from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.nn.utils import weight_norm
from download_models import download_checkpoints
import torchaudio
import torchaudio.transforms as T
import os
import sys
import nltk
from werkzeug.utils import secure_filename
import uuid
import traceback
import shutil
import time

# --- SELF-HEALING DATA DOWNLOADS ---
def download_nltk_resources():
    try:
        nltk.download('averaged_perceptron_tagger_eng', quiet=True)
        nltk.download('punkt', quiet=True)
        nltk.download('punkt_tab', quiet=True)
    except Exception as e:
        print(f"NLTK Download Warning: {e}")

download_nltk_resources()

# --- OPENVOICE V2 MODULE PATH FIX ---
current_dir = os.path.dirname(os.path.abspath(__file__))
openvoice_path = os.path.join(current_dir, 'OpenVoice')

if not os.path.exists(openvoice_path):
    print(f"\n{'='*70}\nERROR: OpenVoice folder not found at {openvoice_path}\n{'='*70}\n")
    sys.exit(1)

api_file = os.path.join(openvoice_path, 'openvoice', 'api.py')
if not os.path.exists(api_file):
    print(f"\n{'='*70}\nERROR: OpenVoice incomplete - missing {api_file}\n{'='*70}\n")
    sys.exit(1)

sys.path.insert(0, openvoice_path)

try:
    from openvoice import se_extractor
    from openvoice.api import ToneColorConverter
    from melo.api import TTS
    from audioseal import AudioSeal
except ImportError as e:
    print(f"\n{'='*70}\nIMPORT ERROR: {e}\n{'='*70}\n")
    traceback.print_exc()
    sys.exit(1)

# Flask app initialization
app = Flask(__name__)

_raw_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:8080,http://localhost:5173,http://127.0.0.1:8080,http://127.0.0.1:5173,http://localhost:7860",
)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

CORS(
    app,
    origins=ALLOWED_ORIGINS,
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Origin", "X-Requested-With"],
    supports_credentials=False,
)

UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'outputs'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['OUTPUT_FOLDER'] = OUTPUT_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

# ── Device selection — dual cuDNN probe ──────────────────────────────────────
def _probe_pytorch_cudnn() -> bool:
    if not torch.cuda.is_available():
        return False
    try:
        conv = weight_norm(
            nn.Conv2d(1, 32, kernel_size=(3, 3), stride=(2, 2), padding=(1, 1))
        ).cuda()
        x = torch.zeros(1, 1, 32, 80, device='cuda')
        with torch.no_grad():
            _ = conv(x)
        torch.cuda.synchronize()
        del conv, x
        torch.cuda.empty_cache()
        print("[DEVICE] Probe A (PyTorch cuDNN): PASSED")
        return True
    except Exception as e:
        print(f"[DEVICE] Probe A (PyTorch cuDNN): FAILED -- {e}")
        return False


def _probe_ctranslate2_cudnn() -> bool:
    try:
        import ctranslate2
    except ImportError:
        print("[DEVICE] Probe B (CTranslate2 cuDNN): skipped -- not installed.")
        return True
    try:
        n = ctranslate2.get_cuda_device_count()
        print(f"[DEVICE] Probe B (CTranslate2 cuDNN): PASSED ({n} device(s))")
        return True
    except Exception as e:
        print(f"[DEVICE] Probe B (CTranslate2 cuDNN): FAILED -- {e}")
        return False


def _select_device() -> str:
    if not torch.cuda.is_available():
        print("[DEVICE] CUDA not available -- using CPU.")
        return "cpu"
    probe_a = _probe_pytorch_cudnn()
    probe_b = _probe_ctranslate2_cudnn()
    if probe_a and probe_b:
        print("[DEVICE] Both cuDNN probes passed -- running on CUDA.")
        return "cuda"
    failing = []
    if not probe_a:
        failing.append("PyTorch cuDNN (cudnn64_8.dll)")
    if not probe_b:
        failing.append("CTranslate2 cuDNN (cudnn_ops_infer64_8.dll)")
    print(f"[DEVICE] cuDNN probe(s) failed: {', '.join(failing)}")
    print("[DEVICE] Falling back to CPU. Install cuDNN 8.x to enable GPU.")
    return "cpu"


device = _select_device()
print(f"[DEVICE] Running on: {device.upper()}")

