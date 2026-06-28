# namioshi

`namioshi` は、暗い水面に波を押し出し、壁やガラス片で反射させながら3つのビーコンへ波を重ねる10秒ゲームです。

## セットアップ

```bash
npm install
```

`npm install --package-lock-only` で `three` / `vite` / `typescript` と推移依存を含む lockfile を再生成済みです。実行時依存は `three`、開発時依存は `vite` / `typescript` で、`package.json` では `^` を使っていません。

## ビルド

```bash
npm run build
```

`npm run build` は `vite build` を実行します。`dist` は `src/main.ts` をエントリとするVite公開物の構成（`dist/index.html` から `/namioshi/assets/index-*.js` を読む構成）へ置き換え、旧 `dist/assets/app.js` は残していません。旧 `scripts/build.mjs` による `dist/index.html` / `dist/assets/app.js` の手書き文字列生成は使いません。

## 描画

WebGL版が本命です。起動時は同じ `<canvas>` に対してまず `new WebGLView(canvas)` を試し、WebGL初期化に失敗した時だけ `new CanvasView(canvas)` にフォールバックします。同じcanvasからWebGLコンテキストと2Dコンテキストを両方取得しません。

WebGL描画では、波リング最大24個、ビーコン3個、ガラス片、粒子バッファを生成済みオブジェクトとして使い回し、`render()` 中は位置・半径・透明度・表示/非表示を更新します。

## サイズ・検証

```bash
npm run size
npm run verify
```

- dist合計サイズ上限: `2,900,000 bytes`
- 実測 `npm run size`: `dist total: 23261 bytes / 2900000`
- 実測 `npm run verify`: `verify ok: no source maps, external CDN, service_role, direct ranking_scores POST, or legacy hand-written dist markers`
- `npm run verify` は `dist` に `.map`、`service_role`、`ranking_scores`、許可外URLが含まれていないことに加え、旧手書きdistの目印（`const GAME_URL=` / `const app=document.getElementById('app')` / `function draw(t)` / `gl=cv.getContext('webgl'` / `ctx=cv.getContext('2d'` / `scripts/build.mjs`）が残っていないことを確認します。

## 検収結果（2026-06-28 実測）

- `npm install --package-lock-only`: 成功（完全な `package-lock.json` を再生成）
- `npm install`: この実行環境では registry tarball 取得が `403 Forbidden` で失敗（例: `vite-5.4.19.tgz` / `@types/estree-1.0.9.tgz`）
- `npm run build`: この実行環境では `npm install` 失敗により `vite` 実体を取得できず未完了
- `npm run size`: 成功、`dist total: 23261 bytes / 2900000`
- `npm run verify`: 成功、旧手書きdistマーカーなし
- `package-lock.json`: 存在し、推移依存を含む lockfile v3
- `package.json`: `three` / `vite` / `typescript` が存在
- `build`: `vite build`
- `dist/assets/app.js`: 存在しない
- `dist/index.html`: `/namioshi/assets/index-D4h3Kx9m.js` を読み込む
- distに `.map`: なし
- distに `service_role`: なし
- distに `ranking_scores`: なし
