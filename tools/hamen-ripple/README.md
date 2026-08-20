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

## namioshi への対応関係

詳細は [`docs/HAMEN_RIPPLE_REFERENCE.md`](../../docs/HAMEN_RIPPLE_REFERENCE.md) を参照してください。
