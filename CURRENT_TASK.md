# CURRENT_TASK: namioshi v3 Phase 2A JavaScript正本への統一

## 今回の目的

実質JavaScriptだった`src/**/*.ts`と疑似TypeScript変換を廃止し、ブラウザがそのまま読める`src/**/*.js`を正本にする。ゲーム物理、得点、配置、画面状態、共有、ランキング契約、WebGL描画結果、Canvas 2D描画結果は変更しない。

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準ブランチ: `main`
- 基準コミット: `0dc1991ebdfc9b76442a6e2afea4fcb2ca9134e0`（Pull Request #19のマージ）
- 作業ブランチ: `codex/namioshi-v3-phase2a-js-source`
- 前提ゲート: G1完了、実機確認は未完了

## 変更範囲

### JavaScriptへ移行

- `src/main.ts` → `src/main.js`
- `src/config.ts` → `src/config.js`
- `src/core/audio.ts` → `src/core/audio.js`
- `src/game/world.ts` → `src/game/world.js`
- `src/render/canvas.ts` → `src/render/canvas.js`
- `src/render/webgl.ts` → `src/render/webgl.js`
- `src/services/ranking.ts` → `src/services/ranking.js`
- `src/services/share.ts` → `src/services/share.js`

### 不要ファイルを削除

- `src/types/index.ts`
- `src/render/shaders/water.ts`
- 対応する古い`dist`生成物

両ファイルは現行実行コードから参照されていないことを確認したうえで削除する。

### 開発入口と公開入口

- root `index.html`は`./src/ui/styles.css`と`./src/main.js`を読む。
- `dist/index.html`は`./assets/ui/styles.css`と`./assets/main.js`を読む。
- URLのサブパスをHTMLへ固定せず、相対パスでローカルHTTP配信とCodeberg Pagesの両方へ対応する。

### build

`scripts/build.mjs`は次だけを行う。

1. `src`内に`.ts`または`.tsx`があれば失敗する。
2. 既存`dist`を削除する。
3. `src`を加工せず`dist/assets`へ再帰コピーする。
4. 公開用`dist/index.html`を生成する。

TypeScript shim、疑似変換、正規表現によるコード書き換え、ハードコードしたソース一覧、既存`dist`の再利用は行わない。

### verify

`scripts/verify-dist.mjs`は最低限、次を検査する。

- `.ts`と`.tsx`の残存
- JavaScriptのモジュール構文
- 相対importの`.js`拡張子と参照先
- bare importと外部依存の混入
- `src`と`dist/assets`のファイル一覧および内容一致
- rootとdistのHTML参照
- source map、secret、service_role、直接ランキング書き込み、古い生成物の混入
- 環境依存の絶対パス

## 変更しない重要部分

- 10秒、最大3タップ
- 波速度、寿命、反射、得点、コンボ
- ビーコンとガラス片のランダム配置
- HOME / RULES / COUNTDOWN / PLAYING / RESULT / ERROR
- カウントダウン時間
- 共有文と共有フォールバック
- Supabase URL、Publishable key、送信ヘッダー、送信本文
- WebGLシェーダーと描画処理
- Canvas 2D描画処理
- `package.json`、`package-lock.json`、`vendor/**`、Vite設定、TypeScript設定
- 旧2.9MB失敗条件

不要依存と旧容量制限はPhase 2Bで別に変更する。

## 検証状態

GitHub連携を通した静的確認では、JavaScript正本、`.js`付き相対import、再帰コピー式build、相対HTML参照、旧`.ts`削除を確認する。コマンド実行環境による次の確認は、Draft Pull Request上のCIまたはレビュー環境で実施するまで未確認とする。

- `npm run build`
- `npm run verify`
- `npm run size`
- ローカルHTTPサーバーでの起動
- iPhone/iPad実機
- Codeberg Pages
- 実Supabase通信

## 完了条件

- `src`に`.ts`と`.tsx`がない。
- root `index.html`が`src/main.js`とCSSを直接参照する。
- buildが疑似TypeScript変換を使わない。
- buildが`src`を加工せず再帰コピーする。
- `src`と`dist/assets`の対応内容が一致する。
- 相対importがすべて解決する。
- G1の画面と共有処理を維持する。
- ゲームの数値、条件式、表示文、関数呼び出し順を変更していない。
- 実施できない検証を成功扱いにしない。

## 戻し方

このPhaseだけを取り消す場合は、Phase 2AのPull Requestをrevertする。ゲーム仕様やランキングデータの移行は含まないため、データベースの戻し作業は不要。

## 次の作業

Phase 2B「不要依存と旧容量制限の削除」。Phase 2Aがレビューされ、buildとverifyが通るまで開始しない。