if device == "cpu" and torch.cuda.is_available():
    os.environ["CUDA_VISIBLE_DEVICES"] = ""
    print("[DEVICE] CUDA_VISIBLE_DEVICES='' -- all ops pinned to CPU.")

TARGET_SR = 22050

# ── Safe error message helper ─────────────────────────────────────────────────
_BACKEND_ERROR_MAP = [
    ("speaker extraction failed",    "Could not extract voice features from the audio sample."),
    ("could not produce any audio",  "No speech segments could be extracted. Please upload a clear speech recording."),
    ("audio too short",              "The audio clip is too short. Please upload at least 5 seconds of clear speech."),
    ("no audio segments",            "No speech was detected. Try a recording with clear, continuous speech."),
    ("tts generation failed",        "Failed to synthesize speech. Please try a shorter script."),
    ("voice conversion failed",      "Voice conversion encountered an error. Try re-uploading the reference audio."),
    ("denoising failed",             "Audio post-processing failed."),
    ("watermark",                    "Watermark embedding failed. Your audio may still be usable."),
    ("model loading failed",         "AI models are still initialising. Please wait a moment and try again."),
    ("failed to preprocess",         "Could not read the uploaded audio file. Please try a WAV or MP3 under 50 MB."),
    ("out of memory",                "The server ran out of memory. Please try a shorter script or smaller audio file."),
    ("cudnn",                        "GPU library (cuDNN) error. The server has fallen back to CPU -- please try again."),
    ("cuda",                         "GPU error encountered. The server has fallen back to CPU -- please try again."),
]

def safe_error(raw: str, fallback: str = "An internal error occurred. Please try again.") -> str:
    low = raw.lower()
    for fragment, message in _BACKEND_ERROR_MAP:
        if fragment in low:
            return message
    if (
        len(raw) < 120
        and "\n" not in raw
        and "traceback" not in low
        and 'file "/' not in low
        and "line " not in low
        and "<" not in raw
    ):
        return raw
    return fallback


# ── Audio I/O helpers ─────────────────────────────────────────────────────────

def preprocess_audio(input_path, output_path):
    """Convert any audio to 22050 Hz mono WAV."""
    try:
        waveform, sr = torchaudio_load(input_path)
        if waveform.shape[0] > 1:
            waveform = torch.mean(waveform, dim=0, keepdim=True)
        if sr != TARGET_SR:
            resampler = T.Resample(orig_freq=sr, new_freq=TARGET_SR)
            waveform = resampler(waveform)
        peak = torch.max(torch.abs(waveform))
        if peak > 0:
            waveform = waveform / peak
        torchaudio_save(output_path, waveform, TARGET_SR)
        return output_path
    except Exception as e:
        print(f"[preprocess_audio] torchaudio path failed: {e}")
        try:
            from pydub import AudioSegment
            audio = AudioSegment.from_file(input_path)
            audio = audio.set_channels(1).set_frame_rate(TARGET_SR)
            audio.export(output_path, format="wav")
            print("[preprocess_audio] pydub fallback succeeded")
            return output_path
        except Exception as e2:
            print(f"[preprocess_audio] pydub also failed: {e2}")
            return None


def torchaudio_load(path):
    """Load audio -- soundfile first, torchaudio second, pydub last resort."""
    try:
        import soundfile as sf
        import numpy as np
        data, sr = sf.read(path, dtype='float32', always_2d=True)
        return torch.from_numpy(data.T), sr
    except Exception:
        pass
    try:
        return torchaudio.load(path)
    except Exception:
        pass
    from pydub import AudioSegment
    import numpy as np
    audio = AudioSegment.from_file(path)
    sr = audio.frame_rate
    samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
    samples /= 2 ** (8 * audio.sample_width - 1)
    samples = samples.reshape(-1, audio.channels).T if audio.channels > 1 else samples.reshape(1, -1)
    return torch.from_numpy(samples), sr


def torchaudio_save(path, waveform, sr):
    """Save WAV -- soundfile first, torchaudio second, pydub last resort."""
    try:
        import soundfile as sf
        sf.write(path, waveform.numpy().T, sr, subtype='PCM_16')
        return
    except Exception:
        pass
    try:
        torchaudio.save(path, waveform, sr)
        return
    except Exception:
        pass
    from pydub import AudioSegment
    import numpy as np
    data = (waveform.numpy().T * 32767).astype(np.int16)
    AudioSegment(
        data.tobytes(), frame_rate=sr, sample_width=2, channels=waveform.shape[0]
    ).export(path, format='wav')


