from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import torch
from download_models import download_checkpoints
import torch.nn.functional as F
import torchaudio
import torchaudio.transforms as T
import os
import sys
import nltk
from werkzeug.utils import secure_filename
import uuid
import traceback

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

# Read allowed origins from env var so the production Vercel URL is accepted.
# Format: comma-separated list, e.g.
#   ALLOWED_ORIGINS="https://your-app.vercel.app,http://localhost:8080"
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

# Configure folders
UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'outputs'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['OUTPUT_FOLDER'] = OUTPUT_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

device = "cuda" if torch.cuda.is_available() else "cpu"

TARGET_SR = 22050

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
        torchaudio.save(output_path, waveform, TARGET_SR)
        return output_path
    except Exception as e:
        print(f"[preprocess_audio] torchaudio failed: {e}")
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
    """Load a WAV with torchaudio, falling back to soundfile then pydub.
    Newer torchaudio (>=2.5) requires torchcodec which is not installed;
    soundfile handles plain WAV files just fine on all platforms."""
    try:
        return torchaudio.load(path)
    except Exception:
        pass
    try:
        import soundfile as sf
        import numpy as np
        data, sr = sf.read(path, dtype='float32', always_2d=True)
        # soundfile returns (samples, channels); torch wants (channels, samples)
        waveform = torch.from_numpy(data.T)
        return waveform, sr
    except Exception:
        pass
    # Last resort: pydub → numpy
    from pydub import AudioSegment
    import numpy as np
    audio = AudioSegment.from_file(path)
    sr = audio.frame_rate
    samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
    samples /= 2 ** (8 * audio.sample_width - 1)   # normalise to [-1, 1]
    if audio.channels > 1:
        samples = samples.reshape(-1, audio.channels).T
    else:
        samples = samples.reshape(1, -1)
    return torch.from_numpy(samples), sr


def apply_light_denoising(waveform):
    """Light smoothing filter."""
    return F.avg_pool1d(waveform.unsqueeze(0), kernel_size=3, stride=1, padding=1).squeeze(0)

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

            tts_model = TTS(language='EN', device=device)
            print("[INFO] ✓ MeloTTS loaded")
            
            watermarker = AudioSeal.load_generator("audioseal_wm_16bits").to(device).eval()
            print("[INFO] ✓ AudioSeal watermarker loaded")
            
            detector = AudioSeal.load_detector("audioseal_detector_16bits").to(device).eval()
            print("[INFO] ✓ AudioSeal detector loaded")

            _models_cache = {
                'converter': converter,
                'tts_model': tts_model,
                'watermarker': watermarker,
                'detector': detector,
            }
            print("[INFO] All models ready!")
        except Exception as e:
            print(f"\n{'='*70}\n[FATAL] Model loading failed: {e}\n{'='*70}\n")
            traceback.print_exc()
            raise RuntimeError("Model loading failed")
    return _models_cache

@app.route('/api/<path:path>', methods=['OPTIONS'])
def handle_preflight(path):
    return '', 204

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'device': device, 'models_loaded': _models_cache is not None})

