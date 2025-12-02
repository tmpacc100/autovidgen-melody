/**
 * ワーカープロセス
 * 動画処理を別プロセスで実行してメインプロセスをブロックしない
 */

const { processVideo } = require('./modules/videoPipeline');

// 標準入力からメッセージを受信
process.stdin.setEncoding('utf8');
let buffer = '';

process.stdin.on('data', (chunk) => {
  buffer += chunk;

  // 完全なメッセージ（改行で区切られている）を処理
  const lines = buffer.split('\n');
  buffer = lines.pop() || ''; // 最後の不完全な行はバッファに残す

  lines.forEach(async (line) => {
    if (!line.trim()) return;

    try {
      const message = JSON.parse(line);

      if (message.type === 'start') {
        await handleProcessVideo(message.data);
      }
    } catch (err) {
      sendMessage({ type: 'error', error: 'Invalid message format' });
    }
  });
});

// 動画処理を実行
async function handleProcessVideo(data) {
  const { inputs, params, outputOptions } = data;

  // 進捗コールバック
  const progressCallback = (step, progress, message) => {
    sendMessage({
      type: 'progress',
      step,
      progress,
      message
    });
  };

  try {
    // FFmpegのパスを設定
    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
    const ffprobePath = require('@ffprobe-installer/ffprobe').path;
    const ffmpeg = require('fluent-ffmpeg');

    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffprobePath);

    // 処理を実行
    const result = await processVideo(inputs, params, outputOptions, progressCallback);

    // 成功メッセージを送信
    sendMessage({
      type: 'complete',
      outputPath: result
    });

    // 処理完了後にプロセスを終了
    process.exit(0);

  } catch (error) {
    // エラーを詳細にログ出力
    console.error('\n=== Worker Process Error ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Stack trace:');
    console.error(error.stack);
    console.error('===========================\n');

    // エラーメッセージを送信
    sendMessage({
      type: 'error',
      error: error.message,
      stack: error.stack
    });

    // エラー終了
    process.exit(1);
  }
}

// メッセージを親プロセスに送信
function sendMessage(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

// プロセス開始メッセージ
sendMessage({ type: 'ready' });