def apply_light_denoising(waveform):
    """Lightweight smoothing -- always CPU to avoid any cuDNN dependency."""
    return F.avg_pool1d(
        waveform.cpu().unsqueeze(0), kernel_size=3, stride=1, padding=1
    ).squeeze(0)


# ── Audio validity check ──────────────────────────────────────────────────────

def _is_valid_audio(path):
    """Return True only if the file is a real audio file (not HTML/corrupt)."""
    if not os.path.exists(path) or os.path.getsize(path) < 1024:
        return False
    try:
        with open(path, 'rb') as f:
            header = f.read(16)
        if header[:4] == b'RIFF':   return True   # WAV
        if header[:3] == b'ID3':    return True   # MP3
        if header[:4] == b'fLaC':  return True   # FLAC
        if header[:4] == b'OggS':  return True   # OGG
        return False
    except Exception:
        return False


# ── Model loading ─────────────────────────────────────────────────────────────

_models_cache = None

def load_models():
    global _models_cache
    if _models_cache is None:
        print("[INFO] Loading models...")
        try:
            ckpt_converter = 'checkpoints_v2/converter'
            converter = ToneColorConverter(f'{ckpt_converter}/config.json', device=device)
            converter.load_ckpt(f'{ckpt_converter}/checkpoint.pth')
            print("[INFO] ✓ ToneColorConverter loaded")

            # EN_NEWEST (MeloTTS-English-v3) is the correct language key for the
            # highest-quality single-speaker model. Its spk2id key is 'EN_NEWEST',
            # which maps to en-newest.pth via speaker_key.lower().replace('_','-').
            # EN_V2 (MeloTTS-English-v2) is a different multi-speaker model that
            # does NOT contain EN-Newest — it silently falls back to EN-US.
            try:
                tts_model = TTS(language='EN_NEWEST', device=device)
                print("[INFO] ✓ MeloTTS EN_NEWEST loaded (en-newest.pth speaker available)")
            except Exception as _tts_err:
                print(f"[INFO] EN_NEWEST unavailable ({_tts_err}), falling back to EN")
                tts_model = TTS(language='EN', device=device)
                print("[INFO] ✓ MeloTTS EN loaded (EN-Default will be used)")

            watermarker = AudioSeal.load_generator("audioseal_wm_16bits").to(device).eval()
            print("[INFO] ✓ AudioSeal watermarker loaded")

            detector = AudioSeal.load_detector("audioseal_detector_16bits").to(device).eval()
            print("[INFO] ✓ AudioSeal detector loaded")

            _models_cache = {
                'converter':   converter,
                'tts_model':   tts_model,
                'watermarker': watermarker,
                'detector':    detector,
            }
            print("[INFO] All models ready!")
        except Exception as e:
            print(f"\n{'='*70}\n[FATAL] Model loading failed: {e}\n{'='*70}\n")
            traceback.print_exc()
            raise RuntimeError("Model loading failed")
    return _models_cache


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route('/', methods=['GET'])
def root():
    html = (
        "<!DOCTYPE html><html><head><title>Voice Clone API</title></head><body>"
        "<h2>Voice Clone API &#x2705;</h2>"
        f"<p>Device: {device.upper()}</p>"
        "<p>Status: Running | <a href='/api/health'>/api/health</a></p>"
        "</body></html>"
    )
    return html, 200, {"Content-Type": "text/html"}


@app.route('/api/<path:path>', methods=['OPTIONS'])
def handle_preflight(path):
    return '', 204


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'device': device,
        'models_loaded': _models_cache is not None,
    })


