# HAMEN 流体リップル参考デモ

Grok Build で試作したインタラクティブ流体表面（高さ場リップル）を、namioshi の見た目検討用に vanilla JS へ移植した参考資料です。

- **本番ゲームには読み込まれません。** `src/` `dist/` からの import はありません。
- 配置ラボと同じく `tools` 配下の開発用ページです。
- namioshi の円環波・反射弧・得点・入力契約は変更しません。

## 開き方

リポジトリルートから静的ファイルとして開きます。

```bash
python3 -m http.server 8080
```

ブラウザで `/tools/hamen-ripple/` を開いてください。

## 操作

- ドラッグで波を起こす（軌跡を格子間隔で補間）
- 粘性: 減衰。高いほど波がすぐ沈む
- 波の強さ: くぼみの振幅と半径
- カラーマップ: 深海 / 氷河 / 熱 / 墨 / 森 / 真珠
- クリア: 高さ場をゼロにする

## 再現用ファイル

| ファイル | 役割 |
|---|---|
| `ripple.js` / `app.js` / `index.html` | 実行デモ |
| `constants.json` | 格子・減衰・入力・照明の定数 |
| `source/engine.ts` | 型つき原典 |
| `source/colormaps.ts` | LUT 原典 |
| `source/ripple-stage.tsx` | 元 React ホスト（参考。実行には不要） |

更新式と再実装チェックリストは [`docs/HAMEN_RIPPLE_ALGORITHM.md`](../../docs/HAMEN_RIPPLE_ALGORITHM.md) です。namioshi への対応関係は [`docs/HAMEN_RIPPLE_REFERENCE.md`](../../docs/HAMEN_RIPPLE_REFERENCE.md) です。
