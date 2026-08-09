# namioshi

暗い水面に波を押し出し、壁や反射板の反射を使って3つのビーコンに波を重ねる30秒ゲームです。公開先はCodeberg Pagesの`/namioshi/`配下を想定しています。

## v3仕様文書

v3は段階的に実装しています。文書があることだけを完成の証拠として扱いません。

- 現行ゲーム仕様の唯一の正本: [`docs/SPEC_v3.md`](docs/SPEC_v3.md)
- 初期要求の背景資料: [`docs/REQUIREMENTS_v3.md`](docs/REQUIREMENTS_v3.md)
- 初期の段階別計画（歴史資料）: [`docs/IMPLEMENTATION_PLAN_v3.md`](docs/IMPLEMENTATION_PLAN_v3.md)
- 現在の工程と状態: [`docs/MASTER_COMPLETION_PLAN_v3.md`](docs/MASTER_COMPLETION_PLAN_v3.md)
- 公式配置候補の比較: [`docs/OFFICIAL_LAYOUT_STUDY_v3.md`](docs/OFFICIAL_LAYOUT_STUDY_v3.md)
- 公式配置の選定ガイド: [`docs/OFFICIAL_LAYOUT_DECISION_GUIDE_v3.md`](docs/OFFICIAL_LAYOUT_DECISION_GUIDE_v3.md)
- 公式配置の選定記録: [`docs/OFFICIAL_LAYOUT_SELECTION_v3.md`](docs/OFFICIAL_LAYOUT_SELECTION_v3.md)
- Phase 3Cマージ後監査: [`docs/POST_PHASE3C_AUDIT.md`](docs/POST_PHASE3C_AUDIT.md)
- レビュー・公開確認: [`docs/REVIEW_CHECKLIST_v3.md`](docs/REVIEW_CHECKLIST_v3.md)
- Supabase Phase 5A監査: [`docs/SUPABASE_AUDIT_v3.md`](docs/SUPABASE_AUDIT_v3.md)
- 敵対的検証後の回復計画: [`docs/PHYSICS_SCORE_INTEGRITY_RECOVERY_PLAN_v3.md`](docs/PHYSICS_SCORE_INTEGRITY_RECOVERY_PLAN_v3.md)

v3では3MBを受け入れ上限にしません。容量は報告値として扱い、入力反応、フレーム時間、継続動作、実機確認を優先します。複数ファイルとES Modulesを正式に使用します。

## 開発構成

`src`が正本です。実行コードはブラウザがそのまま読めるJavaScriptで、相対importには`.js`拡張子を明記しています。

- 開発用入口: `index.html`
- 開発用JavaScript: `src/main.js`
- 開発用CSS: `src/ui/styles.css`
- 公開用入口: `dist/index.html`
- 公開用ファイル: `dist/assets/**`

ビルドと検査には標準Node.js 18以上だけを使います。外部パッケージを使っていないため、`npm install`は不要です。

```bash
npm run build
npm test
npm run analyze:layouts
npm run render:layouts
npm run verify
npm run size
```

`npm run build`は`dist`を削除した後、`src`を加工せず`dist/assets`へ再帰コピーし、公開用`dist/index.html`を生成します。

`npm test`は、固定論理座標、公式配置候補、候補Cの選定記録、公式・練習モードの分離を確認します。

`npm run analyze:layouts`は、3つの配置候補を同じ121地点、同じ56到達時刻、同じ3地点の参考タップで再計算し、保存済み結果と一致するか確認します。これは配置比較用の固定条件で、通常プレイのタップ上限とは別です。

`npm run render:layouts`は、候補データと分析値から生成した比較SVGが最新か確認します。

`npm run verify`は、JavaScript構文、相対importの解決、`src`と`dist/assets`の一致、公開ファイルの参照、安全上の禁止事項を検査します。

`npm run size`は、公開物の総量、ファイル数、大きいファイル、同じ内容の重複ファイルを報告します。固定容量を超えたことだけを理由に失敗しません。

## 固定ゲーム座標

ゲーム内部は360×640へ固定しています。端末画面には縦横比を保って拡大縮小し、余白は暗い水面背景で埋めます。

Pointer入力は画面座標から360×640の座標へ変換し、余白上の入力を拒否します。画面回転やresizeでは描画範囲だけを更新し、進行中のWorld状態を作り直しません。

## 公式配置と練習配置

公式配置は候補C・開港型です。

```text
配置ID: candidate-c-open-harbor
指紋: fnv1a-fc71e804
ルール版: namioshi-v3-layout-study-001
```

公式モードは、ビーコンの初期位置、速度、ガラス片を固定し、初期化時に`Math.random()`を使いません。

練習モードは従来のランダム配置を残します。練習結果はランキングへ送信しません。

旧ランダム配置の記録と新しい公式配置の記録を混ぜないため、公式モードの実送信もPhase 5まで停止します。画面には現在の送信状態をそのまま表示します。

結果画面では、同じモードの再挑戦と、公式・練習を選び直すためのHOME復帰を選べます。停止中の送信関数は、直接呼ばれても通信を開始しません。

比較ラボと静止画像は選定履歴として`tools`と`docs/layout-previews`に残します。

## 描画方式

本命描画は`src/render/webgl.js`の純粋WebGLです。WebGLの初期化などに失敗した場合は`src/render/canvas.js`のCanvas 2Dへ切り替えます。両方が同じ`World`とviewport変換を使います。

## 確認状態

Phase 1からPhase 5Aの監査までの変更はmainへ統合済みです。ただし、main `c9ddd8e`への敵対的検証で、有限反射板を通らない得点、判定波の表示切り捨て、6回未満の入力拒否、寿命後得点、ビーコン速度暴走、時刻付き入力と締切の不一致を再現しました。このためG4「物理と得点」を不合格へ戻し、競技版公開とランキング再開を停止しています。

現在の回復作業では、反射面を逆順にたどる有限経路検査、同一step内の反射伝播、3秒寿命境界、正規ルールから導いた390波の故障検知上限、全判定波の前景表示、上限付きの一時的なビーコン揺れを実装しています。ローカル自動試験は67件成功しています。時刻付き入力と締切精算は不一致・step欠落を再現済みで未解決です。WebGL消失復旧、iPhoneの最大波性能、長時間・反復・発熱、ランキング本番疎通は未確認です。実機で確認していない項目と確認済みの失敗は[`docs/REVIEW_CHECKLIST_v3.md`](docs/REVIEW_CHECKLIST_v3.md)で区別して管理します。
