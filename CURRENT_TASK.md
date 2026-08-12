# CURRENT_TASK: Phase 8B 実機検収（未完了）

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準main: `d2249c33e7debf63da80495043972f92c575f077`（Phase 8A PR #54統合後）
- 対応ブランチ: `codex/namioshi-v3-phase8b-device-report`
- このPull RequestはDraftのままにする
- `RANKING_SERVICE_STATE.enabled=false`を維持する

## 目的

Phase 8AでNode.js標準テストによる回帰契約をそろえた。次は、その自動試験では確認できないブラウザ表示、画面操作、描画方式の切替、音・振動、休止復帰、継続動作を検収記録へまとめる。ただし、実ブラウザ・実機で確認していない項目を合格とは扱わない。

## 今回の対応

- Pull Request #54の統合を確認し、Phase 8Aを完了扱いへ更新する
- Phase 8Bの検収項目、端末候補、成功・失敗の記録欄を `docs/PHASE8B_DEVICE_TEST_REPORT_v3.md` に追加する
- ブラウザ実行バイナリがないため、実ブラウザ試験を実施済みとは記録しない
- 実機を使わずに、成功結果やスクリーンショットを推測で補わない

## 変更しない範囲

- ゲームルール、反射経路、得点式、30秒制限、最大6タップ
- WebGL、Canvas 2D、音、振動、端末内保存の実装
- Supabase URL、Publishable key、SQL、RPC、RLS、本番データ
- ランキング送信・表示の有効化（`RANKING_SERVICE_STATE.enabled=false`）
- Codeberg Pagesへの公開、Ready化、マージ
- 未確認の実機・実ブラウザ結果を確認済みに書き換えること

## 完了条件

- Phase 8AがPR #54統合済みとして、現在の工程へ正しく反映されている
- Phase 8Bの検収方法と未確認範囲が文書化されている
- 端末・ブラウザごとに、実施日、コミット、描画方式、成功・失敗、再現手順を記録できる
- `npm test`、`build`、`verify`の自動試験を実ブラウザ・実機の合格へ置き換えない
- 変更範囲が検収記録と進捗文書に限定される

## 確認結果

- PR #54: merged
- GitHub Actions Run #91: Node.js 18・20・22成功
- PR #54の `npm test`: 127/127成功
- PR #54の `build`、`verify`、配置・生成物検査: 成功
- 実ブラウザ、WebGLコンテキスト消失、Canvas 2D切替、iPhone・iPad実機: 未確認
- Supabase、ランキング再開、Codeberg Pages公開: 未実施

## 未確認・保留

- Chromium、WebKit、実ブラウザでのHOMEからRESULTまでの操作
- 実ブラウザでのWebGLコンテキスト消失・復帰とCanvas 2D切替
- iPhone SE級、iPhone 11 Pro、iPhone 17 Pro、iPad Pro 2018の表示・操作・性能
- 音、振動、safe-area、横画面、VoiceOver、reduced-motion
- 連続再挑戦10回、30分連続稼働、バックグラウンド復帰10回、通常より20%重い条件
- G4・G7の通過、詳細ランキング、Supabaseの非本番適用・本番疎通、ランキング再開
- Codeberg Pages上の公開確認

## 次の工程

Phase 8Bの実機・実ブラウザ確認結果を、同じ公開候補コミット単位で記録する。利用できない端末は未確認と記録し、確認結果がそろうまでPhase 8Cのリリース候補固定、ランキング有効化、公開判定へ進めない。

## 戻し方

このPull Requestの検収記録と文書更新だけをrevertすれば、Phase 8A PR #54統合直後のmainへ戻せる。ゲーム結果、端末保存、Supabaseデータの戻し作業は発生しない。
