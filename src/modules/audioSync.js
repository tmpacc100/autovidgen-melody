const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');

/**
 * 音声同期モジュール（高精度版）
 * librosaベースのPythonスクリプトを使用して音声同期を行う
 */

/**
 * 動画から音声を抽出してWAVファイルとして保存
 * @param {string} videoPath - 動画ファイルのパス
 * @param {string} outputPath - 出力WAVファイルのパス
 * @returns {Promise<string>} - 出力ファイルのパス
 */
async function extractAudio(videoPath, outputPath) {
  const { exec } = require('child_process');
  const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

  return new Promise((resolve, reject) => {
    const escapePath = (p) => `"${p}"`;

    // librosaが読み込みやすい形式で抽出（22050Hz モノラル）
    const command = `${escapePath(ffmpegPath)} -i ${escapePath(videoPath)} -vn -acodec pcm_s16le -ar 22050 -ac 1 -y ${escapePath(outputPath)}`;

    console.log('音声抽出中:', path.basename(videoPath));

    exec(command, {
      timeout: 60000,
      maxBuffer: 50 * 1024 * 1024
    }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`Audio extraction failed: ${error.message}`));
      } else {
        fs.access(outputPath).then(() => {
          console.log('音声抽出完了:', path.basename(outputPath));
          resolve(outputPath);
        }).catch(() => {
          reject(new Error(`Audio file was not created: ${outputPath}`));
        });
      }
    });
  });
}

/**
 * Pythonスクリプトを実行して高精度な音声同期を行う
 * @param {string} audioAPath - 動画Aの音声ファイル
 * @param {string} audioBPath - 動画Bの音声ファイル（基準）
 * @param {number} videoDuration - 動画の長さ（秒）
 * @param {string} mode - 'simple' または 'multi_checkpoint'
 * @returns {Promise<Object>} - 同期結果
 */
async function runPythonAudioSync(audioAPath, audioBPath, videoDuration, mode = 'multi_checkpoint') {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../scripts/audio_sync_advanced.py');

    console.log(`\n=== 高精度音声同期開始（${mode}モード） ===`);
    console.log(`音声A: ${path.basename(audioAPath)}`);
    console.log(`音声B: ${path.basename(audioBPath)}`);
    console.log(`動画の長さ: ${videoDuration.toFixed(2)}秒`);

    const pythonArgs = [
      scriptPath,
      audioAPath,
      audioBPath,
      videoDuration.toString(),
      mode
    ];

    const python = spawn('python', pythonArgs, {
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8'
      }
    });

    let stdout = '';
    let stderr = '';
    let jsonOutput = '';
    let captureJson = false;

    python.stdout.on('data', (data) => {
      const text = data.toString('utf8');
      stdout += text;

      // JSON OUTPUT マーカーを検出
      if (text.includes('=== JSON OUTPUT ===')) {
        captureJson = true;
        jsonOutput = '';
        // マーカー以降の部分をjsonOutputに追加
        const markerIndex = text.indexOf('=== JSON OUTPUT ===');
        const afterMarker = text.substring(markerIndex + '=== JSON OUTPUT ==='.length);
        jsonOutput += afterMarker;
      } else if (captureJson) {
        jsonOutput += text;
      } else {
        // 通常のログ出力（文字化けを防ぐ）
        try {
          process.stdout.write(text);
        } catch (e) {
          console.log('[OUTPUT]', text);
        }
      }
    });

    python.stderr.on('data', (data) => {
      const text = data.toString('utf8');
      stderr += text;
      try {
        process.stderr.write(text);
      } catch (e) {
        console.error('[ERROR]', text);
      }
    });

    python.on('close', (code) => {
      if (code !== 0) {
        console.error('\n=== Python Script Error ===');
        console.error(`Exit code: ${code}`);
        console.error('\n--- STDOUT ---');
        console.error(stdout);
        console.error('\n--- STDERR ---');
        console.error(stderr);
        console.error('==================\n');
        reject(new Error(`Python script failed with code ${code}\nSTDERR:\n${stderr}\n\nSTDOUT:\n${stdout}`));
        return;
      }

      // JSON出力が空の場合
      if (!jsonOutput || jsonOutput.trim().length === 0) {
        console.error('\n=== No JSON Output ===');
        console.error('--- STDOUT ---');
        console.error(stdout);
        console.error('\n--- STDERR ---');
        console.error(stderr);
        console.error('==================\n');
        reject(new Error(`No JSON output received from Python script.\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`));
        return;
      }

      try {
        // JSON出力をパース
        const result = JSON.parse(jsonOutput.trim());
        console.log('\n=== Python音声同期完了 ===');
        console.log(`オフセット: ${result.offset.toFixed(3)}秒`);
        console.log(`信頼度: ${result.confidence.toFixed(4)}`);
        console.log(`品質: ${result.quality_jp} (${result.quality})`);

        if (result.checkpoints) {
          console.log(`\nチェックポイント結果:`);
          result.checkpoints.forEach((cp, i) => {
            console.log(`  ${i+1}. ${cp.position_name}: オフセット=${cp.offset.toFixed(3)}秒, 信頼度=${cp.confidence.toFixed(4)} (${cp.quality_jp})`);
          });
        }

        resolve(result);
      } catch (error) {
        console.error('\n=== JSON Parse Error ===');
        console.error(`Parse error: ${error.message}`);
        console.error('\n--- JSON Output (length: ' + jsonOutput.length + ') ---');
        console.error(jsonOutput);
        console.error('\n--- Full STDOUT ---');
        console.error(stdout);
        console.error('==================\n');
        reject(new Error(`Failed to parse Python output: ${error.message}\nJSON Output:\n${jsonOutput}\n\nFull STDOUT:\n${stdout}`));
      }
    });

    python.on('error', (error) => {
      reject(new Error(`Failed to start Python: ${error.message}`));
    });
  });
}

