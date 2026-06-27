# namioshi

`namioshi` は、暗い水面に波を押し出し、壁やガラス片で反射させながら3つのビーコンへ波を重ねる10秒ゲームです。

## セットアップ

```bash
npm install
```

`npm install` により、実行時依存の `three` と、開発時依存の `vite` / `typescript` が固定バージョンで入ります。`package.json` では `^` を使っていません。

## ビルド

```bash
npm run build
```

`npm run build` は `vite build` を実行します。`dist` は `src/main.ts` をエントリとしてViteが生成する公開物です。旧 `scripts/build.mjs` による `dist/index.html` / `dist/assets/app.js` の手書き文字列生成は使いません。

## 描画

WebGL版が本命です。起動時は同じ `<canvas>` に対してまず `new WebGLView(canvas)` を試し、WebGL初期化に失敗した時だけ `new CanvasView(canvas)` にフォールバックします。同じcanvasからWebGLコンテキストと2Dコンテキストを両方取得しません。

WebGL描画では、波リング最大24個、ビーコン3個、ガラス片、粒子バッファを生成済みオブジェクトとして使い回し、`render()` 中は位置・半径・透明度・表示/非表示を更新します。

## サイズ・検証

```bash
npm run size
npm run verify
```

- dist合計サイズ上限: `2,900,000 bytes`
- `npm run size` は `dist total: ... bytes / 2900000` を出力します。
- `npm run verify` は `dist` に `.map`、`service_role`、`ranking_scores`、許可外URLが含まれていないことを確認します。

## 検収結果

- `npm install` が通ること。
- `npm run build` が通ること。
- `npm run size` が通ること。
- `npm run verify` が通ること。
- dist合計が `2,900,000 bytes` 以下であること。
- `package-lock.json` が存在すること。
- `package.json` に `three` / `vite` / `typescript` が存在すること。
- `build` が `vite build` になっていること。
- `scripts/build.mjs` による手書きdist生成を使っていないこと。
- distに `.map` がないこと。
- distに `service_role` がないこと。
- distに `ranking_scores` がないこと。
- WebGL版で描画されること。
- WebGL初期化失敗時にCanvas版で描画されること。
- 1タップで波が1つだけ出ること。
- 4回目のタップは無視されること。
- 10秒でRESULTへ進むこと。
- RESULTでランキング送信は1回だけであること。
- シェア文末に `https://chameleonjp.codeberg.page/namioshi/` が入ること。
