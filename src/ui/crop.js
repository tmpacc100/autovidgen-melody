const { ipcRenderer } = require('electron');

let video1Path = null;
let video2Path = null;
let currentVideo = 'video1';
let cropData = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  startTime: 0,
  endTime: 0,
  rotation: 0,
  zoom: 100
};

let isDragging = false;
let isResizing = false;
let resizeHandle = null;
let dragStartX = 0;
let dragStartY = 0;
let cropStartX = 0;
let cropStartY = 0;
let cropStartWidth = 0;
let cropStartHeight = 0;

let videoElement = null;
let cropRect = null;
let videoScale = 1;
let videoOffsetX = 0;
let videoOffsetY = 0;

// タイムライン関連
let timelineTrack = null;
let timelineSelection = null;
let startHandle = null;
let endHandle = null;
let isTimelineDragging = false;
let timelineDragType = null; // 'start', 'end', 'selection'
let loopEnabled = false;

// 初期化
window.addEventListener('DOMContentLoaded', async () => {
  videoElement = document.getElementById('videoPreview');
  cropRect = document.getElementById('cropRect');

  // ビデオパスを取得
  const paths = await ipcRenderer.invoke('get-crop-video-paths');

  if (!paths || !paths.video1) {
    document.getElementById('loading').textContent = 'エラー: ビデオパスが見つかりません';
    return;
  }

  video1Path = paths.video1;
  video2Path = paths.video2;

  // 動画2がない場合は選択肢を無効化
  if (!video2Path) {
    document.querySelector('#videoSelect option[value="video2"]').disabled = true;
  }

  // 既存のクロップ設定を取得
  const existingCrop = await ipcRenderer.invoke('get-crop-settings');
  if (existingCrop) {
    cropData = { ...cropData, ...existingCrop };
    document.getElementById('rotation').value = cropData.rotation || 0;
    document.getElementById('zoom').value = cropData.zoom || 100;
  }

  // ビデオを読み込み
  videoElement.src = video1Path;

  videoElement.addEventListener('loadedmetadata', () => {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('videoWrapper').style.display = 'inline-block';

    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;
    const videoDuration = videoElement.duration;

    document.getElementById('statusText').textContent =
      `動画サイズ: ${videoWidth}x${videoHeight}px | 長さ: ${videoDuration.toFixed(1)}秒 | 出力: 1080x1920px`;

    // デフォルトのクロップ範囲を設定（画面全体）
    if (cropData.width === 0 || cropData.height === 0) {
      cropData.width = videoWidth;
      cropData.height = videoHeight;
      cropData.x = 0;
      cropData.y = 0;
    }

    // デフォルトの時間範囲を設定（動画全体）
    if (cropData.endTime === 0) {
      cropData.startTime = 0;
      cropData.endTime = videoDuration;
    }

    // タイムライン要素を取得
    timelineTrack = document.getElementById('timelineTrack');
    timelineSelection = document.getElementById('timelineSelection');
    startHandle = document.getElementById('startHandle');
    endHandle = document.getElementById('endHandle');

    updateCropDisplay();
    updateTimeline();

    // イベントリスナーを設定
    setupEventListeners();
    setupTimelineListeners();
  });

  // 動画の時間更新イベント
  videoElement.addEventListener('timeupdate', () => {
    updateTimelineProgress();

    // ループ再生
    if (loopEnabled && videoElement.currentTime >= cropData.endTime) {
      videoElement.currentTime = cropData.startTime;
      videoElement.play();
    }
  });

  videoElement.addEventListener('error', (e) => {
    document.getElementById('loading').textContent =
      'エラー: 動画の読み込みに失敗しました';
    console.error('Video load error:', e);
  });
});

