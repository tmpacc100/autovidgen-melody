# Docker クイックスタート

## 最速で始める（VNC使用 - 推奨）

X11設定不要で、すべてのOSで動作します。

```bash
# 1. イメージをビルド
docker-compose build

# 2. ヘッドレスモードで起動（VNC付き）
docker-compose --profile headless up video-app-headless

# 3. VNCクライアントで接続
# アドレス: localhost:5900
# パスワード: なし
```

## OS別セットアップ

### Windows（3ステップ）

```powershell
# ステップ1: ビルド
docker-compose build

# ステップ2: 起動（VNCモード）
docker-compose --profile headless up video-app-headless

# ステップ3: VNC接続
# RealVNC ViewerやTightVNCをインストールして localhost:5900 に接続
```

### Mac（3ステップ）

```bash
# ステップ1: ビルド（Apple Siliconでも自動対応）
docker-compose build

# ステップ2: 起動
docker-compose --profile headless up video-app-headless

# ステップ3: VNC接続
# Finderで Command+K → "vnc://localhost:5900" を入力
```

### Linux（2ステップ - X11使用）

```bash
# ステップ1: X11アクセス許可
xhost +local:docker

# ステップ2: 起動
docker-compose up video-app-gui

# GUIが表示されます！
```

## マルチアーキテクチャビルド

Intel WindowsからApple Silicon Mac用にビルド：

```bash
# Buildxセットアップ（初回のみ）
docker buildx create --name mybuilder --use
docker buildx inspect --bootstrap

# 両対応でビルド
docker buildx build --platform linux/amd64,linux/arm64 -t video-generator-app:latest .
```

## よくある質問

**Q: GUIが表示されない**
A: VNCモード（`--profile headless`）を使用してください。

**Q: ビルドが遅い**
A: マルチアーキテクチャビルドではなく、単一アーキテクチャでビルドしてください：
```bash
docker build -t video-generator-app:latest .
```

**Q: Apple Silicon Macで動かない**
A: ARMネイティブビルドされるので問題なく動作します。VNCモードを推奨します。

## トラブルシューティング

```bash
# すべてクリーンアップして再起動
docker-compose down
docker system prune -a
docker-compose build --no-cache
docker-compose --profile headless up video-app-headless
```

詳細は [DOCKER.md](DOCKER.md) を参照してください。
