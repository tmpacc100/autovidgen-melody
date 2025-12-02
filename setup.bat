@echo off
echo =========================================
echo   動画生成アプリ セットアップ (Windows)
echo =========================================
echo.

REM Node.jsのチェック
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo エラー: Node.jsがインストールされていません
    echo https://nodejs.org/ からダウンロードしてインストールしてください
    pause
    exit /b 1
)

echo ✓ Node.js が見つかりました
node --version

REM Pythonのチェック
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo エラー: Pythonがインストールされていません
    echo https://www.python.org/downloads/ からダウンロードしてインストールしてください
    pause
    exit /b 1
)

echo ✓ Python が見つかりました
python --version

REM Node.js依存関係をインストール
echo.
echo Node.js依存関係をインストール中...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo エラー: npm install が失敗しました
    pause
    exit /b 1
)

echo ✓ Node.js依存関係のインストール完了

REM Python依存関係をインストール
echo.
echo Python依存関係をインストール中...
pip install moviepy Pillow numpy

if %ERRORLEVEL% NEQ 0 (
    echo エラー: Python依存関係のインストールが失敗しました
    pause
    exit /b 1
)

echo ✓ Python依存関係のインストール完了

REM tempディレクトリを作成
echo.
echo 一時ディレクトリを作成中...
if not exist temp mkdir temp

echo ✓ セットアップ完了!
echo.
echo 以下のコマンドでアプリを起動できます:
echo   npm start
echo.
echo アプリをビルドする場合:
echo   npm run build:win
echo.
pause
