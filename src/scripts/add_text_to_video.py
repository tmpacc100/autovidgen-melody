#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
動画にテキストを直接描画するスクリプト
MoviePyとPillowを使用（ImageMagick不要）
Windows/Mac両対応、文字化け防止のためBase64エンコーディング使用
"""
import sys
import platform
import io

# Windows環境での文字化け防止（標準入出力をUTF-8に設定）
if sys.platform == 'win32':
    sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

from PIL import Image, ImageDraw, ImageFont
import numpy as np

try:
    # MoviePy 2.x の新しいインポート方式
    from moviepy import VideoFileClip, ImageClip, CompositeVideoClip
except ImportError:
    # MoviePy 1.x の古いインポート方式
    from moviepy.editor import VideoFileClip, ImageClip, CompositeVideoClip

def get_font_path(font_family, font_weight='normal'):
    """
    フォントファミリーとウェイトからフォントパスを取得（クロスプラットフォーム対応）

    Args:
        font_family: フォントファミリー名
        font_weight: normal または bold

    Returns:
        フォントファイルのパス
    """
    os_type = platform.system()

    # Windows用フォントマップ
    windows_fonts = {
        'msgothic': {
            'normal': 'C:/Windows/Fonts/msgothic.ttc',
            'bold': 'C:/Windows/Fonts/msgothic.ttc'
        },
        'msmincho': {
            'normal': 'C:/Windows/Fonts/msmincho.ttc',
            'bold': 'C:/Windows/Fonts/msmincho.ttc'
        },
        'meiryo': {
            'normal': 'C:/Windows/Fonts/meiryo.ttc',
            'bold': 'C:/Windows/Fonts/meiryob.ttc'
        },
        'yugothic': {
            'normal': 'C:/Windows/Fonts/YuGothM.ttc',
            'bold': 'C:/Windows/Fonts/YuGothB.ttc'
        },
        'arial': {
            'normal': 'C:/Windows/Fonts/arial.ttf',
            'bold': 'C:/Windows/Fonts/arialbd.ttf'
        },
        'times': {
            'normal': 'C:/Windows/Fonts/times.ttf',
            'bold': 'C:/Windows/Fonts/timesbd.ttf'
        }
    }

    # Mac用フォントマップ
    mac_fonts = {
        'msgothic': {
            'normal': '/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',
            'bold': '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc'
        },
        'msmincho': {
            'normal': '/System/Library/Fonts/ヒラギノ明朝 ProN W3.ttc',
            'bold': '/System/Library/Fonts/ヒラギノ明朝 ProN W6.ttc'
        },
        'meiryo': {
            'normal': '/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',
            'bold': '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc'
        },
        'yugothic': {
            'normal': '/System/Library/Fonts/ヒラギノ角ゴシック W4.ttc',
            'bold': '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc'
        },
        'arial': {
            'normal': '/System/Library/Fonts/Supplemental/Arial.ttf',
            'bold': '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
        },
        'times': {
            'normal': '/Library/Fonts/Times New Roman.ttf',
            'bold': '/Library/Fonts/Times New Roman Bold.ttf'
        }
    }

    # プラットフォームに応じてフォントマップを選択
    if os_type == 'Darwin':  # macOS
        font_map = mac_fonts
    else:  # Windows, Linux
        font_map = windows_fonts

    font_paths = font_map.get(font_family, font_map.get('msgothic', {}))
    return font_paths.get(font_weight, font_paths.get('normal', None))

def wrap_text(text, font, max_width):
    """
    テキストを指定幅に収まるように改行
    改行文字 (\n) がある場合はそこで強制改行

    Args:
        text: 元のテキスト（改行で改行指定可能）
        font: フォントオブジェクト
        max_width: 最大幅

    Returns:
        改行されたテキスト行のリスト
    """
    temp_img = Image.new('RGB', (1, 1))
    draw = ImageDraw.Draw(temp_img)

    # 改行文字で改行指定されているかチェック
    if '\n' in text:
        # 手動改行モード：各行をチェックして必要に応じて自動改行
        manual_lines = [line.strip() for line in text.split('\n') if line.strip()]
        result_lines = []

        for line in manual_lines:
            # 各手動改行された行が幅を超える場合、さらに分割
            bbox = draw.textbbox((0, 0), line, font=font)
            line_width = bbox[2] - bbox[0]

            if line_width <= max_width:
                # そのまま追加
                result_lines.append(line)
            else:
                # 幅を超える場合は自動改行
                words = line.split()
                current_line = ""

                for word in words:
                    test_line = current_line + word if not current_line else current_line + " " + word
                    bbox = draw.textbbox((0, 0), test_line, font=font)
                    test_width = bbox[2] - bbox[0]

                    if test_width <= max_width:
                        current_line = test_line
                    else:
                        if current_line:
                            result_lines.append(current_line)
                        current_line = word

                if current_line:
                    result_lines.append(current_line)

        return result_lines

    # 自動改行モード
    words = text.split()
    lines = []
    current_line = ""

    for word in words:
        # 現在の行に単語を追加した場合の幅をチェック
        test_line = current_line + word if not current_line else current_line + " " + word
        bbox = draw.textbbox((0, 0), test_line, font=font)
        test_width = bbox[2] - bbox[0]

        if test_width <= max_width:
            current_line = test_line
        else:
            # 現在の行を確定して、新しい行を開始
            if current_line:
                lines.append(current_line)
            current_line = word

    # 最後の行を追加
    if current_line:
        lines.append(current_line)

    return lines

def calculate_optimal_font_size(text, max_width, max_height, min_font=10, max_font=30, max_lines=3,
                               padding=30, font_family='msgothic', font_weight='normal'):
    """
    バウンドリー内に収まる最適なフォントサイズを計算

    Args:
        text: 表示するテキスト
        max_width: 最大幅（背景の最大幅）
        max_height: 最大高さ（背景の最大高さ、0の場合は高さ制限なし）
        min_font: 最小フォントサイズ
        max_font: 最大フォントサイズ
        max_lines: 最大行数
        padding: パディング
        font_family: フォントファミリー
        font_weight: フォントウェイト

    Returns:
        (最適フォントサイズ, 改行されたテキスト行のリスト)
    """
    # パディングを考慮した実際の使用可能幅・高さ
    available_width = max_width - (padding * 2)
    # 高さ制限が0の場合は、実質的に無制限（非常に大きな値を設定）
    if max_height > 0:
        available_height = max_height - (padding * 2)
    else:
        available_height = float('inf')  # 高さ制限なし

    best_font_size = min_font
    best_lines = []

    font_path = get_font_path(font_family, font_weight)

    # 大きいサイズから試して、最初に収まるサイズを見つける
    for font_size in range(max_font, min_font - 1, -1):
        try:
            font = ImageFont.truetype(font_path, font_size)
        except:
            try:
                font = ImageFont.truetype('C:/Windows/Fonts/msgothic.ttc', font_size)
            except:
                font = ImageFont.load_default()

        # テキストを改行
        lines = wrap_text(text, font, available_width)

        # 行数チェック
        if len(lines) > max_lines:
            continue

        # 高さをチェック
        temp_img = Image.new('RGB', (1, 1))
        draw = ImageDraw.Draw(temp_img)

        line_height = font_size * 1.3  # 行間を考慮
        total_height = line_height * len(lines)

        if total_height <= available_height:
            # 幅もチェック
            all_fit = True
            for line in lines:
                bbox = draw.textbbox((0, 0), line, font=font)
                line_width = bbox[2] - bbox[0]
                if line_width > available_width:
                    all_fit = False
                    break

            if all_fit:
                best_font_size = font_size
                best_lines = lines
                break

    # 最適なサイズが見つからなかった場合、最小フォントサイズで強制的に収める
    if not best_lines:
        print(f"  Warning: Could not fit text optimally. Using minimum font size {min_font}")
        try:
            font = ImageFont.truetype(font_path, min_font)
        except:
            # クロスプラットフォーム対応のフォールバック
            fallback_fonts = []
            if platform.system() == 'Darwin':  # macOS
                fallback_fonts = [
                    '/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',
                    '/System/Library/Fonts/Helvetica.ttc',
                    '/System/Library/Fonts/Supplemental/Arial.ttf'
                ]
            else:  # Windows
                fallback_fonts = [
                    'C:/Windows/Fonts/msgothic.ttc',
                    'C:/Windows/Fonts/arial.ttf'
                ]

            font_loaded = False
            for fallback in fallback_fonts:
                try:
                    font = ImageFont.truetype(fallback, min_font)
                    font_loaded = True
                    break
                except:
                    continue

            if not font_loaded:
                font = ImageFont.load_default()

        best_lines = wrap_text(text, font, available_width)

        # 行数が多すぎる場合は切り詰める
        if len(best_lines) > max_lines:
            best_lines = best_lines[:max_lines]
            # 最後の行に省略記号を追加
            if best_lines:
                best_lines[-1] = best_lines[-1][:max(0, len(best_lines[-1]) - 3)] + '...'

        best_font_size = min_font

    return best_font_size, best_lines

def create_text_image(text, width, height, font_size=50, text_color='white',
                      bg_color='black', bg_opacity=0.7, padding=30,
                      position_x='center', position_y=0.5,
                      max_bg_width_ratio=0.9, max_bg_height_ratio=0.3,
                      font_family='msgothic', font_weight='normal'):
    """
    テキスト画像をPillowで生成（自動改行とバウンドリー制御付き）

    Args:
        text: 表示するテキスト（'|'で改行指定可能）
        width: 動画の幅
        height: 動画の高さ
        font_size: 初期フォントサイズ（無視され、自動計算される）
        text_color: テキストの色
        bg_color: 背景の色
        bg_opacity: 背景の不透明度 (0.0-1.0)
        padding: 背景ボックスのパディング
        position_x: X位置 ('left', 'center', 'right' または数値)
        position_y: Y位置 (0.0-1.0 の比率または数値)
        max_bg_width_ratio: 背景の最大幅（動画幅に対する比率）
        max_bg_height_ratio: 背景の最大高さ（動画高さに対する比率）
        font_family: フォントファミリー
        font_weight: フォントウェイト (normal/bold)

    Returns:
        numpy array: RGBA画像データ
    """
    # 透明な画像を作成
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # バウンドリー（背景の最大サイズ）を計算
    max_bg_width = int(width * max_bg_width_ratio)
    max_bg_height = int(height * max_bg_height_ratio)

    # 最適なフォントサイズと改行を計算
    optimal_font_size, text_lines = calculate_optimal_font_size(
        text, max_bg_width, max_bg_height,
        min_font=10, max_font=30, max_lines=3, padding=padding,
        font_family=font_family, font_weight=font_weight
    )

    print(f"  Font: {font_family} ({font_weight})")
    print(f"  Optimal font size: {optimal_font_size}")
    print(f"  Text lines: {len(text_lines)}")
    for i, line in enumerate(text_lines):
        print(f"    Line {i+1}: {line}")

    # フォントを読み込み
    font_path = get_font_path(font_family, font_weight)
    try:
        font = ImageFont.truetype(font_path, optimal_font_size)
    except:
        try:
            font = ImageFont.truetype('C:/Windows/Fonts/msgothic.ttc', optimal_font_size)
        except:
            font = ImageFont.load_default()

    # 各行のテキストサイズを測定して、全体のサイズを計算
    line_height = optimal_font_size * 1.3
    max_line_width = 0
    max_line_text_height = 0

    for line in text_lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        line_width = bbox[2] - bbox[0]
        line_text_height = bbox[3] - bbox[1]  # 実際のテキストの高さ
        max_line_width = max(max_line_width, line_width)
        max_line_text_height = max(max_line_text_height, line_text_height)

    # 最後の行を除く行間込みの高さ + 最後の行の実際の高さ
    if len(text_lines) > 1:
        total_text_height = line_height * (len(text_lines) - 1) + max_line_text_height
    else:
        total_text_height = max_line_text_height

    # 背景ボックスのサイズ（テキストに合わせる、上下均等にパディング）
    bg_width = max_line_width + (padding * 2)
    bg_height = total_text_height + (padding * 2)

    # バウンドリーチェック（max_bg_widthとmax_bg_heightが0より大きい場合のみ制限）
    if max_bg_width > 0:
        bg_width = min(bg_width, max_bg_width)
    if max_bg_height > 0:
        bg_height = min(bg_height, max_bg_height)

    # 背景の位置を計算
    if position_x == 'center':
        bg_x = (width - bg_width) // 2
    elif position_x == 'left':
        bg_x = 0
    elif position_x == 'right':
        bg_x = width - bg_width
    else:
        bg_x = int(position_x)

    # Y位置を計算
    if isinstance(position_y, float) and position_y <= 1.0:
        bg_y = int(height * position_y - bg_height // 2)
    else:
        bg_y = int(position_y)

    # 画面外に出ないように調整
    bg_x = max(0, min(bg_x, width - bg_width))
    bg_y = max(0, min(bg_y, height - bg_height))

    # 色の変換
    color_map = {
        'white': (255, 255, 255),
        'black': (0, 0, 0),
        'red': (255, 0, 0),
        'green': (0, 255, 0),
        'blue': (0, 0, 255),
        'yellow': (255, 255, 0),
        'cyan': (0, 255, 255),
        'magenta': (255, 0, 255)
    }

    # 背景ボックスを描画
    bg_rgb = color_map.get(bg_color.lower(), (0, 0, 0))
    bg_alpha = int(255 * max(0.0, min(1.0, bg_opacity)))
    bg_rgba = bg_rgb + (bg_alpha,)

    draw.rectangle(
        [bg_x, bg_y, bg_x + bg_width, bg_y + bg_height],
        fill=bg_rgba
    )

    # テキストを各行描画
    text_rgb = color_map.get(text_color.lower(), (255, 255, 255))
    text_rgba = text_rgb + (255,)

    current_y = bg_y + padding
    for line in text_lines:
        # 各行を中央揃え
        bbox = draw.textbbox((0, 0), line, font=font)
        line_width = bbox[2] - bbox[0]
        text_x = bg_x + (bg_width - line_width) // 2

        draw.text((text_x, current_y), line, font=font, fill=text_rgba)
        current_y += line_height

    # NumPy配列に変換
    return np.array(img)

def add_text_to_video(input_video, output_video, text, font_size=80,
                      text_color='white', bg_color='black', bg_opacity=0.7,
                      padding=30, position_x='center', position_y=0.5,
                      max_bg_width_ratio=0.9, max_bg_height_ratio=0.3,
                      font_family='msgothic', font_weight='normal'):
    """
    動画にテキストを追加

    Args:
        input_video: 入力動画パス
        output_video: 出力動画パス
        text: 表示するテキスト（'|'で改行指定可能）
        font_size: フォントサイズ（無視される、自動計算）
        text_color: テキストの色
        bg_color: 背景の色
        bg_opacity: 背景の不透明度
        padding: パディング
        position_x: X位置
        position_y: Y位置
        max_bg_width_ratio: 背景の最大幅比率
        max_bg_height_ratio: 背景の最大高さ比率
        font_family: フォントファミリー
        font_weight: フォントウェイト
    """
    print(f"Loading video: {input_video}")

    # 動画を読み込み
    video = VideoFileClip(input_video)

    print(f"Video size: {video.size}")
    print(f"Video duration: {video.duration}s")
    print(f"Video fps: {video.fps}")

    # テキスト画像を生成（フォントサイズは自動計算される）
    print(f"Creating text image with auto font sizing...")
    print(f"  Text: {text}")
    print(f"  Text color: {text_color}")
    print(f"  Background color: {bg_color} (opacity: {bg_opacity})")
    print(f"  Position: ({position_x}, {position_y})")
    print(f"  Max background size: {max_bg_width_ratio * 100}% x {max_bg_height_ratio * 100}%")

    text_img = create_text_image(
        text, video.w, video.h, font_size,
        text_color, bg_color, bg_opacity,
        padding, position_x, position_y,
        max_bg_width_ratio, max_bg_height_ratio,
        font_family, font_weight
    )

    # ImageClipを作成
    text_clip = ImageClip(text_img, duration=video.duration)

    # テキスト画像は動画と同じサイズで既に中央配置されているため、(0,0)に配置
    # MoviePy 2.x では with_position を使用
    try:
        text_clip = text_clip.with_position((0, 0))
    except AttributeError:
        # MoviePy 1.x との互換性
        text_clip = text_clip.set_position((0, 0))

    print(f"Text clip created")

    # 動画とテキストを合成
    final_video = CompositeVideoClip([video, text_clip])

    print(f"Writing output: {output_video}")

    # 出力（オーディオも含める）
    # 速度優先の設定: ultrafast プリセット、マルチスレッド最大化、最適化オプション追加
    import multiprocessing
    cpu_count = multiprocessing.cpu_count()

    final_video.write_videofile(
        output_video,
        codec='libx264',
        audio_codec='aac',
        fps=video.fps,
        preset='ultrafast',     # 最速プリセット
        threads=cpu_count,      # 全CPUコアを使用
        ffmpeg_params=[
            '-crf', '28',       # 品質を下げて速度優先（23→28）
            '-tune', 'fastdecode',  # 高速デコード用チューニング
            '-movflags', '+faststart',  # ストリーミング最適化
            '-g', str(int(video.fps * 2)),  # キーフレーム間隔を2秒に
            '-bf', '0',         # Bフレームを無効化（速度優先）
            '-refs', '1',       # 参照フレーム数を最小化
            '-me_method', 'dia',  # 動き推定を最速アルゴリズムに
            '-subq', '0',       # サブピクセル動き推定を無効化
            '-trellis', '0',    # トレリス量子化を無効化
        ],
        logger=None,            # ログを抑制
        write_logfile=False,    # ログファイル作成を無効化
        audio_bitrate='128k'    # 音声ビットレートを下げる
    )

    # クリーンアップ
    video.close()
    final_video.close()

    print("Done!")

if __name__ == '__main__':
    import json
    import base64

    if len(sys.argv) < 4:
        print("Usage: python add_text_to_video.py <input_video> <output_video> <text_base64> [options_base64]")
        print("Text and options are passed as Base64-encoded strings")
        sys.exit(1)

    input_video = sys.argv[1]
    output_video = sys.argv[2]
    text_base64 = sys.argv[3]

    # テキストをBase64デコード（UTF-8で文字化け防止）
    try:
        text = base64.b64decode(text_base64).decode('utf-8')
        print(f"Decoded text: {text}")
    except (base64.binascii.Error, UnicodeDecodeError) as e:
        print(f"Error: Could not decode text: {e}")
        sys.exit(1)

    # デフォルト設定
    font_size = 80  # 使用されない（自動計算）
    font_family = 'msgothic'
    font_weight = 'normal'
    text_color = 'white'
    bg_color = 'black'
    bg_opacity = 0.7
    padding = 30
    position_x = 'center'
    position_y = 0.5
    max_bg_width_ratio = 0.9
    max_bg_height_ratio = 0.3

    # オプションがBase64エンコードされたJSON形式で渡された場合
    if len(sys.argv) > 4:
        try:
            # Base64デコード（UTF-8で文字化け防止）
            options_json = base64.b64decode(sys.argv[4]).decode('utf-8')
            options = json.loads(options_json)

            print(f"Decoded options: {options}")

            font_family = options.get('fontFamily', font_family)
            font_weight = options.get('fontWeight', font_weight)
            text_color = options.get('textColor', text_color)
            bg_color = options.get('bgColor', bg_color)
            bg_opacity = options.get('bgOpacity', bg_opacity)
            padding = options.get('padding', padding)
            position_x = options.get('positionX', position_x)
            position_y = options.get('positionY', position_y)
            max_bg_width_ratio = options.get('maxBgWidthRatio', max_bg_width_ratio)
            max_bg_height_ratio = options.get('maxBgHeightRatio', max_bg_height_ratio)
        except (base64.binascii.Error, json.JSONDecodeError, UnicodeDecodeError) as e:
            # 後方互換性: Base64でない場合はデフォルト値を使用
            print(f"Warning: Could not parse options: {e}")
            pass

    add_text_to_video(
        input_video, output_video, text, font_size,
        text_color, bg_color, bg_opacity,
        padding, position_x, position_y,
        max_bg_width_ratio, max_bg_height_ratio,
        font_family, font_weight
    )
