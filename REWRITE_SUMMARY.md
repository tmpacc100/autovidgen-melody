# FFmpegモジュール書き換え完了

すべてのFFmpeg処理を`fluent-ffmpeg`から直接`exec`による実行に書き換えました。

## 変更内容

### 書き換えたモジュール

| モジュール | 変更内容 | 改善点 |
|-----------|---------|--------|
| **audioSync.js** | `extractAudio()` を直接execで実行 | - タイムアウト60秒<br>- 詳細なエラーメッセージ<br>- ファイル存在確認 |
| **videoPipeline.js** | `trimVideo()`, `extractAudioOnly()`, `mergeVideoAudio()`, `finalEncode()` を書き換え | - 各処理でタイムアウト設定<br>- エラー時にstderrを表示<br>- 出力ファイルの確認 |
| **frameRate.js** | `convertTo60fps()` を書き換え | - タイムアウト5分<br>- 60fps変換の有効/無効対応 |
| **colorCorrection.js** | `extractFrame()`, `applyColorCorrection()` を書き換え | - フレーム抽出を高速化<br>- 色調整フィルターを直接適用 |
| **loudnessNormalization.js** | `normalizeLoudness()` を書き換え | - 2パス処理を1コマンドで実行<br>- タイムアウト5分 |
| **textOverlay.js** | `applyTextOverlay()` を書き換え | - テキストフィルターを直接適用<br>- タイムアウト5分 |

### 主な改善点

#### 1. エラーハンドリングの強化

**変更前（fluent-ffmpeg）:**
```javascript
ffmpeg(inputPath)
  .output(outputPath)
  .on('error', reject)
  .run();
```

**変更後（直接exec）:**
```javascript
exec(command, {
  timeout: 60000,
  maxBuffer: 50 * 1024 * 1024
}, (error, _stdout, stderr) => {
  if (error) {
    reject(new Error(`Processing failed: ${error.message}\n${stderr}`));
  } else {
    fs.access(outputPath).then(() => {
      resolve(outputPath);
    }).catch(() => {
      reject(new Error(`File was not created: ${outputPath}`));
    });
  }
});
```

#### 2. タイムアウト設定

すべての処理にタイムアウトを設定しました：

- 音声抽出: 60秒
- フレーム抽出: 30秒
- 動画トリミング: 2分
- 60fps変換: 5分
- 色調整: 5分
- ラウドネス正規化: 5分
- テキストオーバーレイ: 5分
- 最終エンコード: 10分

#### 3. 詳細なログ出力

すべての処理で実行するFFmpegコマンドをログ出力：

```javascript
console.log('Executing:', command);
```

これにより、エラー発生時にコマンドを確認できます。

#### 4. ファイルパスのエスケープ

Windowsパスを正しく処理：

```javascript
const escapePath = (p) => `"${p}"`;
const command = `${escapePath(ffmpegPath)} -i ${escapePath(videoPath)} ...`;
```

#### 5. 出力ファイルの確認

処理完了後、出力ファイルが実際に作成されたか確認：

```javascript
fs.access(outputPath).then(() => {
  resolve(outputPath);
}).catch(() => {
  reject(new Error(`File was not created: ${outputPath}`));
});
```

## 使い方

### アプリケーションの起動

```bash
npm start
```

### エラー発生時の対処

エラーが発生した場合、以下の情報が表示されるようになりました：

1. **どの処理で失敗したか**
   ```
   Audio extraction failed
   Video trim failed
   Color correction failed
   ```

2. **FFmpegのエラー出力（stderr）**
   ```
   FFmpeg output:
   [詳細なエラーメッセージ]
   ```

3. **実行したコマンド**
   コンソールログで確認できます：
   ```
   Executing: "path/to/ffmpeg" -i "input.mp4" ...
   ```

### デバッグ方法

1. **コンソールログを確認**
   ```bash
   npm start
   ```
   ターミナルに実行したFFmpegコマンドが表示されます

2. **コマンドを手動で実行**
   エラーが発生したコマンドをコピーして、コマンドラインで直接実行：
   ```bash
   "C:\path\to\ffmpeg.exe" -i "input.mp4" -vn -acodec pcm_s16le -ar 48000 -ac 1 -y "output.wav"
   ```

