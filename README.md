# namioshi

暗い水面に波を押し出し、壁や反射板の反射を使って3つのビーコンに波を重ねるゲームです。最大30秒ですが、根波10回と残りの波の精算が終われば早く結果へ進みます。公開先候補はGitHub Pagesの`https://chameleonjp-lab.github.io/namioshi/`です。公開判定は未確認のまま管理します。

## 現行main（PR #74統合後）

現行mainは、根の波10回、反射後の有限弧タップ、反射後の波の最大10秒寿命、プレイ中説明の任意開閉を含みます。盤面では未使用の黄色い反射弧を補助表示し、実際に描画できる有限弧がある間だけ「弧に重ねてタップする」案内を表示します。ゲーム側・入力・Canvas 2D・WebGLは同じ可視反射弧判定を使います。hard ceilingは11200点（経路10800点＋反射波タップ最大400点）です。競技ルールは`namioshi-v3-reflection-wave-lifetime-005`、client versionは`namioshi-v3.5.0-official006`、seasonは`prelaunch-v5`です。旧ルールの端末ベストやランキング記録は新ルールへ移行しません。

効果音を有効にした場合、タップ＝波紋、壁・反射板＝返る波、ビーコン命中＝水しぶき、得点確定＝水滴、RESULT＝静かな水面という水系の短い合成音を重ねます。初期設定オフと、音なしでも読める画面文言は維持します。

反射後の波の輪へタイミングよくタップすると、根波ごとに1回だけ深度1は10〜20点、深度2は20〜40点を加点します。輪からの距離で精度を決め、通常の経路台帳とは別の内訳へ記録します。

PR #73で通常波の約3秒寿命と10回後の精算を追加し、PR #77で反射後の波だけ最大10秒へ延長しました。反射波が残る間は精算を待ちます。得点式とhard ceilingは変更しません。

## v3仕様文書

v3は段階的に実装しています。文書があることだけを完成の証拠として扱いません。

- 現行ゲーム仕様の唯一の正本: [`docs/SPEC_v3.md`](docs/SPEC_v3.md)
- 初期要求の背景資料: [`docs/REQUIREMENTS_v3.md`](docs/REQUIREMENTS_v3.md)
- 初期の段階別計画（歴史資料）: [`docs/IMPLEMENTATION_PLAN_v3.md`](docs/IMPLEMENTATION_PLAN_v3.md)
- 現在の工程と状態: [`docs/MASTER_COMPLETION_PLAN_v3.md`](docs/MASTER_COMPLETION_PLAN_v3.md)
- 公式配置候補の比較: [`docs/OFFICIAL_LAYOUT_STUDY_v3.md`](docs/OFFICIAL_LAYOUT_STUDY_v3.md)
- 公式配置の選定ガイド: [`docs/OFFICIAL_LAYOUT_DECISION_GUIDE_v3.md`](docs/OFFICIAL_LAYOUT_DECISION_GUIDE_v3.md)
- 公式配置の選定記録: [`docs/OFFICIAL_LAYOUT_SELECTION_v3.md`](docs/OFFICIAL_LAYOUT_SELECTION_v3.md)
- Phase 3Cマージ後監査: [`docs/POST_PHASE3C_AUDIT.md`](docs/POST_PHASE3C_AUDIT.md)
- レビュー・公開確認: [`docs/REVIEW_CHECKLIST_v3.md`](docs/REVIEW_CHECKLIST_v3.md)
- Supabase Phase 5A監査: [`docs/SUPABASE_AUDIT_v3.md`](docs/SUPABASE_AUDIT_v3.md)
- 敵対的検証後の回復計画: [`docs/PHYSICS_SCORE_INTEGRITY_RECOVERY_PLAN_v3.md`](docs/PHYSICS_SCORE_INTEGRITY_RECOVERY_PLAN_v3.md)
- Phase 6B 画面・支援機能: [`docs/PHASE6B_SCREEN_ACCESSIBILITY_REPORT.md`](docs/PHASE6B_SCREEN_ACCESSIBILITY_REPORT.md)
- Phase 7A 描画土台最適化: [`docs/PHASE7A_RENDER_FOUNDATION_REPORT.md`](docs/PHASE7A_RENDER_FOUNDATION_REPORT.md)
- Phase 7C 音・振動: [`docs/PHASE7C_AUDIO_HAPTICS_REPORT.md`](docs/PHASE7C_AUDIO_HAPTICS_REPORT.md)
- Phase 8A 自動試験: [`docs/PHASE8A_AUTOMATED_TEST_REPORT.md`](docs/PHASE8A_AUTOMATED_TEST_REPORT.md)
- Phase 8B 実機検収: [`docs/PHASE8B_DEVICE_TEST_REPORT_v3.md`](docs/PHASE8B_DEVICE_TEST_REPORT_v3.md)

