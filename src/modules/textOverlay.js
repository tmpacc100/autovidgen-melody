const { createCanvas } = require('canvas');

/**
 * テキストオーバーレイモジュール
 * 動画にテキストを重ね合わせる
 */

/**
 * テキストを複数行に分割
 * @param {string} text - テキスト
 * @param {number} maxLines - 最大行数
 * @returns {Array<string>} - 分割されたテキスト
 */
function splitTextIntoLines(text, maxLines = 3) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  const targetLength = Math.ceil(text.length / maxLines);

  for (const word of words) {
    if (currentLine.length === 0) {
      currentLine = word;
    } else if (currentLine.length + word.length + 1 <= targetLength || lines.length >= maxLines - 1) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.slice(0, maxLines);
}

/**
 * フォントサイズを調整
 * @param {Array<string>} lines - テキスト行
 * @param {number} lineCount - 行数
 * @param {number} minSize - 最小フォントサイズ
 * @param {number} maxSize - 最大フォントサイズ
 * @returns {number} - 調整されたフォントサイズ
 */
function calculateFontSize(lines, lineCount, minSize = 40, maxSize = 80) {
  if (lineCount === 1) {
    return maxSize;
  } else if (lineCount === 2) {
    return Math.max(minSize, maxSize - 15);
  } else {
    return Math.max(minSize, maxSize - 25);
  }
}

/**
 * テキストオーバーレイのFFmpegフィルターを生成
 * @param {string} text - 表示テキスト
 * @param {Object} options - オプション
 * @returns {string} - FFmpegフィルター文字列
 */
function buildTextOverlayFilter(text, options = {}) {
  const {
    font = 'Arial',
    maxLines = 3,
    minFontSize = 40,
    maxFontSize = 80,
    textColor = 'white',    // 白いテキスト
    bgColor = 'black',      // 黒い背景
    bgOpacity = 0.7,        // 少し透明
    padding = 20,
    positionX = 'center',
    positionY = 0.5,        // 画面中央に変更（デフォルト）
    videoWidth = 1080,
    videoHeight = 1920
  } = options;

  // テキストを行に分割
  const lines = splitTextIntoLines(text, maxLines);
  const lineCount = lines.length;

  // フォントサイズを計算
  const fontSize = calculateFontSize(lines, lineCount, minFontSize, maxFontSize);
  const lineHeight = fontSize * 1.3;

  // 背景色をRGBA形式に変換
  const bgRgba = convertColorToRgba(bgColor, bgOpacity);

  // テキストの位置を計算
  let x, y;

  if (positionX === 'center') {
    x = '(w-text_w)/2';
  } else if (positionX === 'left') {
    x = padding;
  } else if (positionX === 'right') {
    x = `w-text_w-${padding}`;
  } else {
    x = positionX;
  }

  // Y位置を画面中央に設定
  if (typeof positionY === 'number' && positionY <= 1.0) {
    // 全体の高さを考慮して中央揃え
    const totalHeight = lineCount * lineHeight;
    y = Math.floor(videoHeight * positionY - totalHeight / 2);
  } else {
    y = positionY;
  }

  // Windowsフォントパスを確認（複数の候補）
  const fontPaths = [
    'C\\\\:/Windows/Fonts/arial.ttf',
    'C\\\\:/Windows/Fonts/msgothic.ttc',  // 日本語フォント
    'Arial'  // フォント名のみ（システムフォント）
  ];

  // 各行のdrawtextフィルターを生成
  const filters = [];

  lines.forEach((line, index) => {
    const yOffset = y + (index * lineHeight);
    // コロンと引用符をエスケープ
    const escapedText = line.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "'\\\\''");

    // 背景ボックス付きテキスト
    filters.push(
      `drawtext=text='${escapedText}':fontfile=${fontPaths[1]}:fontsize=${fontSize}:fontcolor=${textColor}:x=${x}:y=${yOffset}:box=1:boxcolor=${bgRgba}:boxborderw=${padding}`
    );
  });

  return filters.join(',');
}

/**
 * 色をRGBA形式に変換（16進数形式）
 * @param {string} color - 色名またはHEX
 * @param {number} opacity - 不透明度 (0.0-1.0)
 * @returns {string} - RGBA文字列（16進数形式）
 */
function convertColorToRgba(color, opacity = 1.0) {
  const colorMap = {
    'white': 'FFFFFF',
    'black': '000000',
    'red': 'FF0000',
    'green': '00FF00',
    'blue': '0000FF',
    'yellow': 'FFFF00',
    'cyan': '00FFFF',
    'magenta': 'FF00FF'
  };

  let hex = colorMap[color.toLowerCase()] || 'FFFFFF';
  const alpha = Math.max(0, Math.min(1, opacity));

  // アルファ値を16進数に変換 (0-255)
  const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, '0').toUpperCase();

  // FFmpegの16進数形式: 0xRRGGBBAA
  return `0x${hex}${alphaHex}`;
}

