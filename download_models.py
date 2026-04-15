"""
download_models.py
------------------
Downloads OpenVoice V2 checkpoints from a Hugging Face model repo at startup
and places them into the local directory structure the app expects.

Your HF model repo must have this layout (matching the local checkpoints_v2/ tree):
    checkpoints_v2/converter/config.json
    checkpoints_v2/converter/checkpoint.pth
    checkpoints_v2/base_speakers/ses/en-default.pth
    checkpoints_v2/base_speakers/ses/en-newest.pth

Required environment variable:
    HF_CHECKPOINT_REPO  -- HF repo ID, e.g. "Aniket-ux3/openvoice-checkpoints"
    HF_TOKEN            -- HF read token (REQUIRED in production to avoid 429 rate limits)

IMPORTANT for HF Spaces deployment:
    Set HF_TOKEN as a Space Secret in your Space settings.
    Unauthenticated downloads from the same IP get rate-limited after ~3 restarts.
    Authenticated requests have much higher limits.

MeloTTS models (EN_NEWEST etc.) download automatically at runtime via HuggingFace Hub.
"""

import os
import sys
import time
import shutil

REPO_ID  = os.environ.get("HF_CHECKPOINT_REPO", "")
HF_TOKEN = os.environ.get("HF_TOKEN", None)

# Maps: path inside the HF repo -> local path the app needs.
FILE_MAP = {
    "checkpoints_v2/converter/config.json":            "checkpoints_v2/converter/config.json",
    "checkpoints_v2/converter/checkpoint.pth":         "checkpoints_v2/converter/checkpoint.pth",
    "checkpoints_v2/base_speakers/ses/en-default.pth": "checkpoints_v2/base_speakers/ses/en-default.pth",
    "checkpoints_v2/base_speakers/ses/en-newest.pth":  "checkpoints_v2/base_speakers/ses/en-newest.pth",
}

# Files that are non-fatal if missing (fallback exists in code)
NON_FATAL = {"checkpoints_v2/base_speakers/ses/en-newest.pth"}


def download_checkpoints():
    if not REPO_ID:
        print("[MODELS] HF_CHECKPOINT_REPO not set -- assuming checkpoints exist locally.")
        return

    try:
        from huggingface_hub import hf_hub_download
    except ImportError:
        print("[MODELS] huggingface_hub not installed -- skipping download.")
        return

    if not HF_TOKEN:
        print("[MODELS] WARNING: HF_TOKEN not set. Downloads are unauthenticated.")
        print("[MODELS]          Set HF_TOKEN as a Space Secret to avoid 429 rate limits.")

    print(f"[MODELS] Downloading checkpoints from '{REPO_ID}' ...")

    for hf_path, local_path in FILE_MAP.items():
        if os.path.exists(local_path):
            print(f"[MODELS] Already exists: {local_path}")
            continue

        os.makedirs(os.path.dirname(local_path), exist_ok=True)

        # Retry up to 3 times with backoff to handle transient 429s
        last_error = None
        for attempt in range(3):
            try:
                cached = hf_hub_download(
                    repo_id=REPO_ID,
                    filename=hf_path,
                    token=HF_TOKEN,
                    repo_type="model",
                )
                shutil.copy2(cached, local_path)
                print(f"[MODELS] Downloaded: {hf_path} -> {local_path}")
                last_error = None
                break
            except Exception as e:
                last_error = e
                if "429" in str(e) or "rate limit" in str(e).lower():
                    wait = 30 * (attempt + 1)
                    print(f"[MODELS] Rate limited (attempt {attempt+1}/3). Waiting {wait}s...")
                    time.sleep(wait)
                else:
                    break  # Non-rate-limit error -- no point retrying

        if last_error is not None:
            print(f"[MODELS] Failed to download '{hf_path}': {last_error}")
            if hf_path in NON_FATAL:
                print(f"[MODELS] Non-fatal: will use en-default.pth as fallback source SE.")
            else:
                print("[MODELS] Cannot start without this checkpoint. Aborting.")
                print("[MODELS] Tip: set HF_TOKEN as a Space Secret to avoid rate limits.")
                sys.exit(1)

    print("[MODELS] All checkpoints ready.")


if __name__ == "__main__":
    download_checkpoints()
