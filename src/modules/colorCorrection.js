const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

/**
 * 色調整モジュール
 * JPEG参照画像に「近づける」色調整を行う
 * 完全一致の色転送ではなく、調整可能な係数を使用
 */

/**
 * 画像の平均色と標準偏差を計算
 * @param {string} imagePath - 画像ファイルのパス
 * @returns {Promise<Object>} - 統計情報
 */
async function calculateImageStats(imagePath) {
  const { data, info } = await sharp(imagePath)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = data.length / info.channels;

  // RGBチャンネルごとの平均と標準偏差を計算
  const stats = {
    mean: { r: 0, g: 0, b: 0 },
    std: { r: 0, g: 0, b: 0 }
  };

  // 平均を計算
  for (let i = 0; i < data.length; i += info.channels) {
    stats.mean.r += data[i];
    stats.mean.g += data[i + 1];
    stats.mean.b += data[i + 2];
  }

  stats.mean.r /= pixels;
  stats.mean.g /= pixels;
  stats.mean.b /= pixels;

  // 標準偏差を計算
  for (let i = 0; i < data.length; i += info.channels) {
    stats.std.r += Math.pow(data[i] - stats.mean.r, 2);
    stats.std.g += Math.pow(data[i + 1] - stats.mean.g, 2);
    stats.std.b += Math.pow(data[i + 2] - stats.mean.b, 2);
  }

  stats.std.r = Math.sqrt(stats.std.r / pixels);
  stats.std.g = Math.sqrt(stats.std.g / pixels);
  stats.std.b = Math.sqrt(stats.std.b / pixels);

  return stats;
}

/**
 * 動画から代表フレームを抽出（直接execを使用）
 * @param {string} videoPath - 動画ファイルのパス
 * @param {string} outputPath - 出力画像パス
 * @param {number} time - 抽出時刻(秒)
 * @returns {Promise<string>} - 出力ファイルのパス
 */
function extractFrame(videoPath, outputPath, time = 1.0) {
  const { exec } = require('child_process');
  const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

  return new Promise((resolve, reject) => {
    const escapePath = (p) => `"${p}"`;

    const command = `${escapePath(ffmpegPath)} -ss ${time} -i ${escapePath(videoPath)} -frames:v 1 -y ${escapePath(outputPath)}`;

    console.log('Extract frame command:', command);

    exec(command, {
      timeout: 30000, // 30秒タイムアウト
      maxBuffer: 50 * 1024 * 1024
    }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`Frame extraction failed: ${error.message}\n${stderr}`));
      } else {
        fs.access(outputPath).then(() => {
          resolve(outputPath);
        }).catch(() => {
          reject(new Error(`Frame was not created: ${outputPath}`));
        });
      }
    });
  });
}

/**
 * 色調整パラメータを計算
 * @param {string} videoPath - 動画ファイルのパス
 * @param {string} referencePath - 参照JPEG画像のパス
 * @param {Object} coefficients - 調整係数
 * @returns {Promise<Object>} - 色調整パラメータ
 */
async function calculateColorCorrectionParams(videoPath, referencePath, coefficients = {}) {
  const {
    whiteBalance = 0.5,  // ホワイトバランス係数 (0.0-1.0)
    saturation = 0.5,    // 彩度係数 (0.0-1.0)
    contrast = 0.5       // コントラスト係数 (0.0-1.0)
  } = coefficients;

  const tempDir = path.join(__dirname, '../../temp');
  await fs.mkdir(tempDir, { recursive: true });

  const framePath = path.join(tempDir, 'frame.jpg');

  try {
    // 動画から代表フレームを抽出
    await extractFrame(videoPath, framePath, 1.0);

    // 参照画像と動画フレームの統計を取得
    const [refStats, videoStats] = await Promise.all([
      calculateImageStats(referencePath),
      calculateImageStats(framePath)
    ]);

    // ホワイトバランス調整(色温度・色かぶり)
    const whiteBalanceAdjust = {
      r: (refStats.mean.r - videoStats.mean.r) * whiteBalance,
      g: (refStats.mean.g - videoStats.mean.g) * whiteBalance,
      b: (refStats.mean.b - videoStats.mean.b) * whiteBalance
    };

    // 彩度調整
    const saturationAdjust = 1.0 + ((refStats.std.r / videoStats.std.r - 1.0) * saturation);

    // コントラスト調整
    const avgStdRef = (refStats.std.r + refStats.std.g + refStats.std.b) / 3;
    const avgStdVideo = (videoStats.std.r + videoStats.std.g + videoStats.std.b) / 3;
    const contrastAdjust = 1.0 + ((avgStdRef / avgStdVideo - 1.0) * contrast);

    return {
      whiteBalance: whiteBalanceAdjust,
      saturation: saturationAdjust,
      contrast: contrastAdjust,
      refStats,
      videoStats
    };

  } finally {
    // 一時ファイルをクリーンアップ
    try {
      await fs.unlink(framePath);
    } catch (err) {
      console.error('一時ファイルの削除に失敗:', err);
    }
  }
}