/**
 * テキストオーバーレイを動画に適用（FFmpeg直接使用 - 超高速）
 * @param {string} inputPath - 入力動画パス
 * @param {string} outputPath - 出力動画パス
 * @param {string} artistName - アーティスト名
 * @param {string} songName - 曲名
 * @param {Object} options - オプション
 * @param {number} options.fontSize - フォントサイズ (デフォルト: 80)
 * @param {string} options.textColor - テキストの色 (デフォルト: 'white')
 * @param {string} options.bgColor - 背景の色 (デフォルト: 'black')
 * @param {number} options.bgOpacity - 背景の不透明度 0.0-1.0 (デフォルト: 0.7)
 * @param {number} options.padding - パディング (デフォルト: 30)
 * @param {string|number} options.positionX - X位置 'left', 'center', 'right' または数値 (デフォルト: 'center')
 * @param {number} options.positionY - Y位置 0.0-1.0 の比率または数値 (デフォルト: 0.5)
 * @returns {Promise<string>} - 出力ファイルのパス
 */
async function applyTextOverlay(inputPath, outputPath, artistName, songName, options = {}) {
  const { spawn } = require('child_process');
  const fs = require('fs').promises;
  const path = require('path');

  // カスタムテキストがあればそれを使用、なければ自動生成
  let text;
  if (options.customText && options.customText.trim()) {
    text = options.customText.trim();
  } else {
    text = `${artistName}の「${songName}」弾いてみた`;
  }

  // Pythonスクリプトを使用してテキストオーバーレイを適用
  // Base64エンコーディングで文字化けを防止
  const scriptPath = path.join(__dirname, '..', 'scripts', 'add_text_to_video.py');

  // オプションをBase64エンコード
  const optionsObj = {
    fontFamily: options.fontFamily || 'msgothic',
    fontWeight: options.fontWeight || 'normal',
    textColor: options.textColor || 'black',
    bgColor: options.bgColor || 'white',
    bgOpacity: options.bgOpacity !== undefined ? options.bgOpacity : 1.0,
    padding: options.padding !== undefined ? options.padding : 30,
    positionX: options.positionX || 'center',
    positionY: options.positionY !== undefined ? options.positionY : 0.25,
    maxBgWidthRatio: options.maxBgWidthRatio || 0.9,
    maxBgHeightRatio: options.maxBgHeightRatio || 0.3
  };

  const optionsJson = JSON.stringify(optionsObj);
  const optionsBase64 = Buffer.from(optionsJson, 'utf8').toString('base64');

  // テキストもBase64エンコード
  const textBase64 = Buffer.from(text, 'utf8').toString('base64');

  return new Promise((resolve, reject) => {
    console.log('Pythonスクリプトでテキストオーバーレイを適用中...');
    console.log('テキスト:', text);
    console.log('オプション:', optionsObj);

    // Python実行（UTF-8エンコーディング指定、Base64でテキストとオプションを渡す）
    const pythonArgs = [
      '-X', 'utf8',  // UTF-8モードを有効化
      scriptPath,
      inputPath,
      outputPath,
      textBase64,
      optionsBase64
    ];

    console.log('Python command:', 'python', pythonArgs.join(' '));

    const python = spawn('python', pythonArgs, {
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',  // Python I/OをUTF-8に設定
        PYTHONLEGACYWINDOWSSTDIO: '0'  // Windows標準入出力の問題を回避
      }
    });

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      const output = data.toString('utf8');
      stdout += output;
      console.log(output);
    });

    python.stderr.on('data', (data) => {
      const output = data.toString('utf8');
      stderr += output;
      console.error(output);
    });

    python.on('close', async (code) => {
      if (code === 0) {
        console.log('\nテキストオーバーレイ完了');
        try {
          await fs.access(outputPath);
          resolve(outputPath);
        } catch {
          reject(new Error(`出力ファイルが作成されませんでした: ${outputPath}`));
        }
      } else {
        reject(new Error(`Python エラー (code ${code}): ${stderr}`));
      }
    });

    python.on('error', (error) => {
      reject(new Error(`Python 実行エラー: ${error.message}`));
    });
  });
}

module.exports = {
  applyTextOverlay,
  buildTextOverlayFilter,
  splitTextIntoLines,
  calculateFontSize
};
