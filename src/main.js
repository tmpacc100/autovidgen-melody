const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Hot Reload（開発モード時のみ）
if (process.argv.includes('--dev')) {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit',
    ignored: /node_modules|[\/\\]\.|temp|output/
  });
}

let mainWindow;
let cropWindow = null;
let workerProcess = null;
let cropVideoPath = null;
let cropVideoPath2 = null;
let cropSettings = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // ワーカープロセスを終了
  if (workerProcess) {
    workerProcess.kill();
    workerProcess = null;
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ファイル選択ダイアログ
ipcMain.handle('select-file', async (event, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [{ name: 'All Files', extensions: ['*'] }]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// 保存先選択ダイアログ
ipcMain.handle('select-save-path', async (event) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'output.mp4',
    filters: [
      { name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv'] },
      { name: 'MP4 Video', extensions: ['mp4'] },
      { name: 'MOV Video', extensions: ['mov'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    return result.filePath;
  }
  return null;
});

// 動画処理
ipcMain.handle('process-video', async (event, inputs, params, outputOptions) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('動画処理を開始します...');
      console.log('入力:', inputs);
      console.log('パラメータ:', params);
      console.log('出力オプション:', outputOptions);

      // クロップ設定を追加
      const outputOptionsWithCrop = {
        ...outputOptions,
        cropSettings: cropSettings
      };

      // ワーカープロセスを起動
      const workerPath = path.join(__dirname, 'worker.js');
      workerProcess = spawn('node', [workerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });

      let outputBuffer = '';

      // 標準出力からメッセージを受信
      workerProcess.stdout.setEncoding('utf8');
      workerProcess.stdout.on('data', (data) => {
        outputBuffer += data;

        // 完全なメッセージ（改行で区切られている）を処理
        const lines = outputBuffer.split('\n');
        outputBuffer = lines.pop() || '';

        lines.forEach((line) => {
          if (!line.trim()) return;

          try {
            const message = JSON.parse(line);

            switch (message.type) {
              case 'ready':
                console.log('ワーカープロセスが準備完了');
                // 処理開始メッセージを送信
                workerProcess.stdin.write(JSON.stringify({
                  type: 'start',
                  data: { inputs, params, outputOptions: outputOptionsWithCrop }
                }) + '\n');
                break;

              case 'progress':
                // 進捗をUIに送信
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('process-progress', {
                    step: message.step,
                    progress: message.progress,
                    message: message.message
                  });
                }
                break;

              case 'complete':
                console.log('処理完了:', message.outputPath);
                resolve({ success: true, outputPath: message.outputPath });
                break;

              case 'error':
                console.error('ワーカーエラー:', message.error);
                reject(new Error(message.error));
                break;
            }
          } catch (err) {
            console.error('メッセージのパースエラー:', err);
          }
        });
      });

      // エラー出力（UTF-8でデコードして表示）
      workerProcess.stderr.on('data', (data) => {
        const text = data.toString('utf8');
        // エラーメッセージは重要なので出力する
        console.error('[Worker Error]', text);
      });

      // プロセス終了時
      workerProcess.on('close', (code) => {
        console.log(`ワーカープロセスが終了しました (コード: ${code})`);
        workerProcess = null;

        if (code !== 0 && code !== null) {
          reject(new Error(`ワーカープロセスがエラーで終了しました (コード: ${code})`));
        }
      });

      // プロセスエラー
      workerProcess.on('error', (err) => {
        console.error('ワーカープロセスのエラー:', err);
        reject(err);
      });

    } catch (error) {
      console.error('動画処理エラー:', error);
      reject(error);
    }
  }).then(
    (result) => result,
    (error) => ({ success: false, error: error.message, stack: error.stack })
  );
});

