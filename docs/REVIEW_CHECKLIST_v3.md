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

- [済] Node.js 18でviewport試験5件が成功する
- [済] Node.js 20でviewport試験5件が成功する
- [済] Node.js 22でviewport試験5件が成功する
- [済] 320×568、375×812、390×844、1024×1366で同じ論理入力が同じ結果になる
- [済] 左上、中央、右下の変換誤差が0.25論理ピクセル以内である
- [済] 縦長画面の上下余白と横長画面の左右余白を拒否する
- [済] viewport変更で進行中Worldの状態が変わらない
- [済] `npm run build`、`npm run verify`、`npm run size`が成功する
- [済] build後の`dist`差分がない
- [済] `docs/PHASE3A_VIEWPORT_REPORT.md`へRun #10の結果を記録した
- [済] Pull Request #24の最終headで全ジョブが成功した

### Phase 3B 公式配置比較ラボ 静的確認

- [済] 同じルール版で候補A、B、Cを定義した
- [済] 各候補がビーコン3個とガラス片4個を持つ
- [済] 候補IDと要素IDの重複を検査する
- [済] 候補データに`selected`または`official`を持たせていない
- [済] 121タップ地点と56到達時刻を全候補へ共通使用する
- [済] 共通3タップ地点を全候補へ同じ順序で使う
- [済] ガラス片を有限の線分として反射経路を調べる
- [済] 直接、壁、ガラス、2回反射を同じ方法で分析する
- [済] 候補指紋と分析結果を保存し、変更時に差を検出する
- [済] `tools/layout-lab.html`で候補を切り替えて比較できる
- [済] `docs/OFFICIAL_LAYOUT_STUDY_v3.md`へ方法、結果、限界、人の確認項目を記録した
- [済] 比較用ファイルを`tools`へ置き、本番`src`と`dist`を変更していない
- [済] GitHub Actionsへ`npm run analyze:layouts`を追加した

### Phase 3B 実行確認

- [済] Node.js 18で全単体試験と配置分析が成功した
- [済] Node.js 20で全単体試験と配置分析が成功した
- [済] Node.js 22で全単体試験と配置分析が成功した
- [済] 3候補の指紋が一意で保存結果と一致する
- [済] 3候補すべてで直接、壁、ガラス、2回反射が3つのビーコンへ届く候補を持つ
- [済] 共通3タップの参考得点がv3候補上限3240以下である
- [済] `npm run build`、`npm run verify`、`npm run size`が成功する
- [済] build後の`dist`差分がなく、本番公開物を変更していない
- [済] `G2 Build Verification` Run #15が成功した
- [済] 文書更新後のhead `b490329a58fbeece17acab526b53b666095acafe`でRun #18が成功した

### Phase 3B.1 選定資料 静的確認

- [済] 横並び比較SVGを追加した
- [済] スマートフォン向け縦並び比較SVGを追加した
- [済] 両SVGを候補データと保存済み分析結果から生成する
- [済] ビーコンの初期位置と10秒移動経路を表示する
- [済] ガラス片、共通3タップ、主要な比較値を表示する
- [済] 近接警告対象のガラス片を別の色で示す
- [済] `docs/OFFICIAL_LAYOUT_DECISION_GUIDE_v3.md`へ事実、意見、注意点、選定後の手順を記録した
- [済] 候補Cを初回実機確認の優先候補として推薦した
- [済] 候補Cの推薦を採用決定と表現していない
- [済] Phase 3B.1の比較履歴では採用状態を`human-decision-pending`のまま維持した
- [済] `npm run render:layouts`と生成用コマンドを追加した
- [済] GitHub ActionsへSVG生成一致検査を追加した
- [済] 選定ガイドとSVGの内容を単体試験へ追加した
- [済] 本番`src`と`dist`を変更していない

### Phase 3B.1 実行確認

- [済] Node.js 18で`npm run render:layouts`が成功した
- [済] Node.js 20で`npm run render:layouts`が成功した
- [済] Node.js 22で`npm run render:layouts`が成功した
- [済] 選定ガイドと比較SVGの単体試験が成功した
- [済] 既存の配置分析結果が変わっていない
- [済] build後の`dist`差分がなく、本番公開物を変更していない
- [済] Pull Request #26のhead `6fe2163ff508a7f7c1a2602cdbebc349f19e92c7`でRun #22が成功した

### Phase 3C 公式・練習モード 静的確認

- [済] 候補C・開港型を公式配置へ固定した
- [済] 公式配置ID、指紋、ルール版を固定した
- [済] 公式初期化で`Math.random()`を呼ばない
- [済] 練習ランダムを公式配置から分離した
- [済] 練習をランキング候補外にした
- [済] Phase 5まで公式と練習の送信を停止した
- [済] 停止中の送信関数が通信前に拒否する
- [済] 公式と練習以外のモード値を拒否する
- [済] RESULTに同じモードの再挑戦とモード再選択の両方がある
- [済] HOME、RULES、COUNTDOWNで前回盤面を透過表示しない
- [済] Phase 3C follow-upの単体試験21件がローカルで成功した
- [済] Pull Request #29のhead `1f9428b91a2b7afea0d104fdb71dca477dbfb484`でNode.js 18、20、22の全検査が成功した
- [済] Pull Request #29をmerge commit `95f80a2eef4325e736835192864943d4c311e2dd`としてmainへ反映した

