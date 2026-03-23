# Synthetic Voice Studio — Setup Guide

> **Share this guide + the project folder with your colleague.**
> Follow every step in order. Estimated setup time: 15–20 minutes.

---

## Prerequisites

Install these **before** starting:

| Tool | Version | Download |
|------|---------|----------|
| **Python** | 3.9 – 3.11 | [python.org/downloads](https://www.python.org/downloads/) |
| **Node.js** | 18+ (LTS) | [nodejs.org](https://nodejs.org/) |
| **Git** | Any recent | [git-scm.com](https://git-scm.com/) |
| **FFmpeg** | Any recent | [ffmpeg.org/download](https://ffmpeg.org/download.html) |

> **FFmpeg is required** — `pydub` and `torchaudio` depend on it. On Windows, download the binary and add it to your system PATH.

### Hardware
- **Minimum**: 8 GB RAM, any modern CPU (runs on CPU mode)
- **Recommended**: NVIDIA GPU with CUDA for faster inference (auto-detected)

---

## What Files to Share

### ✅ INCLUDE these (the full project folder):

```
voice_clone_project/
├── api_server.py              ← Flask backend (main server)
├── validator.py               ← Utility
├── requirements_api.txt       ← Python dependencies
├── start.bat                  ← Windows launcher
├── start.sh                   ← Linux/macOS launcher
├── Dockerfile                 ← Docker deployment (optional)
├── nginx.conf                 ← Nginx config (optional, for Docker)
├── .gitignore
├── PROJECT_CONTEXT.md         ← Architecture documentation
├── SETUP_GUIDE.md             ← This file
├── README.md
│
├── OpenVoice/                 ← OpenVoice V2 library (REQUIRED)
│   ├── openvoice/             ← Core Python module
│   ├── setup.py
│   └── ...
│
├── checkpoints_v2/            ← Model weights (REQUIRED, ~131 MB)
│   ├── converter/
│   │   ├── config.json
│   │   └── checkpoint.pth     ← 131 MB — DO NOT DELETE
│   └── base_speakers/
│       └── ses/
│           └── en-default.pth (+ other languages)
│
├── emotions/                  ← Emotion reference WAV files
│   ├── neutral.wav
│   ├── happy.wav
│   └── ... (6 files)
│
└── frontend/                  ← React app
    ├── package.json
    ├── package-lock.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    ├── src/                   ← All React source code
    ├── public/
    └── ...
```

### ❌ DO NOT INCLUDE (will be regenerated):

| Folder/File | Why |
|---|---|
| `venv/` or `env/` | Virtual environment — recreated during setup |
| `frontend/node_modules/` | Node dependencies — recreated by `npm install` |
| `uploads/` contents | Temporary upload files |
| `outputs/` contents | Temporary output files |
| `processed/` contents | Temporary processed files |
| `__pycache__/` | Python bytecode cache |
| `frontend/dist/` | Build output — recreated by `npm run build` |
| `.env.local` or `.env` files | Local environment overrides |

### 💡 Sharing Methods

**Option A — ZIP file (easiest):**
1. Delete `venv/`, `node_modules/`, `uploads/*`, `outputs/*`, `processed/*`
2. ZIP the entire `voice_clone_project/` folder
3. Share via Google Drive, OneDrive, etc. (ZIP will be ~150 MB due to checkpoint.pth)

**Option B — GitHub (best for collaboration):**
```bash
cd voice_clone_project
git init
git add -A
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/voice_clone_project.git
git push -u origin main
```
> ⚠️ `checkpoint.pth` is 131 MB. GitHub allows files up to 100 MB by default. You'll need [Git LFS](https://git-lfs.github.com/) for it:
> ```bash
> git lfs install
> git lfs track "*.pth"
> git add .gitattributes
> ```

---

## Setup Steps (for your colleague)

### Step 1: Extract / Clone the Project

```bash
# If ZIP:
# Extract voice_clone_project.zip to a convenient location

# If GitHub:
git clone https://github.com/YOUR_USERNAME/voice_clone_project.git
cd voice_clone_project
```

### Step 2: Create Python Virtual Environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### Step 3: Install Python Dependencies

```bash
# Core packages
python -m pip install --upgrade pip setuptools wheel
pip install -r requirements_api.txt

# OpenVoice (local install from the included folder)
pip install -e ./OpenVoice

# MeloTTS (from GitHub)
pip install git+https://github.com/myshell-ai/MeloTTS.git

# AudioSeal
pip install audioseal
```

> ⏱️ This step takes 5–10 minutes. PyTorch alone is ~2 GB.

### Step 4: Verify Python Setup

```bash
python -c "import torch; print('PyTorch:', torch.__version__); print('CUDA:', torch.cuda.is_available())"
python -c "from openvoice.api import ToneColorConverter; print('OpenVoice: OK')"
python -c "from melo.api import TTS; print('MeloTTS: OK')"
python -c "from audioseal import AudioSeal; print('AudioSeal: OK')"
```

All four should print OK without errors. CUDA will be `False` if no NVIDIA GPU (the app works fine on CPU, just slower).

### Step 5: Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

### Step 6: Create Required Folders

```bash
# Windows
mkdir uploads outputs processed

# macOS / Linux
mkdir -p uploads outputs processed
```

### Step 7: Run the Project

**Option A — Using the start script (recommended):**

```bash
# Windows
start.bat

# macOS / Linux
chmod +x start.sh
./start.sh
```

**Option B — Manual start (two terminals):**

Terminal 1 — Backend:
```bash
# Make sure venv is activated
python api_server.py
```
Wait until you see: `[BOOT] Models preloaded successfully!` (takes 15–30 seconds on first run, as it downloads NLTK data and loads all 4 models).

Terminal 2 — Frontend:
```bash
cd frontend
npm run dev
```

### Step 8: Open the App

Open **http://localhost:8080** in your browser.

- The frontend (React) runs on port **8080**
- The backend (Flask) runs on port **5000**
- Vite proxies `/api/*` requests to Flask automatically — no CORS issues

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `ModuleNotFoundError: No module named 'openvoice'` | Run `pip install -e ./OpenVoice` from the project root |
| `ModuleNotFoundError: No module named 'melo'` | Run `pip install git+https://github.com/myshell-ai/MeloTTS.git` |
| `[FATAL] Model loading failed` | Check that `checkpoints_v2/converter/checkpoint.pth` exists (131 MB) |
| `OpenVoice folder not found` | Make sure `OpenVoice/` directory is at the project root |
| `ffmpeg not found` or audio processing errors | Install FFmpeg and add to PATH. Restart terminal. |
| `npm: command not found` | Install Node.js from nodejs.org |
| Frontend loads but API calls fail | Make sure `python api_server.py` is running in another terminal |
| Port 5000 already in use | Kill the other process or set `PORT=5001` before running |
| Port 8080 already in use | Edit `frontend/vite.config.ts` line 10: change `port: 8080` |
| `torch.cuda.is_available()` returns False | Normal if no NVIDIA GPU. CPU mode works, just slower. |
| Windows: `PermissionError` on file cleanup | Normal on Windows — the app catches and ignores these |

---

## Quick Reference

| What | Where |
|---|---|
| Backend server | `api_server.py` → http://localhost:5000 |
| Frontend dev server | `frontend/` → http://localhost:8080 |
| Python dependencies | `requirements_api.txt` + 3 manual installs |
| Frontend dependencies | `frontend/package.json` |
| Model weights | `checkpoints_v2/` (~131 MB) |
| API documentation | See `PROJECT_CONTEXT.md` sections 8–10 |

---

*Last updated: March 2026*
