# Phase 6A 端末内保存と結果画面

## 目的

通信成否に関係なく結果を理解できるようにし、公式モードと練習モードの記録を混ぜずに端末へ保存する。

## 保存契約

| キー | 内容 |
|---|---|
| `namioshi.displayName` | 最後に入力した名前 |
| `namioshi.bestScore` | 公式モードだけの端末ベスト |
| `namioshi.playCount` | `official` と `practice` を分けたJSON |
| `namioshi.settings.sound` | 既存の音設定。今回の音声処理を変更しない |
| `namioshi.lastClientVersion` | 結果保存時のクライアント版 |

保存領域を読めない、または書き込めない場合は、結果を画面へ表示しつつ保存済みとは表示しない。書き込み途中で失敗した場合は、可能な範囲で以前の値へ戻す。

## 結果画面

- 公式結果はNEW BESTまたは端末ベストと公式プレイ回数を表示する。
- 練習結果は公式ベストを更新せず、練習プレイ回数だけを表示する。
- 詳細ランキングはSupabase連携を再開するまで無効な準備中表示にする。
- 再挑戦、モード選択、ゲーム終了、実験場への移動、シェアを通信なしで利用できる。

## 実装ファイル

- `src/services/local-progress.js`: 保存・読み出し・書き込み失敗時の復元
- `src/main.js`: 起動時の名前復元、結果保存、結果画面表示、終了導線
- `src/ui/styles.css`: 結果状態と外部導線の表示
- `tests/local-progress.test.mjs`: 公式・練習分離、旧形式、保存失敗、結果画面契約
- `dist/assets/`: buildで生成した公開物

## 検証

- `npm test`: 103/103成功
- `npm run build`: 成功
- `npm run verify`: 成功
- `npm run analyze:layouts`: 成功
- `npm run render:layouts`: 成功
- `npm run size`: 108,986 bytes
- `git diff --check`: 成功

## 残る確認

Supabase連携、ランキング再開、実機確認、実ブラウザの保存拒否確認、Phase 6Bのsafe-area・横画面・アクセシビリティは別工程として残す。
