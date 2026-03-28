import os
import torch
import hashlib
import librosa
import base64
from glob import glob
import numpy as np
from pydub import AudioSegment
from faster_whisper import WhisperModel

# ── Pre-trust silero-vad so torch.hub never prompts interactively ─────────────
# In a headless container there is no stdin; the interactive "do you trust?"
# prompt raises EOFError and kills the request.  Writing the entry to
# hub.trusted_list before any call prevents the prompt entirely.
try:
    import torch.hub as _hub
    _trusted = getattr(_hub, 'trusted_list', None)
    if _trusted is not None and 'snakers4/silero-vad' not in _trusted:
        _trusted.append('snakers4/silero-vad')
    # Also set the env-var that newer torch versions check
    os.environ.setdefault('TORCH_HOME', os.path.expanduser('~/.cache/torch'))
except Exception:
    pass

# ── Faster-Whisper model (loaded once, used for whisper-based segmentation) ───
model_size = "medium"
_whisper_model = None


def _get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        _device = "cuda" if torch.cuda.is_available() else "cpu"
        _compute = "float16" if _device == "cuda" else "int8"
        _whisper_model = WhisperModel(model_size, device=_device, compute_type=_compute)
    return _whisper_model


# ── Strategy 1: faster-whisper word-level segmentation ───────────────────────
def split_audio_whisper(audio_path, audio_name, target_dir='processed'):
    model = _get_whisper_model()
    audio = AudioSegment.from_file(audio_path)
    max_len = len(audio)

    target_folder = os.path.join(target_dir, audio_name)
    os.makedirs(target_folder, exist_ok=True)
    wavs_folder = os.path.join(target_folder, 'wavs')
    os.makedirs(wavs_folder, exist_ok=True)

    segments, _ = model.transcribe(audio_path, beam_size=5, word_timestamps=True)
    segments = list(segments)

    s_ind = 0
    start_time = None

    for k, w in enumerate(segments):
        if k == 0:
            start_time = max(0, w.start)
        end_time = w.end

        confidence = (
            sum(s.probability for s in w.words) / len(w.words)
            if w.words else 0.0
        )
        text = w.text.replace('...', '')

        audio_seg = audio[int(start_time * 1000): min(max_len, int(end_time * 1000) + 80)]
        fname = f"{audio_name}_seg{s_ind}.wav"

        save = (
            audio_seg.duration_seconds > 1.5
            and audio_seg.duration_seconds < 20.0
            and 2 <= len(text) < 200
        )
        if save:
            audio_seg.export(os.path.join(wavs_folder, fname), format='wav')

        if k < len(segments) - 1:
            start_time = max(0, segments[k + 1].start - 0.08)
        s_ind += 1

    return wavs_folder


# ── Strategy 2: silero-VAD segmentation (lazy import, pre-trusted) ────────────
def split_audio_vad(audio_path, audio_name, target_dir, split_seconds=10.0):
    from whisper_timestamped.transcribe import get_audio_tensor, get_vad_segments

    SAMPLE_RATE = 16000
    audio_vad = get_audio_tensor(audio_path)
    segments = get_vad_segments(
        audio_vad,
        output_sample=True,
        min_speech_duration=0.1,
        min_silence_duration=1,
        method="silero",
        trusted_source=True,          # skip interactive prompt where supported
    )
    segments = [(seg["start"], seg["end"]) for seg in segments]
    segments = [(float(s) / SAMPLE_RATE, float(e) / SAMPLE_RATE) for s, e in segments]

    audio_active = AudioSegment.silent(duration=0)
    audio = AudioSegment.from_file(audio_path)
    for start_time, end_time in segments:
        audio_active += audio[int(start_time * 1000): int(end_time * 1000)]

    audio_dur = audio_active.duration_seconds
    print(f'after vad: dur = {audio_dur}')

    target_folder = os.path.join(target_dir, audio_name)
    wavs_folder = os.path.join(target_folder, 'wavs')
    os.makedirs(wavs_folder, exist_ok=True)

    num_splits = max(1, int(np.round(audio_dur / split_seconds)))
    interval = audio_dur / num_splits
    start_time = 0.0

    for i in range(num_splits):
        end_time = audio_dur if i == num_splits - 1 else min(start_time + interval, audio_dur)
        audio_seg = audio_active[int(start_time * 1000): int(end_time * 1000)]
        audio_seg.export(f"{wavs_folder}/{audio_name}_seg{i}.wav", format='wav')
        start_time = end_time

    return wavs_folder


# ── Strategy 3: whole-file fallback (no segmentation at all) ─────────────────
def split_audio_whole(audio_path, audio_name, target_dir):
    """Last resort: treat the entire audio as a single segment."""
    target_folder = os.path.join(target_dir, audio_name)
    wavs_folder = os.path.join(target_folder, 'wavs')
    os.makedirs(wavs_folder, exist_ok=True)

    audio = AudioSegment.from_file(audio_path)
    # Trim to max 30 s so the embedding extractor isn't overloaded
    audio = audio[:30_000]
    out = os.path.join(wavs_folder, f"{audio_name}_seg0.wav")
    audio.export(out, format='wav')
    print(f"[se_extractor] whole-file fallback: exported {out}")
    return wavs_folder


# ── Utilities ─────────────────────────────────────────────────────────────────
def hash_numpy_array(audio_path):
    array, _ = librosa.load(audio_path, sr=None, mono=True)
    array_bytes = array.tobytes()
    hash_value = hashlib.sha256(array_bytes).digest()
    return base64.b64encode(hash_value).decode('utf-8')[:16].replace('/', '_^')


# ── Main entry point ──────────────────────────────────────────────────────────
def get_se(audio_path, vc_model, target_dir='processed', vad=True):
    device = vc_model.device
    version = vc_model.version
    print("OpenVoice version:", version)

    audio_name = (
        f"{os.path.basename(audio_path).rsplit('.', 1)[0]}"
        f"_{version}_{hash_numpy_array(audio_path)}"
    )
    se_path = os.path.join(target_dir, audio_name, 'se.pth')

    # Try whisper segmentation first (no interactive prompts, works headless)
    # then VAD, then whole-file as absolute last resort.
    wavs_folder = None

    if not vad:
        try:
            wavs_folder = split_audio_whisper(audio_path, audio_name, target_dir)
        except Exception as e:
            print(f"[se_extractor] whisper segmentation failed: {e}")

    if wavs_folder is None or not glob(f'{wavs_folder}/*.wav'):
        try:
            wavs_folder = split_audio_vad(audio_path, audio_name, target_dir)
        except Exception as e:
            print(f"[se_extractor] VAD segmentation failed: {e}")

    if wavs_folder is None or not glob(f'{wavs_folder}/*.wav'):
        print("[se_extractor] falling back to whole-file strategy")
        wavs_folder = split_audio_whole(audio_path, audio_name, target_dir)

    audio_segs = glob(f'{wavs_folder}/*.wav')
    if not audio_segs:
        raise RuntimeError(
            "Speaker extraction failed: could not produce any audio segments "
            "from the uploaded file. Please upload a clear speech recording."
        )

    return vc_model.extract_se(audio_segs, se_save_path=se_path), audio_name
