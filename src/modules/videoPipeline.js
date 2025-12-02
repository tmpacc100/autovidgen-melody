const path = require('path');
const fs = require('fs').promises;
const { syncAudio, getVideoDuration } = require('./audioSync');
const { convertTo60fps, getFrameRate } = require('./frameRate');
const { applyColorCorrection } = require('./colorCorrection');
const { normalizeLoudness } = require('./loudnessNormalization');
const { applyTextOverlay } = require('./textOverlay');

/**
 * 動画生成パイプライン
 * すべての処理ステップを統合する
 */

/**
 * 動画を識別する (動画Aと動画Bを自動判別)
 * @param {string} videoPath1 - 動画1のパス
 * @param {string} videoPath2 - 動画2のパス
 * @returns {Object} - {videoA, videoB}
 */
function identifyVideos(videoPath1, videoPath2) {
  const isScreenRecording1 = path.basename(videoPath1).includes('ScreenRecording');
  const isScreenRecording2 = path.basename(videoPath2).includes('ScreenRecording');

  if (isScreenRecording1 && !isScreenRecording2) {
    return { videoA: videoPath2, videoB: videoPath1 };
  } else if (isScreenRecording2 && !isScreenRecording1) {
    return { videoA: videoPath1, videoB: videoPath2 };
  } else {
    throw new Error('動画Bを識別できません。ファイル名に"ScreenRecording"を含めてください。');
  }
}

/**
 * 動画をトリミング（直接execを使用）
 * @param {string} inputPath - 入力動画パス
 * @param {string} outputPath - 出力動画パス
 * @param {number} start - 開始時間(秒)
 * @param {number} duration - 長さ(秒)
 * @param {Object} options - オプション
 * @returns {Promise<string>} - 出力ファイルのパス
 */
function trimVideo(inputPath, outputPath, start, duration, options = {}) {
  const { exec } = require('child_process');
  const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

  return new Promise((resolve, reject) => {
    const escapePath = (p) => `"${p}"`;

    // 正確なトリミングのため、再エンコードする
    // -ss を -i の前に置いて高速シーク、-accurate_seek で正確性を確保
    // avoid_negative_ts で負のタイムスタンプを防ぐ
    const command = `${escapePath(ffmpegPath)} -ss ${start.toFixed(3)} -i ${escapePath(inputPath)} -t ${duration.toFixed(3)} -c:v libx264 -preset ultrafast -crf 18 -c:a aac -b:a 320k -ar 48000 -avoid_negative_ts make_zero -async 1 -y ${escapePath(outputPath)}`;

    console.log('Trim command:', command);
    console.log(`  開始: ${start.toFixed(3)}秒, 長さ: ${duration.toFixed(3)}秒`);

    exec(command, {
      timeout: 300000, // 5分タイムアウト（再エンコードのため長めに）
      maxBuffer: 50 * 1024 * 1024
    }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`Video trim failed: ${error.message}\n${stderr}`));
      } else {
        fs.access(outputPath).then(() => {
          resolve(outputPath);
        }).catch(() => {
          reject(new Error(`Trimmed video was not created: ${outputPath}`));
        });
      }
    });
  });
}

/**
 * 音声のみを抽出（直接execを使用）
 * @param {string} inputPath - 入力動画パス
 * @param {string} outputPath - 出力音声パス
 * @param {number} start - 開始時間(秒) - オプション
 * @param {number} duration - 長さ(秒) - オプション
 * @returns {Promise<string>} - 出力ファイルのパス
 */
function extractAudioOnly(inputPath, outputPath, start = 0, duration = null) {
  const { exec } = require('child_process');
  const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

  return new Promise((resolve, reject) => {
    const escapePath = (p) => `"${p}"`;

    // 開始位置と長さを指定可能に
    let command = `${escapePath(ffmpegPath)}`;
    if (start > 0) {
      command += ` -ss ${start.toFixed(3)}`;
    }
    command += ` -i ${escapePath(inputPath)}`;
    if (duration !== null) {
      command += ` -t ${duration.toFixed(3)}`;
    }
    command += ` -vn -c:a aac -b:a 320k -ar 48000 -avoid_negative_ts make_zero -y ${escapePath(outputPath)}`;

    console.log('Extract audio command:', command);
    if (start > 0 || duration !== null) {
      console.log(`  開始: ${start.toFixed(3)}秒, 長さ: ${duration ? duration.toFixed(3) + '秒' : '全体'}`);
    }

    exec(command, {
      timeout: 120000,
      maxBuffer: 50 * 1024 * 1024
    }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`Audio extraction failed: ${error.message}\n${stderr}`));
      } else {
        fs.access(outputPath).then(() => {
          resolve(outputPath);
        }).catch(() => {
          reject(new Error(`Audio file was not created: ${outputPath}`));
        });
      }
    });
  });
}

