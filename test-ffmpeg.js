// FFmpegのテストスクリプト
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const path = require('path');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

console.log('FFmpeg path:', ffmpegPath);
console.log('FFprobe path:', ffprobePath);

// テスト用の動画ファイルパスを引数から取得
const videoPath = process.argv[2];

if (!videoPath) {
  console.error('Usage: node test-ffmpeg.js <video-file-path>');
  process.exit(1);
}

console.log('\nTesting video file:', videoPath);
console.log('='.repeat(60));

// ファイルが存在するか確認
if (!fs.existsSync(videoPath)) {
  console.error('ERROR: File does not exist:', videoPath);
  process.exit(1);
}

console.log('File exists: YES');
console.log('File size:', (fs.statSync(videoPath).size / 1024 / 1024).toFixed(2), 'MB');

// 1. ffprobeでメタデータを取得
console.log('\n1. Getting metadata with ffprobe...');
ffmpeg.ffprobe(videoPath, (err, metadata) => {
  if (err) {
    console.error('ERROR: ffprobe failed:', err.message);
    return;
  }

  console.log('SUCCESS: Video metadata:');
  console.log('  Duration:', metadata.format.duration, 'seconds');
  console.log('  Format:', metadata.format.format_name);
  console.log('  Bitrate:', metadata.format.bit_rate, 'bps');
  console.log('  Streams:');

  metadata.streams.forEach((stream, index) => {
    console.log(`    Stream ${index}:`);
    console.log(`      Type: ${stream.codec_type}`);
    console.log(`      Codec: ${stream.codec_name}`);

    if (stream.codec_type === 'video') {
      console.log(`      Resolution: ${stream.width}x${stream.height}`);
      console.log(`      Frame rate: ${stream.r_frame_rate}`);
      console.log(`      Pixel format: ${stream.pix_fmt}`);
    }

    if (stream.codec_type === 'audio') {
      console.log(`      Sample rate: ${stream.sample_rate} Hz`);
      console.log(`      Channels: ${stream.channels}`);
      console.log(`      Channel layout: ${stream.channel_layout}`);
    }
  });

  const hasAudio = metadata.streams.some(s => s.codec_type === 'audio');
  const hasVideo = metadata.streams.some(s => s.codec_type === 'video');

  console.log('\n  Has audio track:', hasAudio ? 'YES' : 'NO');
  console.log('  Has video track:', hasVideo ? 'YES' : 'NO');

  if (!hasAudio) {
    console.log('\nWARNING: This video does not have an audio track!');
    console.log('Audio extraction will fail for this file.');
    console.log('\nTo add audio to this video, you can:');
    console.log('1. Re-export the video with audio included');
    console.log('2. Use a video with audio track for processing');
  }

  if (!hasVideo) {
    console.log('\nWARNING: This file does not have a video track!');
  }

  // 2. 音声抽出テスト
  if (hasAudio) {
    console.log('\n2. Testing audio extraction...');
    const outputPath = path.join(__dirname, 'temp', 'test_audio.wav');

    // tempディレクトリを作成
    if (!fs.existsSync(path.join(__dirname, 'temp'))) {
      fs.mkdirSync(path.join(__dirname, 'temp'), { recursive: true });
    }

    let stderrOutput = '';

    ffmpeg(videoPath)
      .outputOptions([
        '-vn',
        '-acodec pcm_s16le',
        '-ar 48000',
        '-ac 1'
      ])
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log('  FFmpeg command:', commandLine);
      })
      .on('stderr', (stderrLine) => {
        stderrOutput += stderrLine + '\n';
      })
      .on('end', () => {
        console.log('SUCCESS: Audio extracted to:', outputPath);
        const audioSize = fs.statSync(outputPath).size;
        console.log('  Audio file size:', (audioSize / 1024 / 1024).toFixed(2), 'MB');

        // クリーンアップ
        try {
          fs.unlinkSync(outputPath);
          console.log('  Cleaned up test file');
        } catch (e) {
          // Ignore cleanup errors
        }
      })
      .on('error', (err) => {
        console.error('ERROR: Audio extraction failed:', err.message);
        console.error('\nFFmpeg stderr output:');
        console.error(stderrOutput);
      })
      .run();
  }
});