/**
 * 2本の動画の音声を同期させる（高精度版）
 * @param {string} videoAPath - 動画Aのパス
 * @param {string} videoBPath - 動画Bのパス（基準音声）
 * @returns {Promise<Object>} - 同期情報
 */
async function syncAudio(videoAPath, videoBPath) {
  const tempDir = path.join(__dirname, '../../temp');
  await fs.mkdir(tempDir, { recursive: true });

  // 音声トラックの存在を確認
  const [hasAudioA, hasAudioB] = await Promise.all([
    hasAudioTrack(videoAPath),
    hasAudioTrack(videoBPath)
  ]);

  if (!hasAudioA) {
    throw new Error(`Video A (${path.basename(videoAPath)}) does not have an audio track.`);
  }

  if (!hasAudioB) {
    throw new Error(`Video B (${path.basename(videoBPath)}) does not have an audio track.`);
  }

  const audioAPath = path.join(tempDir, 'audioA.wav');
  const audioBPath = path.join(tempDir, 'audioB.wav');

  try {
    // 音声を抽出
    console.log('\n音声トラックを抽出中...');
    await Promise.all([
      extractAudio(videoAPath, audioAPath),
      extractAudio(videoBPath, audioBPath)
    ]);

    // ファイルが存在するか確認
    await Promise.all([
      fs.access(audioAPath),
      fs.access(audioBPath)
    ]);

    // 動画の長さを取得
    const [durationA, durationB] = await Promise.all([
      getVideoDuration(videoAPath),
      getVideoDuration(videoBPath)
    ]);

    const videoDuration = Math.min(durationA, durationB);

    // Pythonスクリプトで高精度同期を実行
    const syncResult = await runPythonAudioSync(
      audioAPath,
      audioBPath,
      videoDuration,
      'multi_checkpoint' // マルチチェックポイントモード
    );

    const offsetSeconds = syncResult.offset;
    const offsetMs = offsetSeconds * 1000;

    console.log('\n=== 最終同期結果 ===');
    console.log(`適用するオフセット: ${offsetMs.toFixed(1)}ms (${offsetSeconds.toFixed(3)}秒)`);
    console.log(`信頼度: ${syncResult.confidence.toFixed(4)}`);
    console.log(`品質: ${syncResult.quality_jp}`);
    console.log(`使用手法: ${syncResult.method}`);

    // トリミング範囲を計算
    let startA = 0;
    let startB = 0;

    console.log(`\n動画の長さ: A=${durationA.toFixed(2)}秒, B=${durationB.toFixed(2)}秒`);

    if (offsetSeconds > 0) {
      // 動画Aが遅れている → 動画Bの開始をずらす
      startB = offsetSeconds;
      console.log(`動画Aが${offsetSeconds.toFixed(3)}秒遅れています`);
      console.log(`→ 動画Bを${startB.toFixed(3)}秒の位置から開始`);
    } else if (offsetSeconds < 0) {
      // 動画Aが進んでいる → 動画Aの開始をずらす
      startA = -offsetSeconds;
      console.log(`動画Aが${(-offsetSeconds).toFixed(3)}秒進んでいます`);
      console.log(`→ 動画Aを${startA.toFixed(3)}秒の位置から開始`);
    } else {
      console.log('完全に同期しています（オフセット0秒）');
    }

    // 最終的な動画の長さ
    const finalDuration = Math.min(durationA - startA, durationB - startB);

    console.log(`\nトリミング情報:`);
    console.log(`  動画A: ${startA.toFixed(3)}秒から${finalDuration.toFixed(3)}秒間`);
    console.log(`  動画B: ${startB.toFixed(3)}秒から${finalDuration.toFixed(3)}秒間`);
    console.log(`  最終動画の長さ: ${finalDuration.toFixed(3)}秒`);

    // 警告: 信頼度が低い場合
    if (syncResult.confidence < 0.5) {
      console.warn('\n⚠️ 警告: 同期の信頼度が低いです');
      console.warn('   2つの動画の音声が大きく異なる可能性があります');
      console.warn('   結果を確認してください');
    }

    return {
      offsetSeconds,
      offsetMs,
      confidence: syncResult.confidence,
      quality: syncResult.quality,
      quality_jp: syncResult.quality_jp,
      method: syncResult.method,
      checkpoints: syncResult.checkpoints || [],
      videoA: {
        start: startA,
        duration: finalDuration
      },
      videoB: {
        start: startB,
        duration: finalDuration
      },
      finalDuration
    };

  } finally {
    // 一時ファイルをクリーンアップ
    try {
      await fs.unlink(audioAPath).catch(() => {});
      await fs.unlink(audioBPath).catch(() => {});
    } catch (err) {
      console.error('一時ファイルの削除に失敗:', err);
    }
  }
}

/**
 * 動画に音声トラックがあるか確認
 * @param {string} videoPath - 動画ファイルのパス
 * @returns {Promise<boolean>} - 音声トラックがあればtrue
 */
function hasAudioTrack(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      resolve(!!audioStream);
    });
  });
}

/**
 * 動画の長さを取得
 * @param {string} videoPath - 動画ファイルのパス
 * @returns {Promise<number>} - 動画の長さ(秒)
 */
function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
}

module.exports = {
  syncAudio,
  extractAudio,
  getVideoDuration,
  hasAudioTrack
};
