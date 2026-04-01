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

<br/>

<img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" />
<img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
<img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/Flask-3.0-000000?style=for-the-badge&logo=flask&logoColor=white" />
<img src="https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
<img src="https://img.shields.io/badge/Docker-HF_Spaces-2496ED?style=for-the-badge&logo=docker&logoColor=white" />

<br/><br/>

# 🎙️ Synthetic Voice Studio

**Clone any voice from a short audio sample. Detect whether audio is human or AI‑generated.**

Built on OpenVoice V2, MeloTTS, and AudioSeal — deployed for free on Vercel + Hugging Face Spaces.

<br/>

[**Live Demo →**](https://your-app.vercel.app) &nbsp;|&nbsp; [**HF Space →**](https://huggingface.co/spaces/your-username/voice-studio) &nbsp;|&nbsp; [**API Docs**](#-api-reference)

<br/>

</div>

---

## ✨ What It Does

| Feature | Description |
|---|---|
| 🎤 **Voice Cloning** | Upload 10–30 s of any voice and make it speak any text |
| 🎭 **Emotion Control** | Choose from 6 tones: Neutral, Happy, Sad, Angry, Jolly, Anxious |
| 🛡️ **Voice Authentication** | Detect whether an audio clip is human or AI‑generated |
| 💧 **AudioSeal Watermarking** | Every generated clip is invisibly watermarked for traceability |
| 📱 **Fully Responsive UI** | Works on mobile, tablet, and desktop |
| ⚡ **GPU/CPU Auto-detect** | Runs on GPU when available, gracefully falls back to CPU |

---

## 🏗️ Architecture

```
┌──────────────────────────────────┐        ┌──────────────────────────────────────┐
│   Frontend  ·  React + Vite      │        │   Backend  ·  Flask + PyTorch        │
│   Hosted on Vercel               │──────▶│   Hosted on Hugging Face Spaces      │
│                                  │        │   (Docker, port 7860)                │
│  Pages                           │        │                                      │
│  ├─ Voice Generation             │        │  Endpoints                           │
│  │   ├─ AudioUploader            │        │  ├─ POST  /api/generate              │
│  │   ├─ EmotionSelector          │        │  ├─ POST  /api/authenticate          │
│  │   ├─ AudioPlayer              │        │  ├─ GET   /api/download/:id          │
│  │   └─ ProcessingOverlay        │        │  ├─ GET   /api/health                │
│  └─ Voice Authentication         │        │  └─ GET   /api/emotions              │
│      ├─ AudioUploader            │        │                                      │
│      └─ AnalysisResult           │        │  AI Pipeline                         │
│                                  │        │  ├─ faster-whisper  (segmentation)   │
│  State                           │        │  ├─ OpenVoice V2    (tone converter) │
│  └─ VoiceStudioContext           │        │  ├─ MeloTTS         (TTS engine)     │
│      └─ sessionStorage           │        │  └─ AudioSeal       (watermarking)   │
└──────────────────────────────────┘        └──────────────────────────────────────┘
                                                          │
                                            ┌─────────────▼────────────┐
                                            │  Hugging Face Model Hub  │
                                            │  checkpoints_v2/ weights │
                                            └──────────────────────────┘
```

---

## 🤖 AI Models

| Model | Role | License |
|---|---|---|
| **OpenVoice V2** — ToneColorConverter | Transfers voice timbre from a reference sample onto synthesized audio | MIT |
| **MeloTTS** (EN‑Default) | High‑quality text-to-speech synthesis | MIT |
| **faster-whisper** | Audio segmentation for speaker embedding extraction | MIT |
| **AudioSeal** — Generator | Embeds invisible watermarks into AI-generated audio | CC‑BY‑NC 4.0 |
| **AudioSeal** — Detector | Detects watermarks to classify audio as human or AI | CC‑BY‑NC 4.0 |

> **⚠️ AudioSeal** is licensed for **non-commercial use only**. Review the [AudioSeal license](https://github.com/facebookresearch/audioseal/blob/main/LICENSE) before any commercial deployment.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend language** | Python 3.10 |
| **Web framework** | Flask 3.0 + flask-cors |
| **ML framework** | PyTorch ≥ 2.0, torchaudio |
| **Audio processing** | soundfile, pydub + ffmpeg (fallback) |
| **Frontend framework** | React 18, TypeScript 5, Vite 5 |
| **Styling** | Tailwind CSS 3, shadcn/ui (Radix primitives) |
| **State management** | React Context API + sessionStorage |
| **Frontend hosting** | Vercel |
| **Backend hosting** | Hugging Face Spaces (Docker SDK) |
| **Model storage** | Hugging Face Model Hub |

---

## 📁 Repository Structure

```
voice_clone_project/
│
├── 📄 api_server.py           # Flask backend — all API endpoints + full AI pipeline
├── 📄 se_extractor_patched.py # Custom OpenVoice segmentation (CPU-safe, crash-proof)
├── 📄 download_models.py      # Downloads model checkpoints from HF Hub at startup
├── 📄 cache_silero.py         # Pre-warms silero-VAD cache (used in Docker build)
├── 📄 validator.py            # CLI tool — watermark check on any local audio file
├── 📄 requirements_api.txt    # Python dependencies
│
├── 🐳 Dockerfile              # HF Spaces container — Python 3.10 slim
│
├── 🚀 start.bat               # Windows one-click launcher (backend + frontend)
├── 🚀 start.sh                # Linux/macOS launcher
│
├── 📁 checkpoints_v2/         # Model weights (git-ignored — stored on HF Hub)
│   ├── converter/
│   │   ├── config.json        ✅ committed (838 B)
│   │   └── checkpoint.pth     ❌ git-ignored (125 MB — download from HF)
│   └── base_speakers/ses/
│       └── en-default.pth     ✅ committed (~1.6 KB)
│
├── 📁 OpenVoice/              # OpenVoice V2 source (cloned at build time in Docker)
├── 📁 emotions/               # Reference emotion audio samples
├── 📁 uploads/                # Runtime temp — incoming audio (git-ignored)
├── 📁 outputs/                # Runtime temp — generated audio (git-ignored)
└── 📁 processed/              # Runtime temp — speaker embeddings (git-ignored)
│
└── 📁 frontend/               # React application
    ├── vite.config.ts         # Dev server :8080, proxies /api → :7860
    ├── tailwind.config.ts
    └── src/
        ├── pages/
        │   └── Index.tsx          # App shell: tab switcher, CPU banner, layout
        ├── components/
        │   ├── VoiceGeneration.tsx    # 4-step generation workflow
        │   ├── VoiceAuthentication.tsx
        │   ├── AudioUploader.tsx      # Drag-and-drop with preview + validation
        │   ├── AudioPlayer.tsx        # Custom player with waveform visualizer
        │   ├── EmotionSelector.tsx    # Emotion pill selector
        │   ├── AnalysisResult.tsx     # Animated confidence gauge
        │   └── ProcessingAnimation.tsx
        ├── context/
        │   └── VoiceStudioContext.tsx # Global state + sessionStorage persistence
        ├── hooks/
        │   └── useVoiceStudio.ts
        └── services/
            └── api.ts                 # All fetch calls, error mapping, timeouts
```

---

## 💻 Local Development

### Prerequisites

- Python 3.10+
- Node.js 18+
- `ffmpeg` on your PATH
- `checkpoints_v2/converter/checkpoint.pth` (see step 3)

### 1 — Clone

```bash
git clone https://github.com/YOUR_USERNAME/voice-clone-project.git
cd voice-clone-project
```

### 2 — Clone OpenVoice

```bash
git clone https://github.com/myshell-ai/OpenVoice.git
```

### 3 — Download model weights

```bash
# Option A: Hugging Face Hub (replace with your actual repo)
pip install huggingface_hub
python - <<'EOF'
from huggingface_hub import snapshot_download
snapshot_download(
    repo_id="YOUR_HF_USERNAME/openvoice-checkpoints",
    local_dir=".",
    repo_type="model"
)
EOF

# Option B: Place manually
# checkpoints_v2/converter/config.json          (already in repo)
# checkpoints_v2/converter/checkpoint.pth       ← download this
# checkpoints_v2/base_speakers/ses/en-default.pth (already in repo)
```

### 4 — Python backend

```bash
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements_api.txt
pip install -e ./OpenVoice
```

### 5 — Frontend

```bash
cd frontend
npm install
cd ..
```

### 6 — Environment

```bash
# Copy the example and edit if needed
cp frontend/.env.example frontend/.env
# Default is fine for local dev:
# VITE_API_URL=http://localhost:7860/api
```

### 7 — Run

**Windows:**
```cmd
start.bat
```

**macOS / Linux:**
```bash
chmod +x start.sh && ./start.sh
```

**Manually (two terminals):**
```bash
# Terminal 1 — Backend
source venv/bin/activate
python api_server.py

# Terminal 2 — Frontend
cd frontend && npm run dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:8080 |
| Backend API | http://localhost:7860 |
| Health check | http://localhost:7860/api/health |

> **First run** preloads all AI models — allow 30–60 s before the first request. Subsequent requests are much faster.

---

## 🌐 Deployment

This project deploys for free using:

| Service | Purpose | Cost |
|---|---|---|
| **Vercel** | Frontend hosting — auto-deploys from GitHub | Free |
| **Hugging Face Spaces** | Backend Docker container — 16 GB RAM CPU | Free |
| **Hugging Face Hub** | Model weight storage (Git LFS) | Free |

### Deploy the backend (HF Spaces)

1. Create a new Space → **Docker** SDK
2. Push the repo root (excluding `frontend/`, `venv/`, `OpenVoice/`, `checkpoints_v2/`)
3. Set Secrets in the Space settings:

| Secret | Value |
|---|---|
| `HF_CHECKPOINT_REPO` | `your-username/openvoice-checkpoints` |
| `HF_TOKEN` | Your HF read token (if the model repo is private) |
| `ALLOWED_ORIGINS` | `https://your-app.vercel.app` |

### Deploy the frontend (Vercel)

1. Import the repo into Vercel, set **Root Directory** → `frontend`
2. Add environment variable: `VITE_API_URL` → `https://your-username-voice-studio.hf.space/api`
3. Deploy

---

## 📡 API Reference

Base path: `/api`

### `GET /api/health`

```json
{ "status": "healthy", "device": "cuda", "models_loaded": true }
```

### `POST /api/generate`

**Request** — `multipart/form-data`

| Field | Type | Required | Notes |
|---|---|---|---|
| `audio` | File | ✅ | WAV / MP3 / M4A, max 50 MB |
| `text` | String | ✅ | Script to speak (≤ 200 chars recommended) |
| `emotion` | String | — | `neutral` `happy` `sad` `angry` `jolly` `anxious` |

**Response**
```json
{ "success": true, "audio_id": "a1b2c3d4", "message": "Voice generated successfully" }
```

### `GET /api/download/:audio_id`

Returns binary `audio/wav`.

### `POST /api/authenticate`

**Request** — `multipart/form-data`

| Field | Type | Required |
|---|---|---|
| `audio` | File | ✅ |

**Response**
```json
{ "success": true, "is_original": false, "confidence": 87, "probability": 0.873 }
```

### `GET /api/emotions`

Returns the list of available emotion presets.

---

## ⚙️ Environment Variables

### Backend

| Variable | Required | Description |
|---|---|---|
| `HF_CHECKPOINT_REPO` | Production | HF model repo ID, e.g. `user/openvoice-checkpoints` |
| `HF_TOKEN` | If private | Hugging Face read token |
| `ALLOWED_ORIGINS` | Production | Comma-separated CORS origins |
| `PORT` | HF Spaces | Server port (default `7860`) |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL |

---

## 🔖 CLI Validator

Check any local audio file for AudioSeal watermarks:

```bash
python validator.py path/to/audio.wav
```

```
--- Analysis for audio.wav ---
Watermark Probability : 0.9312
Result                : ❌ AI-GENERATED
```

---

## ⚠️ Known Limitations

- **CPU inference is slow** — voice generation takes 1–3 minutes on the free HF Spaces CPU tier. A GPU Space reduces this to ~10 s.
- **English only** — the default MeloTTS speaker (`EN-Default`) is English. Other languages supported by MeloTTS require code changes.
- **Short reference audio** — very short clips (< 5 s) or clips with heavy background noise reduce voice clone quality.
- **AudioSeal non-commercial** — the watermarking model is CC-BY-NC 4.0. Do not use in commercial products without a separate license.

---

## 📄 License

This project is released under the [MIT License](LICENSE).

Third-party components:

| Component | License |
|---|---|
| [OpenVoice V2](https://github.com/myshell-ai/OpenVoice) | MIT |
| [MeloTTS](https://github.com/myshell-ai/MeloTTS) | MIT |
| [AudioSeal](https://github.com/facebookresearch/audioseal) | CC-BY-NC 4.0 — **non-commercial only** |
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | MIT |

---

## 🙏 Acknowledgements

- [MyShell AI](https://github.com/myshell-ai) for OpenVoice V2 and MeloTTS
- [Meta / Facebook Research](https://github.com/facebookresearch) for AudioSeal
- [shadcn/ui](https://ui.shadcn.com) + [Radix UI](https://www.radix-ui.com) for the component library
- [Hugging Face](https://huggingface.co) for free model hosting and Spaces

---

<div align="center">
  <sub>Built with Python · Flask · PyTorch · React · TypeScript · OpenVoice V2 · AudioSeal</sub>
</div>
