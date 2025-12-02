# Docker使用ガイド - GUI対応版

このアプリケーションはマルチアーキテクチャ対応のDockerイメージで、Windows（Intel）開発環境からApple Silicon Mac、Linux（Intel/ARM）まで対応しています。

## 対応アーキテクチャ

- ✅ linux/amd64 (Intel/AMD x86_64)
- ✅ linux/arm64 (Apple Silicon M1/M2/M3, ARM64)
- ⚠️ Windows/Mac ホストはX11サーバーまたはVNC経由でGUIアクセス

## 前提条件

### すべての環境
- Docker Desktop (Windows/Mac) または Docker Engine (Linux)
- Docker Compose
- Docker Buildx (マルチアーキテクチャビルド用)

### GUIを表示する場合

#### Windows
- [VcXsrv Windows X Server](https://sourceforge.net/projects/vcxsrv/) または
- [Xming](https://sourceforge.net/projects/xming/)
- VNCクライアント（オプション、RealVNC、TightVNC等）

#### Mac
- [XQuartz](https://www.xquartz.org/) または
- VNCクライアント（オプション、組み込みScreen Sharing使用可）

#### Linux
- X11は通常インストール済み
- VNCクライアント（オプション）

## セットアップ

### 1. Docker Buildxのセットアップ（マルチアーキテクチャビルド用）

```bash
# Buildxが有効か確認
docker buildx version

# ビルダーインスタンスを作成
docker buildx create --name mybuilder --use
docker buildx inspect --bootstrap
```

### 2. マルチアーキテクチャイメージのビルド

```bash
# Intel/AMD + Apple Silicon両対応でビルド
docker buildx build --platform linux/amd64,linux/arm64 -t video-generator-app:latest --load .

# または単一アーキテクチャでビルド（高速）
docker build -t video-generator-app:latest .
```

### 3. Docker Composeでビルド

```bash
docker-compose build
```

## 実行方法

### モード1: X11フォワーディング（Linux/Mac推奨）

ホストのX11サーバーに直接接続してGUIを表示します。

#### Linux

```bash
# X11アクセスを許可
xhost +local:docker

# アプリを起動
docker-compose up video-app-gui

# 完了後、アクセスを取り消し
xhost -local:docker
```

#### Mac (XQuartz使用)

```bash
# XQuartzを起動
open -a XQuartz

# XQuartzの設定で "Allow connections from network clients" を有効化
# XQuartz → Preferences → Security

# IPアドレスを取得
export XHOST_IP=$(ifconfig en0 | grep inet | awk '$1=="inet" {print $2}')

# X11アクセスを許可
xhost + $XHOST_IP

# DISPLAYを設定
export DISPLAY=$XHOST_IP:0

# アプリを起動
docker-compose up video-app-gui

# 完了後
xhost - $XHOST_IP
```

#### Windows (VcXsrv使用)

```powershell
# 1. VcXsrvを起動
# - Multiple windows を選択
# - Display number: 0
# - Start no client を選択
# - "Disable access control" をチェック

# 2. PowerShellでIPを確認
ipconfig

# 3. DISPLAYを設定（WSL2の場合）
$env:DISPLAY="host.docker.internal:0.0"

# または Windows側のIPを使用
$env:DISPLAY="192.168.x.x:0.0"

# 4. docker-compose.ymlを編集してDISPLAYを設定
# environment:
#   - DISPLAY=host.docker.internal:0.0

# 5. アプリを起動
docker-compose up video-app-gui
```

### モード2: VNC経由でGUI表示（全OS対応）

X11設定不要で、VNCクライアントから接続します。

```bash
# ヘッドレスモードで起動（Xvfb + VNC）
docker-compose --profile headless up video-app-headless

# VNCクライアントで接続
# ホスト: localhost:5900
# パスワード: なし
```

**VNCクライアント:**
- Windows: RealVNC Viewer, TightVNC
- Mac: 組み込みのScreen Sharing（Finderで `vnc://localhost:5900`）
- Linux: Remmina, TigerVNC

### モード3: ワーカーのみ（GUIなし）

```bash
# ワーカープロセスのみ実行
docker-compose --profile worker up video-worker
```

### モード4: 開発モード

```bash
# ライブリロード付き開発モード
docker-compose --profile dev up video-app-dev
```

## マルチアーキテクチャビルドとプッシュ

Docker Hubやレジストリにプッシュする場合：

```bash
# Docker Hubにログイン
docker login

# マルチアーキテクチャでビルド＆プッシュ
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t yourusername/video-generator-app:latest \
  --push .

# 別のマシンでプル＆実行
docker pull yourusername/video-generator-app:latest
docker run -e DISPLAY=:99 -e ENABLE_VNC=true -p 5900:5900 \
  -v ./input:/app/input -v ./output:/app/output \
  yourusername/video-generator-app:latest
```

## Apple Silicon (M1/M2/M3) での実行

Apple Silicon Macでは、ARMネイティブイメージが自動的に選択されます：

```bash
# XQuartzをインストール
brew install --cask xquartz

# XQuartzを起動して設定
open -a XQuartz
# Preferences → Security → "Allow connections from network clients" をチェック

# ビルド（ARM64ネイティブ）
docker build -t video-generator-app:latest .

# 実行
export DISPLAY=$(hostname):0
xhost + $(hostname)
docker-compose up video-app-gui
```

## Windows開発環境からApple Silicon用ビルド

Intel Windows環境から、Apple Silicon用のイメージをビルド：

```powershell
# Buildxでクロスビルド
docker buildx build \
  --platform linux/arm64 \
  -t video-generator-app:arm64 \
  --load .

# または両方同時にビルド
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t video-generator-app:multiarch \
  --load .
```

## トラブルシューティング

### X11接続エラー

```bash
# エラー: cannot open display
# 解決策:
xhost +local:docker
export DISPLAY=:0
```

### Electronがクラッシュする

```bash
# サンドボックスを無効化
docker run -e ELECTRON_DISABLE_SANDBOX=1 ...
```

### VNCで画面が真っ黒

```bash
# Xvfbの起動を確認
docker exec -it video-app-headless ps aux | grep Xvfb

# 手動で起動
docker exec -it video-app-headless Xvfb :99 -screen 0 1920x1080x24 &
```

### Apple Siliconでビルドが遅い

```bash
# エミュレーションを使用せず、ネイティブビルドのみ
docker build --platform linux/arm64 -t video-generator-app:latest .
```

### GPUアクセスが必要な場合（Linux）

```bash
# docker-compose.ymlに追加
devices:
  - /dev/dri:/dev/dri
runtime: nvidia  # NVIDIA GPU の場合
```

## パフォーマンス比較

| アーキテクチャ | ビルド時間 | 実行速度 | メモリ使用量 |
|--------------|----------|---------|------------|
| linux/amd64  | 5-10分   | 100%    | ~500MB     |
| linux/arm64  | 5-10分   | 95-105% | ~480MB     |
| エミュレーション | 20-30分  | 20-30%  | ~600MB     |

## 本番環境での使用

### バックグラウンド実行

```bash
# デタッチドモードで起動
docker-compose up -d video-app-headless

# ログ確認
docker-compose logs -f video-app-headless

# 停止
docker-compose down
```

### 自動再起動設定

```yaml
# docker-compose.yml に既に設定済み
restart: unless-stopped
```

## クリーンアップ

```bash
# コンテナ停止＆削除
docker-compose down

# イメージも削除
docker-compose down --rmi all

# ボリュームも削除（注意：データが消えます）
docker-compose down -v

# ビルドキャッシュをクリア
docker builder prune -af
```

## 環境変数一覧

| 変数名 | デフォルト | 説明 |
|--------|----------|------|
| `DISPLAY` | `:99` | X11ディスプレイ番号 |
| `ELECTRON_DISABLE_SANDBOX` | `1` | サンドボックス無効化 |
| `NODE_ENV` | `production` | 実行モード |
| `ENABLE_VNC` | `false` | VNCサーバー有効化 |

## 推奨構成

### 開発（Windows/Intel）
```bash
docker-compose --profile dev up video-app-dev
# VNC: localhost:5900 で接続
```

### 本番（Linux Server）
```bash
docker-compose up video-app-headless
# VNC経由でモニタリング
```

### 本番（Mac/Apple Silicon）
```bash
# XQuartz + X11フォワーディング
docker-compose up video-app-gui
```

## サポート

問題が発生した場合は、GitHub Issuesに報告してください。
