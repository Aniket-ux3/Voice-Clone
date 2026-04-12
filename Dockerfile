# ─────────────────────────────────────────────────────────────────────────────
#  Synthetic Voice Studio — Hugging Face Spaces Docker Backend
#  Base image: Python 3.10 slim
#  Port: 7860 (HF Spaces standard)
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.10-slim

# ── System dependencies ───────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    curl \
    build-essential \
    libsndfile1 \
    pkg-config \
    libavformat-dev \
    libavcodec-dev \
    libavdevice-dev \
    libavutil-dev \
    libswscale-dev \
    libswresample-dev \
    libavfilter-dev \
    && rm -rf /var/lib/apt/lists/*

# ── Non-root user (required by Hugging Face Spaces) ───────────────────────────
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TORCH_HOME=/home/user/.cache/torch

WORKDIR /home/user/app

# ── Python dependencies ───────────────────────────────────────────────────────
COPY --chown=user requirements_api.txt .
RUN pip install --user --no-cache-dir -r requirements_api.txt

# ── Install AudioSeal + HuggingFace Hub ───────────────────────────────────────
RUN pip install --user --no-cache-dir audioseal huggingface_hub

# ── Clone and install OpenVoice V2 ────────────────────────────────────────────
# av 10.x has no pre-built wheel and fails to compile with newer Cython.
# av 13.x ships a proper manylinux wheel — install it first so OpenVoice
# never tries to build av from source.
RUN git clone https://github.com/myshell-ai/OpenVoice.git OpenVoice && \
    pip install --user --no-cache-dir "av>=13,<14" && \
    pip install --user --no-cache-dir -e OpenVoice --no-deps && \
    pip install --user --no-cache-dir \
        onnxruntime \
        ctranslate2 \
        openai-whisper \
        dtw-python && \
    pip install --user --no-cache-dir --no-deps \
        faster-whisper==0.9.0 \
        wavmark==0.0.3 && \
    pip install --user --no-cache-dir \
        whisper-timestamped==1.14.2

# ── Overwrite se_extractor.py with our patched version ───────────────────────
# se_extractor.py is tracked at the repo root as se_extractor.py and copied
# into the freshly-cloned OpenVoice tree. This keeps our patch in git without
# needing to vendor the entire OpenVoice source.
# Key fix: sentence-level segmentation (word_timestamps=False) instead of
# word-level, which caused voice embeddings to collapse for short clips.
COPY --chown=user se_extractor.py OpenVoice/openvoice/se_extractor.py

# ── Download unidic dictionary (required by MeCab / MeloTTS Japanese) ────────
RUN python -m unidic download

# ── Pre-trust and cache silero-vad so runtime never gets an interactive prompt ──
COPY --chown=user cache_silero.py .
RUN python cache_silero.py

# ── Pre-download NLTK data ────────────────────────────────────────────────────
RUN python -c "\
import nltk; \
nltk.download('averaged_perceptron_tagger_eng', quiet=True); \
nltk.download('punkt', quiet=True); \
nltk.download('punkt_tab', quiet=True)"

# ── Pre-download MeloTTS EN_NEWEST model ─────────────────────────────────────
# EN_NEWEST (myshell-ai/MeloTTS-English-v3) is the highest-quality English TTS
# speaker used for voice conversion. Downloading at build time avoids a cold-
# start delay of ~200MB on the first request in production.
# Falls back silently if the download fails (network issues during build).
RUN python -c "\
from melo.api import TTS; \
import sys; \
print('[BUILD] Pre-downloading MeloTTS EN_NEWEST...'); \
TTS(language='EN_NEWEST', device='cpu'); \
print('[BUILD] MeloTTS EN_NEWEST cached.')" || \
    echo "[BUILD] WARNING: EN_NEWEST pre-download failed — will download at runtime."

# ── Pre-download BERT model used by MeloTTS ──────────────────────────────────
# MeloTTS loads bert-base-uncased on first TTS call. Baking it into the image
# avoids a 440 MB download on the first request.
RUN python -c "\
from transformers import BertForMaskedLM, AutoTokenizer; \
print('[BUILD] Pre-downloading BERT for MeloTTS...'); \
AutoTokenizer.from_pretrained('bert-base-uncased'); \
BertForMaskedLM.from_pretrained('bert-base-uncased'); \
print('[BUILD] BERT cached.')" || \
    echo "[BUILD] WARNING: BERT pre-download failed — will download at runtime."

# ── Copy application code ─────────────────────────────────────────────────────
COPY --chown=user api_server.py .
COPY --chown=user download_models.py .

# ── Create temp directories ───────────────────────────────────────────────────
RUN mkdir -p uploads outputs processed emotions

# ── Expose HF Spaces port ─────────────────────────────────────────────────────
EXPOSE 7860

CMD ["python", "api_server.py"]