v3では3MBを受け入れ上限にしません。容量は報告値として扱い、入力反応、フレーム時間、継続動作、実機確認を優先します。複数ファイルとES Modulesを正式に使用します。

## 開発構成

`src`が正本です。実行コードはブラウザがそのまま読めるJavaScriptで、相対importには`.js`拡張子を明記しています。

- 開発用入口: `index.html`
- 開発用JavaScript: `src/main.js`
- 開発用CSS: `src/ui/styles.css`
- 公開用入口: `dist/index.html`
- 公開用ファイル: `dist/assets/**`

ビルドと検査には標準Node.js 18以上だけを使います。外部パッケージを使っていないため、`npm install`は不要です。

```bash
npm run build
npm test
npm run analyze:layouts
npm run analyze:strategy
npm run render:layouts
npm run verify
npm run size
```

`npm run build`は`dist`を削除した後、`src`を加工せず`dist/assets`へ再帰コピーし、公開用`dist/index.html`を生成します。

`npm test`は、固定論理座標、公式配置候補、候補Cの選定記録、公式・練習モードの分離、共有経路、画面導線、描画復旧を確認します。

`npm run analyze:layouts`は、3つの配置候補を同じ121地点、同じ56到達時刻、同じ3地点の参考タップで再計算し、保存済み結果と一致するか確認します。これは配置比較用の固定条件で、通常プレイのタップ上限とは別です。

`npm run analyze:strategy`は、現行競技ルールについて、設計入力と同じ時刻列を使うcalibration 1,000試行と独立holdout 1,000試行、同地点の境界込み探索、2地点交互baseline、設計fixture、20/30/60/120Hzの一致を保存済みsnapshotと照合します。配置比較時の波速165の履歴は上書きしません。

`npm run render:layouts`は、候補データと分析値から生成した比較SVGが最新か確認します。

`npm run verify`は、JavaScript構文、相対importの解決、`src`と`dist/assets`の一致、公開ファイルの参照、安全上の禁止事項を検査します。

`npm run size`は、公開物の総量、ファイル数、大きいファイル、同じ内容の重複ファイルを報告します。固定容量を超えたことだけを理由に失敗しません。

## 固定ゲーム座標

ゲーム内部は360×640へ固定しています。端末画面には縦横比を保って拡大縮小し、余白は暗い水面背景で埋めます。

Pointer入力は画面座標から360×640の座標へ変換し、余白上の入力を拒否します。画面回転やresizeでは描画範囲だけを更新し、進行中のWorld状態を作り直しません。画面のsafe-areaはUIの余白へ反映し、ゲーム内部座標へは反映しません。

## 公式配置と練習配置

公式配置は候補C・開港型です。

```text
配置ID: candidate-c-open-harbor
指紋: fnv1a-fc71e804
配置版: namioshi-v3-layout-study-001
競技ルール版: namioshi-v3-reflection-tap-004
```

公式モードは、ビーコンの初期位置、速度、ガラス片を固定し、初期化時に`Math.random()`を使いません。

練習モードはランダム配置を残しますが、反射板の端点を盤内へ収め、ビーコンへ近づきすぎない制約付き配置にします。練習結果はランキングへ送信しません。

旧ランダム配置の記録と新しい公式配置の記録を混ぜないため、公式モードの実送信もランキング再開条件を満たすまで停止します。画面には現在の送信状態をそのまま表示します。

結果画面では、同じモードの再挑戦と、公式・練習を選び直すためのHOME復帰を選べます。停止中の送信関数は、直接呼ばれても通信を開始しません。

比較ラボと静止画像は選定履歴として`tools`と`docs/layout-previews`に残します。

## 描画方式

本命描画は`src/render/webgl.js`の純粋WebGLです。反射波は有限経路を通る有効な弧だけを表示し、直接波だけが全円になります。WebGLの初期化や復帰、描画中の処理に失敗した場合は、同じcanvasで2D contextを取得せず新しいcanvasへ差し替えて`src/render/canvas.js`のCanvas 2Dへ切り替えます。両方が同じ`World`とviewport変換を使います。

