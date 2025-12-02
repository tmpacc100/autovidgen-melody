# Docker使用ガイド - 環境依存なしで実行

## ✅ ビルド完了

Dockerイメージのビルドが成功しました！Windows、Mac、Linuxどの環境でも実行できます。

## 🚀 実行方法

### 1. VNCモードで起動（推奨 - 全OS対応）

```bash
# コンテナを起動
docker run -d \
  --name video-app \
  -e ENABLE_VNC=true \
  -p 5900:5900 \
  -v ./input:/app/input \
  -v ./output:/app/output \
  autovidgen-melody:latest
```

### 2. VNCクライアントで接続

**Windows:**
- [RealVNC Viewer](https://www.realvnc.com/en/connect/download/viewer/) または [TightVNC](https://www.tightvnc.com/download.php) をインストール
- アドレス: `localhost:5900`
- パスワード: なし

**Mac:**
1. Finderを開く
2. `Command + K` を押す
3. `vnc://localhost:5900` と入力
4. 「画面共有」が開きます

**Linux:**
```bash
# Remmina, TigerVNC, 等のVNCクライアントを使用
vncviewer localhost:5900
```

## 📊 コンテナの管理

### ログを確認

```bash
docker logs video-app
```

### コンテナを停止

```bash
docker stop video-app
```

### コンテナを再起動

```bash
docker start video-app
```

### コンテナを削除

```bash
docker rm -f video-app
```

## 🔄 イメージの更新

コードを変更した後、イメージを再ビルド：

```bash
# イメージを再ビルド
docker build -t autovidgen-melody .

# 古いコンテナを削除
docker rm -f video-app

# 新しいコンテナを起動
docker run -d \
  --name video-app \
  -e ENABLE_VNC=true \
  -p 5900:5900 \
  -v ./input:/app/input \
  -v ./output:/app/output \
  autovidgen-melody:latest
```

## 🍎 Apple Silicon (M1/M2/M3) での実行

Apple Silicon Macでは自動的にARMアーキテクチャが使用されます：

```bash
# ビルド（ARMネイティブ）
docker build -t autovidgen-melody .

# 実行（同じコマンド）
docker run -d \
  --name video-app \
  -e ENABLE_VNC=true \
  -p 5900:5900 \
  -v ./input:/app/input \
  -v ./output:/app/output \
  autovidgen-melody:latest

# VNC接続
# Finder → Command+K → vnc://localhost:5900
```

## 🌐 マルチアーキテクチャビルド

Intel WindowsからApple Silicon Mac用のイメージも作成できます：

```bash
# Docker Buildxを使用
docker buildx create --name multiarch --use
docker buildx inspect --bootstrap

# 両対応でビルド
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t autovidgen-melody:multiarch \
  --load .
```

## 📂 ファイルの共有

### 入力ファイルを配置

```bash
# inputフォルダを作成
mkdir input

# 動画ファイルをコピー
cp /path/to/video1.mp4 input/
cp /path/to/video2.mp4 input/
```

### 出力ファイルを取得

処理後、`output/` フォルダに生成されたファイルが表示されます。

## ⚙️ 環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `ENABLE_VNC` | VNCサーバーを有効化 | `false` |
| `DISPLAY` | X11ディスプレイ番号 | `:99` |
| `ELECTRON_DISABLE_SANDBOX` | サンドボックスを無効化 | `1` |

## 🐛 トラブルシューティング

### Electronアプリが表示されない

```bash
# コンテナが実行中か確認
docker ps

# ログを確認
docker logs video-app

# コンテナを再起動
docker restart video-app
```

### VNCで接続できない

```bash
# ポート5900が使用中か確認
netstat -an | grep 5900  # Linux/Mac
netstat -an | findstr 5900  # Windows

# 他のポートを使用
docker run -d \
  --name video-app \
  -e ENABLE_VNC=true \
  -p 5901:5900 \
  -v ./input:/app/input \
  -v ./output:/app/output \
  autovidgen-melody:latest

# VNC接続先: localhost:5901
```

### GPU Eラー（WARNING: gpu_memory_buffer...）

これは正常な動作です。Dockerコンテナ内ではGPU加速が制限されますが、ソフトウェアレンダリングで動作します。

### D-Busエラー

これも正常です。D-Busはシステムサービス用で、アプリの動作には影響しません。

## 📋 docker-compose使用（オプション）

docker-compose.ymlを使用した簡易起動：

```bash
# ヘッドレスモードで起動
docker-compose --profile headless up video-app-headless

# バックグラウンドで起動
docker-compose --profile headless up -d video-app-headless

# 停止
docker-compose down
```

## 🎯 次のステップ

1. VNCクライアントで `localhost:5900` に接続
2. ElectronのGUIが表示されます
3. 動画ファイルを選択して処理開始
4. 出力ファイルは `output/` フォルダに保存されます

## 💡 Tips

- **パフォーマンス**: 初回起動は少し遅いですが、2回目以降は高速です
- **メモリ**: 最低4GB RAM推奨
- **ストレージ**: 動画ファイル + 処理用に十分な空き容量が必要
- **ネットワーク**: VNCのため、ローカルネットワーク内での使用を推奨

## 📖 詳細ドキュメント

- [DOCKER.md](DOCKER.md) - 詳細な技術ドキュメント
- [DOCKER_QUICKSTART.md](DOCKER_QUICKSTART.md) - クイックスタートガイド
- [README.md](README.md) - アプリケーション全体のドキュメント