@app.route('/api/generate', methods=['POST'])
def generate_voice():
    request_id = str(uuid.uuid4())[:8]
    temp_paths = []

    try:
        print(f"\n{'='*70}")
        print(f"[{request_id}] NEW GENERATION REQUEST  (device={device.upper()})")
        print(f"{'='*70}")

        # Validation
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        if 'text' not in request.form:
            return jsonify({'error': 'No text provided'}), 400

        audio_file  = request.files['audio']
        text_script = request.form['text']
        emotion     = request.form.get('emotion', 'neutral')

        if audio_file.filename == '':
            return jsonify({'error': 'Empty filename'}), 400
        if not text_script.strip():
            return jsonify({'error': 'Empty text'}), 400

        print(f"[{request_id}] File: {audio_file.filename}")
        print(f"[{request_id}] Text: {text_script[:60]}...")
        print(f"[{request_id}] Emotion: {emotion}")

        # Save upload
        filename   = secure_filename(audio_file.filename)
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{request_id}_{filename}")
        audio_file.save(input_path)
        temp_paths.append(input_path)
        print(f"[{request_id}] ✓ File saved")

        # Preprocess
        wav_ref = os.path.join(app.config['UPLOAD_FOLDER'], f"{request_id}_normalized.wav")
        temp_paths.append(wav_ref)
        print(f"[{request_id}] Preprocessing audio...")
        if preprocess_audio(input_path, wav_ref) is None:
            return jsonify({'error': 'Failed to preprocess audio - check format'}), 500
        print(f"[{request_id}] ✓ Audio preprocessed")

        # Models
        models      = load_models()
        converter   = models['converter']
        tts_model   = models['tts_model']
        watermarker = models['watermarker']

        # ── Speaker embedding ─────────────────────────────────────────────────
        # get_se() runs Whisper sentence-level segmentation then calls
        # safe_extract_se() which CPU-pins the model for ref_enc, then restores.
        print(f"[{request_id}] Extracting speaker embedding...")
        try:
            target_se, audio_name = se_extractor.get_se(wav_ref, converter, vad=False)
            target_se = target_se.to(device)
            # DO NOT normalize -- the flow network conditioning depends on the
            # raw SE scale. Normalizing destroys scale information and causes
            # the converter to produce a generic/robotic voice regardless of input.
            print(f"[{request_id}] ✓ Speaker embedding extracted (norm={torch.norm(target_se).item():.3f})")
        except Exception as e:
            print(f"[{request_id}] ERROR in speaker extraction: {e}")
            traceback.print_exc()
            return jsonify({
                'error': safe_error(
                    str(e),
                    'Speaker extraction failed. Please upload a clearer audio sample (10-30 s of speech).',
                )
            }), 500

        # ── TTS with emotion-driven prosody ───────────────────────────────────
        print(f"[{request_id}] Generating TTS (emotion={emotion})...")
        base_path = os.path.join(app.config['OUTPUT_FOLDER'], f"{request_id}_base.wav")
        temp_paths.append(base_path)

        EMOTION_PROSODY = {
            # (sdp_ratio, noise_scale, noise_scale_w, speed)
            'neutral': (0.2, 0.6, 0.8, 1.0),
            'happy':   (0.4, 0.8, 0.9, 1.15),
            'sad':     (0.1, 0.4, 0.6, 0.80),
            'angry':   (0.5, 0.9, 1.0, 1.10),
            'jolly':   (0.5, 0.9, 1.0, 1.20),
            'anxious': (0.3, 0.7, 0.9, 1.05),
        }
        sdp, ns, nsw, spd = EMOTION_PROSODY.get(emotion, EMOTION_PROSODY['neutral'])

        # Pick the best available MeloTTS speaker.
        # Priority: EN_NEWEST (single-speaker EN_NEWEST model, key 'EN_NEWEST')
        #           > EN-Default > EN-US > other EN variants.
        # SE filename: speaker_key.lower().replace('_', '-') + '.pth'
        # This matches the official OpenVoice demo_part3.ipynb convention exactly.
        _spk2id = tts_model.hps.data.spk2id
        TTS_SPEAKER = None
        for _candidate in ('EN_NEWEST', 'EN-Newest', 'EN-Default', 'EN-US', 'EN-BR', 'EN-AU', 'EN-IN'):
            if _candidate in _spk2id:
                TTS_SPEAKER = _candidate
                break
        if TTS_SPEAKER is None:
            TTS_SPEAKER = list(_spk2id.keys())[0]  # HParams.keys() is safe; iter() is not

        # SE filename: speaker_key.lower().replace('_', '-') + '.pth'
        # e.g. EN_NEWEST -> en-newest.pth, EN-Default -> en-default.pth
        _se_name = TTS_SPEAKER.lower().replace('_', '-')
        SOURCE_SE_FILE = f'checkpoints_v2/base_speakers/ses/{_se_name}.pth'
        if not os.path.exists(SOURCE_SE_FILE):
            SOURCE_SE_FILE = 'checkpoints_v2/base_speakers/ses/en-default.pth'
            print(f"[{request_id}] source SE for {TTS_SPEAKER} not found, using en-default.pth")

        try:
            speaker_id = _spk2id[TTS_SPEAKER]
            print(f"[{request_id}] TTS speaker: {TTS_SPEAKER}, source SE: {os.path.basename(SOURCE_SE_FILE)}")
            tts_model.tts_to_file(
                text_script, speaker_id, base_path,
                sdp_ratio=sdp, noise_scale=ns, noise_scale_w=nsw,
                speed=spd, quiet=True,
            )
            print(f"[{request_id}] ✓ TTS generated (speaker={TTS_SPEAKER}, sdp={sdp}, speed={spd})")
        except Exception as e:
            print(f"[{request_id}] ERROR in TTS: {e}")
            traceback.print_exc()
            return jsonify({
                'error': safe_error(str(e), 'TTS generation failed. Please try a shorter script (under 200 characters).')
            }), 500

        # ── Voice conversion ──────────────────────────────────────────────────
        print(f"[{request_id}] Applying voice conversion...")
        raw_output = os.path.join(app.config['OUTPUT_FOLDER'], f"{request_id}_raw.wav")
        temp_paths.append(raw_output)
        try:
            source_se = torch.load(SOURCE_SE_FILE, map_location=device).to(device)

            # Norm-match source_se to target_se.
            # The flow network was trained on (src, tgt) SE pairs where both
            # come from the same ReferenceEncoder and have comparable magnitudes.
            # The pre-computed .pth files can have norm ~11 while extracted
            # target SEs are ~8-10. This asymmetry biases the flow inversion
            # and weakens identity transfer. Rescaling fixes the imbalance.
            tgt_norm = torch.norm(target_se).item()
            src_norm = torch.norm(source_se).item()
            if src_norm > 0 and tgt_norm > 0:
                source_se = source_se * (tgt_norm / src_norm)
                print(f"[{request_id}] source_se norm: {src_norm:.3f} -> {tgt_norm:.3f} (matched to target)")

            # ── Emotion style blending ────────────────────────────────────────
            # Use safe_extract_se directly -- bypasses Whisper/VAD segmentation
            # which is inappropriate for short emotion reference clips.
            emotion_wav = os.path.join('emotions', f'{emotion}.wav')
            final_tgt_se = target_se
            if emotion != 'neutral' and _is_valid_audio(emotion_wav):
                try:
                    print(f"[{request_id}] Blending emotion SE: {emotion}")
                    emo_wav_proc = os.path.join(app.config['UPLOAD_FOLDER'], f"{request_id}_emo.wav")
                    temp_paths.append(emo_wav_proc)
                    preprocess_audio(emotion_wav, emo_wav_proc)
                    emo_se = se_extractor.safe_extract_se(converter, [emo_wav_proc])
                    emo_se = emo_se.to(device)
                    tgt_scale = torch.norm(target_se).item()
                    emo_scale = torch.norm(emo_se).item()
                    if emo_scale > 0:
                        emo_se_scaled = emo_se * (tgt_scale / emo_scale)
                        final_tgt_se = 0.75 * target_se + 0.25 * emo_se_scaled
                    print(f"[{request_id}] ✓ Emotion SE blended "
                          f"(tgt_norm={tgt_scale:.3f}, emo_norm={emo_scale:.3f})")
                except Exception as emo_err:
                    print(f"[{request_id}] WARNING: emotion blending skipped ({emo_err})")
                    final_tgt_se = target_se

            # tau = posterior encoder noise scale (reparameterization std dev).
            # 0.3 gives clean, deterministic conversion. Higher values add
            # distortion -- they do NOT increase target-voice influence.
            converter.convert(
                audio_src_path=base_path,
                src_se=source_se,
                tgt_se=final_tgt_se,
                output_path=raw_output,
                tau=0.3,
            )
            print(f"[{request_id}] ✓ Voice converted (tau=0.3)")
        except Exception as e:
            print(f"[{request_id}] ERROR in voice conversion: {e}")
            traceback.print_exc()
            return jsonify({
                'error': safe_error(str(e), 'Voice conversion failed. Try re-uploading the reference audio.')
            }), 500

        # Denoising -- skip on CPU (negligible quality gain, just adds latency)
        if device != 'cpu':
            print(f"[{request_id}] Denoising...")
            try:
                denoised_waveform, raw_sr = torchaudio_load(raw_output)
                denoised_waveform = apply_light_denoising(denoised_waveform)
                torchaudio_save(raw_output, denoised_waveform, raw_sr)
                print(f"[{request_id}] ✓ Denoised")
            except Exception as e:
                print(f"[{request_id}] WARNING: Denoising skipped ({e})")

        # ── Watermarking ──────────────────────────────────────────────────────
        # Watermarking is skipped on CPU — AudioSeal runs 10+ sequential neural
        # network passes per second of audio, which takes 3-5 min on CPU and
        # causes client timeouts. It is a provenance feature only and does not
        # affect voice cloning quality. On GPU it runs in <1s.
        final_path = os.path.join(app.config['OUTPUT_FOLDER'], f"{request_id}_final.wav")
        if device != 'cpu':
            print(f"[{request_id}] Embedding watermark...")
            try:
                wav, sr = torchaudio_load(raw_output)
                wav = wav.to(device)
                with torch.no_grad():
                    wm = watermarker.get_watermark(wav.unsqueeze(0))  # sr arg removed: deprecated in AudioSeal 0.2+
                    final_audio = wav + wm.squeeze(0)
                torchaudio_save(final_path, final_audio.cpu(), sr)
                print(f"[{request_id}] ✓ Watermark embedded")
            except Exception as e:
                print(f"[{request_id}] WARNING: Watermarking failed ({e}), using raw output")
                shutil.copy2(raw_output, final_path)
        else:
            print(f"[{request_id}] Watermarking skipped (CPU mode — would cause timeout)")
            shutil.copy2(raw_output, final_path)

        # ── Cleanup ───────────────────────────────────────────────────────────
        time.sleep(0.3)
        for path in temp_paths:
            try:
                if os.path.exists(path):
                    os.remove(path)
            except Exception as ce:
                print(f"[{request_id}] Cleanup warning: {ce}")

        print(f"[{request_id}] ✅ GENERATION COMPLETE")
        print(f"{'='*70}\n")
        return jsonify({'success': True, 'audio_id': request_id, 'message': 'Voice generated successfully'})

    except Exception as e:
        print(f"\n{'='*70}")
        print(f"[{request_id}] ❌ UNEXPECTED ERROR: {e}")
        traceback.print_exc()
        print(f"{'='*70}\n")
        for path in temp_paths:
            try:
                if os.path.exists(path):
                    os.remove(path)
            except Exception:
                pass
        return jsonify({'error': safe_error(str(e))}), 500


