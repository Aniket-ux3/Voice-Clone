# Synthetic Voice Studio — Full Project Context

> Feed this document to any AI assistant to give it complete, accurate context about this project. Everything is current as of the last cleanup session.

---

## Table of Contents

1. [Project Summary](#1-project-summary)
2. [Tech Stack](#2-tech-stack)
3. [Directory Structure](#3-directory-structure)
4. [How the System Works — End to End](#4-how-the-system-works--end-to-end)
5. [Backend: api_server.py — Full Annotated Breakdown](#5-backend-api_serverpy--full-annotated-breakdown)
6. [AI Models & Checkpoints](#6-ai-models--checkpoints)
7. [API Endpoints Reference](#7-api-endpoints-reference)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Frontend Component Map](#9-frontend-component-map)
10. [State Management](#10-state-management)
11. [API Service Layer](#11-api-service-layer)
12. [Styling System](#12-styling-system)
13. [How to Run the Project](#13-how-to-run-the-project)
14. [File Lifecycle — Temp Files](#14-file-lifecycle--temp-files)
15. [Known Stability Fixes Applied](#15-known-stability-fixes-applied)
16. [What Does NOT Exist / Was Removed](#16-what-does-not-exist--was-removed)
17. [Environment Variables](#17-environment-variables)
18. [Dependencies](#18-dependencies)

---

## 1. Project Summary

**Synthetic Voice Studio** is a full-stack AI web application with two core features:

1. **Voice Generation** — Upload a short audio reference sample, type a script, pick an emotion, and the system clones the voice using OpenVoice V2 + MeloTTS. The output is watermarked with AudioSeal before delivery.

2. **Voice Authentication** — Upload any audio clip and the system runs AudioSeal watermark detection to determine whether it is an authentic human recording or an AI-generated synthetic voice. Returns a confidence percentage.

The project has a **Python/Flask backend** (handles all AI inference) and a **React/TypeScript/Vite frontend** (the browser UI). They communicate through a RESTful JSON/multipart API. In development, Vite proxies all `/api/*` requests to the Flask server so there are zero CORS issues.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Backend language | Python 3.9+ |
| Backend framework | Flask 3.0.0 + flask-cors |
| Voice cloning | OpenVoice V2 (local, in `/OpenVoice/` subfolder) |
| TTS engine | MeloTTS (installed as `melo` package, `EN-Default` speaker) |
| Watermarking | AudioSeal (Facebook Research) |
| Audio processing | torchaudio, pydub (fallback) |
| ML framework | PyTorch (CUDA if available, otherwise CPU) |
| Frontend framework | React 18 + TypeScript |
| Build tool | Vite 5 (dev server on port 8080) |
| Styling | Tailwind CSS v3 + shadcn/ui (Radix UI primitives) |
| Routing | react-router-dom v6 |
| Data fetching | @tanstack/react-query v5 |
| State management | React Context API + sessionStorage persistence |
| Icons | lucide-react |
| Package manager (frontend) | npm |

---

## 3. Directory Structure

```
voice_clone_project/
│
├── api_server.py               ← Main Flask backend (the only Python entry point needed)
├── validator.py                ← Standalone CLI tool for watermark detection (not used by the web app)
├── requirements_api.txt        ← Python dependencies for the backend
│
├── start.bat                   ← Windows launcher (starts both backend + frontend)
├── start.sh                    ← Linux/macOS launcher (starts both backend + frontend)
├── cleanup.bat                 ← One-time cleanup script (deletes temp files)
│
├── .gitignore                  ← Ignores venv, node_modules, *.wav, uploads/*, outputs/*
├── .dockerignore               ← Ignores venv, node_modules, __pycache__, .git
├── .mcp.json                   ← MCP server config for shadcn CLI (dev tooling only)
├── README.md                   ← Public-facing readme
│
├── checkpoints_v2/             ← OpenVoice V2 model weights (required, not in git)
│   ├── converter/
│   │   ├── config.json         ← ToneColorConverter model config
│   │   └── checkpoint.pth      ← ToneColorConverter weights
│   └── base_speakers/
│       └── ses/
│           ├── en-default.pth  ← Source speaker embedding (used in voice conversion)
│           ├── en-us.pth
│           ├── en-au.pth
│           ├── en-br.pth
│           ├── en-india.pth
│           ├── en-newest.pth
│           ├── es.pth
│           ├── fr.pth
│           ├── jp.pth
│           ├── kr.pth
│           └── zh.pth
│
├── OpenVoice/                  ← OpenVoice V2 source code (cloned repo, injected into sys.path)
│   └── openvoice/
│       ├── api.py              ← ToneColorConverter class
│       ├── se_extractor.py     ← Speaker embedding extractor
│       └── ...
│
├── emotions/                   ← WAV reference files for emotion styles (currently unused by backend)
│   ├── neutral.wav
│   ├── happy.wav
│   ├── sad.wav
│   ├── angry.wav
│   ├── jolly.wav
│   └── anxious.wav
│
├── uploads/                    ← Temp folder: incoming audio files (auto-created, auto-cleaned)
│   └── .gitkeep
│
├── outputs/                    ← Temp folder: generated audio files served for download (auto-created)
│   └── .gitkeep
│
├── processed/                  ← Temp folder: speaker embedding cache created by se_extractor
│   └── .gitkeep
│
├── venv/                       ← Python virtual environment (not in git)
│
└── frontend/                   ← React application (Vite + TypeScript)
    ├── package.json
    ├── vite.config.ts          ← Dev server on :8080, proxies /api → localhost:5000
    ├── tailwind.config.ts
    ├── tsconfig.json
    ├── index.html
    ├── nginx.conf              ← Used for production Docker deployment
    ├── .env                    ← VITE_API_URL=http://localhost:5000/api (git-ignored)
    ├── .env.example
    └── src/
        ├── main.tsx            ← Entry point, wraps app in VoiceStudioProvider
        ├── App.tsx             ← Router, QueryClientProvider, Toasters
        ├── index.css           ← Global styles, CSS variables, custom utility classes
        ├── pages/
        │   ├── Index.tsx       ← Main page: hero, tab switcher, renders VoiceGeneration or VoiceAuthentication
        │   └── NotFound.tsx    ← 404 page
        ├── components/
        │   ├── VoiceGeneration.tsx       ← Main generation workflow UI (4-step stepper)
        │   ├── VoiceAuthentication.tsx   ← Authentication/detection UI
        │   ├── AudioUploader.tsx         ← Drag-and-drop / click upload with preview
        │   ├── AudioPlayer.tsx           ← Custom audio player with waveform visualization
        │   ├── EmotionSelector.tsx       ← Emotion pill buttons
        │   ├── AnalysisResult.tsx        ← Animated confidence gauge + result display
        │   ├── ProcessingAnimation.tsx   ← Reusable processing spinner (legacy, inline used now)
        │   ├── QuickTip.tsx             ← Small help tooltip component
        │   ├── NavLink.tsx              ← Navigation helper (unused at top level)
        │   └── ui/                      ← shadcn/ui component library (Radix primitives)
        ├── context/
        │   └── VoiceStudioContext.tsx   ← Global state for generation + authentication sessions
        ├── hooks/
        │   └── useVoiceStudio.ts        ← Re-exports hook from context (convenience)
        ├── services/
        │   └── api.ts                   ← All fetch calls to the Flask backend (VoiceAPIService class)
        └── lib/
            └── utils.ts                 ← Tailwind cn() helper
```

---

## 4. How the System Works — End to End

### Voice Generation Flow

```
Browser                          Vite (port 8080)              Flask (port 5000)
  │                                    │                              │
  │  User uploads WAV/MP3 +            │                              │
  │  types script + picks emotion      │                              │
  │─── POST /api/generate ────────────►│── proxy ────────────────────►│
  │    (multipart/form-data)           │                              │
  │                                    │                 1. Save uploaded file to uploads/
  │                                    │                 2. Normalise to 22050Hz mono WAV (torchaudio)
  │                                    │                 3. load_models() (cached after first call)
  │                                    │                 4. se_extractor.get_se() → speaker embedding
  │                                    │                 5. MeloTTS.tts_to_file() → base TTS WAV
  │                                    │                 6. ToneColorConverter.convert() → voice-converted WAV
  │                                    │                 7. avg_pool1d light denoising
  │                                    │                 8. AudioSeal watermark embedding
  │                                    │                 9. Save final to outputs/{id}_final.wav
  │                                    │                 10. Clean up intermediate files
  │                                    │                              │
  │◄── { success, audio_id } ─────────◄│◄────────────────────────────│
  │                                    │                              │
  │  Audio player appears              │                              │
  │─── GET /api/download/{audio_id} ──►│── proxy ────────────────────►│
  │◄── WAV binary ────────────────────◄│◄────────────────────────────│
```

### Voice Authentication Flow

```
Browser                          Vite (port 8080)              Flask (port 5000)
  │                                    │                              │
  │  User uploads audio to verify      │                              │
  │─── POST /api/authenticate ────────►│── proxy ────────────────────►│
  │                                    │                 1. Save to uploads/
  │                                    │                 2. Normalise to 22050Hz mono WAV
  │                                    │                 3. load_models()
  │                                    │                 4. AudioSeal detector.detect_watermark()
  │                                    │                    → probability float (0.0–1.0)
  │                                    │                 5. prob > 0.5 = synthetic
  │                                    │                 6. confidence = (1-prob or prob) * 100
  │                                    │                              │
  │◄── { is_original, confidence,  ───◄│◄────────────────────────────│
  │      probability }                 │                              │
  │                                    │                              │
  │  Circular gauge + verdict appear   │                              │
```

---

## 5. Backend: api_server.py — Full Annotated Breakdown

### Startup Sequence

```python
# 1. NLTK resource auto-download (runs at import time)
download_nltk_resources()  # punkt, punkt_tab, averaged_perceptron_tagger_eng

# 2. OpenVoice path injection
sys.path.insert(0, os.path.join(current_dir, 'OpenVoice'))

# 3. Imports (fail-fast if missing)
from openvoice import se_extractor
from openvoice.api import ToneColorConverter
from melo.api import TTS
from audioseal import AudioSeal

# 4. Flask app + CORS setup
# Allowed origins: localhost:8080, localhost:5173, 127.0.0.1:8080, 127.0.0.1:5173

# 5. Folder creation
os.makedirs('uploads', exist_ok=True)
os.makedirs('outputs', exist_ok=True)

# 6. Model preload (runs at module level, BEFORE __main__)
load_models()  # Loads all 4 models into _models_cache at startup
```

### Model Loading (`load_models()`)

Loads all four AI models once and caches them in the global `_models_cache` dict. On every subsequent call it returns the cached dict immediately.

```python
_models_cache = {
    'converter':    ToneColorConverter,   # OpenVoice V2 voice tone converter
    'tts_model':    TTS,                  # MeloTTS text-to-speech
    'watermarker':  AudioSeal generator,  # AudioSeal watermark embedder
    'detector':     AudioSeal detector,   # AudioSeal watermark detector
}
```

**Important**: `load_models()` raises `RuntimeError` on failure (no `sys.exit()` — that was a stability fix).

### Audio Preprocessing (`preprocess_audio()`)

Converts any input audio to 22050 Hz mono WAV, which is what OpenVoice expects.

- Primary: torchaudio (fast, handles most formats)
- Fallback: pydub (handles edge cases like certain MP3 encodings)
- Normalises peak amplitude to prevent clipping

### Voice Generation (`/api/generate`)

Step-by-step inside the route handler:

1. Validate request (audio file + text required)
2. Save uploaded file: `uploads/{request_id}_{filename}`
3. Preprocess: `uploads/{request_id}_normalized.wav`
4. Load models from cache
5. Extract speaker embedding via `se_extractor.get_se()` — L2 normalised
6. Generate base TTS: `outputs/{request_id}_base.wav`
   - Uses `EN-Default` speaker, `sdp_ratio=0.2, noise_scale=0.6, noise_scale_w=0.8, speed=0.9`
7. Load source embedding: `checkpoints_v2/base_speakers/ses/en-default.pth`
8. Voice conversion: `outputs/{request_id}_raw.wav` (tau=0.3)
9. Light denoising: `F.avg_pool1d` with kernel_size=3
10. AudioSeal watermark: `wav + watermarker.get_watermark(wav, sr)`
11. Save final: `outputs/{request_id}_final.wav`
12. Cleanup temp files (with 0.5s sleep for Windows file-lock safety)
13. Return `{ success, audio_id, message }`

### Voice Authentication (`/api/authenticate`)

1. Save + preprocess uploaded audio
2. Load models
3. Run `detector.detect_watermark(wav_batch, sr)` → `(probability, _)`
4. `prob > 0.5` = synthetic (watermarked); `prob <= 0.5` = original
5. Confidence = `int((1 - prob if is_original else prob) * 100)`
6. Return `{ success, is_original, confidence, probability }`

### Flask Run Configuration

```python
app.run(
    host='0.0.0.0',
    port=5000,
    debug=False,       # No debug mode (prevents double model loading)
    use_reloader=False, # No watchdog (was restarting during PyTorch init)
    threaded=True      # Handle concurrent requests
)
```

---

## 6. AI Models & Checkpoints

### ToneColorConverter (OpenVoice V2)

- **Purpose**: Transfers the tone colour (timbre) of a reference speaker onto TTS-generated speech
- **Config**: `checkpoints_v2/converter/config.json`
- **Weights**: `checkpoints_v2/converter/checkpoint.pth`
- **Key parameter**: `tau=0.3` (controls how strongly the reference voice characteristics are applied — lower = more neutral, higher = more like reference)

### MeloTTS

- **Purpose**: Text-to-speech synthesis (generates the base speech audio before voice conversion)
- **Language**: English (`EN`)
- **Speaker**: `EN-Default`
- **Installed as**: `melo` Python package (not in the OpenVoice folder)

### AudioSeal (Facebook Research)

- **Generator**: `audioseal_wm_16bits` — embeds invisible watermarks into generated audio
- **Detector**: `audioseal_detector_16bits` — detects presence of AudioSeal watermarks
- **Both run in `.eval()` mode with `torch.no_grad()`**
- **Watermark is additive**: `final = original_wav + watermark_tensor`

### Base Speaker Embeddings

Located in `checkpoints_v2/base_speakers/ses/`. These are pre-computed speaker style embeddings for different English accents and other languages. The backend always uses `en-default.pth` as the source embedding for voice conversion.

---

## 7. API Endpoints Reference

All routes are under the `/api` prefix.

### GET `/api/health`

Health check. Returns whether models are loaded and what device is in use.

**Response:**
```json
{
  "status": "healthy",
  "device": "cuda",
  "models_loaded": true
}
```

### POST `/api/generate`

Generate synthetic voice.

**Request:** `multipart/form-data`
- `audio` (file, required) — reference voice sample (WAV, MP3, M4A etc.)
- `text` (string, required) — script to speak
- `emotion` (string, optional) — one of: `neutral`, `happy`, `sad`, `angry`, `jolly`, `anxious` (received but not yet wired into inference)

**Response (success):**
```json
{
  "success": true,
  "audio_id": "a1b2c3d4",
  "message": "Voice generated successfully"
}
```

**Response (error):**
```json
{
  "error": "Description of what went wrong"
}
```

### GET `/api/download/{audio_id}`

Download the generated WAV file.

**Response:** Binary WAV audio (`audio/wav`, `as_attachment=True`, filename `generated_voice.wav`)

### POST `/api/authenticate`

Detect whether audio is AI-generated or human.

**Request:** `multipart/form-data`
- `audio` (file, required)

**Response (success):**
```json
{
  "success": true,
  "is_original": false,
  "confidence": 87,
  "probability": 0.873
}
```

### GET `/api/emotions`

Returns the list of supported emotion styles.

**Response:**
```json
[
  {"id": "neutral", "label": "😐 Neutral"},
  {"id": "happy",   "label": "😊 Happy"},
  {"id": "sad",     "label": "😢 Sad"},
  {"id": "angry",   "label": "😠 Angry"},
  {"id": "jolly",   "label": "🎉 Jolly"},
  {"id": "anxious", "label": "😰 Anxious"}
]
```

### OPTIONS `/api/*`

Handles CORS preflight. Returns 204.

---

## 8. Frontend Architecture

### Entry Point (`main.tsx`)

```tsx
<VoiceStudioProvider>  // Global state context
  <App />
</VoiceStudioProvider>
```

### App (`App.tsx`)

```tsx
<QueryClientProvider>  // react-query
  <TooltipProvider>    // shadcn tooltip
    <Toaster />        // shadcn toast notifications
    <Sonner />         // sonner toast notifications
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </TooltipProvider>
</QueryClientProvider>
```

### Index Page (`pages/Index.tsx`)

The only real page. Contains:
- Top bar with logo + "Clear Session" button
- Hero section with animated icon cluster, title, feature badges
- Tab switcher: **Voice Generation** | **Voice Authentication**
- Conditionally renders `<VoiceGeneration />` or `<VoiceAuthentication />`
- Footer attribution

### Vite Proxy (dev mode)

In `vite.config.ts`, all requests to `/api/*` are forwarded to `http://localhost:5000`. This means the React app always calls `/api/generate` etc. — never a full URL — so no CORS headers are needed in development.

```ts
proxy: {
  "/api": {
    target: "http://localhost:5000",
    changeOrigin: true,
    secure: false,
  }
}
```

The frontend also reads `VITE_API_URL` from `.env` for production builds where you'd point it at a remote backend.

---

## 9. Frontend Component Map

### `VoiceGeneration.tsx`

The main voice cloning UI. Contains a 4-step stepper:

| Step | Component/UI | What it does |
|---|---|---|
| 1 | `AudioUploader` | Upload reference voice (WAV/MP3/M4A) |
| 2 | `Textarea` | Type the script to be spoken |
| 3 | `EmotionSelector` | Pick emotion style (neutral default) |
| 4 | Output panel | Shows `ProcessingOverlay` → `AudioPlayer` + download |

**Internal state:**
- `audioFile: File | null` — the actual File object (lost on page refresh, hence session restore prompt)
- `isProcessing: boolean`
- `processingStageIdx: number` — cycles through `PROCESSING_STAGES` labels every 2.2s during inference

**Key logic:**
- `handleGenerate()` calls `voiceAPI.generateVoice()`, gets back `audio_id`, builds download URL via `voiceAPI.getDownloadUrl(audio_id)`, stores in context
- `handleDownload()` fetches the blob from `/api/download/{audio_id}` and triggers a browser download
- Session restore: if context has `audioFileName` but no live `audioFile`, shows a "re-upload" prompt (File objects can't be stored in sessionStorage)

### `VoiceAuthentication.tsx`

Authentication UI. Single-column, centered.

**Flow:**
1. `AudioUploader` → user uploads file
2. "Analyze Voice" button → `voiceAPI.authenticateVoice()` → loading `ScanningOverlay`
3. Results: `AnalysisResult` with animated confidence gauge

### `AudioUploader.tsx`

Props: `{ file, onFileSelect, label, inputId }`

- Drag-and-drop zone (dashed border, hover effects)
- Hidden `<input type="file" accept="audio/*" />`
- When file selected: shows file name, size, animated waveform bars, play/pause button, remove button
- Calls `onFileSelect(file)` on change, `onFileSelect(null)` on remove
- Manages its own internal `audioUrl` object URL for local preview playback

### `AudioPlayer.tsx`

Props: `{ audioUrl, onRegenerate? }`

Full-featured audio player for the generated output:
- Animated waveform visualization (60 bars, progress-aware)
- Play/Pause, seek slider, volume slider, mute toggle
- Download button
- Optional "Regenerate" button (triggers parent's `handleGenerate` again)

### `EmotionSelector.tsx`

Props: `{ selected, onSelect }`

Six pill buttons: Neutral, Happy, Sad, Angry, Jolly, Anxious. Selected pill gets highlighted with `selected` CSS class.

### `AnalysisResult.tsx`

Props: `{ isOriginal: boolean, confidence: number }`

- Animated SVG circular gauge that counts up to `confidence` over 1.5 seconds
- After count-up: reveals verdict badge (green = original, amber = synthetic)
- Shows "Analysis Details" panel with watermark status

### `ProcessingAnimation.tsx`

Reusable processing spinner component. Note: `VoiceGeneration` and `VoiceAuthentication` both define their own inline processing overlays (`ProcessingOverlay` and `ScanningOverlay`) rather than using this component, so it's currently unused but kept for reference.

### `QuickTip.tsx`

Small `?` icon with tooltip. Receives a `tip` string prop.

---

## 10. State Management

All global state lives in `VoiceStudioContext.tsx`.

### Shape

```typescript
// Generation state
{
  audioFileUrl: string | null,    // object URL for preview (not persisted to server)
  audioFileName: string | null,   // filename string (persisted to sessionStorage)
  text: string,                   // script text
  emotion: string,                // "neutral" | "happy" | "sad" | "angry" | "jolly" | "anxious"
  generatedAudioUrl: string | null, // /api/download/{id} URL
  audioId: string | null,         // 8-char request ID
}

// Authentication state
{
  audioFileUrl: string | null,
  audioFileName: string | null,
  result: { isOriginal: boolean, confidence: number } | null
}
```

### Persistence

The context syncs to `sessionStorage` under key `voice_studio_session` on every state change. On mount it reads from sessionStorage to restore the previous session within the same browser tab. The actual `File` object cannot be stored in sessionStorage (it is not serialisable), so only `audioFileName` is restored — the UI prompts to re-upload if the filename is present but no live file exists.

### Methods

- `setGeneration(partial)` — merge partial update into generation state
- `setAuthentication(partial)` — merge partial update into authentication state
- `resetGeneration()` — restore generation defaults
- `resetAuthentication()` — restore authentication defaults
- `clearAll()` — reset both + remove sessionStorage entry

---

## 11. API Service Layer

`frontend/src/services/api.ts` contains a `VoiceAPIService` class exported as the singleton `voiceAPI`.

```typescript
voiceAPI.healthCheck()                         // GET /api/health
voiceAPI.generateVoice({ audio, text, emotion }) // POST /api/generate
voiceAPI.getDownloadUrl(audioId)                // builds /api/download/{id} string
voiceAPI.downloadAudio(audioId)                 // GET /api/download/{id} → Blob
voiceAPI.authenticateVoice(audioFile)           // POST /api/authenticate
voiceAPI.getEmotions()                          // GET /api/emotions
```

Base URL defaults to `import.meta.env.VITE_API_URL || 'http://localhost:5000/api'`. In development, the Vite proxy intercepts all `/api/*` calls before they leave the browser, so the base URL is effectively just `/api`.

Error handling: All methods parse the response body for `error` fields and throw descriptive `Error` objects.

---

## 12. Styling System

### CSS Variables (defined in `index.css`)

Custom dark colour palette using HSL CSS variables:

| Variable | Value | Used for |
|---|---|---|
| `--background` | `230 25% 8%` | Deep dark navy page background |
| `--primary` | `270 80% 60%` | Purple — main accent |
| `--secondary` | `200 80% 50%` | Blue — secondary accent |
| `--accent` | `320 80% 60%` | Pink — tertiary accent |
| `--success` | `145 80% 45%` | Green — original voice indicator |
| `--warning` | `40 90% 50%` | Amber — synthetic voice indicator |
| `--gradient-start/mid/end` | Purple/Blue/Pink | Gradient helper vars |

### Custom CSS Classes

Defined in `@layer components` in `index.css`:

| Class | What it does |
|---|---|
| `.glass-card` | Semi-transparent dark card with backdrop blur and purple border glow |
| `.gradient-text` | Purple→Blue→Pink gradient text |
| `.gradient-bg` | Purple→Blue gradient background (used on buttons, active tabs, step nodes) |
| `.gradient-border` | Glass card with an animated gradient border (used on active step cards) |
| `.glow` | Purple outer box-shadow glow |
| `.glow-success` | Green glow (original voice result) |
| `.glow-warning` | Amber glow (synthetic voice result) |
| `.upload-zone` | Dashed bordered upload area with hover effects |
| `.emotion-pill` | Rounded pill buttons for emotion selection |
| `.waveform-bar` | Individual bar in waveform visualisations |

### Custom Animations

All defined in `@layer utilities`:

| Class | Animation |
|---|---|
| `.animate-gradient-shift` | Slow gradient position shift (4s, used on gradient-border) |
| `.animate-pulse-glow` | Breathing box-shadow glow (2s) |
| `.animate-scan` | Left-to-right scanning line (2s) |
| `.animate-wave` | Vertical scale pulse for waveform bars (1s) |
| `.animate-float` | Gentle vertical float (3s, used on icon badges) |
| `.animate-spin-slow` | Slow rotation (8s, used on processing rings) |
| `.animate-fade-in-up` | Fade in + slide up (0.5s, used on page sections) |
| `.animate-scale-in` | Scale from 0.9 to 1 (0.3s, used on result cards) |

---

## 13. How to Run the Project

### Prerequisites

- Python 3.9+
- Node.js 16+
- ffmpeg (for pydub fallback audio conversion)
- `checkpoints_v2/` folder with model weights (not in git — must be provided separately)
- `OpenVoice/` folder (clone from https://github.com/myshell-ai/OpenVoice)
- Python venv with all dependencies installed

### Backend Setup (first time)

```bash
cd voice_clone_project
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements_api.txt
pip install -e ./OpenVoice          # install openvoice package
pip install audioseal               # AudioSeal
pip install git+https://github.com/myshell-ai/MeloTTS.git  # MeloTTS
```

### Frontend Setup (first time)

```bash
cd frontend
npm install
```

### Running (Windows)

```bash
# From project root — starts both servers in separate windows
start.bat
```

The script:
1. Activates venv and runs `python api_server.py` in a new terminal
2. Waits 5 seconds for Flask to start
3. Runs `npm run dev` in `frontend/` in another terminal

### Running (Linux/macOS)

```bash
./start.sh
```

### Running Manually

```bash
# Terminal 1 — Backend
cd voice_clone_project
venv/Scripts/activate  # or source venv/bin/activate
python api_server.py

# Terminal 2 — Frontend
cd voice_clone_project/frontend
npm run dev
```

### Access URLs

| Service | URL |
|---|---|
| Frontend (browser UI) | http://localhost:8080 |
| Backend API | http://localhost:5000 |
| Health check | http://localhost:5000/api/health |

> Note: The Vite dev server runs on **port 8080** (not the default 5173). This is set in `vite.config.ts`.

### First Boot Behaviour

When `api_server.py` starts, it immediately calls `load_models()` at module level (before `if __name__ == '__main__'`). You will see:

```
[BOOT] Preloading AI models...
[INFO] Loading models...
[INFO] ✓ ToneColorConverter loaded
[INFO] ✓ MeloTTS loaded
[INFO] ✓ AudioSeal watermarker loaded
[INFO] ✓ AudioSeal detector loaded
[INFO] All models ready!
[BOOT] Models preloaded successfully!
```

The first voice generation will still take time if models need to warm up on GPU/CPU, but subsequent generations are fast (5–15 seconds on GPU, 30–60 seconds on CPU).

---

## 14. File Lifecycle — Temp Files

The backend creates several temp files per request and cleans them up after the response is built.

### Per Generation Request (request_id = 8-char UUID)

| File | Path | Kept? |
|---|---|---|
| Uploaded reference | `uploads/{id}_{filename}` | Deleted after processing |
| Normalised WAV | `uploads/{id}_normalized.wav` | Deleted after processing |
| Base TTS audio | `outputs/{id}_base.wav` | Deleted after processing |
| Voice-converted (raw) | `outputs/{id}_raw.wav` | Deleted after processing |
| **Final watermarked** | `outputs/{id}_final.wav` | **Kept** until downloaded |
| Speaker embedding cache | `processed/{id}_normalized_v2_*/` | Left behind (not cleaned) |

### Per Authentication Request

| File | Path | Kept? |
|---|---|---|
| Uploaded audio | `uploads/{id}_{filename}` | Deleted |
| Normalised WAV | `uploads/{id}_verify.wav` | Deleted |

### cleanup.bat

Run the included `cleanup.bat` to purge all leftover temp files from previous sessions (uploads/\*, outputs/\*, processed/\*) while preserving `.gitkeep` files.

---

## 15. Known Stability Fixes Applied

These were applied to `api_server.py` as deliberate stability improvements:

### Fix 1: Flask Auto-Reload Disabled

```python
# Before (caused watchdog to restart Flask mid-model-load)
app.run(host='0.0.0.0', port=5000, debug=True)

# After
app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False, threaded=True)
```

### Fix 2: Model Preload at Startup

```python
# Runs at module import level, not on first request
print("[BOOT] Preloading AI models...")
load_models()
print("[BOOT] Models preloaded successfully!")
```

### Fix 3: No sys.exit() in load_models()

```python
# Before (killed Flask process on any model error)
sys.exit(1)

# After (raises, Flask handles it)
raise RuntimeError("Model loading failed")
```

### Fix 4: Windows File Cleanup Safety

```python
# Before
for path in [input_path, wav_ref, base_path, raw_output]:
    try:
        os.remove(path)
    except:
        pass

# After (sleep prevents Windows file-lock errors)
import time
time.sleep(0.5)
for path in [input_path, wav_ref, base_path, raw_output]:
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception as e:
        print(f"[{request_id}] Cleanup warning: {e}")
```

---

## 16. What Does NOT Exist / Was Removed

These files were removed during cleanup and should not be referenced:

| Removed | Why |
|---|---|
| `app.py` | Old Streamlit prototype, fully superseded by `api_server.py` + React frontend |
| `ARCHITECTURE.md`, `SETUP_GUIDE.md`, `QUICK_REFERENCE.md`, etc. | Dev notes, not needed to run |
| `package.json` (root level) | Was a shadcn install leftover; frontend has its own in `frontend/` |
| `package-lock.json` (root level) | Same |
| `quick-start.bat`, `quick-start.sh` | Duplicated `start.bat` / `start.sh` |
| `verify_setup.bat` | One-off setup verification, no longer needed |
| `base_gen.wav`, `raw_output.wav`, `final_authenticated.wav`, etc. (root) | Temp files left over from old Streamlit runs |
| All files in `uploads/`, `outputs/`, `processed/` | Leftover session temp files from testing |
| Docker files (`Dockerfile.backend`, `Dockerfile.frontend`, `docker-compose.yml`) | Were deleted from the file system (no longer present despite README mentioning them) |

> **Note on Docker**: The `README.md` still mentions Docker, and `nginx.conf` + `.dockerignore` still exist, but the actual `Dockerfile.backend`, `Dockerfile.frontend`, and `docker-compose.yml` are gone. If Docker deployment is needed, those files must be recreated.

---

## 17. Environment Variables

### Backend (no `.env` file — set in shell or hardcoded)

The backend has no `.env` file. Device (CPU/CUDA) is auto-detected at startup:
```python
device = "cuda" if torch.cuda.is_available() else "cpu"
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5000/api
```

In production builds, change this to your deployed API URL. If `VITE_API_URL` is not set, `api.ts` defaults to `http://localhost:5000/api`.

---

## 18. Dependencies

### Python (`requirements_api.txt`)

```
Flask==3.0.0
flask-cors==4.0.0
torch>=2.0.0
torchaudio>=2.0.0
pydub>=0.25.1
nltk>=3.8.1
Werkzeug==3.0.1
```

Additional packages installed separately (not in requirements_api.txt):
- `openvoice` — from `./OpenVoice/` directory (`pip install -e ./OpenVoice`)
- `melo` — MeloTTS (`pip install git+https://github.com/myshell-ai/MeloTTS.git`)
- `audioseal` — AudioSeal (`pip install audioseal`)
- `traceback`, `uuid`, `os`, `sys`, `time` — Python stdlib

### Frontend (`frontend/package.json` — key packages)

```
react 18.3.1
react-dom 18.3.1
react-router-dom 6.30.1
@tanstack/react-query 5.83.0
tailwindcss 3.4.17
@radix-ui/* (full suite — accordion, dialog, dropdown, tabs, etc.)
lucide-react 0.462.0
sonner 1.7.4
recharts 2.15.4
react-hook-form 7.61.1
zod 3.25.76
class-variance-authority 0.7.1
clsx 2.1.1
tailwind-merge 2.6.0
vite 5.4.19
typescript 5.8.3
@vitejs/plugin-react-swc 3.11.0
lovable-tagger (dev) — Lovable platform component tagging
```

---

*End of PROJECT_CONTEXT.md — this document covers the complete state of the project as of the last edit session.*
