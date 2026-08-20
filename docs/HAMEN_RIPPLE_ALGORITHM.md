# HAMEN 流体リップルアルゴリズム

日付: 2026-08-20
対象: `chameleonjp-lab/namioshi` 参考資料
正本コード:
- 型つき原典: `tools/hamen-ripple/source/engine.ts`
- 実行デモ: `tools/hamen-ripple/ripple.js`
- 定数表: `tools/hamen-ripple/constants.json`

namioshi の円環物理・得点・入力契約は変更しません。この文書だけで高さ場リップルを再実装できることを目的にします。

## 1. 何の流体か

Navier-Stokes の速度場ではありません。スカラー高さ `h(x, y)` の **2D 波動方程式** です。

```
∂²h / ∂t² = c² ∇²h
```

ゲーム向けの 2 バッファ形（Hugo Elias / Jos Stam 系の水面デモと同じ族）に落とします。粘性はエネルギー減衰 `damping` として毎ステップ掛けます。反射板・ビーコン・経路台帳はありません。境界は格子端の Dirichlet ゼロなので、波は端で位相が反転して戻ります。namioshi の有限反射弧とは別物です。

## 2. 状態

幅 `W`、高さ `H` の 2 枚の `Float32Array`（行優先、長さ `W * H`）。

| バッファ | 意味 |
|---|---|
| `current` | 時刻 t の高さ |
| `previous` | 時刻 t − Δt の高さ |

`ImageData(W, H)` とオフスクリーン Canvas は描画専用です。物理には使いません。

初期値はすべて 0。起動時だけ `seed()` で 4 点のくぼみを足して、最初から水面が動いているように見せます。

## 3. 格子サイズ

CSS ピクセル `(cssW, cssH)` から決めます。物理格子は表示解像度より粗くします。

```
cell = cssW < 600 ? 3.2 : 4.2
W = round(cssW / cell)
H = round(cssH / cell)
maxCells = cssW < 600 ? 48000 : 90000
area = W * H が maxCells を超えたら sqrt(maxCells / area) で縮小
W = clamp(W, 64, 360)
H = clamp(H, 64, 520)
```

表示 Canvas の実ピクセルは `min(devicePixelRatio, 1.5)` 倍です。高さ場の座標は常に格子空間です。

ポインタ → 格子:

```
gx = (clientX - rect.left) / rect.width * W
gy = (clientY - rect.top) / rect.height * H
```

## 4. 時間

固定 Δt = 1/60 秒。`requestAnimationFrame` の実時間を溜め、16.67ms ごとに `step()` を 1 回以上回します。1 フレームの実時間は最大 100ms に切り、スパイラルを止めます。描画は毎 RAF、物理は 60Hz です。

namioshi の 20/30/60/120Hz 一致契約とは独立です。このデモは 60Hz のみです。

## 5. 更新式（物理の核）

内点だけ更新します。`x = 1 … W-2`、`y = 1 … H-2`。端のセルは常に 0 のままです（Dirichlet）。

```
next[i] = ((current[i-1] + current[i+1] + current[i-W] + current[i+W]) * 0.5
           - previous[i]) * damping
```

その後バッファを入れ替えます。

```
current, previous = next, current
```

実装では `previous[i]` に next を書き、参照を入れ替えています。新しい配列は割り当てません。

### 5.1 なぜ 0.5 か

離散波動方程式

```
h_new = 2h - h_old + k ∇²h
∇²h ≈ L + R + U + D − 4h
```

で `k = c² Δt² / Δx² = 0.5` と置くと、

```
h_new = 2h - h_old + 0.5(L+R+U+D−4h)
      = (L+R+U+D)/2 - h_old
```

になります。`k = 0.5` は 4 近傍で安定限界付近です。`damping < 1` があるため発散しません。

### 5.2 減衰

```
t = clamp(viscosity, 0, 100) / 100
damping = 0.996 - t * 0.11
```

| 粘性 | damping | 見え方 |
|---:|---:|---|
| 0 | 0.996 | 長く残る |
| 28（既定） | 0.96512 | 数秒で沈む |
| 100 | 0.886 | すぐ沈む |

コンストラクタの初期値 `0.985` は、最初の `step` 前に上式で上書きされます。

毎ステップ高さが約 `damping` 倍されるため、振幅の半減時間はおおむね

```
steps ≈ ln(0.5) / ln(damping)
秒   ≈ steps / 60
```

既定粘性 28 なら約 0.33 秒で振幅半減、約 2 秒で 1% 程度です。namioshi の `fade = 1 − age/life`（根波 3 秒）とは曲線が違います。

## 6. 入力

`strength` を `t = clamp(strength, 0, 100) / 100` に正規化して使います。くぼみは **current に加算** します。previous は触りません。これにより次の `step` で波として広がります。

半径の下限は 1.2 格子です。端 1 セルは書き込みません。

### 6.1 形状（ガウスではなく 4 乗フォールオフ）

円 `d² ≤ r²` の内側:

```
falloff = 1 − d² / r²
current[x,y] += amp * falloff * falloff
```

`falloff²` は中心が平たく、縁が急なベルです。正規ガウスではありません。

### 6.2 タップ（pointerdown）`drop`

```
amp    = 0.55 + t * 8.2
radius = 2.4 + t * 4.2
```