### Pull Request #31〜#35 音と既知問題の補修

- [済] 効果音の初期値を「なし」にし、利用者が任意で有効にできる
- [済] 判定4段階、壁反射、ガラス反射、2回反射を含む10種類の効果音を呼び分ける
- [済] 音声再開失敗を未処理エラーにせず、画面非表示時に再生中・予約中の音を止める
- [済] 同じ1回の壁接触から反射通知を二重に出さない
- [済] 同じ1回のガラス接触から反射通知を二重に出さない
- [済] 5.8秒と0.001秒では継続し、0秒以下で終了する
- [済] Pull Request #33〜#35がmainへマージ済みである
- [済] Pull Request #33〜#35のNode.js 18、20、22の全検査が成功した
- [済] 後続実装で30秒・6タップへ変更し、初回の時間制限なし案内を追加した
- [済] 反射板の役割を画面上の説明、発光、両端の印、反射方向の目印で示した
- [済] 直接20、壁100、反射板180、2回反射300の基礎点を実装した
- [済] 同じrootTapIdとbeaconIdでは最高候補だけを採用し、差額更新と結果内訳を確認した
- [未確認] iPhoneで判定4段階と反射音を聞き分けられる
- [未確認] iPhoneで6回目のタップ後も約30秒まで結果画面へ移らない
- [未確認] iPhoneでバックグラウンド移動と復帰を10回繰り返しても古い音が鳴らない

### Phase 3B 人の確認

- [未確認] `tools/layout-lab.html`を実ブラウザで開ける
- [未確認] GitHub上で横並び比較SVGを開ける
- [未確認] iPhoneでスマートフォン向け縦比較SVGを読める
- [未確認] iPhone SE級で候補Aのビーコンとガラス片を区別できる
- [未確認] iPhone SE級で候補Bのビーコンとガラス片を区別できる
- [未確認] iPhone SE級で候補Cのビーコンとガラス片を区別できる
- [未確認] 3タップの選択肢が一つに固定されすぎていない
- [未確認] ビーコンとガラスの重なりを理不尽に感じない
- [済] ユーザーが候補Cを実装対象として明示した

### ブラウザ・実機確認

- [済] root `index.html`をローカルHTTPサーバーとChromium 149で起動できる
- [済] `dist/index.html`を静的HTTPサーバーとChromium 149で起動できる
- [済] 320×568相当のローカルChromiumで公式、練習、公式へ再読み込みなしで移動できる
- [済] ローカルChromium確認中のSupabase通信、ページエラー、console errorが0件である
- [未確認] iPhone SE級320×568で360×640全体を視認できる
- [未確認] iPhone Safariで余白タップが拒否される
- [未確認] 画面回転前後で進行中の見た目と操作が壊れない
- [未確認] WebGLで固定ゲーム領域と余白背景が正しく描かれる
- [未確認] Canvas 2Dで固定ゲーム領域と余白背景が正しく描かれる

## 自動確認: ゲーム

- [済] 自動境界試験で、6タップ後に波がなくても30秒未満では継続し、0秒で終了する
- [済] 最大6タップ
- [未確認] 4回目を無視
- [未確認] 1入力1根波
- [未確認] 反射最大2回
- [済] 反射元の壁・ガラスを処理済みとして引き継ぎ、同じ1回の接触を二重通知しない
- [未確認] 同じ面を再判定できる移動距離と正式な`surfaceHistory`を実装する
- [失敗] 固定入力診断で、ガラス有限線分の外側でも延長線付近で反射する
- [失敗] 固定入力診断で、同じ時間の反射イベントが60分割37件、120分割36件になる
- [未確認] 同じ候補C・同じ3タップ・同じ5秒で、60Hz相当と120Hz相当の得点が一致する
- [失敗] Worldをresetしても波IDの連番が同じ初期値へ戻らない
- [未確認] 子波が親の年齢と寿命を正しく引き継ぐ
- [未確認] 24波上限で未処理波を飛ばさない
- [済] 同じrootTapIdとbeaconIdで重複加点しない
- [済] 低い候補から高い候補へ更新した時に差額だけを加点する
- [済] 結果画面の直接、壁反射、反射板、2回反射の内訳合計が総得点と一致する
- [済] 公式は候補Cの固定条件
- [済] 練習は送信しない
- [未確認] 理論上限を超えない

## 自動確認: 画面

- [済] HOME
- [済] RULES
- [済] COUNTDOWN
- [済] PLAYING
- [済] RESULT
- [済] ERROR
- [済] id重複なし
- [済] 320×568相当のローカルChromiumでHOMEに横スクロールがない
- [未確認] safe-area対応
- [済] 開始時に名前入力欄へblur()を実行する
- [未確認] iPhone Safariで開始時にキーボードが閉じる
- [未確認] 結果画面のボタンが見切れない
- [済] 結果画面からモード選択へ戻る静的導線がある
- [済] 初回プレイに時間制限なしの反射板案内がある
- [未確認] iPhoneで反射板の表示と接触時の光を理解できる
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