@app.route('/api/download/<audio_id>', methods=['GET'])
def download_audio(audio_id):
    try:
        if not audio_id or not all(c in '0123456789abcdef-' for c in audio_id) or len(audio_id) > 36:
            return jsonify({'error': 'Invalid audio ID'}), 400
        filename = f"{audio_id}_final.wav"
        filepath = os.path.join(app.config['OUTPUT_FOLDER'], filename)
        safe_dir = os.path.realpath(app.config['OUTPUT_FOLDER'])
        if not os.path.realpath(filepath).startswith(safe_dir):
            return jsonify({'error': 'Invalid audio ID'}), 400
        if not os.path.exists(filepath):
            return jsonify({'error': 'Audio file not found or expired'}), 404
        return send_file(filepath, mimetype='audio/wav', as_attachment=True, download_name='generated_voice.wav')
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': safe_error(str(e), 'Failed to download audio.')}), 500


@app.route('/api/authenticate', methods=['POST'])
def authenticate_voice():
    request_id = str(uuid.uuid4())[:8]
    temp_paths = []
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({'error': 'Empty filename'}), 400

        filename   = secure_filename(audio_file.filename)
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{request_id}_{filename}")
        audio_file.save(input_path)
        temp_paths.append(input_path)

        wav_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{request_id}_verify.wav")
        temp_paths.append(wav_path)
        if preprocess_audio(input_path, wav_path) is None:
            return jsonify({'error': 'Failed to preprocess audio'}), 500

        models   = load_models()
        detector = models['detector']

        wav, sr = torchaudio_load(wav_path)
        if wav.shape[0] > 1:
            wav = torch.mean(wav, dim=0, keepdim=True)
        wav = wav.to(device)

        with torch.no_grad():
            result, _ = detector.detect_watermark(wav.unsqueeze(0), sr)
            prob      = result.item()

        is_original = prob <= 0.5
        confidence  = int((1 - prob if is_original else prob) * 100)

        for path in temp_paths:
            try:
                os.remove(path)
            except Exception:
                pass

        return jsonify({'success': True, 'is_original': is_original, 'confidence': confidence, 'probability': prob})

    except Exception as e:
        print(f"[{request_id}] Authentication error: {e}")
        traceback.print_exc()
        for path in temp_paths:
            try:
                if os.path.exists(path):
                    os.remove(path)
            except Exception:
                pass
        return jsonify({'error': safe_error(str(e), 'Voice authentication failed. Please try again.')}), 500