/**
 * FFmpegフィルターを生成
 * @param {Object} params - 色調整パラメータ
 * @returns {string} - FFmpegフィルター文字列
 */
function buildColorCorrectionFilter(params) {
  const { whiteBalance, saturation, contrast } = params;

  // 正規化された値に変換
  const rShift = whiteBalance.r / 255.0;
  const gShift = whiteBalance.g / 255.0;
  const bShift = whiteBalance.b / 255.0;

  const filters = [];

  // ホワイトバランス調整(curvesではなくeqを使用)
  // curvesフィルターは小さい値で問題が発生するため、eqフィルターを使用
  const threshold = 0.01; // 閾値: 絶対値が0.01未満の場合は調整をスキップ

  if (Math.abs(rShift) > threshold || Math.abs(gShift) > threshold || Math.abs(bShift) > threshold) {
    // RGBシフトをgammaとして適用（より安全な方法）
    const rGamma = 1.0 / (1.0 + rShift);
    const gGamma = 1.0 / (1.0 + gShift);
    const bGamma = 1.0 / (1.0 + bShift);

    // gamma値を安全な範囲にクリップ (0.1 - 10.0)
    const safeRGamma = Math.max(0.1, Math.min(10.0, rGamma));
    const safeGGamma = Math.max(0.1, Math.min(10.0, gGamma));
    const safeBGamma = Math.max(0.1, Math.min(10.0, bGamma));

    filters.push(`eq=gamma_r=${safeRGamma.toFixed(4)}:gamma_g=${safeGGamma.toFixed(4)}:gamma_b=${safeBGamma.toFixed(4)}`);
  }

  // 彩度調整（安全な範囲にクリップ: 0-3）
  const safeSaturation = Math.max(0, Math.min(3, saturation));
  filters.push(`eq=saturation=${safeSaturation.toFixed(4)}`);

  // コントラスト調整（安全な範囲にクリップ: -2 to 2）
  const safeContrast = Math.max(-2, Math.min(2, contrast));
  filters.push(`eq=contrast=${safeContrast.toFixed(4)}`);

  return filters.join(',');
}

/**
 * 動画に色調整を適用（直接execを使用）
 * @param {string} inputPath - 入力動画パス
 * @param {string} outputPath - 出力動画パス
 * @param {string} referencePath - 参照JPEG画像のパス
 * @param {Object} options - オプション
 * @returns {Promise<string>} - 出力ファイルのパス
 */
async function applyColorCorrection(inputPath, outputPath, referencePath, options = {}) {
  const { exec } = require('child_process');
  const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

  const {
    whiteBalance = 0.5,
    saturation = 0.5,
    contrast = 0.5
  } = options;

  const params = await calculateColorCorrectionParams(inputPath, referencePath, {
    whiteBalance,
    saturation,
    contrast
  });

  const filterStr = buildColorCorrectionFilter(params);

  return new Promise((resolve, reject) => {
    const escapePath = (p) => `"${p}"`;

    const command = `${escapePath(ffmpegPath)} -i ${escapePath(inputPath)} -vf "${filterStr}" -c:v libx264 -preset medium -crf 18 -c:a copy -y ${escapePath(outputPath)}`;

    console.log('Color correction command:', command);

    exec(command, {
      timeout: 300000, // 5分タイムアウト
      maxBuffer: 100 * 1024 * 1024
    }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`Color correction failed: ${error.message}\n${stderr}`));
      } else {
        fs.access(outputPath).then(() => {
          resolve(outputPath);
        }).catch(() => {
          reject(new Error(`Color corrected video was not created: ${outputPath}`));
        });
      }
    });
  });
}

module.exports = {
  calculateImageStats,
  calculateColorCorrectionParams,
  applyColorCorrection,
  buildColorCorrectionFilter
};
