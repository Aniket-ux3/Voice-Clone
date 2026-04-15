import os
import sys
import torch
import hashlib
import librosa
import base64
from glob import glob
import numpy as np
from pydub import AudioSegment

# ── CRITICAL: Force CTranslate2 to CPU BEFORE importing faster_whisper ────────
_original_cuda_devices = os.environ.get("CUDA_VISIBLE_DEVICES", None)
os.environ["CUDA_VISIBLE_DEVICES"] = ""
print("[se_extractor] CUDA_VISIBLE_DEVICES='' set -- CTranslate2 will use CPU only.")

from faster_whisper import WhisperModel

if _original_cuda_devices is not None:
    os.environ["CUDA_VISIBLE_DEVICES"] = _original_cuda_devices
else:
    del os.environ["CUDA_VISIBLE_DEVICES"]
print("[se_extractor] CUDA_VISIBLE_DEVICES restored for PyTorch models.")

# ── Pre-trust silero-vad ──────────────────────────────────────────────────────
try:
    import torch.hub as _hub
    _trusted = getattr(_hub, 'trusted_list', None)
    if _trusted is not None and 'snakers4/silero-vad' not in _trusted:
        _trusted.append('snakers4/silero-vad')
    os.environ.setdefault('TORCH_HOME', os.path.expanduser('~/.cache/torch'))
except Exception:
    pass

# ── Faster-Whisper model size ─────────────────────────────────────────────────
# On CPU (HF Spaces free tier): use 'tiny' -- 39 MB, loads in ~2s, good enough
# for speech segmentation which only needs boundary detection, not transcription.
# On GPU or overridden via env var: use the specified size (default 'medium').
# The Dockerfile pre-caches both 'tiny' and 'medium' at build time.
_is_cpu_only = not torch.cuda.is_available()
model_size = os.environ.get("WHISPER_MODEL", "tiny" if _is_cpu_only else "medium")
print(f"[se_extractor] Whisper model size: {model_size} ({'CPU mode' if _is_cpu_only else 'GPU mode'})")

_whisper_model = None


def _get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        saved = os.environ.get("CUDA_VISIBLE_DEVICES", None)
        os.environ["CUDA_VISIBLE_DEVICES"] = ""
        try:
            print(f"[se_extractor] Loading Whisper model ({model_size}) -- CPU/int8...")
            _whisper_model = WhisperModel(model_size, device="cpu", compute_type="int8")
            print("[se_extractor] ✓ Whisper model loaded")
        finally:
            if saved is not None:
                os.environ["CUDA_VISIBLE_DEVICES"] = saved
            elif "CUDA_VISIBLE_DEVICES" in os.environ:
                del os.environ["CUDA_VISIBLE_DEVICES"]
    return _whisper_model


# ── cuDNN-safe extract_se ─────────────────────────────────────────────────────
def safe_extract_se(vc_model, ref_wav_list, se_save_path=None):
    """
    CPU-safe wrapper around vc_model.extract_se().
    Pins model + device string to CPU, calls extract_se, then restores both.
    Also used directly for short reference clips (e.g. emotion wavs) that
    should NOT go through the Whisper/VAD segmentation pipeline.
    """
    original_device = str(vc_model.device)
    on_cuda = original_device.startswith("cuda")

    if on_cuda:
        print("[se_extractor] CPU-pinning model+device for extract_se...")
        try:
            vc_model.model  = vc_model.model.cpu()
            vc_model.device = "cpu"
        except Exception as move_err:
            print(f"[se_extractor] WARNING: could not move model to CPU: {move_err}")
            on_cuda = False

    try:
        result = vc_model.extract_se(ref_wav_list, se_save_path=se_save_path)
        print("[se_extractor] ✓ extract_se completed on CPU")
    finally:
        if on_cuda:
            try:
                vc_model.model  = vc_model.model.to(original_device)
                vc_model.device = original_device
                print(f"[se_extractor] Model restored to {original_device}")
            except Exception as restore_err:
                print(f"[se_extractor] WARNING: could not restore model: {restore_err}")

    return result


# Short-sample threshold: if total speech is under this many seconds, loop the
# audio to give the ReferenceEncoder enough material to build a clean embedding.
# The ref_enc receptive field benefits from at least 6-8 s of input.
_MIN_SE_SECONDS = 6.0
_MAX_LOOP_COPIES = 4   # never loop more than 4x (caps at ~24 s for a 6 s clip)


def _pad_short_audio(audio: AudioSegment) -> AudioSegment:
    """
    If `audio` is shorter than _MIN_SE_SECONDS, tile it (loop) up to
    _MAX_LOOP_COPIES times until it meets the threshold or the cap is reached.
    A short cross-fade of 30 ms is applied at each join to avoid click artefacts.
    """
    if audio.duration_seconds >= _MIN_SE_SECONDS:
        return audio
    xfade = 30  # ms cross-fade at each loop join
    result = audio
    copies = 1
    while result.duration_seconds < _MIN_SE_SECONDS and copies < _MAX_LOOP_COPIES:
        result = result.append(audio, crossfade=xfade)
        copies += 1
    print(f"[se_extractor] short-sample pad: {audio.duration_seconds:.1f}s "
          f"-> {result.duration_seconds:.1f}s ({copies}x loop)")
    return result