@app.route('/api/generate', methods=['POST'])
def generate_voice():
    request_id = str(uuid.uuid4())[:8]
    try:
        print(f"\n{'='*70}")
        print(f"[{request_id}] NEW GENERATION REQUEST")
        print(f"{'='*70}")

        # Input validation
        if 'audio' not in request.files:
            print(f"[{request_id}] ERROR: No audio file in request")
            return jsonify({'error': 'No audio file provided'}), 400
        if 'text' not in request.form:
            print(f"[{request_id}] ERROR: No text in request")
            return jsonify({'error': 'No text provided'}), 400

        audio_file = request.files['audio']
        text_script = request.form['text']
        emotion = request.form.get('emotion', 'neutral')

        if audio_file.filename == '':
            return jsonify({'error': 'Empty filename'}), 400
        if not text_script.strip():
            return jsonify({'error': 'Empty text'}), 400

        print(f"[{request_id}] File: {audio_file.filename}")
        print(f"[{request_id}] Text: {text_script[:50]}...")
        print(f"[{request_id}] Emotion: {emotion}")

        # Save upload
        filename = secure_filename(audio_file.filename)
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{request_id}_{filename}")
        audio_file.save(input_path)
        print(f"[{request_id}] ✓ File saved: {input_path}")

        # Preprocess
        wav_ref = os.path.join(app.config['UPLOAD_FOLDER'], f"{request_id}_normalized.wav")
        print(f"[{request_id}] Preprocessing audio...")
        if preprocess_audio(input_path, wav_ref) is None:
            print(f"[{request_id}] ERROR: Audio preprocessing failed")
            return jsonify({'error': 'Failed to preprocess audio - check format'}), 500
        print(f"[{request_id}] ✓ Audio preprocessed")

        # Load models
        print(f"[{request_id}] Loading models...")
        models = load_models()
        converter = models['converter']
        tts_model = models['tts_model']
        watermarker = models['watermarker']
        print(f"[{request_id}] ✓ Models loaded")

        # Extract speaker embedding
        print(f"[{request_id}] Extracting speaker embedding...")
        try:
            # vad=False → tries faster-whisper segmentation first (no interactive
            # stdin prompts), then auto-falls back to VAD, then whole-file.
            target_se, audio_name = se_extractor.get_se(wav_ref, converter, vad=False)
            target_se = target_se.to(device)
            norm = torch.norm(target_se)
            if norm > 0:
                target_se = target_se / norm
            print(f"[{request_id}] ✓ Speaker embedding extracted")
        except Exception as e:
            print(f"[{request_id}] ERROR in speaker extraction: {e}")
            traceback.print_exc()
            return jsonify({'error': f'Speaker extraction failed: {str(e)}'}), 500

        # Generate TTS
        print(f"[{request_id}] Generating TTS...")
        try:
            speaker_id = tts_model.hps.data.spk2id['EN-Default']
            base_path = os.path.join(app.config['OUTPUT_FOLDER'], f"{request_id}_base.wav")
            tts_model.tts_to_file(text_script, speaker_id, base_path, sdp_ratio=0.2, noise_scale=0.6, noise_scale_w=0.8, speed=0.9, quiet=True)
            print(f"[{request_id}] ✓ TTS generated")
        except Exception as e:
            print(f"[{request_id}] ERROR in TTS: {e}")
            traceback.print_exc()
            return jsonify({'error': f'TTS generation failed: {str(e)}'}), 500

        # Voice conversion
        print(f"[{request_id}] Applying voice conversion...")
        try:
            source_se = torch.load('checkpoints_v2/base_speakers/ses/en-default.pth', map_location=device).to(device)
            raw_output = os.path.join(app.config['OUTPUT_FOLDER'], f"{request_id}_raw.wav")
            converter.convert(audio_src_path=base_path, src_se=source_se, tgt_se=target_se, output_path=raw_output, tau=0.3)
            print(f"[{request_id}] ✓ Voice converted")
        except Exception as e:
            print(f"[{request_id}] ERROR in voice conversion: {e}")
            traceback.print_exc()
            return jsonify({'error': f'Voice conversion failed: {str(e)}'}), 500

        # Denoising
        print(f"[{request_id}] Denoising...")
        try:
            denoised_waveform, raw_sr = torchaudio_load(raw_output)
            denoised_waveform = apply_light_denoising(denoised_waveform.to(device)).cpu()
            torchaudio.save(raw_output, denoised_waveform, raw_sr)
            print(f"[{request_id}] ✓ Denoised")
        except Exception as e:
            print(f"[{request_id}] ERROR in denoising: {e}")
            traceback.print_exc()
            return jsonify({'error': f'Denoising failed: {str(e)}'}), 500

        # Watermarking
        print(f"[{request_id}] Embedding watermark...")
        try:
            wav, sr = torchaudio_load(raw_output)
            wav = wav.to(device)
            with torch.no_grad():
                wav_batch = wav.unsqueeze(0)
                wm = watermarker.get_watermark(wav_batch, sr)
                final_audio = wav + wm.squeeze(0)
            final_path = os.path.join(app.config['OUTPUT_FOLDER'], f"{request_id}_final.wav")
            torchaudio.save(final_path, final_audio.cpu(), sr)
            print(f"[{request_id}] ✓ Watermark embedded")
        except Exception as e:
            print(f"[{request_id}] ERROR in watermarking: {e}")
            traceback.print_exc()
            return jsonify({'error': f'Watermarking failed: {str(e)}'}), 500

        # Cleanup
        import time
        time.sleep(0.5)
        for path in [input_path, wav_ref, base_path, raw_output]:
            try:
                if os.path.exists(path):
                    os.remove(path)
            except Exception as e:
                print(f"[{request_id}] Cleanup warning: {e}")

        print(f"[{request_id}] ✅ GENERATION COMPLETE")
        print(f"{'='*70}\n")

        return jsonify({'success': True, 'audio_id': request_id, 'message': 'Voice generated successfully'})

    except Exception as e:
        print(f"\n{'='*70}")
        print(f"[{request_id}] ❌ UNEXPECTED ERROR: {e}")
        print(f"{'='*70}")
        traceback.print_exc()
        print(f"{'='*70}\n")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/download/<audio_id>', methods=['GET'])
