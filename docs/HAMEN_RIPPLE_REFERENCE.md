# HAMEN 流体リップル参考資料

日付: 2026-08-20
対象: `chameleonjp-lab/namioshi`
置き場: `tools/hamen-ripple/`（開発用。本番ゲームには未接続）

この文書は、Grok Build で試作したインタラクティブ流体表面を namioshi の水面表現の参考として残すためのものです。ゲームコード、得点、物理寿命、入力上限、ランキング、Supabase は変更しません。

アルゴリズムの更新式・定数・再実装手順の正本は [`docs/HAMEN_RIPPLE_ALGORITHM.md`](./HAMEN_RIPPLE_ALGORITHM.md) です。

## 何を残したか

| ファイル | 役割 |
|---|---|
| `tools/hamen-ripple/index.html` | フルスクリーン操作デモ（vanilla、npm 不要） |
| `tools/hamen-ripple/ripple.js` | 2バッファ高さ場とライティング（実行実装） |
| `tools/hamen-ripple/app.js` | pointer 補間、60Hz 固定 step、UI |
| `tools/hamen-ripple/constants.json` | 格子・減衰・入力・照明の定数 |
| `tools/hamen-ripple/README.md` | 開き方 |
| `tools/hamen-ripple/source/engine.ts` | 型つき原典（物理と描画） |
| `tools/hamen-ripple/source/colormaps.ts` | LUT 原典 |
| `tools/hamen-ripple/source/settings.ts` | 既定値（粘度 28、強さ 64、深海） |
| `tools/hamen-ripple/source/ripple-stage.tsx` | 元 React ホストのスナップショット |
| `docs/HAMEN_RIPPLE_ALGORITHM.md` | 波動方程式、境界、入力、照明、再実装チェックリスト |

元試作は React / Canvas 2D。namioshi は外部パッケージなしの ES Modules なので、同じアルゴリズムを vanilla JS に移植しています。TypeScript 原典は `source/` に置き、React / Tailwind / 認証は本番へ持ち込みません。

再現の最短経路は `tools/hamen-ripple/index.html` を静的サーバで開くことです。型と定数から書き直す場合は `source/engine.ts` と `constants.json` を使います。

## namioshi 現行との違い

namioshi の波は **幾何円環** です。`src/game/world.js` が原点・半径・幅・寿命を進め、`src/render/webgl.js` が単位円の帯と有限反射弧を描きます。背景は fragment shader の正弦波と、最大12本の `exp(-pow(abs(d-radius)/width,2))` のリングです。物理・得点寿命は約3秒、反射輪の表示は最大10秒です。

HAMEN の波は **高さ場** です。各格子点の高さ `h` を隣接点の平均と1フレーム前の値から更新します。

```
next = ((left + right + up + down) / 2 - previous) * damping
```

これは `c² Δt² / Δx² = 0.5` の 2D 波動方程式です。タップは `falloff²` のくぼみを `current` に足します。ドラッグは始点と終点の間を格子間隔で分割して連続投入します。減衰は粘性スライダーで `0.996`〜`0.886` です。描画は勾配から法線を作り、拡散＋ハイライト＋カラーマップで水面に見せます。端は Dirichlet ゼロのため、波は位相が反転して戻ります。

幾何円環は namioshi の得点・反射・ビーコン判定に必要です。高さ場は見た目の厚みと干渉縞の参考であり、経路台帳の置換ではありません。

## 取り込める論点（未実装・任意）

1. **タップ直後の局所くぼみ**  
   根波発生時、円環の内側に短い高さインパルスを足すと着水感が増えます。半径・寿命・得点には触れない前提です。HAMEN の `drop` 式（amp = 0.55+t×8.2、radius = 2.4+t×4.2）が振幅の目安です。

2. **背景水面の厚み**  
   現行背景は正弦波とリングの重ねです。高さ場の低解像度版、または法線ハイライトだけを背景クオリティ LOW/MID/HIGH に足す余地があります。前景の得点波は Phase 7A どおり隠さないこと。

3. **減衰カーブ**  
   HAMEN の `damping` はエネルギー減衰です。namioshi の `fade = 1 - age/life` 線形フェードと比較して、消える直前の厚みを検討できます。物理寿命3秒は維持します。

4. **軌跡補間**  
   速いフリックで波が飛び飛びにならないよう、pointer の線分を `ceil(dist × 1.85)` で分割しています。namioshi の入力キューが画面座標を間引く場合の参考です。余白上の入力拒否と 360×640 変換は現行契約のままです。

5. **クリア＝静止水面**  
   RESULT の「静かな水面」SE に合わせ、高さ場をゼロにする操作があります。結果画面の背景を完全静止へ近づける検討用です。

## 取り込まない範囲

- 高さ場を namioshi の判定半径や反射経路に使うこと
- カラーマップ切替を本番 UI に出すこと
- React / Tailwind / 認証スタックを namioshi に持ち込むこと
- 波速110、根波10回、hard ceiling 11200、公式配置指紋の変更

## 確認状態

- 参考デモは `tools/hamen-ripple/` で単体動作する
- TypeScript 原典と定数表を `source/` `constants.json` に置いた
- `src` と `dist` は未変更
- 実ブラウザ・iPhone での本番組み込みは未実施
- 公開判定、ランキング、Supabase は停止のまま
