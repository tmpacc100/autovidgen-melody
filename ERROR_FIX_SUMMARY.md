# エラー修正完了 - 次のステップ

## 実装した改善点

### 1. 音声トラック検証機能
- **機能**: 処理開始前に両方の動画に音声トラックがあるか自動確認
- **ファイル**: [src/modules/audioSync.js](src/modules/audioSync.js)
- **効果**: 音声トラックがない動画を事前に検出し、明確なエラーメッセージを表示

### 2. 詳細なエラーメッセージ表示
- **機能**: FFmpegのstderr出力を含む詳細なエラー情報を表示
- **ファイル**: [src/ui/app.js](src/ui/app.js)
- **効果**: エラーの原因を特定しやすくなりました

### 3. 診断ツールの追加
新しく以下のファイルを作成しました:

#### [test-ffmpeg.js](test-ffmpeg.js)
動画ファイルの詳細診断を実行するスクリプト
- ファイルの存在確認
- 音声/動画トラックの確認
- メタデータの表示
- 音声抽出のテスト

#### [test-videos.bat](test-videos.bat)
複数の動画を一度にテスト（Windows用）

#### [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
日本語の詳細なトラブルシューティングガイド

#### [DIAGNOSTIC_STEPS.md](DIAGNOSTIC_STEPS.md)
英語のクイックガイド

---

## 次にやること

### ステップ1: 動画ファイルを診断する

アプリケーションを実行する前に、入力動画ファイルを診断してください。

```bash
# 動画1をテスト
node test-ffmpeg.js "C:\path\to\video1.mp4"

# 動画2をテスト
node test-ffmpeg.js "C:\path\to\ScreenRecording.mov"

# または両方を一度にテスト（Windows）
test-videos.bat "C:\path\to\video1.mp4" "C:\path\to\ScreenRecording.mov"
```

### ステップ2: 出力を確認

診断ツールの出力で以下を確認してください:

✅ **正常な動画:**
```
Has audio track: YES
Has video track: YES
SUCCESS: Audio extracted to: ...
```

❌ **問題のある動画:**
```
Has audio track: NO
WARNING: This video does not have an audio track!
```

### ステップ3-A: 問題が見つかった場合

#### 音声トラックがない場合

**解決方法:**
1. 動画を再エクスポートして音声を含める
2. 動画編集ソフトで音声トラックを追加
3. 音声付きの別の動画ファイルを使用

**推奨ツール:**
- HandBrake (無料): 動画を再エンコード
- FFmpeg (コマンドライン):
  ```bash
  ffmpeg -i input.mp4 -c:v copy -c:a aac output.mp4
  ```

#### ファイルパスに日本語がある場合

ファイルを英数字のみのパスに移動:
```
悪い例: C:\Users\ユーザー\動画\video.mp4
良い例: C:\Videos\video.mp4
```

### ステップ3-B: 問題がなければアプリを実行

両方の動画で`Has audio track: YES`と表示された場合:

```bash
npm start
```

アプリケーションを起動して処理を実行してください。

---

## 改善されたエラー表示

エラーが発生した場合、以下のような詳細なメッセージが表示されます:

### 例1: 音声トラックがない
```
エラーが発生しました:
Video A (video1.mp4) does not have an audio track.
Please provide a video with audio.
```

### 例2: ファイルが見つからない
```
エラーが発生しました:
Audio files not created: ENOENT: no such file or directory
```

### 例3: FFmpegエラー（詳細付き）
```
エラーが発生しました:
Audio extraction failed for C:\path\to\video.mp4:
Output file #0 does not contain any stream

Stderr:
[詳細なFFmpegエラー出力がここに表示されます]
```

---

## よくある質問

### Q: 診断ツールでエラーが出ないのにアプリでエラーになる

A: 以下を確認してください:
1. アプリで選択した動画ファイルのパスが正しいか
2. ファイル名に日本語や特殊文字が含まれていないか
3. ディスク容量が十分にあるか（一時ファイル用）

### Q: 動画に音声があるのに「音声トラックがない」と表示される

A: 以下を試してください:
1. 動画をMP4 (H.264/AAC) に再エンコード
2. HandBrakeで「Fast 1080p30」プリセットを使用
3. 動画編集ソフトで開いて保存し直す

### Q: 処理に時間がかかりすぎる

A: 以下の設定を調整してください:
1. 出力ビットレートを下げる（8M → 5M）
2. 60fps変換を無効化
3. 短い動画（30秒〜2分）でテストする

---

## テストの推奨手順

1. **まず短い動画でテスト**
   - 30秒〜1分の動画でテスト
   - すべての機能が動作することを確認

2. **設定を調整**
   - 必要に応じてパラメータを変更
   - 色調整、音声設定など

3. **本番の動画で実行**
   - テストが成功したら本番の動画を処理

---

## サポート情報

問題が解決しない場合は、以下の情報を用意してください:

1. **診断ツールの出力**
   ```bash
   node test-ffmpeg.js "動画のパス" > diagnostic.txt
   ```

2. **アプリケーションのエラーメッセージ全文**
   - UIに表示された内容をコピー

3. **動画ファイルの情報**
   - ファイルサイズ
   - 作成元（iPhoneカメラ、画面録画など）
   - 再生可能かどうか

4. **環境情報**
   ```bash
   node --version
   npm --version
   ```

---

## まとめ

### 修正内容
✅ 音声トラック検証機能を追加
✅ 詳細なエラーメッセージ表示
✅ 診断ツールを作成
✅ トラブルシューティングガイドを作成

### 次のステップ
1. `node test-ffmpeg.js "動画のパス"` で診断
2. `Has audio track: YES` を確認
3. `npm start` でアプリを起動
4. 処理を実行

### トラブル発生時
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) を参照
- 診断ツールで動画をチェック
- エラーメッセージの詳細を確認

---

**準備完了！**

まず診断ツールで動画ファイルをチェックしてください。
問題がなければ、アプリケーションを起動して処理を実行できます。
