# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Synthetic Voice Studio is a full-stack application for AI-powered voice cloning and audio authenticity detection. It consists of:
- Backend: Python Flask API server (`api_server.py`) with OpenVoice V2, MeloTTS, and AudioSeal
- Frontend: React TypeScript application using Vite and shadcn-ui
- Deployment: Vercel (frontend) + Hugging Face Spaces Docker (backend)

## Common Commands

### Backend Development
```bash
# Activate virtual environment (Windows)
venv\Scripts\activate

# Install backend dependencies
pip install -r requirements_api.txt
pip install audioseal huggingface_hub
pip install -e OpenVoice --no-deps

# Run the API server
python api_server.py

# Health check endpoint
curl http://localhost:7860/api/health
```

### Frontend Development
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Full Stack (Windows)
```bash
# Start both frontend and backend
start.bat
```

## Code Architecture

### Backend Structure (`api_server.py`)
- **Device Management**: Dynamic CUDA/cuDNN probing with CPU fallback
- **Model Loading**: Lazy-loaded singleton cache for ToneColorConverter, MeloTTS, AudioSeal watermarker/detector
- **Audio Pipeline**:
  1. Preprocessing: Convert to 22050Hz mono WAV
  2. Speaker Extraction: ReferenceEncoder from OpenVoice V2
  3. TTS Generation: MeloTTS EN_NEWEST with emotion-driven prosody
  4. Voice Conversion: OpenVoice V2 normalizing flow
  5. Optional Denoising: GPU-only light smoothing
  6. Watermarking: AudioSeal embedding (CPU-skipped to avoid timeout)
  7. Output: Final WAV file with metadata

### Key Endpoints
- `POST /api/generate`: Voice cloning (multipart form: audio file + text + emotion)
- `POST /api/authenticate`: AI audio detection via AudioSeal watermark
- `GET /api/download/:id`: Retrieve generated audio
- `GET /api/health`: Service status and device info
- `GET /api/emotions`: Available emotion options

### Frontend Structure
- `src/components/`: Reusable UI components (shadcn-ui based)
- `src/pages/`: Page components (currently mainly index page)
- `src/hooks/`: Custom React hooks (mobile detection, toast)
- `src/lib/`: Utility functions
- `public/`: Static assets

### Authentication Fix Context
Recent changes fixed AudioSeal watermarking by:
1. Resampling audio to 16kHz (AudioSeal's native rate) before watermark embedding/detection
2. Removing CPU skip that prevented watermarking on CPU-only deployments (HF Spaces)
3. This ensures generated audio contains detectable watermarks for authentication

### Deployment Notes
- **HF Spaces**: Docker container with automatic model checkpoint downloading
- **Vercel**: Frontend built with Vite, configured via vercel.json
- **Environment Variables**:
  - `HF_CHECKPOINT_REPO`: Hugging Face repo ID for model checkpoints
  - `HF_TOKEN`: Optional token for private repos
  - `PORT`: Server port (defaults to 7860 on HF Spaces)

## Development Guidelines
1. Always test watermark embedding/detection locally before deploying
2. When modifying audio processing pipeline, verify sample rate consistency (16kHz for AudioSeal)
3. Keep frontend/backend version compatibility in sync
4. Monitor GPU memory usage when adjusting batch sizes or model parameters
5. CPU fallback should maintain functionality albeit with slower performance