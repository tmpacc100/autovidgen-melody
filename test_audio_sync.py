#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
音声同期スクリプトのテスト
"""
import sys
import os

print("=== Python Environment Test ===")
print(f"Python version: {sys.version}")
print(f"Python executable: {sys.executable}")
print(f"Current directory: {os.getcwd()}")
print(f"Arguments: {sys.argv}")

# librosaのインポートテスト
try:
    import librosa
    print(f"✓ librosa version: {librosa.__version__}")
except ImportError as e:
    print(f"✗ librosa import failed: {e}")
    sys.exit(1)

# scipyのインポートテスト
try:
    import scipy
    print(f"✓ scipy version: {scipy.__version__}")
except ImportError as e:
    print(f"✗ scipy import failed: {e}")
    sys.exit(1)

# numpyのインポートテスト
try:
    import numpy as np
    print(f"✓ numpy version: {np.__version__}")
except ImportError as e:
    print(f"✗ numpy import failed: {e}")
    sys.exit(1)

# 引数チェック
if len(sys.argv) < 3:
    print("\nUsage: python test_audio_sync.py <audio1.wav> <audio2.wav>")
    sys.exit(1)

audio1_path = sys.argv[1]
audio2_path = sys.argv[2]

print(f"\n=== File Check ===")
print(f"Audio 1: {audio1_path}")
print(f"  Exists: {os.path.exists(audio1_path)}")
if os.path.exists(audio1_path):
    print(f"  Size: {os.path.getsize(audio1_path)} bytes")

print(f"Audio 2: {audio2_path}")
print(f"  Exists: {os.path.exists(audio2_path)}")
if os.path.exists(audio2_path):
    print(f"  Size: {os.path.getsize(audio2_path)} bytes")

if not os.path.exists(audio1_path) or not os.path.exists(audio2_path):
    print("\nError: One or both audio files do not exist")
    sys.exit(1)

# 音声ファイルの読み込みテスト
print(f"\n=== Audio Loading Test ===")
try:
    print("Loading audio 1...")
    y1, sr1 = librosa.load(audio1_path, sr=22050, duration=5.0, mono=True)
    print(f"✓ Audio 1 loaded: {len(y1)} samples, sr={sr1}")
    print(f"  Duration: {len(y1)/sr1:.2f} seconds")
    print(f"  RMS: {np.sqrt(np.mean(y1**2)):.6f}")
    print(f"  Peak: {np.max(np.abs(y1)):.6f}")
except Exception as e:
    print(f"✗ Failed to load audio 1: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    print("\nLoading audio 2...")
    y2, sr2 = librosa.load(audio2_path, sr=22050, duration=5.0, mono=True)
    print(f"✓ Audio 2 loaded: {len(y2)} samples, sr={sr2}")
    print(f"  Duration: {len(y2)/sr2:.2f} seconds")
    print(f"  RMS: {np.sqrt(np.mean(y2**2)):.6f}")
    print(f"  Peak: {np.max(np.abs(y2)):.6f}")
except Exception as e:
    print(f"✗ Failed to load audio 2: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n=== All tests passed ===")
