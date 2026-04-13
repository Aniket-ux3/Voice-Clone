# =============================================================================
#  Synthetic Voice Studio — Hugging Face Spaces Docker Backend
#  Base image: Python 3.10 slim  |  Port: 7860 (HF Spaces standard)
# =============================================================================

FROM python:3.10-slim

# ── System dependencies ───────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y \
    ffmpeg git curl build-essential libsndfile1 pkg-config \
    libavformat-dev libavcodec-dev libavdevice-dev \
    libavutil-dev libswscale-dev libswresample-dev libavfilter-dev \
    && rm -rf /var/lib/apt/lists/*

# ── Non-root user (required by HF Spaces) ────────────────────────────────────
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TORCH_HOME=/home/user/.cache/torch \
    HF_HOME=/home/user/.cache/huggingface

WORKDIR /home/user/app

# ── Python dependencies ───────────────────────────────────────────────────────
COPY --chown=user requirements_api.txt .
RUN pip install --user --no-cache-dir -r requirements_api.txt

# ── Install AudioSeal + HuggingFace Hub ───────────────────────────────────────
RUN pip install --user --no-cache-dir audioseal huggingface_hub

# ── Clone OpenVoice and install dependencies ──────────────────────────────────
# av 13.x ships a proper manylinux wheel — install it first so OpenVoice
# never tries to build av from source.
RUN git clone https://github.com/myshell-ai/OpenVoice.git OpenVoice && \
    pip install --user --no-cache-dir "av>=13,<14" && \
    pip install --user --no-cache-dir -e OpenVoice --no-deps && \
    pip install --user --no-cache-dir \
        onnxruntime ctranslate2 openai-whisper dtw-python && \
    pip install --user --no-cache-dir --no-deps \
        faster-whisper==0.9.0 wavmark==0.0.3 && \
    pip install --user --no-cache-dir \
        whisper-timestamped==1.14.2

# ── Overwrite se_extractor.py with our patched version ───────────────────────
# Tracked at repo root as se_extractor.py; copied into the OpenVoice clone.
# Key fixes: sentence-level Whisper segmentation + CPU-adaptive model sizing.
COPY --chown=user se_extractor.py OpenVoice/openvoice/se_extractor.py

# ── Download unidic dictionary (MeCab / MeloTTS Japanese) ────────────────────
RUN python -m unidic download

# ── Pre-trust and cache silero-vad ────────────────────────────────────────────
COPY --chown=user cache_silero.py .
RUN python cache_silero.py

# ── Pre-download NLTK data ────────────────────────────────────────────────────
RUN python -c "\
import nltk; \
nltk.download('averaged_perceptron_tagger_eng', quiet=True); \
nltk.download('punkt', quiet=True); \
nltk.download('punkt_tab', quiet=True)"

# ── Pre-download MeloTTS EN_NEWEST model ─────────────────────────────────────
# Bakes the EN_NEWEST (MeloTTS-English-v3) model into the image so first-request
# latency doesn't include a 200 MB download.
RUN python -c "\
from melo.api import TTS; \
print('[BUILD] Pre-downloading MeloTTS EN_NEWEST...'); \
TTS(language='EN_NEWEST', device='cpu'); \
print('[BUILD] MeloTTS EN_NEWEST cached.')" || \
    echo "[BUILD] WARNING: EN_NEWEST pre-download failed -- will download at runtime."

# ── Pre-download BERT into the HF hub cache ──────────────────────────────────
# MeloTTS loads bert-base-uncased at TTS generation time from the HF hub cache.
# Baking it here avoids a 440 MB download on the first request.
# We use snapshot_download to ensure the full model is in the HF cache directory
# (the same path that transformers.from_pretrained will look for at runtime).
RUN python -c "\
from huggingface_hub import snapshot_download; \
print('[BUILD] Pre-downloading BERT into HF cache...'); \
snapshot_download('bert-base-uncased', ignore_patterns=['*.msgpack', '*.h5', 'rust_model.safetensors']); \
print('[BUILD] BERT cached in HF hub.')" || \
    echo "[BUILD] WARNING: BERT pre-download failed -- will download at runtime."

# ── Pre-cache faster-whisper models for both CPU and GPU scenarios ────────────
# tiny  → used automatically when CUDA is unavailable (HF free CPU tier)
# medium → used when CUDA is available (GPU worker or local dev with GPU)
# Baking both means Whisper loads instantly on first request in either scenario.
RUN python -c "\
from faster_whisper import WhisperModel; \
print('[BUILD] Pre-caching Whisper tiny (CPU mode)...'); \
WhisperModel('tiny', device='cpu', compute_type='int8'); \
print('[BUILD] Whisper tiny cached.')" || \
    echo "[BUILD] WARNING: Whisper tiny pre-cache failed."

RUN python -c "\
from faster_whisper import WhisperModel; \
print('[BUILD] Pre-caching Whisper medium (GPU mode)...'); \
WhisperModel('medium', device='cpu', compute_type='int8'); \
print('[BUILD] Whisper medium cached.')" || \
    echo "[BUILD] WARNING: Whisper medium pre-cache failed."

# ── Copy application code ─────────────────────────────────────────────────────
COPY --chown=user api_server.py .
COPY --chown=user download_models.py .

# ── Create runtime temp directories ──────────────────────────────────────────
RUN mkdir -p uploads outputs processed emotions

# ── Expose HF Spaces port ─────────────────────────────────────────────────────
EXPOSE 7860

CMD ["python", "api_server.py"]