def download_audio(audio_id):
    try:
        filename = f"{audio_id}_final.wav"
        filepath = os.path.join(app.config['OUTPUT_FOLDER'], filename)
        if not os.path.exists(filepath):
            return jsonify({'error': 'Audio file not found'}), 404
        return send_file(filepath, mimetype='audio/wav', as_attachment=True, download_name='generated_voice.wav')
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/authenticate', methods=['POST'])
def authenticate_voice():
    request_id = str(uuid.uuid4())[:8]
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({'error': 'Empty filename'}), 400

        filename = secure_filename(audio_file.filename)
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{request_id}_{filename}")
        audio_file.save(input_path)

        wav_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{request_id}_verify.wav")
        if preprocess_audio(input_path, wav_path) is None:
            return jsonify({'error': 'Failed to preprocess audio'}), 500

        models = load_models()
        detector = models['detector']

        wav, sr = torchaudio_load(wav_path)
        if wav.shape[0] > 1:
            wav = torch.mean(wav, dim=0, keepdim=True)
        wav = wav.to(device)

        with torch.no_grad():
            wav_batch = wav.unsqueeze(0)
            result, _ = detector.detect_watermark(wav_batch, sr)
            prob = result.item()

        is_original = prob <= 0.5
        confidence = int((1 - prob if is_original else prob) * 100)

        for path in [input_path, wav_path]:
            try:
                os.remove(path)
            except:
                pass

        return jsonify({'success': True, 'is_original': is_original, 'confidence': confidence, 'probability': prob})

    except Exception as e:
        print(f"[{request_id}] Authentication error: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/emotions', methods=['GET'])
def get_emotions():
    return jsonify([
        {'id': 'neutral', 'label': '😐 Neutral'},
        {'id': 'happy', 'label': '😊 Happy'},
        {'id': 'sad', 'label': '😢 Sad'},
        {'id': 'angry', 'label': '😠 Angry'},
        {'id': 'jolly', 'label': '🎉 Jolly'},
        {'id': 'anxious', 'label': '😰 Anxious'},
    ])

# --- DOWNLOAD CHECKPOINTS (no-op locally if files exist) ---
download_checkpoints()

# --- FORCE MODEL PRELOAD AT STARTUP ---
print("[BOOT] Preloading AI models...")
load_models()
print("[BOOT] Models preloaded successfully!")

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
        threaded=True
    )
