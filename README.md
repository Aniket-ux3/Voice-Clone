---
title: Voice Clone Backend
emoji: 🎙️
colorFrom: purple
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

<div align="center">

# 🎙️ Synthetic Voice Studio

### AI-powered voice cloning and authentication platform

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-000000?style=flat-square&logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

Clone any voice from a short audio sample and verify whether audio is human or AI-generated — powered by OpenVoice V2, MeloTTS, and AudioSeal.

[Live Demo](#-live-demo) · [Features](#-features) · [Setup](#-local-setup) · [API Reference](#-api-reference) · [Deploy](#-deployment)

</div>

---

## ✨ Features

**Voice Generation**
- Clone any voice from a 10–30 second reference audio sample
- Supports WAV, MP3, M4A input formats
- Six emotion styles: Neutral, Happy, Sad, Angry, Jolly, Anxious
- Output is transparently watermarked with AudioSeal before download

**Voice Authentication**
- Upload any audio clip to detect whether it is human or AI-generated
- Returns a confidence score (0–100%)
- Uses AudioSeal watermark detection under the hood

**Modern UI**
- Dark glass-morphism design with smooth animations
- 4-step guided workflow for voice generation
- Real-time waveform visualisation and custom audio player
- Session persistence across page refreshes

---

## 🏗️ Architecture

```
┌─────────────────────────────┐      ┌──────────────────────────────────┐
│   Frontend (React + Vite)   │      │     Backend (Flask + PyTorch)    │
│   Vercel · port 8080        │─────▶│  Hugging Face Spaces · port 7860 │
│                             │      │                                  │
│  · VoiceGeneration UI       │      │  · /api/generate                 │
│  · VoiceAuthentication UI   │      │  · /api/authenticate             │
│  · AudioPlayer              │      │  · /api/download/:id             │
│  · EmotionSelector          │      │  · /api/health                   │
│  · AnalysisResult gauge     │      │  · /api/emotions                 │
└─────────────────────────────┘      └──────────────────────────────────┘
                                                    │
                                      ┌─────────────▼──────────────┐
                                      │  Hugging Face Model Hub    │
                                      │  checkpoints_v2/ weights   │
                                      └────────────────────────────┘
```

---

## 🤖 AI Models

| Model | Role | Source |
|---|---|---|
| **OpenVoice V2** — ToneColorConverter | Transfers voice timbre from reference speaker onto TTS audio | [myshell-ai/OpenVoice](https://github.com/myshell-ai/OpenVoice) |
| **MeloTTS** | Text-to-speech synthesis (English, EN-Default speaker) | [myshell-ai/MeloTTS](https://github.com/myshell-ai/MeloTTS) |
| **AudioSeal** — Generator | Embeds invisible watermarks into generated audio | [facebookresearch/audioseal](https://github.com/facebookresearch/audioseal) |
| **AudioSeal** — Detector | Detects AudioSeal watermarks, classifies audio origin | [facebookresearch/audioseal](https://github.com/facebookresearch/audioseal) |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.10, Flask 3.0, flask-cors |
| AI / ML | PyTorch ≥ 2.0, torchaudio, OpenVoice V2, MeloTTS, AudioSeal |
| Audio processing | torchaudio (primary), pydub + ffmpeg (fallback) |
| Frontend | React 18, TypeScript 5, Vite 5 |
| Styling | Tailwind CSS 3, shadcn/ui (Radix UI primitives) |
| State | React Context API + sessionStorage |
| HTTP client | Native fetch API |
| Frontend hosting | Vercel |
| Backend hosting | Hugging Face Spaces (Docker) |
| Model storage | Hugging Face Model Hub |

---

## 📁 Project Structure

```
voice_clone_project/
│
├── api_server.py            # Flask backend — all API endpoints + AI pipeline
├── download_models.py       # Downloads checkpoints from HF Hub at startup
├── validator.py             # Standalone CLI tool for watermark verification
├── requirements_api.txt     # Python dependencies
│
├── Dockerfile               # HF Spaces Docker container definition
├── start.bat                # Windows launcher (backend + frontend)
├── start.sh                 # Linux/macOS launcher
│
├── checkpoints_v2/          # Model weights (not in git — stored on HF Hub)
│   ├── converter/
│   │   ├── config.json
│   │   └── checkpoint.pth
│   └── base_speakers/ses/
│       └── en-default.pth   # (+ other accent/language embeddings)
│
├── OpenVoice/               # OpenVoice V2 source (cloned from GitHub)
├── emotions/                # Emotion reference audio files
├── uploads/                 # Runtime temp: incoming files (gitignored)
├── outputs/                 # Runtime temp: generated audio (gitignored)
├── processed/               # Runtime temp: speaker embeddings (gitignored)
│
└── frontend/                # React application
    ├── vite.config.ts       # Dev server :8080, proxies /api → :5000
    ├── tailwind.config.ts
    └── src/
        ├── pages/
        │   └── Index.tsx    # Main page with tab switcher
        ├── components/
        │   ├── VoiceGeneration.tsx    # 4-step generation workflow
        │   ├── VoiceAuthentication.tsx
        │   ├── AudioUploader.tsx
        │   ├── AudioPlayer.tsx
        │   ├── EmotionSelector.tsx
        │   └── AnalysisResult.tsx
        ├── context/
        │   └── VoiceStudioContext.tsx # Global state + sessionStorage
        └── services/
            └── api.ts       # All fetch calls to the Flask backend
```

---

## 💻 Local Setup

### Prerequisites

- Python 3.10+
- Node.js 16+
- ffmpeg installed and on PATH
- The `checkpoints_v2/` folder with model weights (see below)

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/voice-clone-project.git
cd voice-clone-project
```

### 2. Get model weights

Download from Hugging Face Hub (replace with your actual repo):

```bash
pip install huggingface_hub
python - <<'EOF'
from huggingface_hub import snapshot_download
snapshot_download(
    repo_id="YOUR_HF_USERNAME/openvoice-checkpoints",
    local_dir=".",
    repo_type="model"
)
EOF
```

Or place the files manually:
```
checkpoints_v2/converter/config.json
checkpoints_v2/converter/checkpoint.pth
checkpoints_v2/base_speakers/ses/en-default.pth
```

### 3. Clone OpenVoice

```bash
git clone https://github.com/myshell-ai/OpenVoice.git
```

### 4. Set up Python backend

```bash
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements_api.txt
pip install -e ./OpenVoice
```

### 5. Set up the frontend

```bash
cd frontend
npm install
cd ..
```

### 6. Configure environment

```bash
cp frontend/.env.example frontend/.env
# frontend/.env — default value is fine for local use:
# VITE_API_URL=http://localhost:5000/api
```

### 7. Run

**Windows (recommended):**
```bash
start.bat
```

**macOS / Linux:**
```bash
./start.sh
```

**Manually (two terminals):**
```bash
# Terminal 1 — Backend
source venv/bin/activate   # or venv\Scripts\activate on Windows
python api_server.py

# Terminal 2 — Frontend
cd frontend && npm run dev
```

### Access

| Service | URL |
|---|---|
| Frontend UI | http://localhost:8080 |
| Backend API | http://localhost:5000 |
| Health check | http://localhost:5000/api/health |

> **First startup** preloads all four AI models. Expect 30–60 seconds before the server is ready. Subsequent requests are much faster (5–15 s on GPU, 60–90 s on CPU).

---

## 🌐 Deployment

This project deploys for free using:

- **Frontend → [Vercel](https://vercel.com)** — automatic from GitHub
- **Backend → [Hugging Face Spaces](https://huggingface.co/spaces)** — Docker, 16 GB RAM CPU
- **Model weights → [Hugging Face Hub](https://huggingface.co/models)** — free Git LFS storage

See **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** for the complete step-by-step walkthrough.

---

## 📡 API Reference

All endpoints are prefixed with `/api`.

### `GET /api/health`
Returns server status and whether models are loaded.

```json
{ "status": "healthy", "device": "cuda", "models_loaded": true }
```

### `POST /api/generate`
Generate a synthetic voice clone.

**Request** — `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `audio` | File | ✅ | Reference voice sample (WAV / MP3 / M4A) |
| `text` | String | ✅ | Script for the cloned voice to speak |
| `emotion` | String | — | `neutral` · `happy` · `sad` · `angry` · `jolly` · `anxious` |

**Response**
```json
{ "success": true, "audio_id": "a1b2c3d4", "message": "Voice generated successfully" }
```

### `GET /api/download/:audio_id`
Download the generated WAV file.
Returns binary `audio/wav`.

### `POST /api/authenticate`
Detect whether audio is human or AI-generated.

**Request** — `multipart/form-data`

| Field | Type | Required |
|---|---|---|
| `audio` | File | ✅ |

**Response**
```json
{ "success": true, "is_original": false, "confidence": 87, "probability": 0.873 }
```

### `GET /api/emotions`
Returns the list of available emotion styles.

---

## ⚙️ Environment Variables

### Backend

| Variable | Required | Description |
|---|---|---|
| `HF_CHECKPOINT_REPO` | Production | HF model repo ID, e.g. `user/openvoice-checkpoints` |
| `HF_TOKEN` | If private repo | Hugging Face read token |
| `ALLOWED_ORIGINS` | Production | Comma-separated list of allowed CORS origins |
| `PORT` | Production | Server port (default `7860` on HF Spaces) |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL, e.g. `https://user-space.hf.space/api` |

---

## 🔖 CLI Validator

Use `validator.py` to check any audio file for AudioSeal watermarks from the command line:

```bash
python validator.py path/to/audio.wav
```

Output:
```
--- Analysis for path/to/audio.wav ---
Watermark Probability: 0.9312
RESULT: ❌ AI-GENERATED (Authenticated System)
```

---

## 📄 License

This project is released under the [MIT License](LICENSE).

The following third-party components have their own licenses:
- [OpenVoice V2](https://github.com/myshell-ai/OpenVoice) — MIT License
- [MeloTTS](https://github.com/myshell-ai/MeloTTS) — MIT License
- [AudioSeal](https://github.com/facebookresearch/audioseal) — CC-BY-NC 4.0 *(non-commercial use only)*

> **Note:** AudioSeal is licensed for non-commercial use. If you intend to use this project commercially, review the AudioSeal license terms before deploying.

---

## 🙏 Acknowledgements

- [MyShell AI](https://github.com/myshell-ai) for OpenVoice V2 and MeloTTS
- [Facebook Research](https://github.com/facebookresearch) for AudioSeal
- [shadcn/ui](https://ui.shadcn.com) for the component library
- [Radix UI](https://www.radix-ui.com) for accessible UI primitives

---

<div align="center">
  <sub>Built with Python · Flask · React · TypeScript · OpenVoice V2</sub>
</div>
