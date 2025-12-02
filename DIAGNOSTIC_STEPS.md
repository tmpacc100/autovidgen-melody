# Quick Diagnostic Steps for FFmpeg Error

## Current Error: "ffmpeg exited with code 1: Conversion failed!"

### Step 1: Test Your Video Files

Run the diagnostic script on BOTH input videos:

```bash
# Test Video 1
node test-ffmpeg.js "path\to\video1.mp4"

# Test Video 2 (ScreenRecording)
node test-ffmpeg.js "path\to\ScreenRecording.mov"
```

### Step 2: Check the Output

Look for these critical indicators:

#### ✅ GOOD - Video is OK:
```
Has audio track: YES
Has video track: YES
SUCCESS: Audio extracted to: ...
```

#### ❌ BAD - Problem Found:
```
Has audio track: NO
WARNING: This video does not have an audio track!
```

### Step 3: Common Issues and Solutions

| Problem | Diagnostic Output | Solution |
|---------|------------------|----------|
| No audio track | `Has audio track: NO` | Re-export video with audio OR use different video file |
| File not found | `ERROR: File does not exist` | Check file path, remove Japanese characters from path |
| Corrupted file | `ERROR: ffprobe failed` | Re-download or re-export the video |
| Unsupported codec | `ERROR: Audio extraction failed` | Convert to MP4 (H.264) using HandBrake |

### Step 4: What the App Needs

**BOTH videos must have:**
- ✓ Audio track (AAC, MP3, or PCM)
- ✓ Valid video track
- ✓ Duration > 0 seconds
- ✓ Readable by FFmpeg

**Video B (ScreenRecording) must:**
- ✓ Have "ScreenRecording" in filename
- ✓ Have audio track for synchronization

### Step 5: Run the App Again

After confirming both videos have audio tracks:

1. Start the application: `npm start`
2. Select your validated video files
3. The error message will now show detailed FFmpeg output if it still fails
4. Look for the specific error in the `<pre>` formatted error message

### Example Diagnostic Output

**Good Video:**
```
Testing video file: C:\Videos\video1.mp4
============================================================
File exists: YES
File size: 45.32 MB

1. Getting metadata with ffprobe...
SUCCESS: Video metadata:
  Duration: 30.5 seconds
  Format: mov,mp4,m4a,3gp,3g2,mj2
  Streams:
    Stream 0:
      Type: video
      Codec: h264
      Resolution: 1080x1920
      Frame rate: 30/1
    Stream 1:
      Type: audio
      Codec: aac
      Sample rate: 48000 Hz
      Channels: 2

  Has audio track: YES ✓
  Has video track: YES ✓

2. Testing audio extraction...
SUCCESS: Audio extracted to: temp\test_audio.wav
  Audio file size: 5.43 MB
  Cleaned up test file
```

**Problem Video:**
```
Testing video file: C:\Videos\no_audio.mp4
============================================================
File exists: YES
File size: 40.12 MB

1. Getting metadata with ffprobe...
SUCCESS: Video metadata:
  Duration: 30.5 seconds
  Format: mov,mp4,m4a,3gp,3g2,mj2
  Streams:
    Stream 0:
      Type: video
      Codec: h264
      Resolution: 1080x1920
      Frame rate: 30/1

  Has audio track: NO ✗
  Has video track: YES

WARNING: This video does not have an audio track!
Audio extraction will fail for this file.

To add audio to this video, you can:
1. Re-export the video with audio included
2. Use a video with audio track for processing
```

### Step 6: If Still Failing

The enhanced error handling will now show:

```
エラーが発生しました:
Video A (video1.mp4) does not have an audio track. Please provide a video with audio.
```

OR

```
エラーが発生しました:
Audio extraction failed for C:\path\to\video.mp4:
Output file #0 does not contain any stream
Stderr: [detailed FFmpeg error output here]
```

This will tell you exactly which video is the problem and why.

---

## Quick Fix Checklist

- [ ] Both videos have audio tracks (confirmed with test-ffmpeg.js)
- [ ] File paths use English characters only
- [ ] Video B filename contains "ScreenRecording"
- [ ] Both videos are valid MP4 or MOV files
- [ ] Videos are not corrupted (can play in media player)
- [ ] Videos are longer than 5 seconds
- [ ] Reference JPEG exists and is valid

---

## Need Help?

Run both test commands and share the output:

```bash
node test-ffmpeg.js "path\to\video1.mp4" > video1_diagnostic.txt
node test-ffmpeg.js "path\to\video2.mp4" > video2_diagnostic.txt
```

Then check the `.txt` files for the diagnostic results.
