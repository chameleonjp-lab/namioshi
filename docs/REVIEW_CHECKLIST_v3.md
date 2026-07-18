# namioshi v3 レビュー・公開チェックリスト

確認欄は `[済]`、`[未確認]`、`[対象外]`、`[失敗]` のいずれかを使う。実機で確認していない項目を `[済]` にしない。

## 自動確認: 文書

- [済] 正本が明記されている
- [済] 現行実装とv3予定を区別している
- [済] 3MB上限をv3の受け入れ条件にしていない
- [済] index.html 1ファイル構成を強制していない
- [済] 実機未確認を確認済みにしていない
- [済] 不明なSupabase情報を推測していない

## 自動確認: 開発・ビルド

### Phase 2A 静的確認

- [済] `src`の実行コードを`.js`へ統一した
- [済] `src`に`.ts`と`.tsx`を残していない
- [済] 相対JavaScript importへ`.js`拡張子を付けた
- [済] CSSをJavaScriptからimportしていない
- [済] root `index.html`が`./src/ui/styles.css`と`./src/main.js`を参照する
- [済] `dist/index.html`が`./assets/ui/styles.css`と`./assets/main.js`を参照する
- [済] build前に`dist`を削除する
- [済] buildが`src`を加工せず`dist/assets`へ再帰コピーする
- [済] 疑似TypeScript変換と既存`dist`再利用をbuildから削除した
- [済] 不要な`src/types` placeholderと旧shaderファイルを削除した
- [済] コミット済み`src`と`dist/assets`の対応ファイルを同一内容にした
- [済] verifyにJavaScript構文、import解決、src/dist一致、HTML参照の検査を実装した

### Phase 2B 静的確認

- [済] `package.json`のdependenciesとdevDependenciesを削除した
- [済] `vendor/three`、`vendor/vite`、`vendor/typescript`を削除した
- [済] `vite.config.js`と`tsconfig.json`を削除した
- [済] 依存を記録していた`package-lock.json`を削除した
- [済] 旧`scripts/check-size.mjs`を削除した
- [済] `scripts/report-size.mjs`を追加した
- [済] `npm run size`から固定2.9MB失敗条件を削除した
- [済] 容量、ファイル数、大きいファイル、重複内容を報告する
- [済] `.gitignore`で`node_modules`、一時ファイル、`.env`系を除外する
- [済] verifyが不要依存と旧設定の再混入を拒否する
- [済] verifyが入口から参照されない公開ファイルを拒否する
- [済] 禁止パス検査が検査ファイル自身を誤検出しない

### G2 GitHub Actions定義

- [済] `.github/workflows/g2-build-verification.yml`を追加した
- [済] Pull Request、mainへのpush、手動実行で検査を起動する
- [済] Node.js 18、20、22を別ジョブで確認する
- [済] `npm install`と`npm ci`を実行しない
- [済] `npm run build`を実行する
- [済] `npm run verify`を実行する
- [済] `npm run size`を実行する
- [済] build後に`git diff --exit-code -- dist`を実行する
- [済] workflow権限を`contents: read`へ限定する
- [済] 検証結果を`docs/G2_BUILD_VERIFICATION_REPORT.md`へ記録する

### G2 実行確認

- [済] Node.js 18のbuildが成功する
- [済] Node.js 18のverifyが成功する
- [済] Node.js 18のsizeが成功する
- [済] Node.js 18のdist再現性確認が成功する
- [済] Node.js 20の全検査が成功する
- [済] Node.js 22の全検査が成功する
- [済] Pull Request #22の最終headで3ジョブすべてが成功する
- [済] build後の`dist`差分がない
- [済] `docs/G2_BUILD_VERIFICATION_REPORT.md`へ最終Run結果を反映した
- [済] G2「開発構成」を通過した

### Phase 3A 固定論理座標 静的確認

- [済] `LOGICAL_WIDTH=360`と`LOGICAL_HEIGHT=640`を一元定義した
- [済] `src/game/viewport.js`へ表示倍率、余白、座標変換をまとめた
- [済] `World.w / World.h`を常に360×640へ固定した
- [済] `World.reset()`から画面サイズ引数を削除した
- [済] resizeと画面回転相当の処理でWorldを作り直さない
- [済] `clientX / clientY`を論理座標へ変換してから`World.tap()`へ渡す
- [済] 論理領域外と余白上の入力を拒否する
- [済] `pointercancel`を処理する
- [済] WebGLとCanvas 2Dへ同じviewportを渡す
- [済] Device Pixel Ratioを描画解像度だけへ使う
- [済] `src`と`dist/assets`へ同じ固定座標実装を反映した
- [済] `tests/viewport.test.mjs`へ5件の自動試験を追加した
- [済] GitHub ActionsのNode.js 18、20、22で`npm test`を実行する定義を追加した

