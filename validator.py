import torch
import torchaudio
from audioseal import AudioSeal
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'OpenVoice'))

def verify_audio(file_path):
    # Load Detector
    detector = AudioSeal.load_detector("audioseal_detector_16bits")
    
    # Load Audio
    wav, sr = torchaudio.load(file_path)
    
    # Run Detection
    # result is the probability (0 to 1) that it is watermarked
    result, message = detector.detect_watermark(wav.unsqueeze(0), sr)
    
    prob = result.item()
    print(f"--- Analysis for {file_path} ---")
    print(f"Watermark Probability: {prob:.4f}")
    
    if prob > 0.5:
        print("RESULT: ❌ AI-GENERATED (Authenticated System)")
    else:
        print("RESULT: ✅ ORIGINAL / UNKNOWN SOURCE")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        verify_audio(sys.argv[1])
    else:
        print("Usage: python validator.py <path_to_audio_file>")