# namioshi v2

## 実装方針
`index.html` を入口にした Vite + TypeScript 構成です。WebGL/Three.js 版を本命にし、OrthographicCamera と WebGLRenderer、PlaneGeometry + ShaderMaterial による暗い水面、リング・半透明円・粒子による軽量な発光表現を使います。GLTFLoader、DRACOLoader、KTX2Loader、EffectComposer、UnrealBloomPass、OrbitControls は使いません。

## 起動方法
```bash
npm install
npm run build
npx vite --host 0.0.0.0
```

## ビルド方法
```bash
npm run build
npm run size
npm run verify
```

## サイズ検査結果
`npm run size` は `dist` 合計が 2,900,000 bytes を超えた場合に失敗します。現行ビルドは上限内です。

## iPhone SE向け最適化内容
- 初期品質は MID、平均 fps が 45 未満なら段階的に低下、32 未満なら LOW 固定。
- DPR 上限は HIGH 1.5 / MID 1.25 / LOW 1.0。
- 最大波数 24、シェーダー渡し最大 12、タップ最大 3、1プレイ 10秒。
- UI は狭幅で折り返し、ゲーム面は `touch-action:none`、ボタンは `touch-action:manipulation`。

## WebGL fallbackの説明
WebGL 初期化に失敗した場合のみ Canvas 2D レンダラーへ切り替えます。Canvas 2D でも水面、波、ビーコン、ガラス片、粒子、当たり判定が動作します。WebGL と Canvas の両方が初期化できない時だけ ERROR 画面を表示します。

## ランキング送信方式
`@supabase/supabase-js` は使用せず、Publishable key で REST RPC `submit_score` に `fetch` します。`ranking_scores` への直接 POST と service_role key は使用しません。RESULT へ入った時点で一度だけ送信し、失敗してもゲームは停止しません。

## 検収チェック結果
- `game_slug` は `namioshi`。
- 公開 URL とシェア文末は `https://chameleonjp.codeberg.page/namioshi/`。
- 3タップ制限、10秒終了、RESULT時1回送信、WebGL/Canvas fallback、サイズ検査、source map なし検査を実装済みです。
