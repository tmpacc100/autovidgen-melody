# Pythonセットアップガイド

テキストオーバーレイ機能を使用するには、PythonとMoviePyライブラリが必要です。

## 1. Pythonのインストール

### Windowsの場合

1. **Python公式サイトからダウンロード**
   - https://www.python.org/downloads/
   - 最新版（Python 3.11以上）をダウンロード

2. **インストール時の注意**
   - ✅ **重要**: 「Add Python to PATH」にチェックを入れる
   - 「Install Now」をクリック

3. **確認**
   ```bash
   python --version
   ```
   または
   ```bash
   python3 --version
   ```

## 2. MoviePyのインストール

コマンドプロンプトまたはPowerShellで以下を実行：

```bash
pip install moviepy
```

または

```bash
python -m pip install moviepy
```

**注意**: MoviePyは内部でPillow、NumPy、imageio、decorator などの依存関係を自動的にインストールします。

### 確認

```bash
python -c "from moviepy.editor import VideoFileClip; print('MoviePy is installed')"
```

## 3. インストール確認スクリプト

以下のコマンドでテスト動画にテキストを追加して動作確認：

```bash
python src/scripts/add_text_to_video.py "input.mp4" "output.mp4" "テストの「文字」" 80
```

成功すると `output.mp4` が生成されます。

## トラブルシューティング

### Python not found

**問題**: `'python' is not recognized as an internal or external command`

**解決方法**:
1. Pythonを再インストール（「Add Python to PATH」にチェック）
2. または環境変数PATHに手動でPythonを追加
   - `C:\Users\[ユーザー名]\AppData\Local\Programs\Python\Python3XX`
   - `C:\Users\[ユーザー名]\AppData\Local\Programs\Python\Python3XX\Scripts`

### pip not found

**解決方法**:
```bash
python -m ensurepip --upgrade
```

### MoviePy installation failed

**Windows固有の問題の場合**:

1. pipをアップグレード
   ```bash
   python -m pip install --upgrade pip
   ```

2. MoviePyを再インストール
   ```bash
   python -m pip install moviepy
   ```

3. 依存関係のエラーが出る場合、個別にインストール
   ```bash
   pip install numpy
   pip install imageio
   pip install decorator
   pip install moviepy
   ```

### ImageMagick関連のエラー

MoviePyのTextClipを使用する際、ImageMagickが必要です。

**解決方法**:
1. ImageMagickをインストール
   - https://imagemagick.org/script/download.php#windows
   - インストール時に「Install legacy utilities (e.g. convert)」にチェック

2. または、環境変数を設定
   ```bash
   set IMAGEMAGICK_BINARY="C:\Program Files\ImageMagick-X.X.X-Q16\magick.exe"
   ```

### 日本語フォントが表示されない

スクリプトは以下のフォントを使用します：
- `C:/Windows/Fonts/msgothic.ttc` (MS ゴシック - 日本語対応)

通常、Windowsにはこのフォントが標準でインストールされています。
フォントがない場合は、MS Gothicまたは別の日本語フォントをインストールしてください。

## アプリケーションの使用

Pythonのセットアップが完了したら、アプリケーションを起動：

```bash
npm start
```

テキストオーバーレイ機能が正常に動作します。
