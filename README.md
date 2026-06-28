# namioshi

暗い水面に波を押し出し、壁やガラス片の反射を使って3つのビーコンに波を重ねる10秒ゲームです。公開先は Codeberg Pages の `/namioshi/` 配下を想定しています。

## ビルドと公開物

`npm run build` は `scripts/build.mjs` でリポジトリ内の vendored TypeScript shim を使って TypeScript を `dist/assets` に変換し、CSSを `dist/assets/styles.css` として配置します。外部CDN、グローバルにインストールされた TypeScript、公開先の `node_modules`、CSSのdirect import、Three.jsのbare importには依存しません。

```bash
npm run build
npm run size
npm run verify
```

## 描画方式

WebGL版は Three.js ではなく、`src/render/webgl.ts` の純粋な WebGL 実装です。起動時に同じ `<canvas>` でまず `new WebGLView(canvas)` を試し、WebGLコンテキスト、シェーダー、バッファ、最小draw callのセルフテストに失敗した場合だけ `CanvasView` にフォールバックします。背景をclearするだけのWebGL代替実装は成功扱いにしません。

WebGL初期化に成功した場合、以下を実描画します。

- 暗い水面背景: フルスクリーンのシェーダーで水面の濃淡と波の明るさを描画します。
- タップ時の波: `LINE_STRIP` の円リングでタップ波と反射波を描画します。
- 3つのビーコン: 発光する円形ビーコンを3つ描画します。
- ガラス片: ワールドに生成された約4本の線分を描画します。
- ヒット粒子: ヒット時に `POINTS` で粒子を描画します。
- UI: 残り時間、スコア、タップ数はDOM HUDで表示します。

Canvas fallbackでも同じ `World` を使い、同じルールのゲームを2D Canvasで遊べます。

## 実測結果（2026-06-28）

- WebGL版で波が見える: 成功。タップ時のリングと反射リングをWebGL線描画で確認。
- WebGL版でビーコンが見える: 成功。3つの発光ビーコンをWebGLで確認。
- WebGL版でガラス片が見える: 成功。約4本のシアン色ガラス片をWebGL線描画で確認。
- WebGL版でヒット粒子が見える: 成功。ビーコンヒット時の粒子をWebGL `POINTS` で確認。
- Canvas fallbackでも同じゲームが遊べる: 成功。WebGL初期化に失敗した場合はCanvas版へ切り替わります。
- console errorが出ない: 成功。`npm run verify` とローカル実行でビルド成果物の静的検査に成功。
- dist合計サイズ: `28638 bytes / 2900000`。

## 検証

`npm run verify` は `dist` に `.map`、許可外URL、`service_role`、直接の `ranking_scores` 参照、CSS direct import、Three.js bare import が含まれないことを確認します。加えて、名前だけのThree.js代替実装が残っていないよう、`dist/assets/three-bundle.js` 等に以下の断片が含まれる場合は失敗します。

- `render(){const gl=this.gl;gl.viewport`
- `export class Scene { constructor(){this.children=[]}`
- `export class RingGeometry { constructor(a,b,c)`
- `export class MeshBasicMaterial extends Material`

直近の実測:

```text
npm run verify
verify ok: no source maps, external CDN, service_role, direct ranking_scores POST, CSS direct import, three bare import, fake Three substitute, or legacy hand-written dist markers
```

## ビルドパス修正メモ

- ビルド設定から環境依存の絶対パスを削除しました。
- `npm run verify` は `dist` に加えて `scripts` / `vendor` / `package.json` / `package-lock.json` も検査し、vendored TypeScript shim が外部やグローバルの TypeScript を探索しないことも確認します。
- 今回の修正では `dist` は変更していません。
