# CURRENT_TASK: Phase 7A WebGL描画の土台最適化（Draft・未統合）

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準main: `c9c5546e5034412b0fea448ccfcf97949d1c5ad2`（Phase 6B PR #50統合後）
- 対応ブランチ: `codex/namioshi-v3-phase7a-render-foundation`
- このPull RequestはDraftのままにする
- `RANKING_SERVICE_STATE.enabled=false`を維持する

## 目的

Supabase連携とランキング再開を保留したまま、Phase 7Aの描画土台を最適化する。WebGLの毎フレームの位置検索、配列・バッファ更新、単位円計算、品質適用、非プレイ画面の描画頻度を整える。ゲームルール、得点、物理、保存、ランキングの契約は変更しない。

## 今回の実装

- WebGLのattribute位置とuniform位置を初期化時に保存
- 背景用の静的頂点バッファと、動的頂点用の再利用バッファを分離
- 動的バッファを一度確保し、`bufferSubData`で内容だけ更新
- 波、反射演出、ビーコンで使う単位円のsin/cosを事前計算
- 背景用波の配列転記を添字処理へ変更し、`slice`と毎回の小配列生成を削除
- WebGLの前景波は品質を下げても全件を描画し、背景波と粒子だけへ品質上限を適用
- Canvas 2Dの粒子数と内部描画解像度にも同じ品質設定を適用
- HOME、RULES、COUNTDOWN、RESULT、ERRORでは描画を最大30fpsへ抑制
- プレイ中は品質を変更せず、計測結果を次の画面状態から次のプレイへ反映
- 位置検索、バッファ再利用、品質固定、描画頻度の自動契約を追加

## 品質設定

```text
HIGH: DPR上限1.5、背景波12、粒子90
MID:  DPR上限1.25、背景波8、粒子60
LOW:  DPR上限1.0、背景波5、粒子30
```

得点判定に使う前景波は、HIGH・MID・LOWのいずれでも隠さない。品質を下げる対象は背景装飾と粒子だけにする。

## 変更しない範囲

- Supabase URL、Publishable key、SQL、RPC、RLS、本番データ
- ランキング送信、ランキング表示、ランキング有効化
- 公式の得点式、配置、30秒制限、6タップ、反射ルール
- `src/game/**`、保存処理、音声の判定契約
- WebGLの波を帯として描くPhase 7Bの見た目改修
- iPhone・iPad実機確認を自動検査済みと扱う
- Ready化、マージ、公開

## ローカル検証

- `npm test`: 109/109
- `npm run build`: 成功
- `npm run verify`: 成功
- `npm run analyze:layouts`: 成功（`human-decision-pending`を維持）
- `npm run render:layouts`: 成功
- `npm run size`: 117,612 bytes（固定上限ではなく報告値）
- `git diff --check`: 成功
- `src`と`dist/assets`の一致: `verify`で成功
- Supabaseへの通信・書き込み: 0件

## 未完了・未確認

- GitHub Actionsの最終確認
- 実ブラウザでのWebGL初期化、描画、Canvas 2D切替
- WebGLコンテキスト消失・復帰の実ブラウザ確認
- iPhone・iPadでの継続30fps、入力反応、発熱、10回再挑戦、30分連続稼働
- `prefers-reduced-motion`を有効にした端末での画面確認
- 詳細ランキングとSupabase連携
- Phase 7Bの波の帯描画、高品質水面、反射板・ビーコンの見た目補修
- G4の実機確認とG7の通過

## 次の工程

GitHub Actionsと独立レビューを完了し、Draftのまま引き渡す。統合後は、Phase 7Bの視覚表現または実機検収を、G4の停止条件を維持したまま別PRとして扱う。

## 戻し方

このPRのコミットをrevertすれば、Phase 6B PR #50統合後のmainへ戻せる。ゲーム結果、端末保存、Supabaseデータの戻し作業は発生しない。
