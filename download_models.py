"""
download_models.py
──────────────────
Downloads OpenVoice V2 checkpoints from a Hugging Face model repo at startup
and places them into the local directory structure the app expects.

Your HF model repo has this layout (matching the local checkpoints_v2/ tree):
    checkpoints_v2/converter/config.json
    checkpoints_v2/converter/checkpoint.pth
    checkpoints_v2/base_speakers/ses/en-default.pth

Required environment variable:
    HF_CHECKPOINT_REPO   — HF repo ID, e.g. "Aniket-ux3/openvoice-checkpoints"
    HF_TOKEN             — (optional) HF read token for private repos

If HF_CHECKPOINT_REPO is not set this script is a no-op (safe for local dev
where you already have the files in place).
"""

import os
import sys
import shutil

REPO_ID  = os.environ.get("HF_CHECKPOINT_REPO", "")
HF_TOKEN = os.environ.get("HF_TOKEN", None)

# Maps: path inside the HF repo → local path the app needs
# The HF repo folder structure mirrors the local checkpoints_v2/ layout.
FILE_MAP = {
    "checkpoints_v2/converter/config.json":              "checkpoints_v2/converter/config.json",
    "checkpoints_v2/converter/checkpoint.pth":           "checkpoints_v2/converter/checkpoint.pth",
    "checkpoints_v2/base_speakers/ses/en-default.pth":   "checkpoints_v2/base_speakers/ses/en-default.pth",
}


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

    for hf_path, local_path in FILE_MAP.items():
        if os.path.exists(local_path):
            print(f"[MODELS] ✓ Already exists: {local_path}")
            continue

        # Ensure the target directory exists
        os.makedirs(os.path.dirname(local_path), exist_ok=True)

        try:
            cached = hf_hub_download(
                repo_id=REPO_ID,
                filename=hf_path,      # path inside the HF repo
                token=HF_TOKEN,
                repo_type="model",
            )
            shutil.copy2(cached, local_path)
            print(f"[MODELS] ✓ Downloaded: {hf_path} → {local_path}")

        except Exception as e:
            print(f"[MODELS] ✗ Failed to download '{hf_path}': {e}")
            print("[MODELS] Cannot start without model checkpoints. Aborting.")
            sys.exit(1)

    print("[MODELS] All checkpoints ready.")


if __name__ == "__main__":
    download_checkpoints()