既定 `t = 0.64` なら amp ≈ 5.80、radius ≈ 5.09。

### 6.3 ドラッグ（pointermove）`disturbSegment`

始点 `(x0,y0)` と終点 `(x1,y1)` を格子間隔より細かく分割します。

```
dist   = hypot(x1−x0, y1−y0)
steps  = max(1, ceil(dist * 1.85))
amp    = (0.42 + t * 7.6) / steps^0.32
radius = 2.15 + t * 3.6 + min(dist * 0.12, 2.8)

for i in 0 … steps:
  u = i / steps
  disturb(lerp(x0,x1,u), lerp(y0,y1,u), amp, radius)
```

`steps^0.32` で分割数に応じて振幅を下げ、速いフリックが帯状に飾和するのを防ぎます。マルチタッチは `pointerId` ごとの最終格子点を `Map` で持ちます。

### 6.4 起動シード

格子比座標:

| x | y | amp | radius |
|---:|---:|---:|---:|
| 0.50 | 0.46 | 6.4 | 6.2 |
| 0.32 | 0.62 | 4.2 | 4.6 |
| 0.70 | 0.34 | 5.1 | 5.2 |
| 0.58 | 0.72 | 3.2 | 3.8 |

リサイズで格子サイズが変わるとエンジンを作り直し、再度 seed します。クリア後は seed しません。

### 6.5 クリア

```
current.fill(0)
previous.fill(0)
```

即時に平坦面へ戻します。フェードアウトはありません。

## 7. 描画

物理格子を `ImageData` に塗り、オフスクリーンから表示 Canvas へスムージング付きで拡大します。

### 7.1 法線

高さの中心差分（符号は「左が高く右が低い → +X 法線」）。

```
dx = (h[x-1] − h[x+1]) * 0.62
dy = (h[y-1] − h[y+1]) * 0.62
n  = normalize(dx, dy, 1)
```

### 7.2 照明

ライト（正規化していません。n·L のクランプで足りるため）:

```
L = (−0.42, −0.58, 0.70)
```

Lambert:

```
ndotl = max(0, n · L)
shade = 0.28 + 0.72 * ndotl
```

Blinn-Phong。ハーフベクトルは `H = normalize(L + (0,0,1))`、指数 42。

```
spec = max(0, n · H)^42
```

### 7.3 カラーマップ

高さと峰の勾配を 0..1 に潰して 256 エントリ LUT を引きます。

```
crest  = min(1, hypot(dx, dy) * 1.4)
mapped = 0.5 + 0.5 * tanh(z * 0.38 + crest * 0.22)
idx    = floor(mapped * 255)
```

LUT はストップ色を smoothstep で補間した RGB×256 です。ストップ表は `constants.json` の `colormapStops` と同一です。

最終ピクセル:

```
rgb = min(255, lut[idx] * shade + spec * (235, 235, 240))
a   = 255
```

端 1 ピクセルは内側の隣をコピーします（物理値は 0 のまま）。

## 8. 再実装チェックリスト

次を満たせば HAMEN と同じ動きになります。

- [ ] `next = ((L+R+U+D)/2 − previous) * damping` で、k=0.5 の波動方程式になっている
- [ ] 端 1 セルは step も disturb も書かない
- [ ] くぼみは current だけに足し、previous は触らない
- [ ] フォールオフは `falloff²`（ガウス関数ではない）
- [ ] ドラッグは `ceil(dist * 1.85)` 分割、振幅は `steps^0.32` で割る
- [ ] 物理 60Hz、描画は RAF、dt クリップ 100ms
- [ ] damping = `0.996 − viscosity/100 * 0.11`
- [ ] 法線スケール 0.62、spec 指数 42、tanh マッピング係数 0.38 / 0.22
- [ ] クリアは fill(0) 即時

## 9. namioshi へ持ち込む場合の境界

| HAMEN | namioshi |
|---|---|
| 高さ場の干渉と減衰 | 幾何円環。原点・半径・幅・寿命 |
| 端で位相反転 | 反射板による有限弧、最大 2 回 |
| ドラッグ連続投入 | 根波 10 回、余白拒否、360×640 |
| 見た目の寿命は damping | 物理・得点寿命約 3 秒、反射表示最大 10 秒 |

判定半径、反射経路、台帳、得点、波速 110 に高さ場を使ってはいけません。
背景の厚み・着水の局所くぼみ・RESULT の静止面だけが検討対象です。対応表は `docs/HAMEN_RIPPLE_REFERENCE.md` を参照してください。

## 10. ファイル対応

| パス | 内容 |
|---|---|
| `tools/hamen-ripple/index.html` | 実行デモ（vanilla、npm 不要） |
| `tools/hamen-ripple/ripple.js` | 上記アルゴリズムの JS 実装 |
| `tools/hamen-ripple/app.js` | pointer / RAF / UI |
| `tools/hamen-ripple/constants.json` | 本文書の定数を機械可読にしたもの |
| `tools/hamen-ripple/source/engine.ts` | 型つき原典 |
| `tools/hamen-ripple/source/colormaps.ts` | LUT 原典 |
| `tools/hamen-ripple/source/settings.ts` | 既定値と永続化（アルゴリズム外） |
| `tools/hamen-ripple/source/ripple-stage.tsx` | 元 React ホスト（アルゴリズム外） |
