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
RUN git clone https://github.com/myshell-ai/OpenVoice.git OpenVoice && \
    pip install --user --no-cache-dir -e OpenVoice

# ── Pre-download NLTK data ────────────────────────────────────────────────────
RUN python -c "\
import nltk; \
nltk.download('averaged_perceptron_tagger_eng', quiet=True); \
nltk.download('punkt', quiet=True); \
nltk.download('punkt_tab', quiet=True)"

# ── Copy application code ─────────────────────────────────────────────────────
COPY --chown=user api_server.py .
COPY --chown=user download_models.py .
COPY --chown=user emotions/ ./emotions/

# ── Create temp directories ───────────────────────────────────────────────────
RUN mkdir -p uploads outputs processed

# ── Expose HF Spaces port ─────────────────────────────────────────────────────
EXPOSE 7860

CMD ["python", "api_server.py"]
