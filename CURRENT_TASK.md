# CURRENT_TASK: namioshi v3 G2 開発構成の実行確認

## 今回の目的

Phase 2AとPhase 2Bで整えたJavaScript正本、依存0件、一方向build、容量報告専用化を、GitHub上の独立した実行環境で検証する。ゲームコード、得点、配置、画面、共有、ランキング通信、描画結果は変更しない。

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準ブランチ: `main`
- 基準コミット: `cf37cb040c5f1570ff489819b921b337843262fb`（Pull Request #21のマージ）
- 作業ブランチ: `codex/namioshi-v3-g2-build-verification`
- 対象ゲート: G2「開発構成」
- 前提: Phase 2AとPhase 2Bはmainへ反映済み
- 実機確認: 未完了

## 今回追加するもの

### GitHub Actions

`.github/workflows/g2-build-verification.yml`を追加する。

Node.js 18、20、22で、それぞれ次を実行する。

```text
node --version
npm run build
npm run verify
npm run size
git diff --exit-code -- dist
```

`npm install`と`npm ci`は実行しない。外部パッケージなしで成立する構成を、そのまま検証する。

### 検証報告

`docs/G2_BUILD_VERIFICATION_REPORT.md`を追加し、次を記録する。

- 対象コミット
- 実行内容
- Node.js 18、20、22の結果
- build、verify、size、dist再現性
- G2の合否
- 未確認範囲
- 次のPhase開始条件

## 変更しない重要部分

- `src/**`
- `dist/**`
- root `index.html`
- `scripts/build.mjs`
- `scripts/verify-dist.mjs`
- `scripts/report-size.mjs`
- `package.json`
- 10秒、最大3タップ
- 波速度、寿命、反射、得点、コンボ
- ビーコンとガラス片のランダム配置
- HOME / RULES / COUNTDOWN / PLAYING / RESULT / ERROR
- 共有文と共有フォールバック
- Supabase URL、Publishable key、Authorizationヘッダー、送信本文
- WebGLとCanvas 2Dの描画処理

自動検査が既存コードの問題を検出した場合は、G2未通過として停止する。検査を通すためにゲームコードや別Phaseの仕様を先回りして変更しない。

## 自動検査の合格条件

- Node.js 18、20、22の3ジョブがすべて成功する。
- `npm run build`が成功する。
- `npm run verify`が成功する。
- `npm run size`が固定容量上限なしで成功する。
- build後の`git diff --exit-code -- dist`が成功する。
- package install処理がない。
- 実行結果を検証報告とレビュー表へ反映する。

## 現在の検証状態

- GitHub Actions定義: 追加済み
- 検証報告のひな型: 追加済み
- Node.js 18: 実行結果待ち
- Node.js 20: 実行結果待ち
- Node.js 22: 実行結果待ち
- G2判定: 未確定

初回のGitHub Actionsが完了するまで、実行項目を`[済]`へ変更しない。

## 失敗時の対応

検査が失敗した場合は、同じ作業ブランチと同じPull Requestで原因を修正する。新しいPull Requestへ作り直さない。

原因がPhase 2AまたはPhase 2Bの構成にある場合だけ、必要最小限のbuild・verify・size・文書を修正する。ゲームコード、ランキング、描画、固定座標には進まない。

## 戻し方

この作業を取り消す場合は、G2検証用Pull Requestをrevertする。追加対象は自動検査と文書だけであり、ゲーム仕様、公開スコア、Supabaseデータの戻し作業は不要。

## 次の作業

G2通過後、Phase 3A「360×640固定論理座標」を開始する。G2の検査が失敗または未完了の間はPhase 3Aへ進まない。
