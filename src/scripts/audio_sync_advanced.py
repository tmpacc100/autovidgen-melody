#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
高精度音声同期スクリプト
librosaを使用した音響特徴抽出（メルスペクトログラム、クロマ特徴、MFCC）
複数のチェックポイントで検証し、最も信頼性の高いオフセットを返す
"""
import sys
import io
import json
import numpy as np
import librosa
from scipy.signal import correlate

# Windows環境での文字化け防止（標準入出力をUTF-8に設定）
if sys.platform == 'win32':
    sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

def extract_audio_features(audio_path, sr=22050, duration=5.0, offset=0.0):
    """
    音声ファイルから高度な音響特徴を抽出

    Args:
        audio_path: 音声ファイルのパス
        sr: サンプリングレート
        duration: 抽出する秒数
        offset: 開始オフセット（秒）

    Returns:
        dict: 複数の音響特徴を含む辞書
    """
    # 音声を読み込み
    y, sr = librosa.load(audio_path, sr=sr, duration=duration, offset=offset, mono=True)

    if len(y) == 0:
        raise ValueError(f"No audio data found at offset {offset}")

    # 1. メルスペクトログラム（周波数特徴）
    mel_spec = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128, fmax=8000)
    mel_spec_db = librosa.power_to_db(mel_spec, ref=np.max)

    # 2. クロマ特徴（音楽的特徴、ピッチクラス）
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)

    # 3. MFCC（音色特徴）
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)

    # 4. スペクトル・コントラスト（音響パワー分布）
    contrast = librosa.feature.spectral_contrast(y=y, sr=sr)

    # 5. テンポとビート
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)

    # 6. ゼロ交差率（音声の時間的変化）
    zcr = librosa.feature.zero_crossing_rate(y)

    # 7. RMSエネルギー（音量）
    rms = librosa.feature.rms(y=y)

    return {
        'raw': y,
        'sr': sr,
        'mel_spec': mel_spec_db,
        'chroma': chroma,
        'mfcc': mfcc,
        'contrast': contrast,
        'tempo': tempo,
        'beats': beats,
        'zcr': zcr,
        'rms': rms
    }

def compute_feature_similarity(features1, features2, method='combined'):
    """
    2つの音響特徴間の類似度を計算

    Args:
        features1, features2: 音響特徴の辞書
        method: 'combined', 'mel', 'chroma', 'mfcc', 'raw'

    Returns:
        float: 類似度スコア（0-1、高いほど類似）
    """
    if method == 'raw' or method == 'combined':
        # 生の波形で相互相関
        corr = correlate(features1['raw'], features2['raw'], mode='valid')
        max_corr = np.max(np.abs(corr))
        norm = np.sqrt(np.sum(features1['raw']**2) * np.sum(features2['raw']**2))
        raw_similarity = max_corr / norm if norm > 0 else 0

    if method == 'mel' or method == 'combined':
        # メルスペクトログラムの類似度（コサイン類似度）
        mel1_flat = features1['mel_spec'].flatten()
        mel2_flat = features2['mel_spec'].flatten()
        min_len = min(len(mel1_flat), len(mel2_flat))
        mel1_flat = mel1_flat[:min_len]
        mel2_flat = mel2_flat[:min_len]

        dot_product = np.dot(mel1_flat, mel2_flat)
        norm1 = np.linalg.norm(mel1_flat)
        norm2 = np.linalg.norm(mel2_flat)
        mel_similarity = dot_product / (norm1 * norm2) if (norm1 * norm2) > 0 else 0

    if method == 'chroma' or method == 'combined':
        # クロマ特徴の類似度
        chroma1_flat = features1['chroma'].flatten()
        chroma2_flat = features2['chroma'].flatten()
        min_len = min(len(chroma1_flat), len(chroma2_flat))
        chroma1_flat = chroma1_flat[:min_len]
        chroma2_flat = chroma2_flat[:min_len]

        dot_product = np.dot(chroma1_flat, chroma2_flat)
        norm1 = np.linalg.norm(chroma1_flat)
        norm2 = np.linalg.norm(chroma2_flat)
        chroma_similarity = dot_product / (norm1 * norm2) if (norm1 * norm2) > 0 else 0

    if method == 'mfcc' or method == 'combined':
        # MFCC特徴の類似度
        mfcc1_flat = features1['mfcc'].flatten()
        mfcc2_flat = features2['mfcc'].flatten()
        min_len = min(len(mfcc1_flat), len(mfcc2_flat))
        mfcc1_flat = mfcc1_flat[:min_len]
        mfcc2_flat = mfcc2_flat[:min_len]

        dot_product = np.dot(mfcc1_flat, mfcc2_flat)
        norm1 = np.linalg.norm(mfcc1_flat)
        norm2 = np.linalg.norm(mfcc2_flat)
        mfcc_similarity = dot_product / (norm1 * norm2) if (norm1 * norm2) > 0 else 0

    # 組み合わせスコア（重み付け平均）
    if method == 'combined':
        # 各特徴量の重み（調整可能）
        weights = {
            'raw': 0.3,      # 波形相関
            'mel': 0.3,      # メルスペクトログラム
            'chroma': 0.2,   # クロマ特徴
            'mfcc': 0.2      # MFCC
        }

        combined_score = (
            weights['raw'] * raw_similarity +
            weights['mel'] * mel_similarity +
            weights['chroma'] * chroma_similarity +
            weights['mfcc'] * mfcc_similarity
        )
        return combined_score
    elif method == 'raw':
        return raw_similarity
    elif method == 'mel':
        return mel_similarity
    elif method == 'chroma':
        return chroma_similarity
    elif method == 'mfcc':
        return mfcc_similarity

def find_audio_offset_advanced(audio1_path, audio2_path, search_duration=30.0,
                                sample_duration=5.0, max_offset=30.0, sr=22050):
    """
    高精度な音声オフセット検出（librosaベース）

    Args:
        audio1_path: 参照音声ファイル
        audio2_path: 比較音声ファイル
        search_duration: 検索する音声の長さ（秒）
        sample_duration: 各サンプルの長さ（秒）
        max_offset: 最大オフセット範囲（秒）
        sr: サンプリングレート

    Returns:
        dict: オフセット情報と信頼度スコア
    """
    print(f"音声同期を開始します（高精度モード）")
    print(f"  参照音声: {audio1_path}")
    print(f"  比較音声: {audio2_path}")
    print(f"  検索範囲: {search_duration}秒")
    print(f"  サンプル長: {sample_duration}秒")
    print(f"  最大オフセット: ±{max_offset}秒")

    # 参照音声から特徴を抽出（最初の部分）
    print("\n参照音声から特徴を抽出中...")
    ref_features = extract_audio_features(audio1_path, sr=sr, duration=sample_duration, offset=0)

    # 比較音声で最適なオフセットを探索
    print(f"\n比較音声から最適なオフセットを探索中（±{max_offset}秒）...")

    # -max_offset から +max_offset まで0.1秒刻みで探索
    step = 0.1  # 探索ステップ（秒）
    offsets = np.arange(-max_offset, max_offset + step, step)
    scores = []

    for offset in offsets:
        try:
            # オフセット位置から特徴を抽出
            test_features = extract_audio_features(audio2_path, sr=sr, duration=sample_duration, offset=max(0, offset))

            # 類似度を計算
            similarity = compute_feature_similarity(ref_features, test_features, method='combined')
            scores.append(similarity)

        except Exception as e:
            # オフセットが範囲外の場合はスキップ
            scores.append(0)

    scores = np.array(scores)

    # 最大スコアのオフセットを見つける
    best_idx = np.argmax(scores)
    best_offset = offsets[best_idx]
    best_score = scores[best_idx]

    print(f"\n最適なオフセット: {best_offset:.3f}秒")
    print(f"信頼度スコア: {best_score:.4f}")

    # 信頼度の評価
    if best_score > 0.8:
        quality = "excellent"
        quality_jp = "優秀"
    elif best_score > 0.6:
        quality = "good"
        quality_jp = "良好"
    elif best_score > 0.4:
        quality = "fair"
        quality_jp = "普通"
    else:
        quality = "poor"
        quality_jp = "不良"

    print(f"同期品質: {quality_jp} ({quality})")

    return {
        'offset': float(best_offset),
        'confidence': float(best_score),
        'quality': quality,
        'quality_jp': quality_jp,
        'method': 'librosa_advanced'
    }

def multi_checkpoint_sync(audio1_path, audio2_path, video_duration,
                          checkpoint_positions=[0.25, 0.5, 0.75],
                          sample_duration=5.0, max_offset=30.0):
    """
    複数のチェックポイントで音声同期を検証

    動画全体をスキャンして、最も音声が一致する開始位置を見つける

    Args:
        audio1_path: 参照音声ファイル
        audio2_path: 比較音声ファイル
        video_duration: 動画の長さ（秒）
        checkpoint_positions: チェックポイント位置のリスト（0-1の比率）
        sample_duration: 各チェックポイントのサンプル長（秒）
        max_offset: 最大オフセット範囲（秒）

    Returns:
        dict: 総合的な同期情報
    """
    print(f"\n=== 動画全体スキャン音声同期 ===")
    print(f"動画の長さ: {video_duration:.2f}秒")
    print(f"最大オフセット範囲: ±{max_offset}秒")

    # 複数のスキャン位置を試して、最も信頼性の高い結果を採用
    print(f"\n--- フェーズ1: マルチポジション全体スキャン ---")
    scan_duration = min(15.0, video_duration * 0.15)  # 動画の15%または15秒（長めに）

    # 3つのスキャン位置を試す（開始後、中盤、終了前）
    scan_positions = []
    if video_duration > 40:
        # 長い動画の場合、20秒、中盤、終了20秒前
        scan_positions = [
            max(15.0, video_duration * 0.2),
            video_duration * 0.5,
            max(video_duration - 35.0, video_duration * 0.8)
        ]
    else:
        # 短い動画の場合、3等分
        scan_positions = [
            max(5.0, video_duration * 0.25),
            video_duration * 0.5,
            min(video_duration - scan_duration - 5.0, video_duration * 0.75)
        ]

    print(f"スキャン長: {scan_duration:.1f}秒")
    print(f"スキャン位置: {[f'{p:.1f}秒' for p in scan_positions]}")

    # 各スキャン位置で最良のオフセットを検出
    all_position_results = []

    for scan_idx, scan_offset in enumerate(scan_positions):
        print(f"\n  スキャン位置 {scan_idx+1}/{len(scan_positions)}: {scan_offset:.1f}秒")

        ref_features = extract_audio_features(audio1_path, sr=22050, duration=scan_duration, offset=scan_offset)

        # -max_offset から +max_offset まで1秒刻みで粗い探索
        coarse_step = 1.0
        coarse_offsets = np.arange(-max_offset, max_offset + coarse_step, coarse_step)
        coarse_scores = []

        for offset in coarse_offsets:
            test_offset = scan_offset + offset
            if test_offset < 0 or test_offset > video_duration - scan_duration:
                coarse_scores.append(0)
                continue

            try:
                test_features = extract_audio_features(audio2_path, sr=22050, duration=scan_duration, offset=test_offset)
                similarity = compute_feature_similarity(ref_features, test_features, method='combined')
                coarse_scores.append(similarity)
            except:
                coarse_scores.append(0)

        coarse_scores = np.array(coarse_scores)
        best_idx = np.argmax(coarse_scores)
        best_offset_for_position = coarse_offsets[best_idx]
        best_score_for_position = coarse_scores[best_idx]

        # トップ5の結果を記録
        top5_indices = np.argsort(coarse_scores)[-5:][::-1]
        print(f"    トップ5スコア:")
        for rank, idx in enumerate(top5_indices, 1):
            print(f"      {rank}. オフセット={coarse_offsets[idx]:+.1f}秒, スコア={coarse_scores[idx]:.4f}")

        all_position_results.append({
            'scan_offset': scan_offset,
            'best_offset': best_offset_for_position,
            'best_score': best_score_for_position,
            'all_scores': coarse_scores.copy()
        })

    # 最もスコアが高かった位置の結果を採用
    best_position_idx = np.argmax([r['best_score'] for r in all_position_results])
    best_position_result = all_position_results[best_position_idx]
    best_coarse_offset = best_position_result['best_offset']
    best_coarse_score = best_position_result['best_score']

    print(f"\n  最良スキャン位置: {best_position_result['scan_offset']:.1f}秒")
    print(f"  粗い探索結果: オフセット={best_coarse_offset:.1f}秒, スコア={best_coarse_score:.4f}")

    # スコア分布を確認
    scores_mean = best_position_result['all_scores'].mean()
    scores_std = best_position_result['all_scores'].std()
    score_range = best_position_result['all_scores'].max() - best_position_result['all_scores'].min()
    print(f"  スコア統計: 平均={scores_mean:.4f}, 標準偏差={scores_std:.4f}, 範囲={score_range:.4f}")

    if score_range < 0.1:
        print(f"  ⚠️ 警告: スコアの差が小さいため、検出精度が低い可能性があります")

    # 最良のオフセット周辺を0.1秒刻みで細かく探索
    print(f"\n--- フェーズ2: 細かい探索（±5秒範囲） ---")
    fine_step = 0.1
    fine_range = 5.0
    fine_offsets = np.arange(best_coarse_offset - fine_range, best_coarse_offset + fine_range + fine_step, fine_step)
    fine_scores = []

    # 最良スキャン位置で細かい探索を実行
    best_scan_offset = best_position_result['scan_offset']
    ref_features = extract_audio_features(audio1_path, sr=22050, duration=scan_duration, offset=best_scan_offset)

    for offset in fine_offsets:
        test_offset = best_scan_offset + offset
        if test_offset < 0 or test_offset > video_duration - scan_duration:
            fine_scores.append(0)
            continue

        try:
            test_features = extract_audio_features(audio2_path, sr=22050, duration=scan_duration, offset=test_offset)
            similarity = compute_feature_similarity(ref_features, test_features, method='combined')
            fine_scores.append(similarity)
        except:
            fine_scores.append(0)

    fine_scores = np.array(fine_scores)
    best_fine_idx = np.argmax(fine_scores)
    best_offset = fine_offsets[best_fine_idx]
    best_score = fine_scores[best_fine_idx]

    print(f"細かい探索結果: オフセット={best_offset:.3f}秒, スコア={best_score:.4f}")

    # 細かい探索のトップ5も表示
    top5_fine_indices = np.argsort(fine_scores)[-5:][::-1]
    print(f"  トップ5スコア:")
    for rank, idx in enumerate(top5_fine_indices, 1):
        print(f"    {rank}. オフセット={fine_offsets[idx]:+.3f}秒, スコア={fine_scores[idx]:.4f}")

    # フェーズ3: 検出したオフセットをチェックポイントで検証
    print(f"\n--- フェーズ3: チェックポイント検証（オフセット={best_offset:.3f}秒） ---")
    print(f"チェックポイント数: {len(checkpoint_positions)}")

    checkpoint_results = []

    for i, position in enumerate(checkpoint_positions):
        checkpoint_time = video_duration * position
        checkpoint_name = f"{int(position * 100)}%地点"

        print(f"\nチェックポイント {i+1}/{len(checkpoint_positions)}: {checkpoint_name} ({checkpoint_time:.2f}秒)")

        try:
            # 参照音声の特徴を抽出
            ref_features = extract_audio_features(audio1_path, sr=22050,
                                                   duration=sample_duration,
                                                   offset=checkpoint_time)

            # 検出したオフセットを適用した位置の音声と比較
            test_offset = checkpoint_time + best_offset
            if test_offset < 0 or test_offset > video_duration - sample_duration:
                print(f"  警告: オフセット位置が範囲外 ({test_offset:.2f}秒)")
                checkpoint_results.append({
                    'position': position,
                    'position_name': checkpoint_name,
                    'time': checkpoint_time,
                    'offset': float(best_offset),
                    'confidence': 0.0,
                    'quality': 'out_of_range',
                    'quality_jp': '範囲外'
                })
                continue

            test_features = extract_audio_features(audio2_path, sr=22050,
                                                    duration=sample_duration,
                                                    offset=test_offset)

            # 類似度を計算
            similarity = compute_feature_similarity(ref_features, test_features, method='combined')

            # 信頼度評価
            if similarity > 0.8:
                quality = "excellent"
                quality_jp = "優秀"
            elif similarity > 0.6:
                quality = "good"
                quality_jp = "良好"
            elif similarity > 0.4:
                quality = "fair"
                quality_jp = "普通"
            else:
                quality = "poor"
                quality_jp = "不良"

            print(f"  信頼度: {similarity:.4f} ({quality_jp})")

            checkpoint_results.append({
                'position': position,
                'position_name': checkpoint_name,
                'time': checkpoint_time,
                'offset': float(best_offset),
                'confidence': float(similarity),
                'quality': quality,
                'quality_jp': quality_jp
            })

        except Exception as e:
            print(f"  エラー: {str(e)}")
            checkpoint_results.append({
                'position': position,
                'position_name': checkpoint_name,
                'time': checkpoint_time,
                'offset': float(best_offset),
                'confidence': 0.0,
                'quality': 'error',
                'quality_jp': 'エラー',
                'error': str(e)
            })

    # チェックポイントの平均信頼度を計算
    total_confidence = sum(r['confidence'] for r in checkpoint_results)
    avg_checkpoint_confidence = total_confidence / len(checkpoint_results) if checkpoint_results else 0.0

    # 全体スキャンの結果と、チェックポイント検証の結果を組み合わせ
    # 全体スキャンで見つけたオフセットを使用し、チェックポイントの平均信頼度と組み合わせる
    final_offset = best_offset
    final_confidence = (best_score + avg_checkpoint_confidence) / 2.0  # 両方のスコアの平均

    print(f"\n=== 総合結果 ===")
    print(f"検出オフセット: {final_offset:.3f}秒")
    print(f"スキャンスコア: {best_score:.4f}")
    print(f"検証平均信頼度: {avg_checkpoint_confidence:.4f}")
    print(f"総合信頼度: {final_confidence:.4f}")

    # 総合品質評価
    if final_confidence > 0.8:
        overall_quality = "excellent"
        overall_quality_jp = "優秀"
    elif final_confidence > 0.6:
        overall_quality = "good"
        overall_quality_jp = "良好"
    elif final_confidence > 0.4:
        overall_quality = "fair"
        overall_quality_jp = "普通"
    else:
        overall_quality = "poor"
        overall_quality_jp = "不良"

    print(f"総合品質: {overall_quality_jp} ({overall_quality})")

    return {
        'offset': float(final_offset),
        'confidence': float(final_confidence),
        'quality': overall_quality,
        'quality_jp': overall_quality_jp,
        'scan_score': float(best_score),
        'verification_score': float(avg_checkpoint_confidence),
        'checkpoints': checkpoint_results,
        'method': 'full_scan_librosa'
    }

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: python audio_sync_advanced.py <audio1> <audio2> <video_duration> [mode]", file=sys.stderr)
        print("  mode: 'simple' (default) or 'multi_checkpoint'", file=sys.stderr)
        sys.exit(1)

    audio1_path = sys.argv[1]
    audio2_path = sys.argv[2]

    try:
        video_duration = float(sys.argv[3])
    except ValueError as e:
        print(f"Error: Invalid video_duration '{sys.argv[3]}': {e}", file=sys.stderr)
        sys.exit(1)

    mode = sys.argv[4] if len(sys.argv) > 4 else 'simple'

    # 入力ファイルの存在確認
    import os
    if not os.path.exists(audio1_path):
        print(f"Error: Audio file 1 not found: {audio1_path}", file=sys.stderr)
        sys.exit(1)
    if not os.path.exists(audio2_path):
        print(f"Error: Audio file 2 not found: {audio2_path}", file=sys.stderr)
        sys.exit(1)

    try:
        if mode == 'multi_checkpoint':
            result = multi_checkpoint_sync(
                audio1_path, audio2_path, video_duration,
                checkpoint_positions=[0.25, 0.5, 0.75],
                sample_duration=5.0,
                max_offset=30.0
            )
        else:
            result = find_audio_offset_advanced(
                audio1_path, audio2_path,
                search_duration=30.0,
                sample_duration=5.0,
                max_offset=30.0
            )

        # JSON形式で結果を出力
        print("\n=== JSON OUTPUT ===")
        print(json.dumps(result, ensure_ascii=False, indent=2))

    except FileNotFoundError as e:
        print(f"\nファイルが見つかりません: {str(e)}", file=sys.stderr)
        sys.exit(1)
    except (ValueError, RuntimeError) as e:
        # librosaやnumpyのエラーをキャッチ
        print(f"\n音声ファイルの処理エラー: {str(e)}", file=sys.stderr)
        print("音声ファイルのフォーマットが不正、または音声データが不足している可能性があります", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\nエラーが発生しました: {str(e)}", file=sys.stderr)
        print(f"エラータイプ: {type(e).__name__}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
