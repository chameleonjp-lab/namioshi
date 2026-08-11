# CURRENT_TASK: Phase 7C 音と振動（Draft・未統合）

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準main: `0ecadccda073a79397caf32e31115bb1d116f904`（Phase 7B PR #52統合後）
- 対応ブランチ: `codex/namioshi-v3-phase7c-audio-feedback`
- このPull RequestはDraftのままにする
- `RANKING_SERVICE_STATE.enabled=false`を維持する

## 目的

Phase 7Bまでの視覚表現と既存の効果音を維持し、画面を見続けなくてもタップ、反射、命中価値、結果の区別を補助できる任意の振動通知を追加する。振動に対応しない環境でも、ゲームを止めずに遊べる状態を保つ。

## 今回の実装

- `src/core/haptics.js`へ振動機能、パターン、端末保存、表示中だけ有効にする制御を追加
- 振動設定を初期状態「なし」でHOMEへ追加
- `navigator.vibrate`の実行時機能検出を行い、非対応時はボタンを無効化して説明を表示
- タップ、壁反射、ガラス反射、HIT／GOOD／GREAT／PERFECT、2回反射命中、結果表示へ別の振動パターンを接続
- `visibilitychange`、`pagehide`、`pageshow`に合わせて振動を停止・再開
- 振動の非対応、設定保存、パターン差、画面イベント接続を自動試験へ追加
- Phase 7Cの進捗と判断を計画書・決定ログ・READMEへ記録
- `src` と `dist` を同期する

## 変更しない範囲

- ゲームルール、反射経路、得点式、30秒制限、最大6タップ
- 公式配置、練習配置、物理時間、端末内スコア保存
- WebGL、Canvas 2D、画面レイアウト、WebGLコンテキスト消失回復
- Supabase URL、Publishable key、SQL、RPC、RLS、本番データ
- ランキング送信・表示の有効化（`RANKING_SERVICE_STATE.enabled=false`）
- 効果音の既存契約と初期無音設定
- 実機確認を自動検査済みと扱うこと
- Ready化、マージ、公開

## 完了条件

- `navigator.vibrate`がない環境で、起動・入力・反射・命中・結果・復帰が例外なく動く契約がある
- 振動設定が保存され、初期状態は無効である
- 画面非表示中とページ終了時に振動を停止する
- 音なし・振動なしでも画面表示だけでゲームの結果を理解できる
- 既存の`build / verify / test`と配布物検査が成功する
- 変更範囲がPhase 7Cと記録文書へ限定される

## 自動検証

- `npm test`: 116/116成功
- `npm run build`: 成功
- `npm run verify`: 成功
- `npm run analyze:layouts`: 成功（`human-decision-pending`を維持）
- `npm run render:layouts`: 成功（SVG 2件）
- `npm run size`: 128,451 bytes（固定上限ではなく報告値）
- `git diff --check`: 成功
- Supabaseへの通信・書き込み: 0件

## 未確認・保留

- 実ブラウザでの`navigator.vibrate`実動作
- iPhone・iPadの振動API対応状況と実機操作
- 実ブラウザでのWebGL描画、WebGLコンテキスト消失・復帰
- iPhone・iPadでの反射種類の視認性、継続30fps、入力反応、発熱、10回再挑戦、30分連続稼働
- `prefers-reduced-motion`を有効にした端末での視覚確認
- G4の実機確認とG7の通過
- 詳細ランキングとSupabase連携

## 次の工程

GitHub Actionsと独立レビューを完了し、Draftのまま引き渡す。音と振動の最終採用、Ready化、マージ、実機確認、ランキングとSupabaseはユーザー確認・別工程として残す。

## 戻し方

このPRのコミットをrevertすれば、Phase 7B PR #52統合後のmainへ戻せる。ゲーム結果、端末保存、Supabaseデータの戻し作業は発生しない。
