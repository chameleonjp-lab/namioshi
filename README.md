# namioshi

暗い水面に波を押し出し、壁やガラス片の反射を使って3つのビーコンに波を重ねる10秒ゲームです。公開先はCodeberg Pagesの`/namioshi/`配下を想定しています。

## v3仕様文書

v3は段階的に実装しています。文書があることだけを完成の証拠として扱いません。

- 要件の正本: [`docs/REQUIREMENTS_v3.md`](docs/REQUIREMENTS_v3.md)
- ゲーム仕様の正本: [`docs/SPEC_v3.md`](docs/SPEC_v3.md)
- 段階別の実装順: [`docs/IMPLEMENTATION_PLAN_v3.md`](docs/IMPLEMENTATION_PLAN_v3.md)
- 完成までの統合計画: [`docs/MASTER_COMPLETION_PLAN_v3.md`](docs/MASTER_COMPLETION_PLAN_v3.md)
- 公式配置候補の比較: [`docs/OFFICIAL_LAYOUT_STUDY_v3.md`](docs/OFFICIAL_LAYOUT_STUDY_v3.md)
- 公式配置の選定ガイド: [`docs/OFFICIAL_LAYOUT_DECISION_GUIDE_v3.md`](docs/OFFICIAL_LAYOUT_DECISION_GUIDE_v3.md)
- 公式配置の選定記録: [`docs/OFFICIAL_LAYOUT_SELECTION_v3.md`](docs/OFFICIAL_LAYOUT_SELECTION_v3.md)
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

`npm test`は、固定論理座標、公式配置候補、候補Cの選定記録、公式・練習モードの分離を確認します。

`npm run analyze:layouts`は、3つの配置候補を同じ121地点、同じ56到達時刻、同じ3タップ地点で再計算し、保存済み結果と一致するか確認します。

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

比較ラボと静止画像は選定履歴として`tools`と`docs/layout-previews`に残します。

## 描画方式

本命描画は`src/render/webgl.js`の純粋WebGLです。WebGLの初期化などに失敗した場合は`src/render/canvas.js`のCanvas 2Dへ切り替えます。両方が同じ`World`とviewport変換を使います。

## 確認状態

Phase 1と1.1で画面状態と共有処理を修正し、Phase 2A・2BでJavaScript正本、再現可能なbuild、依存0件、容量報告専用化を完了しました。Phase 3Aの固定論理座標、Phase 3Bの候補分析、Phase 3B.1の判断資料は自動検査を通過しています。現在はPhase 3Cで候補Cの公式配置と練習ランダムを分離しています。

iPhone、iPad、Codeberg Pages、実Supabase通信は未確認です。実機で確認していない項目は[`docs/REVIEW_CHECKLIST_v3.md`](docs/REVIEW_CHECKLIST_v3.md)で`[未確認]`のまま管理します。