# ── Strategy 1: faster-whisper SENTENCE-level segmentation ───────────────────
def split_audio_whisper(audio_path, audio_name, target_dir='processed'):
    """
    Segment audio into sentence-level chunks for SE extraction.

    CRITICAL FIX: We now iterate over SEGMENTS (sentences/phrases), NOT words.
    The original code used word_timestamps=True and iterated over individual
    words (~0.3s each), which were always rejected by the >1.5s duration filter.
    This caused fallback to the whole-file strategy for almost every clip,
    especially short ones like male voice samples, producing poor SE embeddings
    where all male voices collapsed to nearly identical outputs (measured at
    0.992 MFCC cosine similarity between completely different speakers).

    Sentence-level segments are typically 2-10s and reliably pass the filter,
    giving the ReferenceEncoder diverse, clean speech chunks to build a
    distinctive speaker embedding from.

    Short-sample improvement: if total accepted speech < _MIN_SE_SECONDS, each
    segment is individually looped via _pad_short_audio() before export, so the
    ReferenceEncoder always receives at least 6 s of audio per chunk.
    """
    saved = os.environ.get("CUDA_VISIBLE_DEVICES", None)
    os.environ["CUDA_VISIBLE_DEVICES"] = ""
    try:
        model = _get_whisper_model()
        audio = AudioSegment.from_file(audio_path)
        max_len = len(audio)
        total_dur = audio.duration_seconds

        target_folder = os.path.join(target_dir, audio_name)
        os.makedirs(target_folder, exist_ok=True)
        wavs_folder = os.path.join(target_folder, 'wavs')
        os.makedirs(wavs_folder, exist_ok=True)

        # Transcribe at SEGMENT level -- each segment is a sentence or phrase.
        # word_timestamps=False is the critical change that fixes the bug.
        segments, _ = model.transcribe(audio_path, beam_size=5, word_timestamps=False)
        segments = list(segments)
        print(f"[se_extractor] Whisper produced {len(segments)} sentence segment(s) "
              f"(total dur={total_dur:.1f}s)")

        # For very short clips (< _MIN_SE_SECONDS) Whisper may produce 0 or 1
        # segments. Lower the floor to 0.5 s so we accept everything audible.
        min_dur = 0.5 if total_dur < _MIN_SE_SECONDS else 1.0

        exported = 0
        for k, seg in enumerate(segments):
            start_ms = max(0, int(seg.start * 1000) - 80)
            end_ms   = min(max_len, int(seg.end * 1000) + 80)
            audio_seg = audio[start_ms:end_ms]
            text = seg.text.strip().replace('...', '')

            save = (
                audio_seg.duration_seconds >= min_dur
                and audio_seg.duration_seconds <= 25.0
                and len(text) >= 1
            )
            if save:
                # Pad short segments so ref_enc gets enough material
                audio_seg = _pad_short_audio(audio_seg)
                fname = f"{audio_name}_seg{exported}.wav"
                audio_seg.export(os.path.join(wavs_folder, fname), format='wav')
                exported += 1
                print(f"[se_extractor]   seg{exported}: {audio_seg.duration_seconds:.1f}s"
                      f" -- '{text[:60]}'")

        print(f"[se_extractor] {exported}/{len(segments)} segments accepted")
        return wavs_folder
    finally:
        if saved is not None:
            os.environ["CUDA_VISIBLE_DEVICES"] = saved
        elif "CUDA_VISIBLE_DEVICES" in os.environ:
            del os.environ["CUDA_VISIBLE_DEVICES"]


# ── Strategy 2: silero-VAD segmentation ──────────────────────────────────────
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
        trusted_source=True,
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


# ── Strategy 3: whole-file fallback ──────────────────────────────────────────
def split_audio_whole(audio_path, audio_name, target_dir):
    """Last resort: treat the entire audio as one segment (max 30 s).

    Also pads the clip to _MIN_SE_SECONDS via looping so that even a 2-3 s
    sample gives the ReferenceEncoder a usable amount of speech.
    """
    target_folder = os.path.join(target_dir, audio_name)
    wavs_folder = os.path.join(target_folder, 'wavs')
    os.makedirs(wavs_folder, exist_ok=True)

    audio = AudioSegment.from_file(audio_path)
    audio = audio[:30_000]          # hard cap at 30 s
    audio = _pad_short_audio(audio) # loop if < _MIN_SE_SECONDS
    out = os.path.join(wavs_folder, f"{audio_name}_seg0.wav")
    audio.export(out, format='wav')
    print(f"[se_extractor] whole-file fallback: exported {out} "
          f"({audio.duration_seconds:.1f}s)")
    return wavs_folder


# ── Utilities ─────────────────────────────────────────────────────────────────
def hash_numpy_array(audio_path):
    array, _ = librosa.load(audio_path, sr=None, mono=True)
    array_bytes = array.tobytes()
    hash_value = hashlib.sha256(array_bytes).digest()
    return base64.b64encode(hash_value).decode('utf-8')[:16].replace('/', '_^')


# ── Main entry point ──────────────────────────────────────────────────────────
def get_se(audio_path, vc_model, target_dir='processed', vad=True):
    version = vc_model.version
    print("OpenVoice version:", version)

    audio_name = (
        f"{os.path.basename(audio_path).rsplit('.', 1)[0]}"
        f"_{version}_{hash_numpy_array(audio_path)}"
    )
    se_path = os.path.join(target_dir, audio_name, 'se.pth')

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
            "Speaker extraction failed: no audio segments could be produced. "
            "Please upload a clear speech recording (10-30 s recommended)."
        )

    # Pins model+device to CPU -> runs ref_enc on CPU -> restores to CUDA
    se = safe_extract_se(vc_model, audio_segs, se_save_path=se_path)
    return se, audio_name
