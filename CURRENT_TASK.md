# CURRENT_TASK: Phase 8B 実機・実ブラウザ検収（未完了）

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準main: `cc9d00e8542a1d1edc34cc5731e69e03b0d2ee9e`（PR #57統合後）
- 対応ブランチ: `agent/namioshi-deadline-settlement-recovery`
- このPull RequestはDraftのままにする
- `RANKING_SERVICE_STATE.enabled=false`を維持する

## 目的

Phase 8AでNode.js標準テストによる回帰契約をそろえた。次は、その自動試験では確認できないブラウザ表示、画面操作、描画方式の切替、音・振動、休止復帰、継続動作を検収記録へまとめる。ただし、実ブラウザ・実機で確認していない項目を合格とは扱わない。

## 今回の対応

- Pull Request #54の統合を確認し、Phase 8Aを完了扱いへ更新する
- Pull Request #57の統合後コミット `cc9d00e8542a1d1edc34cc5731e69e03b0d2ee9e` を今回の検収対象として固定する
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
- PR #55: merged（merge commit `bc038feba7774cc58ecb3ce7845012e98b80eb18`）
- PR #55の変更は文書6ファイルのみで、ゲーム本体・自動試験コードは変更なし
- PR #56: merged（merge commit `2474ec9e9a4863e483465075cfaa294d696feb58`）
- PR #56の変更は文書6ファイルのみで、ゲーム本体・自動試験コードは変更なし
- PR #54と同じゲームコード・自動試験コードを作業コピーで再実行し、`npm test` 127/127、build、verify、配置分析、SVG、容量、差分検査が成功
- GitHub Actions Run #91: Node.js 18・20・22成功
- PR #54の `npm test`: 127/127成功
- PR #54の `build`、`verify`、配置・生成物検査: 成功
- 実ブラウザ、WebGLコンテキスト消失、Canvas 2D切替、iPhone・iPad実機: 未確認
- Supabase、ランキング再開、Codeberg Pages公開: 未実施

## 2026-08-12 再確認記録

- PlaywrightのNode.jsパッケージは利用できたが、ChromiumとWebKitの実行バイナリは存在しなかった。
- Chromiumの一時導入を試行したが、取得アーカイブが0MiB・破損状態で終了したため、ブラウザ操作、画面キャプチャ、コンソール確認を実施済みとは扱わない。
- iPhone、iPad、実ブラウザの確認結果を推測で補わず、Phase 8Bは未完了のまま維持する。

## 2026-08-12 PR #56統合後の基準更新

- Pull Request #56をmainへ統合し、Phase 8Bの検収対象コミットを `2474ec9e9a4863e483465075cfaa294d696feb58` へ更新する。
- PR #56の変更は文書6ファイルだけで、ゲーム本体・自動試験コード・ランキング・Supabase設定は変更していない。
- 実ブラウザ・実機の結果は追加されていないため、Phase 8Bは未完了のまま維持する。

## 2026-08-12 公開版Cloud Chromeの後続確認

- https://chameleonjp-lab.github.io/namioshi/ をCloud Chromeで開き、名前入力から公式モードのPLAYINGまで進めた。
- 締切後に表示が「残り 0.0」のまま35秒以上継続し、RESULTへ遷移しなかった。RESULTは非表示のままで、ゲーム本体URLのコンソールエラーは確認されなかった。
- この失敗は実ブラウザで確認した失敗として記録し、iPhone・iPad、WebGL強制消失・復帰、Canvas 2D切替、音・振動、長時間試験の確認済みとは扱わない。
- 原因候補を、描画停止中のrendererSuspended分岐が締切決済を進めない経路として限定し、期限到達時だけ固定更新の追いつきを継続する最小修正をDraft候補へ追加する。

## 未確認・保留

- Chromium、WebKit、実ブラウザでのHOMEからRESULTまでの操作
- 実ブラウザでのWebGLコンテキスト消失・復帰とCanvas 2D切替
- iPhone SE級、iPhone 11 Pro、iPhone 17 Pro、iPad Pro 2018の表示・操作・性能
- 音、振動、safe-area、横画面、VoiceOver、reduced-motion
- 連続再挑戦10回、30分連続稼働、バックグラウンド復帰10回、通常より20%重い条件
- G4・G7の通過、詳細ランキング、Supabaseの非本番適用・本番疎通、ランキング再開
- Codeberg Pages上の公開確認

## 次の工程

Phase 8Bの実機・実ブラウザ確認結果を、PR #57統合後の公開候補コミット `cc9d00e8542a1d1edc34cc5731e69e03b0d2ee9e` 単位で記録する。利用できない端末は未確認と記録し、確認結果がそろうまでPhase 8Cのリリース候補固定、ランキング有効化、公開判定へ進めない。

## 戻し方

このPull Requestの検収記録と文書更新だけをrevertすれば、PR #56統合後のmainへ戻せる。ゲーム結果、端末保存、Supabaseデータの戻し作業は発生しない。