// イベントリスナーの設定
function setupEventListeners() {
  // ハンドルのドラッグ
  const handles = document.querySelectorAll('.crop-handle');
  handles.forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      isResizing = true;
      resizeHandle = handle.dataset.handle;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      cropStartX = cropData.x;
      cropStartY = cropData.y;
      cropStartWidth = cropData.width;
      cropStartHeight = cropData.height;
    });
  });

  // クロップ矩形のドラッグ（移動）
  cropRect.addEventListener('mousedown', (e) => {
    if (isResizing) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    cropStartX = cropData.x;
    cropStartY = cropData.y;
  });

  // マウス移動
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      handleDrag(e);
    } else if (isResizing) {
      handleResize(e);
    }
  });

  // マウスアップ
  document.addEventListener('mouseup', () => {
    isDragging = false;
    isResizing = false;
    resizeHandle = null;
  });

  // 数値入力
  document.getElementById('cropWidth').addEventListener('input', (e) => {
    const newWidth = parseInt(e.target.value);
    if (newWidth > 0 && newWidth <= videoElement.videoWidth) {
      cropData.width = newWidth;
      // 範囲チェック
      if (cropData.x + cropData.width > videoElement.videoWidth) {
        cropData.x = videoElement.videoWidth - cropData.width;
      }
      updateCropDisplay();
    }
  });

  document.getElementById('cropHeight').addEventListener('input', (e) => {
    const newHeight = parseInt(e.target.value);
    if (newHeight > 0 && newHeight <= videoElement.videoHeight) {
      cropData.height = newHeight;
      // 範囲チェック
      if (cropData.y + cropData.height > videoElement.videoHeight) {
        cropData.y = videoElement.videoHeight - cropData.height;
      }
      updateCropDisplay();
    }
  });

  // 回転の変更
  document.getElementById('rotation').addEventListener('change', (e) => {
    cropData.rotation = parseInt(e.target.value);
    applyVideoTransform();
  });

  // ズームの変更
  document.getElementById('zoom').addEventListener('input', (e) => {
    cropData.zoom = parseInt(e.target.value);
    applyVideoTransform();
  });

  // ウィンドウリサイズ時に再計算
  window.addEventListener('resize', () => {
    updateCropDisplay();
    updateTimeline();
  });
}

// 動画の切り替え
function switchVideo() {
  const select = document.getElementById('videoSelect');
  currentVideo = select.value;

  const newPath = currentVideo === 'video1' ? video1Path : video2Path;
  if (!newPath) return;

  const currentTime = videoElement.currentTime;
  const wasPaused = videoElement.paused;

  videoElement.src = newPath;
  videoElement.addEventListener('loadeddata', () => {
    videoElement.currentTime = Math.min(currentTime, videoElement.duration);
    if (!wasPaused) {
      videoElement.play();
    }
    updateCropDisplay();
    updateTimeline();
  }, { once: true });
}

// 動画の変形を適用（回転・ズーム）
function applyVideoTransform() {
  const rotation = cropData.rotation || 0;
  const zoom = (cropData.zoom || 100) / 100;

  videoElement.style.transform = `rotate(${rotation}deg) scale(${zoom})`;
}

// タイムラインのイベントリスナーを設定
function setupTimelineListeners() {
  // 開始ハンドルのドラッグ
  startHandle.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    isTimelineDragging = true;
    timelineDragType = 'start';
  });

  // 終了ハンドルのドラッグ
  endHandle.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    isTimelineDragging = true;
    timelineDragType = 'end';
  });

  // タイムライントラックのクリック（シーク）
  timelineTrack.addEventListener('click', (e) => {
    if (isTimelineDragging) return;

    const rect = timelineTrack.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * videoElement.duration;

    videoElement.currentTime = Math.max(cropData.startTime, Math.min(cropData.endTime, newTime));
  });

  // マウス移動
  document.addEventListener('mousemove', (e) => {
    if (isTimelineDragging) {
      handleTimelineDrag(e);
    }
  });

  // マウスアップ
  document.addEventListener('mouseup', () => {
    if (isTimelineDragging) {
      isTimelineDragging = false;
      timelineDragType = null;
    }
  });
}

// タイムラインのドラッグ処理
function handleTimelineDrag(e) {
  const rect = timelineTrack.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const percentage = Math.max(0, Math.min(1, mouseX / rect.width));
  const newTime = percentage * videoElement.duration;

  if (timelineDragType === 'start') {
    cropData.startTime = Math.max(0, Math.min(cropData.endTime - 0.1, newTime));
    videoElement.currentTime = cropData.startTime;
  } else if (timelineDragType === 'end') {
    cropData.endTime = Math.max(cropData.startTime + 0.1, Math.min(videoElement.duration, newTime));
    // 終了ハンドルをドラッグ中も、その位置のフレームを表示
    videoElement.currentTime = cropData.endTime;
  }

  updateTimeline();
  updateCropDisplay();
}

