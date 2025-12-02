const { ipcRenderer } = require('electron');

let nextSetId = 1;

// 動画セットを追加
function addVideoSet() {
  const container = document.getElementById('videoSetsContainer');
  const setId = nextSetId++;
  const setNumber = container.children.length + 1;

  const setHtml = `
    <div class="video-set" data-set-id="${setId}">
      <div class="set-header">
        <span class="set-title">セット ${setNumber}</span>
        <button onclick="removeVideoSet(${setId})" class="delete-btn">🗑️ 削除</button>
      </div>

      <div class="input-grid">
        <div class="input-group">
          <label>🎥 動画1</label>
          <div class="file-input">
            <input type="text" class="video1Path" readonly placeholder="動画ファイルを選択...">
            <button onclick="selectVideo1ForSet(${setId})">📂</button>
          </div>
        </div>

        <div class="input-group">
          <label>🎥 動画2</label>
          <div class="file-input">
            <input type="text" class="video2Path" readonly placeholder="動画ファイルを選択...">
            <button onclick="selectVideo2ForSet(${setId})">📂</button>
          </div>
        </div>

        <div class="input-group">
          <label>🖼️ 参照JPEG <span class="optional">(任意)</span></label>
          <div class="file-input">
            <input type="text" class="referencePath" readonly placeholder="色調整用の画像">
            <button onclick="selectReferenceForSet(${setId})">📂</button>
          </div>
        </div>

        <div class="input-group">
          <label>👤 アーティスト名</label>
          <input type="text" class="artistName" placeholder="例: John Doe">
        </div>

        <div class="input-group">
          <label>🎵 曲名</label>
          <input type="text" class="songName" placeholder="例: Amazing Song">
        </div>

        <div class="input-group full-width">
          <label>✏️ テキスト <span class="optional">(任意・改行で複数行)</span></label>
          <textarea class="customText" rows="2" placeholder="空欄の場合、自動生成されます"></textarea>
        </div>

        <div class="input-group full-width">
          <label>💾 出力先</label>
          <div class="file-input">
            <input type="text" class="outputPath" readonly placeholder="保存先を選択...">
            <button onclick="selectOutputPathForSet(${setId})">📂</button>
          </div>
        </div>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', setHtml);
}

// 動画セットを削除
function removeVideoSet(setId) {
  const sets = document.querySelectorAll('.video-set');
  if (sets.length === 1) {
    alert('最低1つのセットが必要です');
    return;
  }

  const setElement = document.querySelector(`.video-set[data-set-id="${setId}"]`);
  if (setElement) {
    setElement.remove();
    // セット番号を再計算
    updateSetNumbers();
  }
}

// セット番号を更新
function updateSetNumbers() {
  const sets = document.querySelectorAll('.video-set');
  sets.forEach((set, index) => {
    const setTitle = set.querySelector('.set-title');
    setTitle.textContent = `セット ${index + 1}`;
  });
}

// ファイル選択関数（セット別）
async function selectVideo1ForSet(setId) {
  const path = await ipcRenderer.invoke('select-file', [
    { name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv'] }
  ]);
  if (path) {
    const set = document.querySelector(`.video-set[data-set-id="${setId}"]`);
    set.querySelector('.video1Path').value = path;
  }
}

async function selectVideo2ForSet(setId) {
  const path = await ipcRenderer.invoke('select-file', [
    { name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv'] }
  ]);
  if (path) {
    const set = document.querySelector(`.video-set[data-set-id="${setId}"]`);
    set.querySelector('.video2Path').value = path;
  }
}

async function selectReferenceForSet(setId) {
  const path = await ipcRenderer.invoke('select-file', [
    { name: 'Image Files', extensions: ['jpg', 'jpeg'] }
  ]);
  if (path) {
    const set = document.querySelector(`.video-set[data-set-id="${setId}"]`);
    set.querySelector('.referencePath').value = path;
  }
}

async function selectOutputPathForSet(setId) {
  const path = await ipcRenderer.invoke('select-save-path');
  if (path) {
    const set = document.querySelector(`.video-set[data-set-id="${setId}"]`);
    set.querySelector('.outputPath').value = path;
  }
}

// 全セットの入力値を取得
function getAllVideoSets() {
  const sets = document.querySelectorAll('.video-set');
  const videoSets = [];

  sets.forEach((set, index) => {
    videoSets.push({
      inputs: {
        video1Path: set.querySelector('.video1Path').value,
        video2Path: set.querySelector('.video2Path').value,
        referencePath: set.querySelector('.referencePath').value,
        artistName: set.querySelector('.artistName').value,
        songName: set.querySelector('.songName').value
      },
      textOptions: {
        fontFamily: document.getElementById('fontFamily').value,
        fontWeight: document.getElementById('fontWeight').value,
        customText: set.querySelector('.customText').value,
        textColor: document.getElementById('textColor').value,
        bgColor: document.getElementById('bgColor').value,
        bgOpacity: parseFloat(document.getElementById('bgOpacity').value),
        padding: parseInt(document.getElementById('padding').value),
        positionY: parseFloat(document.getElementById('positionY').value),
        maxBgWidthRatio: parseFloat(document.getElementById('maxBgWidthRatio').value),
        maxBgHeightRatio: parseFloat(document.getElementById('maxBgHeightRatio').value)
      },
      outputPath: set.querySelector('.outputPath').value
    });
  });

  return videoSets;
}

// 共通パラメータを取得
function getCommonParams() {
  return {
    syncTolerance: parseFloat(document.getElementById('syncTolerance').value),
    targetLUFS: parseFloat(document.getElementById('targetLUFS').value),
    audioGain: parseFloat(document.getElementById('audioGain').value),
    limiterThreshold: parseFloat(document.getElementById('limiterThreshold').value),
    whiteBalance: parseFloat(document.getElementById('whiteBalance').value),
    saturation: parseFloat(document.getElementById('saturation').value),
    contrast: parseFloat(document.getElementById('contrast').value),
    enableFrameRateConversion: document.getElementById('enableFrameRateConversion').checked
  };
}

// 出力オプションを取得
function getOutputOptions() {
  return {
    width: parseInt(document.getElementById('outputWidth').value),
    height: parseInt(document.getElementById('outputHeight').value),
    fps: parseInt(document.getElementById('outputFps').value),
    codec: document.getElementById('codec').value,
    bitrate: document.getElementById('bitrate').value
  };
}

// 入力検証
function validateBatchInputs(videoSets) {
  const errors = [];

  videoSets.forEach((set, index) => {
    const setNum = index + 1;
    if (!set.inputs.video1Path) {
      errors.push(`セット${setNum}: 動画1を選択してください`);
    }
    if (!set.inputs.video2Path) {
      errors.push(`セット${setNum}: 動画2を選択してください`);
    }

    // テキストが入力されていない場合のみ、アーティスト名と曲名が必須
    const hasCustomText = set.textOptions.customText && set.textOptions.customText.trim();
    if (!hasCustomText) {
      if (!set.inputs.artistName) {
        errors.push(`セット${setNum}: アーティスト名を入力するか、カスタムテキストを入力してください`);
      }
      if (!set.inputs.songName) {
        errors.push(`セット${setNum}: 曲名を入力するか、カスタムテキストを入力してください`);
      }
    }

    if (!set.outputPath) {
      errors.push(`セット${setNum}: 出力ファイルパスを選択してください`);
    }
  });

  return errors;
}

// バッチ処理開始
async function startBatchProcessing() {
  const videoSets = getAllVideoSets();
  const commonParams = getCommonParams();
  const outputOptions = getOutputOptions();

  const errors = validateBatchInputs(videoSets);

  if (errors.length > 0) {
    alert('入力エラー:\n' + errors.join('\n'));
    return;
  }

  // UI更新
  document.querySelector('.process-button').disabled = true;
  document.getElementById('progressSection').style.display = 'block';
  document.getElementById('resultSection').style.display = 'none';
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('progressText').textContent = `バッチ処理を開始しています... (全${videoSets.length}セット)`;

  try {
    const result = await ipcRenderer.invoke(
      'process-video-batch',
      videoSets,
      commonParams,
      outputOptions
    );

    if (result.success) {
      // 成功
      document.getElementById('progressFill').style.width = '100%';
      document.getElementById('progressText').textContent = '完了!';
      document.getElementById('resultSection').style.display = 'block';

      const successList = result.results
        .filter(r => r.success)
        .map((r, i) => `セット${i+1}: ${r.outputPath}`)
        .join('<br>');

      const failList = result.results
        .filter(r => !r.success)
        .map((r, i) => `セット${i+1}: ${r.error}`)
        .join('<br>');

      let resultHtml = `<span class="success">バッチ処理が完了しました!</span><br>`;
      resultHtml += `<br><strong>成功: ${result.results.filter(r => r.success).length}/${videoSets.length}</strong><br>${successList}`;

      if (failList) {
        resultHtml += `<br><br><strong>失敗:</strong><br><span class="error">${failList}</span>`;
      }

      document.getElementById('resultText').innerHTML = resultHtml;
    } else {
      // エラー
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('処理エラー:', error);
    document.getElementById('progressText').textContent = 'エラーが発生しました';
    document.getElementById('resultSection').style.display = 'block';

    const errorMessage = (error.message || '不明なエラー').replace(/\n/g, '<br>');
    document.getElementById('resultText').innerHTML = `
      <span class="error">エラーが発生しました:</span><br>
      <pre style="white-space: pre-wrap; word-wrap: break-word; font-size: 12px; margin-top: 10px;">${errorMessage}</pre>
    `;
  } finally {
    document.querySelector('.process-button').disabled = false;
  }
}

// クロップ設定ウィンドウを開く
async function openCropWindow() {
  // 最初のセットの動画1と動画2を取得
  const firstSet = document.querySelector('.video-set[data-set-id="0"]');
  if (!firstSet) {
    alert('動画セットが見つかりません');
    return;
  }

  const video1Path = firstSet.querySelector('.video1Path').value;
  const video2Path = firstSet.querySelector('.video2Path').value;

  if (!video1Path) {
    alert('動画1を選択してください');
    return;
  }

  try {
    const cropSettings = await ipcRenderer.invoke('open-crop-window', video1Path, video2Path);
    if (cropSettings) {
      console.log('クロップ設定が更新されました:', cropSettings);
      const timeInfo = cropSettings.startTime !== undefined && cropSettings.endTime !== undefined
        ? `\n時間: ${cropSettings.startTime}秒 〜 ${cropSettings.endTime}秒 (${(cropSettings.endTime - cropSettings.startTime).toFixed(1)}秒)`
        : '';
      const rotationInfo = cropSettings.rotation ? `\n回転: ${cropSettings.rotation}°` : '';
      const zoomInfo = cropSettings.zoom && cropSettings.zoom !== 100 ? `\nズーム: ${cropSettings.zoom}%` : '';
      const videoInfo = cropSettings.currentVideo ? `\n対象: ${cropSettings.currentVideo === 'video1' ? '動画1' : '動画2'}` : '';
      alert(`クロップ設定が適用されました\nX: ${cropSettings.x}, Y: ${cropSettings.y}\n幅: ${cropSettings.width}, 高さ: ${cropSettings.height}${timeInfo}${rotationInfo}${zoomInfo}${videoInfo}`);
    }
  } catch (error) {
    console.error('クロップウィンドウのエラー:', error);
    alert('クロップウィンドウの起動に失敗しました: ' + error.message);
  }
}

// 進捗状況を受信
ipcRenderer.on('process-progress', (event, data) => {
  const { step, progress, message, currentSet, totalSets } = data;

  // 全体の進捗を計算（ステップ数を10に更新）
  const totalSteps = 10;
  const setProgress = currentSet ? ((currentSet - 1) / totalSets) * 100 : 0;
  const stepProgress = step ? ((step - 1) / totalSteps * 100) + (progress / totalSteps) : 0;
  const overallProgress = setProgress + (stepProgress / totalSets);

  // 進捗バーを更新
  const progressFill = document.getElementById('progressFill');
  progressFill.style.width = `${overallProgress.toFixed(1)}%`;
  progressFill.textContent = `${overallProgress.toFixed(0)}%`;

  // 進捗テキストを更新
  const progressText = document.getElementById('progressText');
  if (currentSet && totalSets) {
    progressText.textContent = `セット ${currentSet}/${totalSets} - ステップ ${step}/${totalSteps}: ${message || '処理中...'}`;
  } else if (message) {
    progressText.textContent = message;
  } else {
    progressText.textContent = `処理中... ${overallProgress.toFixed(1)}%`;
  }

  console.log(`進捗更新: セット ${currentSet}/${totalSets} - ステップ ${step}/${totalSteps} - ${progress.toFixed(1)}% - ${message || ''}`);
});

// デフォルト値を設定
window.addEventListener('DOMContentLoaded', () => {
  console.log('アプリケーションが起動しました');
});
