"""
cache_silero.py — run once during Docker build to pre-download and
trust the silero-vad model so runtime containers never hit the
interactive "do you trust this repo?" prompt (which raises EOFError
when stdin is closed in a headless environment).
"""
import os
import torch

os.environ["TORCH_HOME"] = "/home/user/.cache/torch"
torch.hub.set_dir("/home/user/.cache/torch/hub")

try:
    torch.hub.load(
        "snakers4/silero-vad",
        "silero_vad",
        source="github",
        trust_repo=True,
    )
    print("silero-vad cached OK")
except Exception as e:
    # Non-fatal: the 3-strategy fallback in se_extractor_patched.py means
    # faster-whisper segmentation will be tried first anyway.
    print(f"silero-vad pre-cache warning (non-fatal): {e}")