@app.route('/api/emotions', methods=['GET'])
def get_emotions():
    return jsonify([
        {'id': 'neutral', 'label': '😐 Neutral'},
        {'id': 'happy',   'label': '😊 Happy'},
        {'id': 'sad',     'label': '😢 Sad'},
        {'id': 'angry',   'label': '😠 Angry'},
        {'id': 'jolly',   'label': '🎉 Jolly'},
        {'id': 'anxious', 'label': '😰 Anxious'},
    ])


# --- DOWNLOAD CHECKPOINTS (no-op locally if files exist) ---
download_checkpoints()

# --- FORCE MODEL PRELOAD AT STARTUP ---
print("[BOOT] Preloading AI models...")
load_models()
print("[BOOT] Models preloaded successfully!")

# --- VALIDATE & REGENERATE EMOTION WAV FILES ---
def _generate_emotion_wavs():
    """
    Synthesise emotion reference wavs using MeloTTS at startup.
    Skips any wav that is already a valid audio file.
    These are used as SE reference clips for emotion style blending.
    """
    models = load_models()
    tts = models['tts_model']

    EMOTION_PROSODY = {
        'neutral': (0.2, 0.6, 0.8, 1.0),
        'happy':   (0.4, 0.8, 0.9, 1.15),
        'sad':     (0.1, 0.4, 0.6, 0.80),
        'angry':   (0.5, 0.9, 1.0, 1.10),
        'jolly':   (0.5, 0.9, 1.0, 1.20),
        'anxious': (0.3, 0.7, 0.9, 1.05),
    }
    REF_TEXT = (
        "The quick brown fox jumps over the lazy dog. "
        "She sells seashells by the seashore."
    )

    _spk2id = tts.hps.data.spk2id
    TTS_SPEAKER = None
    for _candidate in ('EN_NEWEST', 'EN-Newest', 'EN-Default', 'EN-US', 'EN-BR', 'EN-AU', 'EN-IN'):
        if _candidate in _spk2id:
            TTS_SPEAKER = _candidate
            break
    if TTS_SPEAKER is None:
        TTS_SPEAKER = list(_spk2id.keys())[0]  # HParams.keys() is safe; iter() is not
    speaker_id = _spk2id[TTS_SPEAKER]

    os.makedirs('emotions', exist_ok=True)
    regenerated = []

    for emotion, (sdp, ns, nsw, spd) in EMOTION_PROSODY.items():
        wav_path = os.path.join('emotions', f'{emotion}.wav')
        if _is_valid_audio(wav_path):
            print(f"[BOOT] Emotion wav OK: {emotion}")
            continue
        try:
            print(f"[BOOT] Regenerating emotion wav: {emotion} ...")
            tts.tts_to_file(
                REF_TEXT, speaker_id, wav_path,
                sdp_ratio=sdp, noise_scale=ns, noise_scale_w=nsw,
                speed=spd, quiet=True,
            )
            if _is_valid_audio(wav_path):
                print(f"[BOOT] ✓ Generated: {wav_path}")
                regenerated.append(emotion)
            else:
                print(f"[BOOT] ✗ Output invalid after generation: {wav_path}")
        except Exception as e:
            print(f"[BOOT] ✗ Failed to generate emotion wav for '{emotion}': {e}")

    if regenerated:
        print(f"[BOOT] Regenerated {len(regenerated)} emotion wavs: {', '.join(regenerated)}")
    print("[BOOT] Emotion wav check complete.")


print("[BOOT] Checking emotion reference wavs...")
_generate_emotion_wavs()
print("[BOOT] Startup complete -- server ready.")

if __name__ == '__main__':
    print(f"\n{'='*70}")
    print(f"🚀 Starting Voice Clone API Server")
    print(f"   Device: {device.upper()}")
    PORT = int(os.environ.get("PORT", 7860))
    print(f"   URL: http://localhost:{PORT}")
    print(f"{'='*70}\n")
    app.run(
        host='0.0.0.0',
        port=PORT,
        debug=False,
        use_reloader=False,
        threaded=True,
    )
