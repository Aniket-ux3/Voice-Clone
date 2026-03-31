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
#
# The root cause of ECONNRESET crashes:
#   CTranslate2 (faster-whisper's backend) has a lazy-load mechanism for its
#   CUDA kernels. Even when you specify device="cpu" in WhisperModel(), if
#   CTranslate2 detects a CUDA device in the environment, it may attempt to
#   load CUDA kernel libraries (including cudnn_ops_infer64_8.dll) at
#   transcribe() time — not at model load time. This is a C-level DLL load
#   that happens outside Python's exception handling. When the DLL is missing,
#   it raises a Windows SEH exception / Linux signal that kills the OS thread.
#   Python's `except Exception` cannot catch this. The thread dies silently,
#   the socket is dropped, and the client sees ECONNRESET.
#
# THE ONLY RELIABLE FIX:
#   Set CUDA_VISIBLE_DEVICES="" in the environment BEFORE ctranslate2/
#   faster_whisper is imported. This makes CTranslate2 see zero CUDA devices
#   and completely bypasses its CUDA code path. The WhisperModel then runs
#   purely on CPU with no DLL loading risk.
#
#   We set this here (module level, before the import) and NOT in api_server.py
#   because api_server.py imports this module, so the env var is set before
#   ctranslate2 is imported anywhere in the process.
#
_original_cuda_devices = os.environ.get("CUDA_VISIBLE_DEVICES", None)
os.environ["CUDA_VISIBLE_DEVICES"] = ""
print("[se_extractor] CUDA_VISIBLE_DEVICES='' set — CTranslate2 will use CPU only.")

from faster_whisper import WhisperModel

# Restore CUDA_VISIBLE_DEVICES so PyTorch models (converter, TTS, AudioSeal)
# can still use GPU after the import is complete.
if _original_cuda_devices is not None:
    os.environ["CUDA_VISIBLE_DEVICES"] = _original_cuda_devices
else:
    del os.environ["CUDA_VISIBLE_DEVICES"]
print("[se_extractor] CUDA_VISIBLE_DEVICES restored for PyTorch models.")

# ── Pre-trust silero-vad so torch.hub never prompts interactively ─────────────
try:
    import torch.hub as _hub
    _trusted = getattr(_hub, 'trusted_list', None)
    if _trusted is not None and 'snakers4/silero-vad' not in _trusted:
        _trusted.append('snakers4/silero-vad')
    os.environ.setdefault('TORCH_HOME', os.path.expanduser('~/.cache/torch'))
except Exception:
    pass

# ── Faster-Whisper — ALWAYS CPU/int8 ─────────────────────────────────────────
model_size = "medium"
_whisper_model = None


def _get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        # Extra safety: temporarily hide CUDA while loading the model too
        saved = os.environ.get("CUDA_VISIBLE_DEVICES", None)
        os.environ["CUDA_VISIBLE_DEVICES"] = ""
        try:
            print("[se_extractor] Loading Whisper model — CPU/int8...")
            _whisper_model = WhisperModel(model_size, device="cpu", compute_type="int8")
            print("[se_extractor] ✓ Whisper model loaded")
        finally:
            if saved is not None:
                os.environ["CUDA_VISIBLE_DEVICES"] = saved
            elif "CUDA_VISIBLE_DEVICES" in os.environ:
                del os.environ["CUDA_VISIBLE_DEVICES"]
    return _whisper_model


# ── cuDNN-safe extract_se ─────────────────────────────────────────────────────
#
# ToneColorConverter.extract_se() does:
#
#   device = self.device          # copies the string, e.g. "cuda"
#   y = y.to(device)              # tensor goes to CUDA
#   g = self.model.ref_enc(y...)  # Conv2d + weight_norm → cuDNN
#
# We must patch BOTH vc_model.model AND vc_model.device before the call,
# because extract_se reads `device = self.device` into a local variable —
# moving just the nn.Module is not enough.
#
def safe_extract_se(vc_model, ref_wav_list, se_save_path=None):
    """
    CPU-safe wrapper around vc_model.extract_se().
    Pins model + device string to CPU, calls extract_se, then restores both.
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


# ── Strategy 1: faster-whisper word-level segmentation ───────────────────────
def split_audio_whisper(audio_path, audio_name, target_dir='processed'):
    # Hide CUDA during transcription as belt-and-suspenders
    saved = os.environ.get("CUDA_VISIBLE_DEVICES", None)
    os.environ["CUDA_VISIBLE_DEVICES"] = ""
    try:
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
    """Last resort: treat the entire audio as one segment (max 30 s)."""
    target_folder = os.path.join(target_dir, audio_name)
    wavs_folder = os.path.join(target_folder, 'wavs')
    os.makedirs(wavs_folder, exist_ok=True)

    audio = AudioSegment.from_file(audio_path)
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
            "Please upload a clear speech recording (10–30 s recommended)."
        )

    # Pins model+device to CPU → runs ref_enc on CPU → restores to CUDA
    se = safe_extract_se(vc_model, audio_segs, se_save_path=se_path)
    return se, audio_name
