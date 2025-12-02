const ffmpeg = require('fluent-ffmpeg');
const { exec } = require('child_process');
const fs = require('fs').promises;

/**
 * 映像フレームレート処理モジュール
 * 入力動画を60fpsに変換する(AI補間は使わず、フレーム複製による疑似60fps化)
 */

/**
 * 動画のフレームレートを取得
 * @param {string} videoPath - 動画ファイルのパス
 * @returns {Promise<number>} - フレームレート
 */
function getFrameRate(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      if (!videoStream) {
        return reject(new Error('Video stream not found'));
      }

      // フレームレートを計算
      const fpsString = videoStream.r_frame_rate || videoStream.avg_frame_rate;
      const [num, den] = fpsString.split('/').map(Number);
      const fps = num / den;

      resolve(fps);
    });
  });
}

/**
 * 動画を60fpsに変換(フレーム複製) - 直接execを使用
 * @param {string} inputPath - 入力動画パス
 * @param {string} outputPath - 出力動画パス
 * @param {Object} options - オプション
 * @param {boolean} options.enabled - フレームレート変換を有効化
 * @returns {Promise<string>} - 出力ファイルのパス
 */
async function convertTo60fps(inputPath, outputPath, options = {}) {
  const { enabled = true } = options;
  const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

  return new Promise((resolve, reject) => {
    const escapePath = (p) => `"${p}"`;

    let command;
    if (!enabled) {
      // フレームレート変換が無効の場合は入力をそのままコピー
      command = `${escapePath(ffmpegPath)} -i ${escapePath(inputPath)} -c copy -y ${escapePath(outputPath)}`;
    } else {
      // 60fps変換
      command = `${escapePath(ffmpegPath)} -i ${escapePath(inputPath)} -r 60 -vsync cfr -y ${escapePath(outputPath)}`;
    }

    console.log('Frame rate conversion command:', command);

    exec(command, {
      timeout: 300000, // 5分タイムアウト
      maxBuffer: 100 * 1024 * 1024
    }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`Frame rate conversion failed: ${error.message}\n${stderr}`));
      } else {
        fs.access(outputPath).then(() => {
          resolve(outputPath);
        }).catch(() => {
          reject(new Error(`Converted video was not created: ${outputPath}`));
        });
      }
    });
  });
}

/**
 * 動画の解像度を取得
 * @param {string} videoPath - 動画ファイルのパス
 * @returns {Promise<{width: number, height: number}>} - 解像度
 */
function getVideoResolution(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      if (!videoStream) {
        return reject(new Error('映像ストリームが見つかりません'));
      }

      resolve({
        width: videoStream.width,
        height: videoStream.height
      });
    });
  });
}

module.exports = {
  getFrameRate,
  convertTo60fps,
  getVideoResolution
};
