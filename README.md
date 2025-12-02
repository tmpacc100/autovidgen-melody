# 動画生成アプリ

2本の動画を音声同期して1080x1920/60fpsのMP4を生成するElectronアプリケーション

## 機能

- 2つの動画を音声で自動同期
- 60fpsへのフレームレート変換
- テキストオーバーレイ（日本語対応）
- バッチ処理対応
- クロスプラットフォーム（Windows & Mac）

## セットアップ

### 必要な環境

- **Node.js**: v18以上
- **Python**: v3.8以上（MoviePy用）
- **FFmpeg**: 自動インストール（npm経由）

### Mac での初回セットアップ

1. **Homebrewのインストール**（未インストールの場合）:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

2. **Node.jsのインストール**:
```bash
brew install node
```

3. **Pythonのインストール**:
```bash
brew install python3
```

4. **プロジェクトディレクトリに移動**:
```bash
cd /path/to/動画生成アプリ
```

5. **セットアップスクリプトを実行**:
```bash
chmod +x setup.sh
./setup.sh
```

### Windows での初回セットアップ

1. **Node.jsをインストール**: https://nodejs.org/
2. **Pythonをインストール**: https://www.python.org/downloads/
3. **プロジェクトディレクトリで実行**:
```bash
setup.bat
```

### 手動セットアップ（すべてのプラットフォーム）

```bash
# Node.js依存関係をインストール
npm install

# Python依存関係をインストール
pip3 install moviepy Pillow numpy

# アプリを起動
npm start
```

## 使用方法

### アプリの起動

```bash
npm start
```

### ビルド（アプリケーション化）

**Mac版をビルド**（Macマシンで実行）:
```bash
npm run build:mac
```

**Windows版をビルド**（Windowsマシンで実行）:
```bash
npm run build:win
```

ビルドされたアプリは `dist/` フォルダに生成されます。

## ライセンス

MIT
