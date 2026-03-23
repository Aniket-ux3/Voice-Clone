"""
download_models.py
──────────────────
Downloads OpenVoice V2 checkpoints from a Hugging Face model repo at startup.

Required environment variables:
  HF_CHECKPOINT_REPO   — your HF repo ID, e.g. "yourusername/openvoice-checkpoints"
  HF_TOKEN             — (optional) your HF read token, needed for private repos

If HF_CHECKPOINT_REPO is not set, this script assumes checkpoints already exist
locally (useful for local development where you have the files already).
"""

import os
import sys

REPO_ID  = os.environ.get("HF_CHECKPOINT_REPO", "")
HF_TOKEN = os.environ.get("HF_TOKEN", None)

# All files the app needs from the checkpoint repo
REQUIRED_FILES = [
    "checkpoints_v2/converter/config.json",
    "checkpoints_v2/converter/checkpoint.pth",
    "checkpoints_v2/base_speakers/ses/en-default.pth",
]


def download_checkpoints():
    if not REPO_ID:
        print("[MODELS] HF_CHECKPOINT_REPO not set — assuming checkpoints exist locally.")
        return

    try:
        from huggingface_hub import hf_hub_download
    except ImportError:
        print("[MODELS] huggingface_hub not installed — skipping download.")
        return

    print(f"[MODELS] Downloading checkpoints from '{REPO_ID}' ...")

    for file_path in REQUIRED_FILES:
        if os.path.exists(file_path):
            print(f"[MODELS] ✓ Already exists: {file_path}")
            continue

        os.makedirs(os.path.dirname(file_path), exist_ok=True)

        try:
            hf_hub_download(
                repo_id=REPO_ID,
                filename=file_path,
                token=HF_TOKEN,
                local_dir=".",        # Downloads relative to working directory
                local_dir_use_symlinks=False,
            )
            print(f"[MODELS] ✓ Downloaded: {file_path}")
        except Exception as e:
            print(f"[MODELS] ✗ Failed to download {file_path}: {e}")
            print("[MODELS] Cannot start without model checkpoints. Aborting.")
            sys.exit(1)

    print("[MODELS] All checkpoints ready.")


if __name__ == "__main__":
    download_checkpoints()
