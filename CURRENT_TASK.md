# CURRENT_TASK: Phase 7B 高品質な視覚表現（Draft・未統合）

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準main: `074ec51725eee2d740a11c7e85bc7da517ee8c70`（Phase 7A PR #51統合後）
- 対応ブランチ: `codex/namioshi-v3-phase7b-visual-quality`
- このPull RequestはDraftのままにする
- `RANKING_SERVICE_STATE.enabled=false`を維持する

## 目的

Phase 7Aで整えた描画土台の上に、水面、波、ガラス片、ビーコンの情報を読み取りやすくする。WebGLの波の太さを`lineWidth`へ依存させず、Canvas 2Dでも同じ反射弧と視認性を保つ。ゲームルール、得点、物理、保存、ランキング、Supabase契約は変更しない。

## 今回の実装

- WebGLの直接波を内周・外周の`TRIANGLE_STRIP`帯として描画
- WebGLの反射波を有限反射弧から帯状の三角形へ変換して描画
- 波の種類ごとに幅と色を変え、直接・壁・反射板・2回反射を区別
- 水面へ2層の細波、中央の反射光、画面端の暗がりを追加
- ガラス片へ外側の光、中心線、端点の光を追加
- ビーコンへ外光、脈動リング、白い中心、命中時の拡大を追加
- Canvas 2Dでも水面、波帯、ガラス端点、ビーコンの表現を同期
- 加点が発生したときだけ`+点数 種類`を約0.5秒表示し、状態変更時に消去
- WebGL動的バッファ上限を拡張し、毎フレームの帯配列生成を避ける
- 視覚表現の静的契約試験を追加

## 変更しない範囲

- `src/game/**`、反射経路、得点式、30秒制限、最大6タップ
- 公式配置、練習配置、端末保存、音声判定、共有処理
- Supabase URL、Publishable key、SQL、RPC、RLS、本番データ
- ランキング送信・表示の有効化（`RANKING_SERVICE_STATE.enabled=false`）
- WebGLコンテキスト消失・Canvas切替の回復契約
- 実機確認を自動検査済みと扱うこと
- Ready化、マージ、公開

## 自動検証

- `npm test`: 108/108
- `npm run build`: 成功
- `npm run verify`: 成功
- `npm run analyze:layouts`: 成功（`human-decision-pending`を維持）
- `npm run render:layouts`: 成功
- `npm run size`: 124,956 bytes（固定上限ではなく報告値）
- `git diff --check`: ソース修正後に再実行
- Supabaseへの通信・書き込み: 0件

## 未完了・未確認

- GitHub上の差分確認とActions
- 実ブラウザでのWebGL帯描画、Canvas 2D描画、命中表示
- iPhone・iPadでの反射種類の視認性、継続30fps、入力反応、発熱、10回再挑戦、30分連続稼働
- 実ブラウザでのWebGLコンテキスト消失・復帰
- `prefers-reduced-motion`を有効にした端末での視覚確認
- G4の実機確認とG7の通過
- 詳細ランキングとSupabase連携

## 次の工程

GitHub Actionsと独立レビューを完了し、Draftのまま引き渡す。実機での見た目・性能確認はユーザー確認工程として残す。ランキングとSupabaseは保留する。

## 戻し方

このPRのコミットをrevertすれば、Phase 7A PR #51統合後のmainへ戻せる。ゲーム結果、端末保存、Supabaseデータの戻し作業は発生しない。
