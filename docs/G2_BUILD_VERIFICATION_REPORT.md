# namioshi v3 G2 開発構成検証報告

- 対象リポジトリ: `chameleonjp-lab/namioshi`
- 基準ブランチ: `main`
- 基準コミット: `cf37cb040c5f1570ff489819b921b337843262fb`
- 検証ブランチ: `codex/namioshi-v3-g2-build-verification`
- 対象ゲート: G2「開発構成」
- 現在の状態: 自動検査追加済み、初回実行結果待ち

## 1. 目的

Phase 2AとPhase 2Bで作った開発構成を、GitHub上の独立した実行環境で再検証する。

確認する内容は次のとおり。

1. 外部パッケージをインストールせずにbuildできる。
2. JavaScript構文、import、公開物、安全検査が通る。
3. 容量報告が固定上限なしで完了する。
4. build後の`dist`がコミット済み内容と一致する。
5. Node.js 18、20、22で同じ検査が通る。

## 2. 自動検査

`.github/workflows/g2-build-verification.yml`を使用する。

各Node.js版で次を順に実行する。

```text
node --version
npm run build
npm run verify
npm run size
git diff --exit-code -- dist
```

`npm install`と`npm ci`は実行しない。現在の構成が標準Node.jsだけで成立することを直接確認するためである。

## 3. 合否条件

| 確認項目 | 合格条件 |
|---|---|
| build | `npm run build`が終了コード0 |
| verify | `npm run verify`が終了コード0 |
| size | `npm run size`が終了コード0。固定容量上限による失敗なし |
| 再現性 | build後の`git diff --exit-code -- dist`が終了コード0 |
| 対応Node.js | 18、20、22の3件がすべて成功 |
| 依存 | package install処理なし |

1件でも失敗した場合、G2は未通過とする。同じブランチとPull Requestで原因を修正し、新しいPull Requestへ作り直さない。

## 4. 実行結果

| 実行環境 | build | verify | size | dist再現性 | 判定 |
|---|---|---|---|---|---|
| Node.js 18 | 未確認 | 未確認 | 未確認 | 未確認 | 実行待ち |
| Node.js 20 | 未確認 | 未確認 | 未確認 | 未確認 | 実行待ち |
| Node.js 22 | 未確認 | 未確認 | 未確認 | 未確認 | 実行待ち |

初回GitHub Actions完了後、この表へ実際の結果と対象Runを記録する。

## 5. G2通過条件

次をすべて満たした時だけG2を通過とする。

- Node.js 18、20、22の全ジョブが成功する。
- build後の`dist`差分がない。
- Phase 2AのJavaScript正本と一方向buildが維持されている。
- Phase 2Bの依存0件と容量報告専用化が維持されている。
- ゲームコード、得点、ランキング通信、描画結果を変更していない。
- 検証結果をこの文書とレビュー表へ反映している。

## 6. 未確認の範囲

G2では次を確認しない。

- iPhoneとiPadの実機動作
- WebGLの見た目と性能
- Canvas 2Dへの実切り替え
- Codeberg Pagesの公開動作
- Supabaseの実通信
- 公式配置、反射、v3得点

これらは後続Phaseで確認する。

## 7. 次の作業

G2通過後、Phase 3A「360×640固定論理座標」を開始する。G2の自動検査が失敗または未完了の間は、Phase 3Aへ進まない。
