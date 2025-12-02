#!/bin/bash

echo "========================================="
echo "  動画生成アプリ セットアップ (Mac/Linux)"
echo "========================================="
echo ""

# Node.jsのバージョンチェック
if ! command -v node &> /dev/null
then
    echo "エラー: Node.jsがインストールされていません"
    echo "以下のコマンドでインストールしてください:"
    echo "  brew install node"
    exit 1
fi

echo "✓ Node.js $(node --version) が見つかりました"

# Pythonのバージョンチェック
if ! command -v python3 &> /dev/null
then
    echo "エラー: Python 3がインストールされていません"
    echo "以下のコマンドでインストールしてください:"
    echo "  brew install python3"
    exit 1
fi

echo "✓ Python $(python3 --version) が見つかりました"

# Node.js依存関係をインストール
echo ""
echo "Node.js依存関係をインストール中..."
npm install

if [ $? -ne 0 ]; then
    echo "エラー: npm installが失敗しました"
    exit 1
fi

echo "✓ Node.js依存関係のインストール完了"

# Python依存関係をインストール
echo ""
echo "Python依存関係をインストール中..."
pip3 install moviepy Pillow numpy

if [ $? -ne 0 ]; then
    echo "エラー: Python依存関係のインストールが失敗しました"
    exit 1
fi

echo "✓ Python依存関係のインストール完了"

# tempディレクトリを作成
echo ""
echo "一時ディレクトリを作成中..."
mkdir -p temp

echo "✓ セットアップ完了!"
echo ""
echo "以下のコマンドでアプリを起動できます:"
echo "  npm start"
echo ""
echo "アプリをビルドする場合:"
echo "  npm run build:mac"
echo ""
