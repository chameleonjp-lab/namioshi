# CURRENT_TASK: Phase 8A 自動試験（Draft・未統合）

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準main: `31f02de3b7e06f3840b99865980bb94fe73599c7`（Phase 7C PR #53統合後）
- 対応ブランチ: `codex/namioshi-v3-phase8a-automated-tests`
- このPull RequestはDraftのままにする
- `RANKING_SERVICE_STATE.enabled=false`を維持する

## 目的

公開前の手作業だけに依存せず、物理・得点・時刻・画面・共有・ランキング契約・描画復旧・生成物の回帰をNode.js標準テストで再実行できる状態にする。実ブラウザと実機の確認は自動試験の成功へ置き換えない。

## 今回の実装

- シェア文の得点、本文、公式URLを固定する試験を追加
- ネイティブ共有の成功、キャンセル、予期しない失敗からのクリップボード切替を追加
- クリップボードだけが使える環境、共有機能がない環境、コピー失敗を追加
- HOME、RULES、COUNTDOWN、PLAYING、RESULT、ERRORの状態契約を追加
- カウントダウンとプレイ開始の二重起動防止を追加確認
- RESULTのシェア、再挑戦、モード選択、終了導線を追加確認
- 入力上限とWebGLからCanvas 2Dへの切替契約を追加確認
- Phase 8Aの進捗、確認範囲、未確認範囲を記録する

## 変更しない範囲

- ゲームルール、反射経路、得点式、30秒制限、最大6タップ
- WebGL、Canvas 2D、音、振動、端末内保存の実装
- Supabase URL、Publishable key、SQL、RPC、RLS、本番データ
- ランキング送信・表示の有効化（`RANKING_SERVICE_STATE.enabled=false`）
- 実ブラウザ・実機確認を自動検査済みと扱うこと
- Ready化、マージ、公開

## 完了条件

- `npm test`で共有6ケースと画面導線の契約を含む全回帰を実行できる
- `npm run build`と`npm run verify`が試験後も成功する
- `src`と`dist`の一致を維持する
- 失敗時に、共有・画面・ゲーム・ランキング・描画復旧のどの契約か切り分けられる
- 変更範囲がPhase 8Aの試験と記録文書に限定される

## 自動検証

- `npm test`: 127/127成功
- `npm run build`: 成功
- `npm run verify`: 成功
- `npm run analyze:layouts`: 成功（`human-decision-pending`を維持）
- `npm run render:layouts`: 成功（SVG 2件）
- `npm run size`: 成功（容量は報告値）
- `git diff --check`: 成功

## 未確認・保留

- Chromium、WebKit、実ブラウザでのHOMEからRESULTまでの操作
- 実ブラウザでのWebGLコンテキスト消失・復帰とCanvas 2D切替
- iPhone・iPadの振動、safe-area、性能、長時間稼働
- `prefers-reduced-motion`を有効にした実機での表示
- G4の実機確認とG7の通過
- 詳細ランキング、Supabaseの非本番適用、本番疎通、ランキング再開
- Codeberg Pages上の公開確認

## 次の工程

GitHub Actionsと独立レビューを完了し、Draftのまま引き渡す。実機検収、ランキングとSupabase、リリース候補、公開は別工程として残す。

## 戻し方

このPRのテスト・文書コミットだけをrevertすれば、Phase 7C PR #53統合後のmainへ戻せる。ゲーム結果、端末保存、Supabaseデータの戻し作業は発生しない。
