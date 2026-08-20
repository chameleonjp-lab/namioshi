# HAMEN 元ソース（TypeScript スナップショット）

Grok Build で 2026-08-20 に実装した HAMEN のアルゴリズム原典です。
namioshi の `src/` には接続しません。再現・移植の参照用です。

| ファイル | 役割 | 依存 |
|---|---|---|
| `engine.ts` | 2バッファ高さ場、入力、60Hz step、法線ライティング | `colormaps.ts` のみ |
| `colormaps.ts` | 6色 LUT（smoothstep 補間） | なし |
| `settings.ts` | 既定値と localStorage 永続化 | `colormaps.ts` の型のみ |
| `ripple-stage.tsx` | 元 React ホスト（pointer、RAF、UI） | TanStack / Tailwind / 認証キット |

## 再現の優先順位

1. **動くもの** — 親ディレクトリの vanilla デモ（`../index.html`）。npm 不要。
2. **型つき原典** — `engine.ts` と `colormaps.ts`。物理と描画の正本。
3. **ホスト** — `ripple-stage.tsx` は App Builder の React 枠。波の式は含まない。`AuthChip`、`Button`、`Slider`、localStorage は波面アルゴリズムの一部ではない。

アルゴリズム定数と更新式の解説は [`docs/HAMEN_RIPPLE_ALGORITHM.md`](../../../docs/HAMEN_RIPPLE_ALGORITHM.md) を正本とする。
