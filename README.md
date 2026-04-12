---
title: Synthetic Voice Studio
emoji: 🎙️
colorFrom: purple
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

<div align="center">

# 🎙️ Synthetic Voice Studio

### AI-powered voice cloning and audio authenticity detection

<p>
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Flask-3.0-000000?style=for-the-badge&logo=flask&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Deployment-Vercel_+_HF_Spaces-black?style=for-the-badge" />
</p>

**Clone voices from short audio samples, generate expressive speech, and detect AI-generated audio — all in one web app.**

[🚀 Live Demo](https://voice-clone-one.vercel.app/) • [🤗 Hugging Face Space](https://huggingface.co/spaces/Aniket-ux3/voice-clone-backend)

</div>

---

## Why This Project Stands Out

Synthetic Voice Studio is built to show a **real-world AI application** with both **generation** and **detection** features.

It allows users to:

- **Clone a voice** from a short sample — male or female, any accent
- **Generate speech** with different emotions affecting both prosody and tone color
- **Check whether audio is human or AI-generated** via AudioSeal watermark detection
- Use everything through a **simple, clean web interface**

---

## Features

### Voice Cloning
Upload a short voice sample and generate new speech in the same voice style.  
The pipeline extracts a speaker embedding from your sample using OpenVoice V2's ReferenceEncoder and applies it via normalizing flow voice conversion.

### Emotion Control
Generate speech with different tones:
- Neutral, Happy, Sad, Angry, Jolly, Anxious

Each emotion affects both MeloTTS prosody parameters (speed, noise scale) and the speaker embedding used in voice conversion.

### Audio Detection
Analyze uploaded audio and classify whether it is likely human or AI-generated, using AudioSeal watermark detection.

### Modern UI
Clean and responsive frontend, easy upload and playback, works on desktop and mobile.

### Smart Execution
Uses GPU when available, falls back to CPU automatically.

---

## How It Works

```text
User Uploads Audio Sample + Text Script
              │
              ▼
  Whisper sentence-level segmentation
  → ReferenceEncoder extracts speaker SE
              │
              ▼
  MeloTTS EN_NEWEST generates TTS base audio
  (with emotion-driven prosody)
              │
              ▼
  OpenVoice V2 voice conversion
  (normalizing flow: src_se → tgt_se)
              │
              ▼
  AudioSeal watermark embedding
              │
              ▼
        Final Audio Output
```

### Main Pipeline Components
- **OpenVoice V2** — voice style transfer via normalizing flow
- **MeloTTS EN_NEWEST** — highest quality English TTS base speaker
- **faster-whisper** — sentence-level audio segmentation for SE extraction
- **AudioSeal** — watermarking and AI-audio detection

---

## Tech Stack

### Frontend
- React 18, TypeScript, Tailwind CSS, Vite

### Backend
- Python 3.10, Flask, PyTorch, CUDA

### AI / Audio
- OpenVoice V2 (MyShell AI)
- MeloTTS EN_NEWEST (myshell-ai/MeloTTS-English-v3)
- AudioSeal (Meta)
- faster-whisper

### Deployment
- Vercel (frontend) + Hugging Face Spaces Docker (backend)

---

## Local Setup

### Requirements
- Python 3.9+ (3.10 recommended)
- Node.js 16+
- CUDA-capable GPU recommended (CPU fallback works but is slow)

### Backend
```bash
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements_api.txt
pip install audioseal huggingface_hub
pip install -e OpenVoice --no-deps
python api_server.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Or use `start.bat` on Windows to launch both at once.

### Model Checkpoints
Place OpenVoice V2 checkpoints at:
```
checkpoints_v2/
  converter/
    config.json
    checkpoint.pth        ← download from HF or set HF_CHECKPOINT_REPO
  base_speakers/ses/
    en-newest.pth         ← committed to repo (1.65 KB)
    en-default.pth        ← committed to repo (1.74 KB)
    ... (other small SE files)
```

Set `HF_CHECKPOINT_REPO=your-hf-repo-id` to auto-download `checkpoint.pth` at startup.

---

## HF Spaces Deployment

The backend runs as a Docker container on HF Spaces.

**Environment variables to set in HF Space settings:**
- `HF_CHECKPOINT_REPO` — your HF model repo ID containing the large checkpoint files
- `HF_TOKEN` — (optional) HF read token if repo is private

The container automatically downloads `checkpoint.pth` on startup and pre-caches all MeloTTS and BERT models at build time.

---

## API Overview

```http
GET  /api/health              — server status + device info
POST /api/generate            — generate voice clone (multipart: audio + text + emotion)
GET  /api/download/:audio_id  — download generated WAV
POST /api/authenticate        — detect AI watermark in audio
GET  /api/emotions            — list available emotion options
```

---

## Limitations

- Best results from clean, continuous speech samples (10–60 seconds)
- Short samples (< 5s) may produce weaker voice embeddings
- EN_NEWEST is English-only; other languages fall back to EN-Default
- CPU generation takes 1–3 minutes; GPU takes 5–20 seconds
- AudioSeal is a non-commercial license — check before commercial use

---

## License

This project is released under the **MIT License**.

### Third-party tools
- **OpenVoice V2** — MIT
- **MeloTTS** — MIT
- **AudioSeal** — CC-BY-NC 4.0 (non-commercial)
- **faster-whisper** — MIT

> Always review third-party licenses before commercial use.

---

## Acknowledgements

- **MyShell AI** for OpenVoice V2 and MeloTTS
- **Meta / Facebook Research** for AudioSeal
- **Hugging Face** for hosting and model storage
- **Vercel** for frontend deployment

---

<div align="center">

### ⭐ If you found this project interesting, consider starring the repo

</div>
