@echo off
echo ============================================================
echo Video Diagnostic Tool for Video Generation App
echo ============================================================
echo.

if "%~1"=="" (
    echo Usage: test-videos.bat "path\to\video1.mp4" "path\to\video2.mp4"
    echo.
    echo Example:
    echo   test-videos.bat "C:\Videos\video1.mp4" "C:\Videos\ScreenRecording.mov"
    echo.
    pause
    exit /b 1
)

if "%~2"=="" (
    echo Testing single video file...
    echo.
    node test-ffmpeg.js "%~1"
    echo.
    echo ============================================================
    pause
    exit /b 0
)

echo Testing Video 1: %~1
echo ============================================================
node test-ffmpeg.js "%~1"

echo.
echo.
echo ============================================================
echo Testing Video 2: %~2
echo ============================================================
node test-ffmpeg.js "%~2"

echo.
echo ============================================================
echo Diagnostic Complete
echo ============================================================
echo.
echo Check the output above for any warnings or errors.
echo Both videos MUST show "Has audio track: YES"
echo.
pause
