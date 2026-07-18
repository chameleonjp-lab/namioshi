# namioshi v3 G2 開発構成検証報告

- 対象リポジトリ: `chameleonjp-lab/namioshi`
- 基準ブランチ: `main`
- 基準コミット: `cf37cb040c5f1570ff489819b921b337843262fb`
- 検証ブランチ: `codex/namioshi-v3-g2-build-verification`
- 対象Pull Request: `#22`
- 対象ゲート: G2「開発構成」
- 判定: **通過**
- 初回全成功Run: `G2 Build Verification #4`
- 初回成功Run ID: `29635225175`
- 初回成功コミット: `f6f0ab01f8715653ac5962bbe05d511a60fd688d`
- Pull Request最終head成功Run: `G2 Build Verification #6`
- 最終head成功Run ID: `29635330869`
- Pull Request最終head: `e3fdc069f9892faa5ee5b89c6f487aa0611ec586`
- mainへのマージコミット: `5ddd92274eb61ba110f05bbd59d8fa15787533c8`

## 1. 目的

Phase 2AとPhase 2Bで作った開発構成を、GitHub上の独立した実行環境で再検証する。

確認した内容は次のとおり。

1. 外部パッケージをインストールせずにbuildできる。
2. JavaScript構文、import、公開物、安全検査が通る。
3. 容量報告が固定上限なしで完了する。
4. build後の`dist`がコミット済み内容と一致する。
5. Node.js 18、20、22で同じ検査が通る。

## 2. 自動検査

`.github/workflows/g2-build-verification.yml`を使用した。

各Node.js版で次を順に実行した。

```text
node --version
npm run build
npm run verify
npm run size
git diff --exit-code -- dist
```

`npm install`と`npm ci`は実行していない。現在の構成が標準Node.jsだけで成立することを直接確認した。

## 3. 合否条件

| 確認項目 | 合格条件 |
|---|---|
| build | `npm run build`が終了コード0 |
| verify | `npm run verify`が終了コード0 |
| size | `npm run size`が終了コード0。固定容量上限による失敗なし |
| 再現性 | build後の`git diff --exit-code -- dist`が終了コード0 |
| 対応Node.js | 18、20、22の3件がすべて成功 |
| 依存 | package install処理なし |

## 4. 実行履歴

| Run | ID | 結果 | 原因・対応 |
|---:|---:|---|---|
| #1 | `29634993456` | 失敗 | `actions/setup-node`へ無効な`cache: false`を指定していた。`package-manager-cache: false`へ修正した。 |
| #2 | `29635064991` | 失敗 | Node.js設定は通過したが、`npm run build`で停止した。診断ログを追加した。 |
| #3 | `29635184708` | 失敗 | 診断Artifactから`src/vite-env.d.ts`の残存を確認した。不要なVite用型宣言を削除した。 |
| #4 | `29635225175` | 成功 | Node.js 18、20、22の全ジョブが全検査を通過した。 |
| #5 | Pull Request更新中 | 中間実行 | 文書更新中の一時的なheadに対する実行。最終判定には使用しない。 |
| #6 | `29635330869` | 成功 | Pull Request #22の最終headで、Node.js 18、20、22の全ジョブが全検査を通過した。 |

失敗時に検査を削除、無効化、成功扱いへ変更していない。原因を同じブランチとPull Requestで修正した。

## 5. 最終実行結果

対象はPull Request #22の最終head `e3fdc069f9892faa5ee5b89c6f487aa0611ec586`、Run #6である。

| 実行環境 | build | verify | size | dist再現性 | 判定 |
|---|---|---|---|---|---|
| Node.js 18 | 成功 | 成功 | 成功 | 成功 | 合格 |
| Node.js 20 | 成功 | 成功 | 成功 | 成功 | 合格 |
| Node.js 22 | 成功 | 成功 | 成功 | 成功 | 合格 |

すべてのジョブで、失敗時だけ保存する診断Artifactの処理はスキップされた。

## 6. G2判定

G2「開発構成」は通過と判定する。

根拠は次のとおり。

- Pull Request #22の最終headでNode.js 18、20、22の全ジョブが成功した。
- `npm run build`、`npm run verify`、`npm run size`がすべて成功した。
- build後の`dist`差分がなかった。
- Phase 2AのJavaScript正本と一方向buildが維持された。
- Phase 2Bの依存0件と容量報告専用化が維持された。
- package installを行わずに検査できた。
- ゲームコード、得点、ランキング通信、描画結果を変更していない。
- 成功した最終headがmainへマージされた。

## 7. 今回追加で判明した残存物

Phase 2A時点で`src/vite-env.d.ts`が残っていた。内容はCSS module宣言だけで、現在のJavaScript正本とHTMLからのCSS読込には不要だった。

G2検査が`.ts`残存を正しく検出したため、このファイルを削除した。ゲームの実行内容、物理、得点、描画には影響しない。

## 8. 未確認の範囲

G2では次を確認していない。

- iPhoneとiPadの実機動作
- WebGLの見た目と性能
- Canvas 2Dへの実切り替え
- rootと`dist`のブラウザ操作
- Codeberg Pagesの公開動作
- Supabaseの実通信
- 公式配置、反射、v3得点

これらは後続Phaseで確認する。

## 9. 次の作業

G2はmain上で通過済みである。次はPhase 3A「360×640固定論理座標」を開始できる。

Phase 3Aでは端末画面のピクセル数を物理座標へ使わず、入力と描画だけを360×640の論理領域へ変換する。得点式、公式配置、ランキング送信は同じPull Requestで変更しない。