// タイムラインの表示を更新
function updateTimeline() {
  if (!timelineTrack || !videoElement.duration) return;

  const duration = videoElement.duration;
  const startPercent = (cropData.startTime / duration) * 100;
  const endPercent = (cropData.endTime / duration) * 100;

  timelineSelection.style.left = startPercent + '%';
  timelineSelection.style.width = (endPercent - startPercent) + '%';

  // ラベルを更新
  document.getElementById('startLabel').textContent = cropData.startTime.toFixed(1) + 's';
  document.getElementById('endLabel').textContent = cropData.endTime.toFixed(1) + 's';
  document.getElementById('selectionDuration').textContent = (cropData.endTime - cropData.startTime).toFixed(1) + '秒';
}

// タイムラインの進行状況を更新
function updateTimelineProgress() {
  if (!timelineTrack || !videoElement.duration) return;

  const percentage = (videoElement.currentTime / videoElement.duration) * 100;
  document.getElementById('timelineProgress').style.width = percentage + '%';
  document.getElementById('currentLabel').textContent = videoElement.currentTime.toFixed(1) + 's';
}

// 再生/一時停止の切り替え
function togglePlayPause() {
  const btn = document.getElementById('playPauseBtn');

  if (videoElement.paused) {
    // 現在の位置が選択範囲外なら、開始位置にシーク
    if (videoElement.currentTime < cropData.startTime || videoElement.currentTime >= cropData.endTime) {
      videoElement.currentTime = cropData.startTime;
    }
    videoElement.play();
    btn.textContent = '⏸ 一時停止';
  } else {
    videoElement.pause();
    btn.textContent = '▶ 再生';
  }
}

// ループ再生の切り替え
function toggleLoop() {
  loopEnabled = !loopEnabled;
  const loopBtn = document.getElementById('loopBtn');
  loopBtn.textContent = loopEnabled ? '🔁 ループ: ON' : '🔁 ループ: OFF';
  loopBtn.style.background = loopEnabled ? '#FF9800' : '#4CAF50';
}

// 動画の再生/一時停止イベントを監視してボタンを更新
if (videoElement) {
  videoElement.addEventListener('play', () => {
    const btn = document.getElementById('playPauseBtn');
    if (btn) btn.textContent = '⏸ 一時停止';
  });

  videoElement.addEventListener('pause', () => {
    const btn = document.getElementById('playPauseBtn');
    if (btn) btn.textContent = '▶ 再生';
  });
}

// ドラッグ処理（移動）
function handleDrag(e) {
  const rect = videoElement.getBoundingClientRect();
  videoScale = rect.width / videoElement.videoWidth;

  const deltaX = (e.clientX - dragStartX) / videoScale;
  const deltaY = (e.clientY - dragStartY) / videoScale;

  cropData.x = Math.max(0, Math.min(
    videoElement.videoWidth - cropData.width,
    cropStartX + deltaX
  ));
  cropData.y = Math.max(0, Math.min(
    videoElement.videoHeight - cropData.height,
    cropStartY + deltaY
  ));

  updateCropDisplay();
}

