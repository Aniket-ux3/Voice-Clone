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
    PYTHONDONTWRITEBYTECODE=1

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
# se_extractor_patched.py lives at the repo root (tracked by git) and is
# copied over the freshly-cloned upstream file inside the container.
COPY --chown=user se_extractor_patched.py OpenVoice/openvoice/se_extractor.py

# ── Download unidic dictionary (required by MeCab / MeloTTS Japanese) ────────
# unidic ships as an empty package; the actual dictionary must be downloaded
# separately with `python -m unidic download` before MeCab can initialise.
RUN python -m unidic download

# ── Pre-download NLTK data ────────────────────────────────────────────────────
RUN python -c "\
import nltk; \
nltk.download('averaged_perceptron_tagger_eng', quiet=True); \
nltk.download('punkt', quiet=True); \
nltk.download('punkt_tab', quiet=True)"

# ── Copy application code ─────────────────────────────────────────────────────
COPY --chown=user api_server.py .
COPY --chown=user download_models.py .

# ── Create temp directories ───────────────────────────────────────────────────
RUN mkdir -p uploads outputs processed

# ── Expose HF Spaces port ─────────────────────────────────────────────────────
EXPOSE 7860

CMD ["python", "api_server.py"]
