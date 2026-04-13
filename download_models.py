"""
download_models.py
──────────────────
Downloads OpenVoice V2 checkpoints and stores them in HF Spaces persistent
storage (/data) so they survive container restarts and avoid 429 rate limits.

STRATEGY:
  - On HF Spaces: /data is a persistent disk that survives restarts.
    All large files go to /data/checkpoints_v2/ on first boot, then a symlink
    is created so the app can find them at ./checkpoints_v2/.
  - Locally (HF_CHECKPOINT_REPO not set): no-op, files already in place.

Environment variables:
  HF_CHECKPOINT_REPO  — HF model repo ID (e.g. "Aniket-ux3/openvoice-checkpoints")
  HF_TOKEN            — (optional) HF read token for private repos
"""

import os
import sys
import shutil

REPO_ID  = os.environ.get("HF_CHECKPOINT_REPO", "")
HF_TOKEN = os.environ.get("HF_TOKEN", None)

# Persistent storage root on HF Spaces — survives container restarts.
# Falls back to the local directory when running outside HF Spaces.
PERSISTENT_ROOT = "/data" if os.path.isdir("/data") else "."
PERSISTENT_CKPT = os.path.join(PERSISTENT_ROOT, "checkpoints_v2")
LOCAL_CKPT      = "checkpoints_v2"

# All checkpoint files needed by the app.
FILE_MAP = {
    "checkpoints_v2/converter/config.json":            "checkpoints_v2/converter/config.json",
    "checkpoints_v2/converter/checkpoint.pth":         "checkpoints_v2/converter/checkpoint.pth",
    "checkpoints_v2/base_speakers/ses/en-default.pth": "checkpoints_v2/base_speakers/ses/en-default.pth",
    "checkpoints_v2/base_speakers/ses/en-newest.pth":  "checkpoints_v2/base_speakers/ses/en-newest.pth",
}


def _setup_persistent_symlink():
    """
    On HF Spaces, point ./checkpoints_v2 -> /data/checkpoints_v2.
    This means files downloaded once to /data persist across restarts.
    Returns the effective checkpoint root (local or persistent).
    """
    if PERSISTENT_ROOT == ".":
        return  # Not on HF Spaces, nothing to do

    # Create persistent directory structure
    os.makedirs(PERSISTENT_CKPT, exist_ok=True)
    os.makedirs(os.path.join(PERSISTENT_CKPT, "converter"), exist_ok=True)
    os.makedirs(os.path.join(PERSISTENT_CKPT, "base_speakers", "ses"), exist_ok=True)

    # If ./checkpoints_v2 already exists and is NOT a symlink to /data,
    # move any pre-existing files to /data then replace with symlink.
    if os.path.exists(LOCAL_CKPT) and not os.path.islink(LOCAL_CKPT):
        print(f"[MODELS] Moving existing checkpoints to persistent storage ({PERSISTENT_CKPT})...")
        for dirpath, _, filenames in os.walk(LOCAL_CKPT):
            for fname in filenames:
                src = os.path.join(dirpath, fname)
                # Compute relative path within checkpoints_v2/
                rel = os.path.relpath(src, LOCAL_CKPT)
                dst = os.path.join(PERSISTENT_CKPT, rel)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                if not os.path.exists(dst):
                    shutil.copy2(src, dst)
        shutil.rmtree(LOCAL_CKPT)

    # Create symlink ./checkpoints_v2 -> /data/checkpoints_v2
    if not os.path.islink(LOCAL_CKPT):
        os.symlink(PERSISTENT_CKPT, LOCAL_CKPT)
        print(f"[MODELS] Symlinked {LOCAL_CKPT} -> {PERSISTENT_CKPT}")
    else:
        print(f"[MODELS] Persistent symlink already in place: {LOCAL_CKPT} -> {PERSISTENT_CKPT}")


def download_checkpoints():
    if not REPO_ID:
        print("[MODELS] HF_CHECKPOINT_REPO not set -- assuming checkpoints exist locally.")
        return

    try:
        from huggingface_hub import hf_hub_download
    except ImportError:
        print("[MODELS] huggingface_hub not installed -- skipping download.")
        return

    # Set up /data symlink before checking file existence
    _setup_persistent_symlink()

    print(f"[MODELS] Checking checkpoints (persistent: {PERSISTENT_ROOT != '.'})...")

    for hf_path, local_path in FILE_MAP.items():
        if os.path.exists(local_path):
            size_mb = os.path.getsize(local_path) / 1024 / 1024
            print(f"[MODELS] ✓ Already exists ({size_mb:.1f} MB): {local_path}")
            continue

        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        print(f"[MODELS] Downloading: {hf_path} ...")

        try:
            cached = hf_hub_download(
                repo_id=REPO_ID,
                filename=hf_path,
                token=HF_TOKEN,
                repo_type="model",
            )
            shutil.copy2(cached, local_path)
            size_mb = os.path.getsize(local_path) / 1024 / 1024
            print(f"[MODELS] ✓ Downloaded ({size_mb:.1f} MB): {hf_path}")

        except Exception as e:
            print(f"[MODELS] ✗ Failed to download '{hf_path}': {e}")
            if "checkpoint.pth" in hf_path:
                print("[MODELS] FATAL: Cannot start without converter checkpoint. Aborting.")
                sys.exit(1)
            elif "en-newest" in hf_path:
                print("[MODELS] WARNING: en-newest.pth missing -- will fall back to en-default.pth")
            else:
                print("[MODELS] WARNING: Non-critical file missing, continuing.")

    print("[MODELS] All checkpoints ready.")


if __name__ == "__main__":
    download_checkpoints()
