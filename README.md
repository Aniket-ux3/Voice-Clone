# 🎙️ Voice Clone Project

A powerful voice cloning application using OpenVoice V2, featuring emotion transfer and voice conversion capabilities.

## ✨ Features

- 🎯 High-quality voice cloning with OpenVoice V2
- 🎭 Emotion and style transfer
- 🔐 Audio watermarking with AudioSeal
- 🚀 Easy deployment with Docker
- 🌐 Modern web interface
- 📊 Real-time processing

## 🚀 Quick Start

### Using Docker (Recommended)

1. **Clone the repository**:
```bash
git clone <your-repo-url>
cd voice_clone_project
```

2. **Start the application**:
```bash
docker-compose up --build
```

3. **Access the app**:
   - Frontend: http://localhost
   - Backend API: http://localhost:5000

### Manual Setup

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed instructions.

## 📋 Prerequisites

- Docker Desktop (recommended)
- OR Python 3.10+ with ffmpeg

## 📖 Documentation

- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Complete setup and deployment instructions
- [Setup Guide](SETUP_GUIDE.md) - Manual installation guide
- [Architecture](ARCHITECTURE.md) - System architecture overview
- [Quick Reference](QUICK_REFERENCE.md) - API and usage reference

## 🛠️ Tech Stack

- **Backend**: Python, Flask, OpenVoice V2, MeloTTS
- **Frontend**: React/Vue (customize based on your frontend)
- **Containerization**: Docker, Docker Compose
- **Audio Processing**: FFmpeg, AudioSeal

## 📁 Project Structure

```
voice_clone_project/
├── api_server.py          # Backend API
├── docker-compose.yml     # Docker orchestration
├── Dockerfile.backend     # Backend container
├── Dockerfile.frontend    # Frontend container
├── frontend/              # Frontend code
├── checkpoints_v2/        # Model checkpoints
├── emotions/              # Emotion data
├── uploads/               # Input files
└── outputs/               # Generated audio
```

## 🔧 Configuration

Edit `docker-compose.yml` to customize:
- Port mappings
- Environment variables
- Volume mounts
- Resource limits

## 🐛 Troubleshooting

**Container won't start?**
```bash
docker-compose logs backend
```

**Port conflicts?**
```yaml
# Edit docker-compose.yml
ports:
  - "5001:5000"  # Change port
```

**Build issues?**
```bash
docker-compose down -v
docker-compose up --build --force-recreate
```

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for more troubleshooting tips.

## 📝 License

Include your license information here.

## 🙏 Acknowledgments

- [OpenVoice V2](https://github.com/myshell-ai/OpenVoice)
- [MeloTTS](https://github.com/myshell-ai/MeloTTS)
- [AudioSeal](https://github.com/facebookresearch/audioseal)

## 📧 Contact

Your contact information or project links here.

---

⭐ If this project helped you, please give it a star!