// リサイズ処理
function handleResize(e) {
  const rect = videoElement.getBoundingClientRect();
  videoScale = rect.width / videoElement.videoWidth;

  const deltaX = (e.clientX - dragStartX) / videoScale;
  const deltaY = (e.clientY - dragStartY) / videoScale;

  const videoWidth = videoElement.videoWidth;
  const videoHeight = videoElement.videoHeight;

  switch (resizeHandle) {
    case 'nw':
      cropData.x = Math.max(0, Math.min(cropStartX + cropStartWidth - 100, cropStartX + deltaX));
      cropData.y = Math.max(0, Math.min(cropStartY + cropStartHeight - 100, cropStartY + deltaY));
      cropData.width = cropStartWidth - (cropData.x - cropStartX);
      cropData.height = cropStartHeight - (cropData.y - cropStartY);
      break;
    case 'ne':
      cropData.y = Math.max(0, Math.min(cropStartY + cropStartHeight - 100, cropStartY + deltaY));
      cropData.width = Math.min(videoWidth - cropStartX, Math.max(100, cropStartWidth + deltaX));
      cropData.height = cropStartHeight - (cropData.y - cropStartY);
      break;
    case 'sw':
      cropData.x = Math.max(0, Math.min(cropStartX + cropStartWidth - 100, cropStartX + deltaX));
      cropData.width = cropStartWidth - (cropData.x - cropStartX);
      cropData.height = Math.min(videoHeight - cropStartY, Math.max(100, cropStartHeight + deltaY));
      break;
    case 'se':
      cropData.width = Math.min(videoWidth - cropStartX, Math.max(100, cropStartWidth + deltaX));
      cropData.height = Math.min(videoHeight - cropStartY, Math.max(100, cropStartHeight + deltaY));
      break;
    case 'n':
      cropData.y = Math.max(0, Math.min(cropStartY + cropStartHeight - 100, cropStartY + deltaY));
      cropData.height = cropStartHeight - (cropData.y - cropStartY);
      break;
    case 's':
      cropData.height = Math.min(videoHeight - cropStartY, Math.max(100, cropStartHeight + deltaY));
      break;
    case 'w':
      cropData.x = Math.max(0, Math.min(cropStartX + cropStartWidth - 100, cropStartX + deltaX));
      cropData.width = cropStartWidth - (cropData.x - cropStartX);
      break;
    case 'e':
      cropData.width = Math.min(videoWidth - cropStartX, Math.max(100, cropStartWidth + deltaX));
      break;
  }

  updateCropDisplay();
}

// クロップ表示を更新
function updateCropDisplay() {
  const rect = videoElement.getBoundingClientRect();
  videoScale = rect.width / videoElement.videoWidth;

  const displayX = cropData.x * videoScale;
  const displayY = cropData.y * videoScale;
  const displayWidth = cropData.width * videoScale;
  const displayHeight = cropData.height * videoScale;

  cropRect.style.left = displayX + 'px';
  cropRect.style.top = displayY + 'px';
  cropRect.style.width = displayWidth + 'px';
  cropRect.style.height = displayHeight + 'px';

  // 情報表示を更新
  const duration = cropData.endTime - cropData.startTime;
  document.getElementById('cropInfo').textContent =
    `X: ${Math.round(cropData.x)}, Y: ${Math.round(cropData.y)}, W: ${Math.round(cropData.width)}, H: ${Math.round(cropData.height)} | 時間: ${cropData.startTime.toFixed(1)}秒 〜 ${cropData.endTime.toFixed(1)}秒 (${duration.toFixed(1)}秒)`;

  // 入力フィールドを更新
  document.getElementById('cropWidth').value = Math.round(cropData.width);
  document.getElementById('cropHeight').value = Math.round(cropData.height);
}

// リセット
function resetCrop() {
  const videoWidth = videoElement.videoWidth;
  const videoHeight = videoElement.videoHeight;
  const videoDuration = videoElement.duration;

  cropData.width = videoWidth;
  cropData.height = videoHeight;
  cropData.x = 0;
  cropData.y = 0;
  cropData.startTime = 0;
  cropData.endTime = videoDuration;
  cropData.rotation = 0;
  cropData.zoom = 100;

  document.getElementById('rotation').value = 0;
  document.getElementById('zoom').value = 100;

  videoElement.currentTime = 0;
  videoElement.pause();

  applyVideoTransform();
  updateCropDisplay();
  updateTimeline();
}

// 適用
async function applyCrop() {
  // クロップ設定を保存（rotation, zoom, currentVideoも含める）
  const result = {
    x: Math.round(cropData.x),
    y: Math.round(cropData.y),
    width: Math.round(cropData.width),
    height: Math.round(cropData.height),
    startTime: parseFloat(cropData.startTime.toFixed(1)),
    endTime: parseFloat(cropData.endTime.toFixed(1)),
    rotation: parseInt(cropData.rotation || 0),
    zoom: parseInt(cropData.zoom || 100),
    currentVideo: currentVideo
  };

  await ipcRenderer.invoke('set-crop-settings', result);
  window.close();
}

// キャンセル
function cancel() {
  window.close();
}