## Phase 7A 描画土台

WebGLはattributeとuniformの位置を初期化時に取得し、背景用の静的バッファと動的頂点バッファを分けています。単位円のsin/cosは事前計算し、動的バッファは`bufferSubData`で更新します。背景波と粒子はHIGH・MID・LOWの品質設定を使いますが、得点対象の前景波は品質を下げても隠しません。プレイ中の品質は固定し、HOMEやRESULTなどは最大30fpsで描画します。

## Phase 7C 音と振動

効果音は初期設定では鳴らしません。利用者がHOMEから「あり」にした場合、既存の判定音へ水系の短い合成音（波紋、返る波、水しぶき、水滴、静かな水面）を低音量で重ねます。振動は`navigator.vibrate`を実行時に確認し、対応環境で利用者がHOMEから「あり」にした場合だけ使います。振動に対応しない環境では「非対応」と表示し、ゲームは音なし・振動なしで継続できます。画面非表示やページ終了時には、音声と振動を停止します。

## Phase 8A 自動試験

Pull Request #54で、共有成功・キャンセル・失敗時のクリップボード切替、画面導線、カウントダウン二重起動防止、WebGLからCanvas 2Dへの切替契約をNode.js標準テストへ追加しました。`npm test`は127/127成功し、GitHub Actions Run #91もNode.js 18・20・22で成功しています。実ブラウザと実機の確認は別工程です。

## Phase 8B 実機検収

Phase 8Bでは、同じ公開候補コミットでブラウザ表示、スマートフォン操作、描画復旧、音・振動、休止復帰、継続動作を確認します。現在のmainはPR #73実装・PR #74文書同期後の `148ff54ea516f24ffe02501fdb4797ff915adad5` です。PR #60〜#73で、波速110、二段階台帳、初回案内、練習配置、結果案内、目的表示、10回タップ、水系SE、反射波タップ技能ボーナス、可視反射弧と案内の共有判定、波の寿命と早期RESULTを統合しました。自動検査は通過していますが、G4・G7・G8、iPhone実機、ランキング再開、公開判定は未完了です。記録欄と未確認範囲は[`docs/PHASE8B_DEVICE_TEST_REPORT_v3.md`](docs/PHASE8B_DEVICE_TEST_REPORT_v3.md)で管理します。

## 2026-08-12 公開版ブラウザの後続確認

Cloud Chromeで公式モードを実行したところ、締切後に「残り 0.0」の表示が35秒以上続き、RESULTへ遷移しない失敗を確認しました。これは実ブラウザで確認した失敗として記録します。描画停止中の締切決済経路を補修するDraft候補を作成しますが、iPhone・iPad、強制WebGL消失・復帰、Canvas 2D切替、音・振動、長時間動作、ランキング、Supabaseの確認済みとは扱いません。

## 2026-08-13 PR #58統合後の再検証

GitHub Pages上のPR #58統合後コードでも、公式モードが締切後32秒以上「残り 0.0」のままRESULTへ進まない失敗を再現しました。1Hz相当では30秒時点で90/1800固定stepしか処理できず、結果まで追加570回の画面更新が必要になることを自動再現しています。第2修正では締切後だけ小分け精算を開始し、通常プレイ中の1画面最大3stepは維持します。

## 2026-08-13 PR #59統合後の再検証

PR #59のGitHub ActionsとPages配信成功後、Cloud Chromeで公開版の公式モードを開始し、30秒後に`公式結果`へ遷移することを確認しました。操作は入力なしの1プレイで、iPhone・iPad、WebGL強制消失、音・振動、反復性能の合格には置き換えません。

## 2026-08-15 PR #65統合後・命中と得点確定の表示

PR #65では、プレイ中の目的、ビーコン命中の得点条件、6回後も30秒まで待つこと、公式・練習モードの入口説明をmainへ統合しました。これは履歴です。現在は10回タップの仕様へ更新済みで、命中確認と得点確定の表示も後続PRで統合済みです。狭い画面での通知と初見プレイの理解は実ブラウザ・実機で未確認です。


## 確認状態

