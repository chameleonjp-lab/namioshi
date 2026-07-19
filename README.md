# namioshi

暗い水面に波を押し出し、壁やガラス片の反射を使って3つのビーコンに波を重ねる10秒ゲームです。公開先はCodeberg Pagesの`/namioshi/`配下を想定しています。

## v3仕様文書

現在のゲームルールはv2相当です。v3のゲーム仕様は段階的に実装しており、文書があることだけをv3完成の証拠として扱いません。

- 要件の正本: [`docs/REQUIREMENTS_v3.md`](docs/REQUIREMENTS_v3.md)
- ゲーム仕様の正本: [`docs/SPEC_v3.md`](docs/SPEC_v3.md)
- 段階別の実装順: [`docs/IMPLEMENTATION_PLAN_v3.md`](docs/IMPLEMENTATION_PLAN_v3.md)
- 完成までの統合計画: [`docs/MASTER_COMPLETION_PLAN_v3.md`](docs/MASTER_COMPLETION_PLAN_v3.md)
- 公式配置候補の比較: [`docs/OFFICIAL_LAYOUT_STUDY_v3.md`](docs/OFFICIAL_LAYOUT_STUDY_v3.md)
- 公式配置の選定ガイド: [`docs/OFFICIAL_LAYOUT_DECISION_GUIDE_v3.md`](docs/OFFICIAL_LAYOUT_DECISION_GUIDE_v3.md)
- レビュー・公開確認: [`docs/REVIEW_CHECKLIST_v3.md`](docs/REVIEW_CHECKLIST_v3.md)

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

`npm test`は、固定論理座標と公式配置候補の構造・分析結果を確認します。

`npm run analyze:layouts`は、3つの配置候補を同じ121地点、同じ56到達時刻、同じ3タップ地点で再計算し、保存済み結果と一致するか確認します。候補を意図的に変更した時だけ`npm run analyze:layouts:write`で保存結果を更新し、数値差をレビューします。

`npm run render:layouts`は、候補データと分析値から生成した横比較・スマートフォン向け縦比較のSVGが最新か確認します。候補を意図的に変更した場合だけ`npm run render:layouts:write`で画像を更新します。

`npm run verify`は、JavaScript構文、相対importの解決、`src`と`dist/assets`の一致、公開ファイルの参照、安全上の禁止事項を検査します。

`npm run size`は、公開物の総量、ファイル数、大きいファイル、同じ内容の重複ファイルを報告します。固定容量を超えたことだけを理由に失敗しません。

## 固定ゲーム座標

ゲーム内部は360×640へ固定しています。端末画面には縦横比を保って拡大縮小し、余白は暗い水面背景で埋めます。

Pointer入力は画面座標から360×640の座標へ変換し、余白上の入力を拒否します。画面回転やresizeでは描画範囲だけを更新し、進行中のWorld状態を作り直しません。

## 公式配置比較と選定資料

Phase 3Bでは、本番ゲームへ配置を入れる前に3候補を比較しています。

動きを確認する比較ラボ:

```text
/tools/layout-lab.html
```

GitHub上で直接確認できる静止画像:

- [スマートフォン向け縦比較](docs/layout-previews/layout-comparison-mobile.svg)
- [横並び比較](docs/layout-previews/layout-comparison.svg)

判断材料と現時点の推薦は[`docs/OFFICIAL_LAYOUT_DECISION_GUIDE_v3.md`](docs/OFFICIAL_LAYOUT_DECISION_GUIDE_v3.md)へまとめています。

候補の採用状態は`human-decision-pending`です。自動分析は候補を選びません。候補Cは初回実機確認の優先候補として推薦していますが、採用決定ではありません。

比較ページ、候補データ、静止画像は本番の`src`と`dist`へ入りません。

## 描画方式

本命描画は`src/render/webgl.js`の純粋WebGLです。WebGLの初期化などに失敗した場合は`src/render/canvas.js`のCanvas 2Dへ切り替えます。両方が同じ`World`とviewport変換を使います。

## 確認状態

Phase 1と1.1で画面状態と共有処理を修正し、Phase 2A・2BでJavaScript正本、再現可能なbuild、依存0件、容量報告専用化を完了しました。Phase 3Aの固定論理座標とPhase 3Bの候補分析はNode.js 18・20・22の自動検査を通過しています。現在は候補選択の判断資料を整備しています。

iPhone、iPad、Codeberg Pages、実Supabase通信は未確認です。実機で確認していない項目は[`docs/REVIEW_CHECKLIST_v3.md`](docs/REVIEW_CHECKLIST_v3.md)で`[未確認]`のまま管理します。
