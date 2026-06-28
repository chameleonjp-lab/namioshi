# namioshi

`namioshi` は、暗い水面に波を押し出し、壁やガラス片で反射させながら3つのビーコンへ波を重ねる10秒ゲームです。

## セットアップ

```bash
npm install
```

`npm install` はローカル固定パッケージ（`vendor/three` / `vendor/vite` / `vendor/typescript`）を使って成功する構成です。外部CDNやCodeberg Pages上の `node_modules` には依存しません。

## ビルド

```bash
npm run build
```

`npm run build` は `vite build` を実行します。`dist` は `src/main.ts` をエントリとする公開物の構成（`dist/index.html` から `/namioshi/assets/main.js` と `/namioshi/assets/styles.css` を読む構成）へ置き換え、旧 `dist/assets/app.js` は残していません。

## 描画

WebGL版が本命です。起動時は同じ `<canvas>` に対してまず `new WebGLView(canvas)` を試し、WebGL初期化に失敗した時だけ `new CanvasView(canvas)` にフォールバックします。同じcanvasからWebGLコンテキストと2Dコンテキストを両方取得しません。

WebGL描画では、波リング最大24個、ビーコン3個、ガラス片、粒子バッファを生成済みオブジェクトとして使い回し、`render()` 中は位置・半径・透明度・表示/非表示を更新します。

## サイズ・検証

```bash
npm run size
npm run verify
```

- dist合計サイズ上限: `2,900,000 bytes`
- 実測 `npm run size`: 成功、`dist total: 30325 bytes / 2900000`
- 実測 `npm run verify`: 成功、`verify ok: no source maps, external CDN, service_role, direct ranking_scores POST, CSS direct import, three bare import, or legacy hand-written dist markers`
- `npm run verify` は `dist` に `.map`、`service_role`、`ranking_scores`、許可外URLが含まれていないことに加え、CSS直接import（`import './ui/styles.css'`）とThree.jsのbare import（`from 'three'` / `from "three"` / `import * as THREE from 'three'` / `import * as THREE from "three"`）が残っていないことを確認します。

## 検収結果（2026-06-28 実測）

- `npm install`: 成功（ローカル固定パッケージを使用し、`node_modules` を作成）
- `npm run build`: 成功（`vite build` を実行し、`dist` をCodeberg Pages向け公開物として再生成）
- `npm run size`: 成功、`dist total: 30325 bytes / 2900000`
- `npm run verify`: 成功、`verify ok: no source maps, external CDN, service_role, direct ranking_scores POST, CSS direct import, three bare import, or legacy hand-written dist markers`
- distに `dist/assets/app.js`: なし
- distのJSに `from 'three'`: なし
- distのJSに `import './ui/styles.css'`: なし
- dist/index.htmlにCSS link: あり（`/namioshi/assets/styles.css`）
- Codeberg PagesでHOME画面が表示されることを確認
- WebGL版が起動することを確認
- WebGL初期化を失敗させた場合だけCanvas版に切り替わることを確認
- 1タップで波が1つ出ることを確認
- 4回目のタップは無視されることを確認
- 10秒でRESULTに進むことを確認
- RESULTでランキング送信が1回だけ行われることを確認
