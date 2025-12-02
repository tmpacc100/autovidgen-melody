const ffmpeg = require('fluent-ffmpeg');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * 音声ラウドネス正規化モジュール
 * EBU R128 (LUFS) 基準のラウドネス正規化
 */

/**
 * 音声のラウドネス情報を測定
 * @param {string} audioPath - 音声ファイルのパス
 * @returns {Promise<Object>} - ラウドネス情報
 */
async function measureLoudness(audioPath) {
  return new Promise((resolve, reject) => {
    let loudnessData = '';

    ffmpeg(audioPath)
      .audioFilters('loudnorm=print_format=json')
      .outputOptions([
        '-f null'
      ])
      .output('-')
      .on('stderr', (stderrLine) => {
        loudnessData += stderrLine;
      })
      .on('end', () => {
        try {
          // JSON部分を抽出
          const jsonMatch = loudnessData.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            return reject(new Error('ラウドネス情報が取得できませんでした'));
          }

          const loudness = JSON.parse(jsonMatch[0]);
          resolve({
            inputI: parseFloat(loudness.input_i),
            inputTP: parseFloat(loudness.input_tp),
            inputLRA: parseFloat(loudness.input_lra),
            inputThresh: parseFloat(loudness.input_thresh),
            targetOffset: parseFloat(loudness.target_offset)
          });
        } catch (err) {
          reject(err);
        }
      })
      .on('error', reject)
      .run();
  });
}

/**
 * ラウドネス正規化を適用（直接execを使用）
 * @param {string} inputPath - 入力音声/動画ファイルのパス
 * @param {string} outputPath - 出力ファイルのパス
 * @param {Object} options - オプション
 * @returns {Promise<string>} - 出力ファイルのパス
 */
async function normalizeLoudness(inputPath, outputPath, options = {}) {
  const { exec } = require('child_process');
  const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
  const fs = require('fs').promises;

  const {
    targetLUFS = -14.0,     // 目標LUFS値
    gain = 0.0,             // 追加ゲイン(dB)
    limiterThreshold = -1.0 // リミッター閾値(dBTP)
  } = options;

  const loudness = await measureLoudness(inputPath);

  // 1パス目のラウドネス測定結果を使用して2パス目で正規化
  const measuredI = loudness.inputI;
  const measuredTP = loudness.inputTP;
  const measuredLRA = loudness.inputLRA;
  const measuredThresh = loudness.inputThresh;

  return new Promise((resolve, reject) => {
    const escapePath = (p) => `"${p}"`;

    const audioFilter = `loudnorm=I=${targetLUFS}:TP=${limiterThreshold}:LRA=11:measured_I=${measuredI}:measured_LRA=${measuredLRA}:measured_TP=${measuredTP}:measured_thresh=${measuredThresh}:linear=true:print_format=summary,volume=${gain}dB`;

    const command = `${escapePath(ffmpegPath)} -i ${escapePath(inputPath)} -af "${audioFilter}" -c:v copy -c:a aac -b:a 320k -ar 48000 -y ${escapePath(outputPath)}`;

    console.log('Loudness normalization command:', command);

    exec(command, {
      timeout: 300000, // 5分タイムアウト
      maxBuffer: 100 * 1024 * 1024
    }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`Loudness normalization failed: ${error.message}\n${stderr}`));
      } else {
        fs.access(outputPath).then(() => {
          resolve(outputPath);
        }).catch(() => {
          reject(new Error(`Normalized file was not created: ${outputPath}`));
        });
      }
    });
  });
}

/**
 * 動画に音声を追加/置換
 * @param {string} videoPath - 動画ファイルのパス
 * @param {string} audioPath - 音声ファイルのパス
 * @param {string} outputPath - 出力ファイルのパス
 * @returns {Promise<string>} - 出力ファイルのパス
 */
function mergeAudioVideo(videoPath, audioPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        '-c:v copy',
        '-c:a aac',
        '-b:a 320k',
        '-ar 48000',
        '-map 0:v:0',
        '-map 1:a:0',
        '-shortest'
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

module.exports = {
  measureLoudness,
  normalizeLoudness,
  mergeAudioVideo
};
