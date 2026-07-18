# namioshi

暗い水面に波を押し出し、壁やガラス片の反射を使って3つのビーコンに波を重ねる10秒ゲームです。公開先はCodeberg Pagesの`/namioshi/`配下を想定しています。

## v3仕様文書

現在のゲームルールはv2相当です。v3のゲーム仕様は段階的に実装しており、文書があることだけをv3完成の証拠として扱いません。

- 要件の正本: [`docs/REQUIREMENTS_v3.md`](docs/REQUIREMENTS_v3.md)
- ゲーム仕様の正本: [`docs/SPEC_v3.md`](docs/SPEC_v3.md)
- 段階別の実装順: [`docs/IMPLEMENTATION_PLAN_v3.md`](docs/IMPLEMENTATION_PLAN_v3.md)
- 完成までの統合計画: [`docs/MASTER_COMPLETION_PLAN_v3.md`](docs/MASTER_COMPLETION_PLAN_v3.md)
- レビュー・公開確認: [`docs/REVIEW_CHECKLIST_v3.md`](docs/REVIEW_CHECKLIST_v3.md)

v3では3MBを受け入れ上限にしません。容量は報告値として扱い、入力反応、フレーム時間、継続動作、実機確認を優先します。複数ファイルとES Modulesを正式に使用します。

## 開発構成

`src`が正本です。実行コードはブラウザがそのまま読めるJavaScriptで、相対importには`.js`拡張子を明記しています。

- 開発用入口: `index.html`
- 開発用JavaScript: `src/main.js`
- 開発用CSS: `src/ui/styles.css`
- 公開用入口: `dist/index.html`
- 公開用ファイル: `dist/assets/**`

ビルドと検査には標準Node.js 18以上だけを使います。外部パッケージを使っていないため、`npm install`は不要です。vendored TypeScript、Vite、Three.js代替パッケージ、`vite.config.js`、`tsconfig.json`は使用しません。

```bash
npm run build
npm run verify
npm run size
```

`npm run build`は`dist`を削除した後、`src`を加工せず`dist/assets`へ再帰コピーし、公開用`dist/index.html`を生成します。TypeScript変換、正規表現によるコード変換、既存`dist`の再利用は行いません。

`npm run verify`は、JavaScript構文、相対importの解決、`src`と`dist/assets`の一致、公開ファイルが入口から参照されていること、HTMLの参照先、不要依存の再混入、公開物へのsecret・service_role・直接ランキング書き込みの混入を検査します。

`npm run size`は、公開物の総量、ファイル数、大きいファイル、同じ内容の重複ファイルを報告します。固定容量を超えたことだけを理由に失敗しません。

## 描画方式

本命描画は`src/render/webgl.js`の純粋WebGLです。WebGLの初期化、シェーダー作成、プログラム接続、バッファ作成、最小描画確認のいずれかが失敗した場合は、`src/render/canvas.js`のCanvas 2Dへ切り替えます。

現在のWebGL版は、水面背景、波、ビーコン、ガラス片、命中粒子を描画します。Canvas 2D版も同じ`World`を使い、同じゲームルールを維持します。

## 確認状態

Phase 1とPhase 1.1で画面状態と共有処理を修正し、Phase 2AでJavaScript正本と一方向ビルドへ移行しました。Phase 2Bでは不要依存と旧2.9MB失敗条件を削除しています。

iPhone、iPad、Codeberg Pages、実Supabase通信は未確認です。実機で確認していない項目は[`docs/REVIEW_CHECKLIST_v3.md`](docs/REVIEW_CHECKLIST_v3.md)で`[未確認]`のまま管理します。