/**
 * 映像と音声をマージ（直接execを使用）
 * @param {string} videoPath - 映像ファイルのパス
 * @param {string} audioPath - 音声ファイルのパス
 * @param {string} outputPath - 出力ファイルのパス
 * @param {Object} options - オプション
 * @returns {Promise<string>} - 出力ファイルのパス
 */
function mergeVideoAudio(videoPath, audioPath, outputPath, options = {}) {
  const { exec } = require('child_process');
  const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

  return new Promise((resolve, reject) => {
    const escapePath = (p) => `"${p}"`;

    // 音声を映像の長さに正確に合わせる（音声の繰り返しを防ぐ）
    // -shortest: 短い方のストリームに合わせる
    // -fflags +shortest: より厳密に最短ストリームを適用
    // -max_interleave_delta 0: インターリーブのズレを最小化
    const command = `${escapePath(ffmpegPath)} -i ${escapePath(videoPath)} -i ${escapePath(audioPath)} -c:v copy -c:a aac -b:a 320k -ar 48000 -map 0:v:0 -map 1:a:0 -shortest -fflags +shortest -max_interleave_delta 0 -avoid_negative_ts make_zero -y ${escapePath(outputPath)}`;

    console.log('Merge command:', command);

    exec(command, {
      timeout: 180000, // 3分タイムアウト
      maxBuffer: 100 * 1024 * 1024
    }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`Video/audio merge failed: ${error.message}\n${stderr}`));
      } else {
        fs.access(outputPath).then(() => {
          resolve(outputPath);
        }).catch(() => {
          reject(new Error(`Merged file was not created: ${outputPath}`));
        });
      }
    });
  });
}

/**
 * 最終動画をエンコード（直接execを使用）
 * @param {string} inputPath - 入力動画パス
 * @param {string} outputPath - 出力動画パス
 * @param {Object} options - エンコードオプション
 * @returns {Promise<string>} - 出力ファイルのパス
 */