3. **診断ツールを使用**
   ```bash
   node test-ffmpeg.js "動画ファイルのパス"
   ```

## 期待される効果

### ✅ 改善される問題

1. **エラーメッセージが詳細になる**
   - FFmpegのstderr出力が表示される
   - どの処理で失敗したか明確になる

2. **タイムアウトで無限ハング防止**
   - 各処理に適切なタイムアウト設定
   - フリーズしても一定時間後にエラーになる

3. **ファイル作成の確認**
   - 出力ファイルが実際に作成されたか確認
   - 「成功したのにファイルがない」問題を防止

4. **デバッグが容易**
   - 実行コマンドがログ出力される
   - コマンドを手動で実行して検証可能

### ⚠️ まだ解決しない可能性がある問題

以下の問題は、FFmpegの実行方法を変更しただけでは解決しません：

1. **動画ファイルに音声トラックがない**
   → 診断ツールで確認してください
   ```bash
   node test-ffmpeg.js "動画のパス"
   ```

2. **動画ファイルが破損している**
   → 動画を再エクスポートしてください

3. **コーデックがサポートされていない**
   → MP4 (H.264/AAC) に変換してください

## 次のステップ

### 1. アプリケーションをテスト

```bash
npm start
```

### 2. エラーが発生した場合

#### A. ターミナルで実行コマンドを確認

```
Executing: "C:\...\ffmpeg.exe" -i "動画.mp4" ...
```

このコマンドをコピーしてください。

#### B. コマンドを手動で実行

```bash
# コピーしたコマンドを貼り付けて実行
"C:\...\ffmpeg.exe" -i "動画.mp4" ...
```

FFmpegの出力を確認して、エラーの原因を特定できます。

#### C. 診断ツールで動画を確認

```bash
node test-ffmpeg.js "動画1のパス"
node test-ffmpeg.js "動画2のパス"
```

両方で`Has audio track: YES`と表示されることを確認してください。

### 3. それでも解決しない場合

以下の情報を集めてください：

1. **エラーメッセージ全文**
   - UIに表示されたエラー
   - ターミナルのログ

2. **実行されたコマンド**
   ```
   Executing: ...
   ```

3. **診断ツールの出力**
   ```bash
   node test-ffmpeg.js "動画のパス" > diagnostic.txt
   ```

4. **動画ファイルの情報**
   - ファイルサイズ
   - どのソフトで作成したか
   - 他のプレイヤーで再生できるか

## 技術的な詳細

### fluent-ffmpegから直接execに変更した理由

1. **エラー情報の不足**
   - fluent-ffmpegはエラー時の情報が限定的
   - stderrの内容が取得しづらい

2. **タイムアウトの制御**
   - fluent-ffmpegのタイムアウトが不安定
   - execの方が確実にタイムアウトできる

3. **デバッグの困難さ**
   - fluent-ffmpegは内部でコマンドを生成
   - 実際に実行されるコマンドが見えにくい

4. **パス処理の問題**
   - fluent-ffmpegのパスエスケープが不完全
   - 日本語や特殊文字で問題が発生しやすい

### 直接exec実行の利点

1. **完全な制御**
   - FFmpegコマンドを直接記述
   - オプションの細かい調整が可能

2. **透明性**
   - 実行されるコマンドが明確
   - ログで確認できる

3. **デバッグ性**
   - コマンドをコピーして手動実行可能
   - エラーの原因特定が容易

4. **エラーハンドリング**
   - stderr出力を完全に取得
   - 詳細なエラーメッセージ

## まとめ

✅ すべてのFFmpegモジュールを書き換え完了
✅ タイムアウト設定で無限ハング防止
✅ 詳細なエラーメッセージ表示
✅ デバッグが容易になった
✅ ファイル作成の確認機能追加

### 試してください

1. `npm start` でアプリケーションを起動
2. 動画ファイルを選択して処理を実行
3. エラーが発生した場合は、ターミナルのログを確認
4. 実行されたコマンドを確認してデバッグ

問題が解決しない場合は、診断ツールで動画ファイルを確認してください。
