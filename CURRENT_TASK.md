# CURRENT_TASK: namioshi v3 G2完了記録の同期

## 今回の目的

Pull Request #22で完了したG2「開発構成」の最終実行結果を、main上の検証報告とレビュー表へ正確に同期する。ゲームコード、公開物、build、得点、配置、画面、共有、ランキング通信、描画結果は変更しない。

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準ブランチ: `main`
- 基準コミット: `5ddd92274eb61ba110f05bbd59d8fa15787533c8`（Pull Request #22のマージ）
- 作業ブランチ: `docs/namioshi-g2-final-sync`
- 対象ゲート: G2「開発構成」
- G2判定: 通過済み
- 実機確認: 未完了

## 確認済みの最終結果

Pull Request #22の最終headは`e3fdc069f9892faa5ee5b89c6f487aa0611ec586`である。

このheadに対する`G2 Build Verification` Run #6、Run ID `29635330869`は成功した。

Node.js 18、20、22の各ジョブで、次がすべて成功した。

```text
npm run build
npm run verify
npm run size
git diff --exit-code -- dist
```

外部パッケージをインストールする`npm install`と`npm ci`はworkflowに含めていない。

## G2で修正した問題

### GitHub ActionsのNode.js設定

初回は`actions/setup-node`へ無効な`cache: false`を渡して失敗した。`package-manager-cache: false`へ修正した。

### TypeScript残存

buildが`src/vite-env.d.ts`を検出して停止した。このファイルは現在のJavaScript正本とHTMLからのCSS読込では使わないため、同じPull Request内で削除した。

検査を弱めたり、失敗を成功扱いにしたりせず、原因を修正した後に再実行した。

## 今回変更する文書

- `CURRENT_TASK.md`
- `docs/G2_BUILD_VERIFICATION_REPORT.md`
- `docs/REVIEW_CHECKLIST_v3.md`

## 今回変更しないもの

- `.github/workflows/g2-build-verification.yml`
- `src/**`
- `dist/**`
- root `index.html`
- `package.json`
- `scripts/**`
- 10秒、最大3タップ
- 波、反射、得点、コンボ、配置
- HOME / RULES / COUNTDOWN / PLAYING / RESULT / ERROR
- 共有文と共有フォールバック
- Supabase URL、Publishable key、送信ヘッダー、送信本文
- WebGLとCanvas 2D

## 未確認の範囲

- root `index.html`のブラウザ操作
- `dist/index.html`のブラウザ操作
- iPhoneとiPad実機
- WebGLの実表示と性能
- Canvas 2Dへの実切り替え
- Codeberg Pages
- Supabase実通信

これらをG2の成功として扱わない。

## 完了条件

- Pull Request #22最終headのRun #6成功を文書へ記録する。
- Node.js 18、20、22の各検査を`[済]`へ更新する。
- G2を通過済みとして記録する。
- 実機と本番環境の未確認項目を残す。
- 文書以外を変更しない。
- この同期Pull Requestの最新headでもG2 workflowが成功する。

## 戻し方

この同期だけを取り消す場合は、この文書同期Pull Requestをrevertする。ゲームコード、公開物、Supabaseデータの戻し作業は不要。

## 次の作業

この同期Pull Requestがmainへマージされた後、Phase 3A「360×640固定論理座標」を開始する。

Phase 3Aでは固定座標、画面への拡大縮小、入力座標変換だけを扱う。得点式、公式配置、ランキング送信、WebGLの高品質化は同じPull Requestで変更しない。
