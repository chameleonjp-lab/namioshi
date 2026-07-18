# CURRENT_TASK: namioshi v3 Phase 2B 不要依存と旧容量制限の削除

## 今回の目的

Phase 2Aで確立したJavaScript正本と一方向ビルドを維持したまま、実行に使っていないTypeScript・Vite・Three.js代替登録、古い設定、固定2.9MB失敗条件を削除する。ゲーム物理、得点、配置、画面、共有、ランキング通信、描画結果は変更しない。

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準ブランチ: `main`
- 基準コミット: `f7a7c0069241f1fe01117a53103a050e4e321470`（Pull Request #20のマージ）
- 作業ブランチ: `codex/namioshi-v3-phase2b-build-cleanup`
- 前提ゲート: G1完了、Phase 2Aはmainへ反映済み
- 実機確認: 未完了

## 調査結果

Phase 2A後の実行コードとbuildは、`vendor`、Vite、TypeScript、Three.jsを参照していない。一方、次の不要物が残っていた。

- `package.json`の`three`、`typescript`、`vite`登録
- それらを記録した`package-lock.json`
- `vendor/three/**`
- `vendor/typescript/**`
- `vendor/vite/**`
- `vite.config.js`
- `tsconfig.json`
- 2,900,000バイト超過時に失敗する`scripts/check-size.mjs`
- `node_modules`や秘密設定を除外する`.gitignore`の不足

## 変更内容

### 依存と旧設定

- `package.json`から`dependencies`と`devDependencies`を削除する。
- Node.js 18以上で、外部パッケージをインストールせずbuild・verify・sizeを実行できる構成にする。
- `package-lock.json`を削除する。依存を追加する将来の変更では、同じPull Requestで再作成する。
- `vendor/three`、`vendor/typescript`、`vendor/vite`を削除する。
- `vite.config.js`と`tsconfig.json`を削除する。

### 容量報告

- `scripts/check-size.mjs`を削除する。
- `scripts/report-size.mjs`を追加する。
- `npm run size`は次を報告する。
  - `dist`全体のバイト数とKiB
  - ファイル数
  - 容量が大きい上位10ファイル
  - 同じ内容を持つ重複ファイル群
- 固定容量を超えたことだけを理由に失敗しない。
- `dist`が存在しない場合は、先にbuildが必要なため失敗する。

### 検査

`scripts/verify-dist.mjs`へ次を追加・維持する。

- `vendor`、Vite設定、TypeScript設定、旧容量スクリプトの再混入を拒否する。
- `package.json`へ未使用依存が戻った場合に拒否する。
- package scriptsが正式なbuild・verify・sizeを指すことを確認する。
- 固定2.9MB失敗条件が戻っていないことを確認する。
- `dist/index.html`からJavaScript importとCSS参照を追跡し、参照されない公開ファイルを拒否する。
- source map、古い生成物、環境依存パス、secret、service_role、スコア表への直接参照を拒否する。
- 禁止パス検査が検査ファイル自身を誤検出しないよう、禁止文字列は分割して組み立てる。

### ローカル不要物

`.gitignore`を追加し、次を追跡対象外にする。

- `node_modules/`
- OSの一時ファイル
- ログ
- coverageとcache
- 一時ディレクトリ
- `.env`系の秘密設定

## 変更しない重要部分

- `src/**`
- `dist/**`
- root `index.html`
- `scripts/build.mjs`
- 10秒、最大3タップ
- 波速度、寿命、反射、得点、コンボ
- ビーコンとガラス片のランダム配置
- HOME / RULES / COUNTDOWN / PLAYING / RESULT / ERROR
- カウントダウン時間
- 共有文と共有フォールバック
- Supabase URL、Publishable key、Authorizationヘッダー、送信本文
- WebGLシェーダーと描画処理
- Canvas 2D描画処理

## 検証状態

GitHub連携による静的確認では、不要依存と旧設定の削除、package scripts、容量報告化、`.gitignore`、検査コードの更新を確認する。

この実行環境ではGitHubのローカルcloneがDNS制限で失敗したため、次はDraft Pull Request上の別実行環境で確認するまで`[未確認]`とする。

- `npm run build`
- `npm run verify`
- `npm run size`
- build後に`git diff --exit-code -- dist`が成功すること
- Node.js 18、20、22の少なくとも1つでbuildとverifyが成功すること
- root `index.html`のローカルHTTP起動
- `dist/index.html`の静的HTTP起動
- iPhone/iPad実機
- Codeberg Pages
- 実Supabase通信

## 完了条件

- package依存が0件である。
- `vendor`、`vite.config.js`、`tsconfig.json`がない。
- 旧`package-lock.json`と旧`scripts/check-size.mjs`がない。
- `npm run size`が報告専用で、固定上限によって失敗しない。
- buildとverifyが外部パッケージなしで実行できる。
- 同一コミットから同じ`dist`を生成できる。
- Phase 2AのJavaScript正本と`src`・`dist`一致契約を維持する。
- ゲームコードと公開ゲームの挙動を変更していない。
- 実施していない確認を成功扱いにしない。

## 戻し方

このPhaseだけを取り消す場合は、Phase 2BのPull Requestをrevertする。ゲーム仕様、公開スコア、Supabaseデータの変更は含まないため、データベースの戻し作業は不要。

## 次の作業

Phase 2Aと2Bのbuild・verifyを別実行環境で確認し、G2「開発構成」を通過させる。その後、Phase 3A「360×640固定論理座標」を開始する。G2確認前にPhase 3Aへ進まない。
