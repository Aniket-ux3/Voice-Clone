# Deployment Guide — Synthetic Voice Studio (Free Hosting)

## Architecture

```
Browser
  │
  ▼
Vercel (Frontend — React/Vite)        ← FREE
  │  calls /api/* to HF Space backend
  ▼
Hugging Face Spaces (Flask backend)   ← FREE, 16 GB RAM CPU
  │  downloads model weights on first boot
  ▼
Hugging Face Model Hub (checkpoints)  ← FREE, Git LFS storage
```

---

## Overview of steps

1. Create a GitHub repository and push your code
2. Upload your model weights to Hugging Face Hub
3. Deploy the backend to Hugging Face Spaces
4. Deploy the frontend to Vercel
5. Connect the two together (set env vars)
6. Test the live deployment

Everything is free on the tiers described below.

---

## PART 1 — GitHub Repository

### 1.1 Create a GitHub account (if you don't have one)

Go to https://github.com and sign up.

### 1.2 Create a new repository

1. Click the **+** button → **New repository**
2. Name it: `voice-clone-project` (or anything you like)
3. Set to **Public** or **Private** (both work)
4. Do NOT initialise with a README (you already have one)
5. Click **Create repository**

### 1.3 Push your project

Open a terminal in your project root (`voice_clone_project/`) and run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/voice-clone-project.git
git push -u origin main
```

> **Note:** The `.gitignore` already excludes `venv/`, `node_modules/`, `*.wav`, `uploads/*`, `outputs/*`, and `processed/*` — so none of those will be pushed.

> **Note on `checkpoints_v2/`:** The `.gitignore` currently has `checkpoints_v2/*` commented out, meaning the checkpoint files WILL be pushed if you leave it like that. Since the `.pth` files are very large (hundreds of MB), it is strongly recommended to keep them OUT of GitHub and instead use Hugging Face Hub (see Part 2). To exclude them, uncomment this line in `.gitignore`:
> ```
> checkpoints_v2/*
> !checkpoints_v2/.gitkeep
> ```
> Add a `.gitkeep` inside `checkpoints_v2/` if it doesn't exist, then commit.

---

## PART 2 — Upload Model Weights to Hugging Face Hub

Your `.pth` checkpoint files are too large for regular Git. Hugging Face Hub handles large files natively via Git LFS and is free for public repos.

### 2.1 Create a Hugging Face account

Go to https://huggingface.co and sign up.

### 2.2 Install the Hugging Face CLI (on your local machine)

```bash
pip install huggingface_hub
huggingface-cli login
# Paste your HF token when prompted (get it from https://huggingface.co/settings/tokens)
```

### 2.3 Create a new model repository on HF Hub

```bash
huggingface-cli repo create openvoice-checkpoints --type model
```

This creates: `https://huggingface.co/YOUR_HF_USERNAME/openvoice-checkpoints`

### 2.4 Upload your checkpoint files

```bash
# From your project root
huggingface-cli upload YOUR_HF_USERNAME/openvoice-checkpoints \
    checkpoints_v2/converter/config.json \
    checkpoints_v2/converter/config.json

huggingface-cli upload YOUR_HF_USERNAME/openvoice-checkpoints \
    checkpoints_v2/converter/checkpoint.pth \
    checkpoints_v2/converter/checkpoint.pth

huggingface-cli upload YOUR_HF_USERNAME/openvoice-checkpoints \
    checkpoints_v2/base_speakers/ses/en-default.pth \
    checkpoints_v2/base_speakers/ses/en-default.pth
```

Or use the Python SDK:

```python
from huggingface_hub import HfApi

api = HfApi()
repo_id = "YOUR_HF_USERNAME/openvoice-checkpoints"

# Upload all files in checkpoints_v2/
api.upload_folder(
    folder_path="checkpoints_v2",
    repo_id=repo_id,
    repo_type="model",
    path_in_repo="checkpoints_v2",
)
```

After uploading, your HF model repo will contain:
```
checkpoints_v2/
  converter/
    config.json
    checkpoint.pth
  base_speakers/
    ses/
      en-default.pth
```

> **Private repo?** If you make the HF model repo private, you'll need to create a HF read token and add it as the `HF_TOKEN` env var in your Space (see Part 3).

---

## PART 3 — Deploy Backend to Hugging Face Spaces

### 3.1 Create a new Space

1. Go to https://huggingface.co/spaces
2. Click **Create new Space**
3. Fill in:
   - **Owner**: your HF username
   - **Space name**: `voice-clone-backend` (or anything)
   - **License**: MIT
   - **SDK**: **Docker** ← important
   - **Hardware**: CPU Basic (free, 2 vCPU, 16 GB RAM)
   - **Visibility**: Public (free) or Private (requires Pro)
4. Click **Create Space**

You will now have a new Space at: `https://huggingface.co/spaces/YOUR_HF_USERNAME/voice-clone-backend`

### 3.2 Connect your GitHub repo to the Space

Option A — Push directly to the Space's git repo (simplest):

```bash
# The Space has its own git repo. Add it as a remote:
git remote add space https://huggingface.co/spaces/YOUR_HF_USERNAME/voice-clone-backend

# Push your main branch to the Space
git push space main
```

Option B — Link GitHub repo for auto-sync (in Space settings → Repository → Link to GitHub)

### 3.3 Set environment variables in the Space

In your Space → **Settings** → **Variables and secrets**, add:

| Variable name | Value | Type |
|---|---|---|
| `HF_CHECKPOINT_REPO` | `YOUR_HF_USERNAME/openvoice-checkpoints` | Variable |
| `HF_TOKEN` | your HF read token | **Secret** |
| `ALLOWED_ORIGINS` | `https://YOUR-APP.vercel.app,http://localhost:8080` | Variable |
| `PORT` | `7860` | Variable |

> You will fill in the Vercel URL in `ALLOWED_ORIGINS` after completing Part 4. For now, set it to a placeholder and update it later.

### 3.4 What happens when the Space starts

1. Docker builds the image (takes 10–20 minutes the first time):
   - Installs Python packages
   - Clones OpenVoice from GitHub
   - Installs MeloTTS
   - Pre-downloads NLTK data
2. Container starts, `api_server.py` runs:
   - `download_checkpoints()` pulls weights from your HF model repo
   - `load_models()` loads all 4 AI models into RAM
3. Flask listens on port 7860

Your backend will be live at: `https://YOUR_HF_USERNAME-voice-clone-backend.hf.space`

### 3.5 Verify the backend is running

Visit: `https://YOUR_HF_USERNAME-voice-clone-backend.hf.space/api/health`

Expected response:
```json
{"device": "cpu", "models_loaded": true, "status": "healthy"}
```

> **First build takes 15–20 minutes.** Subsequent pushes rebuild only changed layers (much faster). Monitor progress in the Space's **Logs** tab.

---

## PART 4 — Deploy Frontend to Vercel

### 4.1 Create a Vercel account

Go to https://vercel.com and sign up with your GitHub account.

### 4.2 Import your project

1. On the Vercel dashboard, click **Add New → Project**
2. Find your `voice-clone-project` GitHub repo and click **Import**
3. Configure the project:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend` ← **critical**, click "Edit" and type `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### 4.3 Set the environment variable

Before clicking Deploy, scroll down to **Environment Variables** and add:

| Name | Value |
|---|---|
| `VITE_API_URL` | `https://YOUR_HF_USERNAME-voice-clone-backend.hf.space/api` |

Replace `YOUR_HF_USERNAME` and the space name with your actual values.

### 4.4 Deploy

Click **Deploy**. Vercel will:
1. Install frontend dependencies
2. Run `vite build`
3. Deploy the `dist/` folder to their global CDN

Your frontend will be live at: `https://your-app-name.vercel.app`

This takes about 1–2 minutes.

### 4.5 Update CORS on the backend

Now that you have your Vercel URL, go back to your HF Space → **Settings** → **Variables** and update `ALLOWED_ORIGINS`:

```
https://your-app-name.vercel.app,http://localhost:8080
```

Then **restart** your Space (Settings → Factory reboot) so the new env var takes effect.

---

## PART 5 — Connect & Test

### 5.1 Test the full flow

1. Open your Vercel URL: `https://your-app-name.vercel.app`
2. Upload a voice sample (WAV or MP3, 10–30 seconds)
3. Type a short script
4. Click **Generate Voice**
5. Wait (30–90 seconds on CPU — this is expected on free tier)
6. Audio player should appear with the cloned voice

### 5.2 Test authentication

1. Click **Voice Authentication** tab
2. Upload the generated voice
3. Click **Analyze Voice**
4. Should return "Synthetic Voice Detected" with high confidence

### 5.3 Check logs if anything fails

In your HF Space → **Logs** tab — all `print()` statements from Flask appear here.

---

## PART 6 — Important Notes & Limitations

### Free tier constraints

| Constraint | Detail |
|---|---|
| CPU only (no GPU) | Generation takes ~60–90 seconds per request instead of ~5–10s |
| No persistent storage | `outputs/` is in-memory; generated files are lost if the Space restarts |
| Space sleeps after 48 hours of inactivity | First request after sleep takes ~2 min to cold-start models |
| Concurrent requests | Only 1–2 at a time comfortably on CPU Basic |

### Handling Space cold starts

When the HF Space has been sleeping, the first request will time out because models take 1–2 minutes to load. To mitigate:
- Visit `/api/health` first to wake the Space
- Tell users to expect a delay on the first request

### Custom domain on Vercel

Vercel lets you connect a custom domain for free (if you own one). Go to your Vercel project → **Settings → Domains** and follow the instructions.

---

## PART 7 — Keeping It Updated

### Update the backend

```bash
git add .
git commit -m "Update backend"
git push origin main     # push to GitHub
git push space main      # push to HF Space (triggers rebuild)
```

### Update the frontend

```bash
git add .
git commit -m "Update frontend"
git push origin main     # Vercel auto-deploys on every push to main
```

Vercel watches your GitHub repo and redeploys automatically on every push.

---

## Quick Reference — Your Live URLs

After completing all steps, fill in this table:

| Service | URL |
|---|---|
| Frontend (Vercel) | `https://YOUR-APP.vercel.app` |
| Backend health check | `https://YOUR_HF_USERNAME-voice-clone-backend.hf.space/api/health` |
| HF Space logs | `https://huggingface.co/spaces/YOUR_HF_USERNAME/voice-clone-backend` |
| HF Model repo (weights) | `https://huggingface.co/YOUR_HF_USERNAME/openvoice-checkpoints` |
| GitHub repo | `https://github.com/YOUR_USERNAME/voice-clone-project` |

---

## Files Created for Deployment

| File | Purpose |
|---|---|
| `Dockerfile` | Defines the HF Space Docker container (Python, ffmpeg, OpenVoice, deps) |
| `download_models.py` | Downloads checkpoints from HF Hub at startup |
| `requirements_api.txt` | Updated to include `huggingface_hub` |
| `api_server.py` | Updated: CORS via env var, port via env var, calls `download_checkpoints()` |

---

*If you get stuck at any step, check the HF Space Logs tab — it shows everything happening inside the container in real time.*