### Phase 3A 実行確認

- [未確認] Node.js 18でviewport試験5件が成功する
- [未確認] Node.js 20でviewport試験5件が成功する
- [未確認] Node.js 22でviewport試験5件が成功する
- [未確認] 320×568、375×812、390×844、1024×1366で同じ論理入力が同じ結果になる
- [未確認] 左上、中央、右下の変換誤差が0.25論理ピクセル以内である
- [未確認] 縦長画面の上下余白と横長画面の左右余白を拒否する
- [未確認] viewport変更で進行中Worldの状態が変わらない
- [未確認] `npm run build`、`npm run verify`、`npm run size`が成功する
- [未確認] build後の`dist`差分がない

### ブラウザ・実機確認

- [未確認] root `index.html`をローカルHTTPサーバーで起動できる
- [未確認] `dist/index.html`を静的HTTPサーバーで起動できる
- [未確認] iPhone SE級320×568で360×640全体を視認できる
- [未確認] iPhone Safariで余白タップが拒否される
- [未確認] 画面回転前後で進行中の見た目と操作が壊れない
- [未確認] WebGLで固定ゲーム領域と余白背景が正しく描かれる
- [未確認] Canvas 2Dで固定ゲーム領域と余白背景が正しく描かれる

## 自動確認: ゲーム

- [済] 10秒
- [済] 最大3タップ
- [未確認] 4回目を無視
- [未確認] 1入力1根波
- [未確認] 反射最大2回
- [未確認] 即時再反射がない
- [未確認] 同じrootTapIdとbeaconIdで重複加点しない
- [未確認] 公式は固定条件
- [未確認] 練習は送信しない
- [未確認] 理論上限を超えない

## 自動確認: 画面

- [済] HOME
- [済] RULES
- [済] COUNTDOWN
- [済] PLAYING
- [済] RESULT
- [済] ERROR
- [済] id重複なし
- [未確認] 320×568で横スクロールなし
- [未確認] safe-area対応
- [済] 開始時に名前入力欄へblur()を実行する
- [未確認] iPhone Safariで開始時にキーボードが閉じる
- [未確認] 結果画面のボタンが見切れない
- [未確認] 共有文末にゲームURL

## 自動確認: ランキング

- [未確認] game_slugはnamioshi
- [未確認] 共通submit_scoreを使用
- [未確認] apikeyヘッダー
- [未確認] Authorization: Bearerなし
- [未確認] secret keyなし
- [済] service_role keyなし
- [未確認] 4項目本文
- [未確認] CLIENT_VERSION
- [未確認] 公式だけ送信
- [未確認] 1プレイ1送信
- [未確認] playId
- [未確認] タイムアウト
- [済] 送信失敗でも結果画面が使える
- [未確認] 旧スコアとv3スコアを混ぜない
- [未確認] 実RPC疎通を推測で済にしない
- [未確認] public.games登録を推測で済にしない

## 自動確認: 描画と性能

- [未確認] WebGL実描画
- [未確認] Canvas 2Dフォールバック
- [未確認] タップ後50ms以内の視覚反応を目標
- [未確認] 継続30fps未満なし
- [未確認] 高更新端末でもゲーム速度不変
- [未確認] 毎フレーム不要な配列生成なし
- [未確認] 毎フレームlocation検索なし
- [未確認] 描画資源が周回ごとに増えない
- [未確認] WebGLコンテキスト消失対応
- [未確認] reduced motion
- [未確認] HIGH / MID / LOW
- [済] 総容量は報告するが固定上限で落とさない実装になっている

## 実機確認: 継続試験

- [未確認] 連続再挑戦10回
- [未確認] 30分連続稼働
- [未確認] バックグラウンド復帰10回
- [未確認] オフライン
- [未確認] 通信再接続
- [未確認] 通常より20％重い条件
- [未確認] 同じ公開候補版で3回連続合格

## 実機確認: 公開

- [未確認] Codeberg Pages
- [未確認] 公開URL
- [未確認] 実験場リンク
- [未確認] 詳細ランキング
- [未確認] シェアURL
- [未確認] Supabase設定
- [未確認] console errorなし
- [未確認] 旧公開物なし
- [未確認] ロールバック手順
- [未確認] 実機未確認項目なし
