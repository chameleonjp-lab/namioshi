# CURRENT_TASK: namioshi v3 G2 開発構成の実行確認

## 今回の目的

Phase 2AとPhase 2Bで整えたJavaScript正本、依存0件、一方向build、容量報告専用化を、GitHub上の独立した実行環境で検証する。ゲームコード、得点、配置、画面、共有、ランキング通信、描画結果は変更しない。

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準ブランチ: `main`
- 基準コミット: `cf37cb040c5f1570ff489819b921b337843262fb`（Pull Request #21のマージ）
- 作業ブランチ: `codex/namioshi-v3-g2-build-verification`
- 対象Pull Request: `#22`
- 対象ゲート: G2「開発構成」
- 前提: Phase 2AとPhase 2Bはmainへ反映済み
- 実機確認: 未完了

## 追加した自動検査

`.github/workflows/g2-build-verification.yml`を追加した。

Node.js 18、20、22で、それぞれ次を実行する。

```text
node --version
npm run build
npm run verify
npm run size
git diff --exit-code -- dist
```

`npm install`と`npm ci`は実行しない。外部パッケージなしで成立する構成を、そのまま検証する。

失敗時は`g2-build.log`を1日だけArtifactへ保存する。成功時は診断Artifactを作らない。

## 実行結果

初回全成功Run:

```text
workflow: G2 Build Verification
run number: 4
run id: 29635225175
commit: f6f0ab01f8715653ac5962bbe05d511a60fd688d
```

結果:

| 実行環境 | build | verify | size | dist再現性 |
|---|---|---|---|---|
| Node.js 18 | 成功 | 成功 | 成功 | 成功 |
| Node.js 20 | 成功 | 成功 | 成功 | 成功 |
| Node.js 22 | 成功 | 成功 | 成功 | 成功 |

詳細は`docs/G2_BUILD_VERIFICATION_REPORT.md`へ記録した。

## 失敗と修正

### Run #1

`actions/setup-node`へ`cache: false`を渡していたため失敗した。現在の入力契約に合わせ、`package-manager-cache: false`へ修正した。

### Run #2・#3

`npm run build`が`src/vite-env.d.ts`の残存を検出して停止した。診断Artifactで原因を確認し、現在のJavaScript構成で使っていない型宣言を削除した。

検査を弱めたり、失敗を成功扱いにしたりせず、同じブランチとPull Requestで原因を修正した。

## G2判定

G2「開発構成」は通過と判定する。

- Node.js 18、20、22の3ジョブが成功した。
- `npm run build`が成功した。
- `npm run verify`が成功した。
- `npm run size`が固定容量上限なしで成功した。
- build後の`dist`差分がなかった。
- package install処理を使っていない。
- Phase 2AのJavaScript正本とPhase 2Bの依存0件を維持した。

この文書更新後のPull Request最新headでも、同じworkflowが成功していることをマージ前に確認する。

## 変更しなかった重要部分

- ゲームの`src/**/*.js`
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

例外として、buildを阻止していた未使用の`src/vite-env.d.ts`だけを削除した。これは実行コードではない。

## 未確認の範囲

- root `index.html`のブラウザ操作
- `dist/index.html`のブラウザ操作
- iPhoneとiPad実機
- WebGLの実表示と性能
- Canvas 2Dへの実切り替え
- Codeberg Pages
- Supabase実通信

これらをG2の成功として扱わない。

## 戻し方

この作業を取り消す場合は、Pull Request #22をrevertする。追加対象は自動検査、G2文書、未使用型宣言の削除だけであり、ゲーム仕様、公開スコア、Supabaseデータの戻し作業は不要。

## 次の作業

Pull Request #22がmainへマージされた後、Phase 3A「360×640固定論理座標」を開始する。

Phase 3Aでは固定座標、画面への拡大縮小、入力座標変換だけを扱う。得点式、公式配置、ランキング送信、WebGLの高品質化は同じPull Requestで変更しない。