function finalEncode(inputPath, outputPath, options = {}) {
  const { exec } = require('child_process');
  const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

  const {
    width = 1080,
    height = 1920,
    fps = 60,
    codec = 'libx264',
    bitrate = '8M',
    preset = 'medium'
  } = options;

  return new Promise((resolve, reject) => {
    const escapePath = (p) => `"${p}"`;

    // ビデオフィルター
    const videoFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,fps=${fps}`;

    const command = `${escapePath(ffmpegPath)} -i ${escapePath(inputPath)} -vf "${videoFilter}" -c:v ${codec} -b:v ${bitrate} -preset ${preset} -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 320k -ar 48000 -y ${escapePath(outputPath)}`;

    console.log('Final encode command:', command);

    exec(command, {
      timeout: 600000, // 10分タイムアウト
      maxBuffer: 200 * 1024 * 1024
    }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`Final encode failed: ${error.message}\n${stderr}`));
      } else {
        fs.access(outputPath).then(() => {
          resolve(outputPath);
        }).catch(() => {
          reject(new Error(`Final video was not created: ${outputPath}`));
        });
      }
    });
  });
}

/**
 * 動画をクロップ
 * @param {string} inputPath - 入力動画パス
 * @param {string} outputPath - 出力動画パス
 * @param {Object} cropSettings - クロップ設定 {x, y, width, height}
 * @returns {Promise<string>} - 出力ファイルのパス
 */
function cropVideo(inputPath, outputPath, cropSettings) {
  const { exec } = require('child_process');
  const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

  return new Promise((resolve, reject) => {
    const escapePath = (p) => `"${p}"`;

    if (!cropSettings || cropSettings.width === 0 || cropSettings.height === 0) {
      // クロップ設定がない場合はそのままコピー
      console.log('クロップ設定なし - スキップ');
      const { exec } = require('child_process');
      const command = `${escapePath(ffmpegPath)} -i ${escapePath(inputPath)} -c copy -y ${escapePath(outputPath)}`;
      exec(command, {
        timeout: 300000,
        maxBuffer: 50 * 1024 * 1024
      }, (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(`Video copy failed: ${error.message}\n${stderr}`));
        } else {
          fs.access(outputPath).then(() => {
            resolve(outputPath);
          }).catch(() => {
            reject(new Error(`Copied video was not created: ${outputPath}`));
          });
        }
      });
      return;
    }

    // 空間的クロップフィルタ
    const cropFilter = `crop=${cropSettings.width}:${cropSettings.height}:${cropSettings.x}:${cropSettings.y}`;

    // 時間的クロップ（トリミング）パラメータ
    let timeParams = '';
    if (cropSettings.startTime !== undefined && cropSettings.endTime !== undefined) {
      const duration = cropSettings.endTime - cropSettings.startTime;
      if (duration > 0) {
        timeParams = `-ss ${cropSettings.startTime} -t ${duration}`;
      }
    }

    // FFmpegコマンドを構築（時間クロップ → 空間クロップ）
    const command = `${escapePath(ffmpegPath)} ${timeParams} -i ${escapePath(inputPath)} -vf "${cropFilter}" -c:v libx264 -preset medium -crf 18 -c:a copy -y ${escapePath(outputPath)}`;

    console.log('Crop command:', command);
    console.log(`  空間クロップ: X=${cropSettings.x}, Y=${cropSettings.y}, W=${cropSettings.width}, H=${cropSettings.height}`);
    if (timeParams) {
      console.log(`  時間クロップ: ${cropSettings.startTime}秒 〜 ${cropSettings.endTime}秒 (${(cropSettings.endTime - cropSettings.startTime).toFixed(1)}秒)`);
    }

    exec(command, {
      timeout: 300000,
      maxBuffer: 50 * 1024 * 1024
    }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`Video crop failed: ${error.message}\n${stderr}`));
      } else {
        fs.access(outputPath).then(() => {
          console.log('クロップ完了:', path.basename(outputPath));
          resolve(outputPath);
        }).catch(() => {
          reject(new Error(`Cropped video was not created: ${outputPath}`));
        });
      }
    });
  });
}

/**
 * フルパイプライン処理
 * @param {Object} inputs - 入力ファイル
 * @param {Object} params - 処理パラメータ
 * @param {Object} outputOptions - 出力オプション
 * @param {Function} progressCallback - 進捗コールバック(step, progress, message)
 * @returns {Promise<string>} - 出力ファイルのパス
 */
async function processVideo(inputs, params, outputOptions = {}, progressCallback = null) {
  const {
    video1Path,
    video2Path,
    referencePath,
    artistName,
    songName
  } = inputs;

  const {
    syncTolerance = 50,
    targetLUFS = -14.0,
    audioGain = 0.0,
    limiterThreshold = -1.0,
    whiteBalance = 0.5,
    saturation = 0.5,
    contrast = 0.5,
    enableFrameRateConversion = true,
    textOptions = {}
  } = params;

  const {
    outputPath,
    width = 1080,
    height = 1920,
    fps = 60,
    codec = 'libx264',
    bitrate = '8M',
    cropSettings = null
  } = outputOptions;

  const tempDir = path.join(__dirname, '../../temp');
  await fs.mkdir(tempDir, { recursive: true });

  // 進捗通知ヘルパー
  const notifyProgress = (step, progress, message) => {
    if (progressCallback) {
      progressCallback(step, progress, message);
    }
  };

  try {
    // ステップ1: 動画を識別
    notifyProgress(1, 0, '動画を識別中...');
    const { videoA, videoB } = identifyVideos(video1Path, video2Path);
    notifyProgress(1, 100, '動画識別完了');

    // ステップ2: クロップ処理（設定がある場合、最初に実行）
    let videoAToProcess = videoA;
    if (cropSettings && cropSettings.width > 0 && cropSettings.height > 0) {
      notifyProgress(2, 0, '動画Aをクロップ中...');
      const croppedAPath = path.join(tempDir, 'cropped_A.mp4');
      await cropVideo(videoA, croppedAPath, cropSettings);
      videoAToProcess = croppedAPath;
      notifyProgress(2, 100, '動画Aクロップ完了');
    } else {
      notifyProgress(2, 0, 'クロップをスキップ（設定なし）');
      notifyProgress(2, 100, 'クロップスキップ');
    }

    // ステップ3: 音声同期
    notifyProgress(3, 0, '音声同期を計算中...');
    const syncInfo = await syncAudio(videoAToProcess, videoB);
    notifyProgress(3, 100, '音声同期完了');

    // ステップ4: 動画Aをトリミング
    notifyProgress(4, 0, '動画Aをトリミング中...');
    const trimmedAPath = path.join(tempDir, 'trimmed_A.mp4');
    await trimVideo(videoAToProcess, trimmedAPath, syncInfo.videoA.start, syncInfo.finalDuration);
    notifyProgress(4, 100, '動画Aトリミング完了');

    // ステップ5: 動画Bから音声のみを抽出（正しい開始位置と長さで）
    notifyProgress(5, 0, '動画Bから音声を抽出中...');
    const audioBPath = path.join(tempDir, 'audio_B.aac');
    // 動画Bから直接、正しい開始位置と長さで音声を抽出
    await extractAudioOnly(videoB, audioBPath, syncInfo.videoB.start, syncInfo.finalDuration);
    notifyProgress(5, 100, '音声抽出完了');

    // ステップ6: 映像色調整（参照JPEGがある場合のみ）
    let colorCorrectedPath;
    if (referencePath && referencePath.trim()) {
      notifyProgress(6, 0, '映像色調整を適用中...');
      colorCorrectedPath = path.join(tempDir, 'color_corrected.mp4');
      await applyColorCorrection(trimmedAPath, colorCorrectedPath, referencePath, {
        whiteBalance,
        saturation,
        contrast
      });
      notifyProgress(6, 100, '色調整完了');
    } else {
      notifyProgress(6, 0, '映像色調整をスキップ（参照JPEGなし）');
      colorCorrectedPath = trimmedAPath; // 色調整なしで次のステップへ
      notifyProgress(6, 100, '色調整スキップ');
    }

    // ステップ7: 60fps変換
    notifyProgress(7, 0, '60fps変換中...');
    const fps60Path = path.join(tempDir, 'fps60.mp4');
    await convertTo60fps(colorCorrectedPath, fps60Path, { enabled: enableFrameRateConversion });
    notifyProgress(7, 100, '60fps変換完了');

    // ステップ8: 音声ラウドネス正規化
    notifyProgress(8, 0, '音声ラウドネス正規化中...');
    const normalizedAudioPath = path.join(tempDir, 'normalized_audio.aac');
    await normalizeLoudness(audioBPath, normalizedAudioPath, {
      targetLUFS,
      gain: audioGain,
      limiterThreshold
    });
    notifyProgress(8, 100, 'ラウドネス正規化完了');

    // ステップ9: テキストオーバーレイ
    notifyProgress(9, 0, 'テキストオーバーレイを適用中...');
    const textOverlayPath = path.join(tempDir, 'text_overlay.mp4');
    await applyTextOverlay(fps60Path, textOverlayPath, artistName, songName, {
      videoWidth: width,
      videoHeight: height,
      ...textOptions
    });
    notifyProgress(9, 100, 'テキストオーバーレイ完了');

    // ステップ10: 映像と音声をマージして最終エンコード
    notifyProgress(10, 0, '最終エンコード中...');
    const mergedPath = path.join(tempDir, 'merged.mp4');
    await mergeVideoAudio(textOverlayPath, normalizedAudioPath, mergedPath);
    await finalEncode(mergedPath, outputPath, { width, height, fps, codec, bitrate });
    notifyProgress(10, 100, '最終エンコード完了');

    return outputPath;

  } catch (error) {
    console.error('\n=== Video Pipeline Error ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Stack trace:');
    console.error(error.stack);
    console.error('============================\n');

    if (progressCallback) {
      progressCallback(-1, 0, `エラー: ${error.message}`);
    }
    throw error;
  }
}

module.exports = {
  processVideo,
  identifyVideos,
  trimVideo,
  extractAudioOnly,
  mergeVideoAudio,
  finalEncode,
  cropVideo
};
