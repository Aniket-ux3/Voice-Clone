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

- **Clone a voice** from a short sample
- **Generate speech** with different emotions
- **Check whether audio is human or AI-generated**
- Use everything through a **simple, clean web interface**

---

## Features

### Voice Cloning
Upload a short voice sample and generate new speech in the same style.

### Emotion Control
Generate speech with different tones such as:
- Neutral
- Happy
- Sad
- Angry
- Jolly
- Anxious

### Audio Detection
Analyze uploaded audio and classify whether it is likely:
- Human speech
- AI-generated speech

### Modern UI
- Clean and responsive frontend
- Easy upload and playback workflow
- Works on desktop and mobile

### Smart Execution
- Uses **GPU** when available
- Falls back to **CPU** automatically

---

## How It Works

```text
User Uploads Audio + Text
           │
           ▼
   Reference Voice Processing
           │
           ▼
   Text-to-Speech Generation
           │
           ▼
   Voice Style Transfer
           │
           ▼
   Watermark / Detection Layer
           │
           ▼
      Final Audio Output
```

### Main Pipeline
- **OpenVoice V2** → voice style transfer
- **MeloTTS** → speech generation
- **faster-whisper** → audio segmentation
- **AudioSeal** → watermarking + detection

---

## Tech Stack

### Frontend
- React
- TypeScript
- Tailwind CSS
- Vite

### Backend
- Python
- Flask
- PyTorch

### AI / Audio
- OpenVoice V2
- MeloTTS
- AudioSeal
- faster-whisper

### Deployment
- Vercel
- Hugging Face Spaces
- Docker

---


## 📡 API Overview

### Health Check
```http
GET /api/health
```

### Generate Voice
```http
POST /api/generate
```

### Download Audio
```http
GET /api/download/:audio_id
```

### Authenticate Audio
```http
POST /api/authenticate
```

---

## Limitations

- Slower performance on CPU
- Best results come from clean voice samples
- Default setup is mainly focused on English
- Some third-party models are non-commercial only

---

## 📄 License

This project is released under the **MIT License**.

### Third-party tools
- **OpenVoice V2** — MIT
- **MeloTTS** — MIT
- **AudioSeal** — CC-BY-NC 4.0
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
