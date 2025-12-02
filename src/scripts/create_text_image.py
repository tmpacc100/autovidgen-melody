#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
テキスト画像を生成するスクリプト
"""
import sys
import json
from PIL import Image, ImageDraw, ImageFont

def create_text_image(text, output_path, width=1080, height=1920, font_size=80):
    """
    テキスト画像を生成

    Args:
        text: 表示するテキスト
        output_path: 出力ファイルパス
        width: 画像の幅
        height: 画像の高さ
        font_size: フォントサイズ
    """
    # 透明な画像を作成
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # フォントを読み込む（日本語対応）
    try:
        # Windows日本語フォント
        font = ImageFont.truetype('C:/Windows/Fonts/msgothic.ttc', font_size)
    except:
        try:
            # フォールバック: Arial
            font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', font_size)
        except:
            # デフォルトフォント
            font = ImageFont.load_default()

    # テキストのバウンディングボックスを取得
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    # テキストの位置を計算（中央）
    x = (width - text_width) // 2
    y = (height - text_height) // 2

    # 背景の矩形を描画（黒、70%不透明）
    padding = 30
    bg_color = (0, 0, 0, int(255 * 0.7))
    draw.rectangle(
        [x - padding, y - padding, x + text_width + padding, y + text_height + padding],
        fill=bg_color
    )

    # テキストを描画（白）
    text_color = (255, 255, 255, 255)
    draw.text((x, y), text, font=font, fill=text_color)

    # PNG形式で保存（透明度を保持）
    img.save(output_path, 'PNG')
    print(f"Text image created: {output_path}")
    print(f"Size: {width}x{height}")
    print(f"Text: {text}")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python create_text_image.py <text> <output_path> [width] [height] [font_size]")
        sys.exit(1)

    text = sys.argv[1]
    output_path = sys.argv[2]
    width = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    height = int(sys.argv[4]) if len(sys.argv) > 4 else 1920
    font_size = int(sys.argv[5]) if len(sys.argv) > 5 else 80

    create_text_image(text, output_path, width, height, font_size)
