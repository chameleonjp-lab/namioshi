# CURRENT_TASK: Phase 6B 画面・支援機能（Draft・未統合）

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準main: `37a19eea46e9d23a870e70164cd18bfd3dfabb0f`（PR #49の統合後）
- 対応ブランチ: `agent/phase6b-screen-accessibility`
- このPull RequestはDraftのままにする
- `RANKING_SERVICE_STATE.enabled=false`を維持する

## 目的

Supabase連携とランキング再開を保留したまま、Phase 6Aの結果画面を安全な領域、横画面、読み上げ、キーボードフォーカスで使いやすくする。ゲームルール、得点、物理、描画方式、保存内容は変更しない。

## 今回の実装

- `env(safe-area-inset-*)`を使い、画面、HUD、プレイ中の説明、初回案内の配置が端末の切り欠きやホームインジケータへ重ならないCSS契約を追加
- `100dvh`、横画面用の画面幅、結果内訳の横並び、初回案内のスクロール領域を追加
- `resize`、`orientationchange`、`visualViewport.resize`で表示変換だけを再計算し、Worldを作り直さない
- 名前入力へlabelと入力補助を追加
- 画面状態の`aria-hidden`、カウントダウンと結果のstatus、エラー通知、シェア文のlabelを追加
- RULES、RESULT、ERROR、初回案内へ状態遷移後のフォーカス移動を追加
- `:focus-visible`の視認性を追加
- `prefers-reduced-motion`時にCSSのアニメーション・遷移・スクロールの動きを抑える設定を追加
- 追加した画面契約の静的試験を追加

## 変更しない範囲

- Supabase URL、Publishable key、SQL、RPC、RLS、本番データ
- ランキング送信、ランキング表示、ランキング有効化
- 公式の得点式、配置、30秒制限、6タップ、反射ルール
- WebGL、Canvas 2D、音声、端末保存のデータ契約
- iPhone・iPad実機確認を自動検査済みと扱う
- Ready化、マージ、公開

## ローカル検証

- `npm test`: 107/107
- `npm run build`: 成功
- `npm run verify`: 成功
- `npm run analyze:layouts`: 成功（`human-decision-pending`を維持）
- `npm run render:layouts`: 成功
- `npm run size`: 113,983 bytes（固定上限ではなく報告値）
- `git diff --check`: 成功
- Supabaseへの通信・書き込み: 0件

## 未完了・未確認

- GitHub Actionsの最終確認
- iPhone・iPad実機でのsafe-area、横画面、キーボード、結果画面の見切れ
- 実ブラウザでの強制WebGL消失・復帰
- `prefers-reduced-motion`を有効にした端末での画面確認
- 詳細ランキングとSupabase連携
- Phase 7の高品質WebGL・性能検証

## 次の工程

GitHub Actionsと独立レビューを完了し、Draftのまま引き渡す。統合後は、Phase 7の描画品質または実機検収を、G4の停止条件を維持したまま別PRとして扱う。

## 戻し方

このPRのコミットをrevertすれば、PR #49統合後のmainへ戻せる。ゲーム結果、端末保存、Supabaseデータの戻し作業は発生しない。