// バッチ動画処理
ipcMain.handle('process-video-batch', async (event, videoSets, commonParams, outputOptions) => {
  const totalSets = videoSets.length;
  const results = [];

  console.log(`バッチ処理を開始します (${totalSets}セット)...`);

  for (let i = 0; i < totalSets; i++) {
    const currentSet = i + 1;
    const videoSet = videoSets[i];

    console.log(`\nセット ${currentSet}/${totalSets} を処理中...`);

    try {
      // 各セットの入力とパラメータを準備
      const inputs = videoSet.inputs;
      const params = {
        ...commonParams,
        textOptions: videoSet.textOptions
      };
      const setOutputOptions = {
        ...outputOptions,
        outputPath: videoSet.outputPath,
        cropSettings: cropSettings
      };

      // 個別の動画処理を実行
      const result = await new Promise((resolve, reject) => {
        const workerPath = path.join(__dirname, 'worker.js');
        const workerProc = spawn('node', [workerPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true
        });

        let outputBuffer = '';

        workerProc.stdout.setEncoding('utf8');
        workerProc.stdout.on('data', (data) => {
          outputBuffer += data;
          const lines = outputBuffer.split('\n');
          outputBuffer = lines.pop() || '';

          lines.forEach((line) => {
            if (!line.trim()) return;

            // JSON行かどうかをチェック（{ または [ で始まる）
            const trimmedLine = line.trim();
            if (!trimmedLine.startsWith('{') && !trimmedLine.startsWith('[')) {
              // JSON以外の行はコンソールに出力（デバッグ用）
              console.log(`セット ${currentSet} 出力: ${trimmedLine}`);
              return;
            }

            try {
              const message = JSON.parse(line);

              switch (message.type) {
                case 'ready':
                  console.log(`セット ${currentSet}: ワーカープロセスが準備完了`);
                  workerProc.stdin.write(JSON.stringify({
                    type: 'start',
                    data: { inputs, params, outputOptions: setOutputOptions }
                  }) + '\n');
                  break;

                case 'progress':
                  // バッチ進捗をUIに送信
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('process-progress', {
                      step: message.step,
                      progress: message.progress,
                      message: message.message,
                      currentSet: currentSet,
                      totalSets: totalSets
                    });
                  }
                  break;

                case 'complete':
                  console.log(`セット ${currentSet}: 処理完了 - ${message.outputPath}`);
                  resolve({ success: true, outputPath: message.outputPath });
                  break;

                case 'error':
                  console.error(`セット ${currentSet}: エラー - ${message.error}`);
                  reject(new Error(message.error));
                  break;
              }
            } catch (err) {
              console.error('メッセージのパースエラー:', err);
            }
          });
        });

        workerProc.stderr.on('data', (data) => {
          const text = data.toString('utf8');
          // エラーメッセージは重要なので出力する
          console.error(`[Worker Error - セット${currentSet}]`, text);
        });

        workerProc.on('close', (code) => {
          console.log(`セット ${currentSet}: ワーカープロセスが終了 (コード: ${code})`);
          if (code !== 0 && code !== null) {
            reject(new Error(`ワーカープロセスがエラーで終了しました (コード: ${code})`));
          }
        });

        workerProc.on('error', (err) => {
          console.error(`セット ${currentSet}: ワーカープロセスのエラー:`, err);
          reject(err);
        });
      }).then(
        (result) => result,
        (error) => ({ success: false, error: error.message })
      );

      results.push(result);

    } catch (error) {
      console.error(`セット ${currentSet} の処理エラー:`, error);
      results.push({ success: false, error: error.message });
    }
  }

  // すべてのセットの結果を返す
  const successCount = results.filter(r => r.success).length;
  console.log(`\nバッチ処理完了: ${successCount}/${totalSets} 成功`);

  return {
    success: successCount > 0,
    results: results
  };
});

// クロップウィンドウを開く
ipcMain.handle('open-crop-window', async (event, videoPath, videoPath2) => {
  if (cropWindow && !cropWindow.isDestroyed()) {
    cropWindow.focus();
    return;
  }

  cropVideoPath = videoPath;
  cropVideoPath2 = videoPath2;

  cropWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    parent: mainWindow,
    modal: true,
    title: 'クロップ設定'
  });

  cropWindow.loadFile(path.join(__dirname, 'ui', 'crop.html'));

  if (process.argv.includes('--dev')) {
    cropWindow.webContents.openDevTools();
  }

  cropWindow.on('closed', () => {
    cropWindow = null;
  });

  return new Promise((resolve) => {
    cropWindow.on('closed', () => {
      resolve(cropSettings);
    });
  });
});

// クロップ用のビデオパスを取得（旧版 - 互換性のため残す）
ipcMain.handle('get-crop-video-path', async () => {
  return cropVideoPath;
});

// クロップ用のビデオパス（両方）を取得
ipcMain.handle('get-crop-video-paths', async () => {
  return {
    video1: cropVideoPath,
    video2: cropVideoPath2
  };
});

// 既存のクロップ設定を取得
ipcMain.handle('get-crop-settings', async () => {
  return cropSettings;
});

// クロップ設定を保存
ipcMain.handle('set-crop-settings', async (event, settings) => {
  cropSettings = settings;
  console.log('クロップ設定を保存:', settings);
  return true;
});

// FFmpegのパスを設定
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

console.log('FFmpeg path:', ffmpegPath);
console.log('FFprobe path:', ffprobePath);