Phase 1からPhase 5Aの監査、物理・得点回復のPull Request #42、時刻・入力回復のPull Request #43・#44、描画復旧のPull Request #45、ランキング安全化のPull Request #46〜#48、Phase 6AのPull Request #49、Phase 6BのPull Request #50、Phase 7AのPull Request #51、Phase 7BのPull Request #52、Phase 7CのPull Request #53、Phase 8AのPull Request #54、締切回復のPull Request #58・#59、競技ルール再調整のPull Request #60、Phase 8BのPull Request #61〜#74まではmainへ統合済みです。Phase 8Bの実ブラウザ・実機検収は未完了です。G4「物理と得点」はiPhone短期確認と描画復旧の実機確認が終わるまで不合格を維持し、競技版公開とランキング再開を停止しています。

現在のmainでは、有限経路に対応する反射弧、無効な仮想接触の通知抑制、WebGL消失からの復帰、新canvasによるCanvas 2D切替、端末内保存、結果画面の終了導線、Phase 6Bの画面支援契約、Phase 7Bの水面・波帯・ガラス・ビーコン表現、Phase 7Cの任意振動通知、Phase 8Aの自動試験契約、締切後の小分け精算、競技ルール`namioshi-v3-reflection-tap-004`の波速110・二段階台帳、初回案内の成功確認、練習配置制約、同時確定時の反射種別集約通知、結果画面の最高経路と次の目標、プレイ中の波・反射板・ビーコン凡例、目的・得点条件・10回後の待機表示、反射弧の案内と描画の共有判定まで統合済みです。設計fixture7629点、独立holdout中央値2562点、同地点最高標本3271点、2地点最高標本3805点は現行10入力の分析値です。実ブラウザの候補表示、強制WebGL消失、iPhoneの最大波性能、長時間・反復・発熱、ランキング本番疎通、Phase 6Bの実機表示、Phase 7A・7Bの実ブラウザ性能、Phase 7Cの振動実動作、同時通知と結果案内、プレイ中の目的・得点・待機表示、命中確認と得点確定の実機読みやすさは未確認です。実機で確認していない項目と確認済みの失敗は[`docs/REVIEW_CHECKLIST_v3.md`](docs/REVIEW_CHECKLIST_v3.md)で区別して管理します。


## 回復D D2.1の状態

D2のサーバー契約案は未適用のまま、Supabase公式RPC契約に合わせて7引数RPCを`submit_namioshi_score_v1`という専用名へ修正しています。既存の4引数`submit_score`、Supabase本番、ランキング送信、ランキング表示は変更していません。


## Phase 6A・6Bの状態

Phase 6Aでは公式ベスト、公式・練習のプレイ回数、結果画面の保存状態と終了導線を追加しました。Phase 6Bではsafe-area、横画面、読み上げ用の状態情報、フォーカス表示、`prefers-reduced-motion`を追加しています。Supabaseとランキングは無効のままです。自動検査は通過していますが、iPhone・iPadの実機確認とVoiceOverの確認は未完了です。

## 2026-08-15 PR #68統合後・反射波タップ

PR #68で、反射後の有限弧をタップする技能ボーナスをmainへ統合しました。深度1は10〜20点、深度2は20〜40点で、1根波につき1回、全体10件までです。結果画面では経路得点と分けて表示します。

PR #68〜#71で、反射波タップの技能ボーナス、黄色い補助表示、タイミング案内、描画可能な有限弧との共有判定を統合しました。案内と描画の不一致は自動検査で解消済みですが、実ブラウザ、iPhone・iPad、人の初見再現性、ランキング再開、Supabase適用、Ready化は未確認または未承認のまま維持します。


## 2026-08-17 PR #77 Draft・反射波10秒と説明トグル

通常の根波は約3秒で自然に消え、反射後に生成された波は最大10秒まで残ります。タップしても出ている波は消えません。根波を10回使い切った後、反射波を含む残りの波と入力がなくなれば、30秒を待たずに結果へ進みます。カウントダウン中は説明を表示し、PLAYING中は上部の「説明を表示」ボタンで任意に開閉します。自動検査はActionsで確認中で、実ブラウザとiPhone・iPadでの視認性・終了タイミングは未確認です。


## 2026-08-17 PR #74統合後・次期検収

PR #73の実装とPR #74の文書同期はmainへ統合済みです。自動検査とGitHub Actionsは成功しています。次に残る確認は、実ブラウザ・iPhone・iPadでの終了表示と波の視認性、初見プレイでの反射経路の理解、水系SEの聞き分けです。ランキング、Supabase、Ready化、公開判定は未確認のため停止しています。
