# namioshi

暗い水面に波を押し出し、壁や反射板の反射を使って3つのビーコンに波を重ねる30秒ゲームです。公開先はCodeberg Pagesの`/namioshi/`配下を想定しています。

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
npm run render:layouts
npm run verify
npm run size
```

`npm run build`は`dist`を削除した後、`src`を加工せず`dist/assets`へ再帰コピーし、公開用`dist/index.html`を生成します。

`npm test`は、固定論理座標、公式配置候補、候補Cの選定記録、公式・練習モードの分離、共有経路、画面導線、描画復旧を確認します。

`npm run analyze:layouts`は、3つの配置候補を同じ121地点、同じ56到達時刻、同じ3地点の参考タップで再計算し、保存済み結果と一致するか確認します。これは配置比較用の固定条件で、通常プレイのタップ上限とは別です。

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
ルール版: namioshi-v3-layout-study-001
```

公式モードは、ビーコンの初期位置、速度、ガラス片を固定し、初期化時に`Math.random()`を使いません。

練習モードは従来のランダム配置を残します。練習結果はランキングへ送信しません。

旧ランダム配置の記録と新しい公式配置の記録を混ぜないため、公式モードの実送信もランキング再開条件を満たすまで停止します。画面には現在の送信状態をそのまま表示します。

結果画面では、同じモードの再挑戦と、公式・練習を選び直すためのHOME復帰を選べます。停止中の送信関数は、直接呼ばれても通信を開始しません。

比較ラボと静止画像は選定履歴として`tools`と`docs/layout-previews`に残します。

## 描画方式

本命描画は`src/render/webgl.js`の純粋WebGLです。反射波は有限経路を通る有効な弧だけを表示し、直接波だけが全円になります。WebGLの初期化や復帰、描画中の処理に失敗した場合は、同じcanvasで2D contextを取得せず新しいcanvasへ差し替えて`src/render/canvas.js`のCanvas 2Dへ切り替えます。両方が同じ`World`とviewport変換を使います。

## Phase 7A 描画土台

WebGLはattributeとuniformの位置を初期化時に取得し、背景用の静的バッファと動的頂点バッファを分けています。単位円のsin/cosは事前計算し、動的バッファは`bufferSubData`で更新します。背景波と粒子はHIGH・MID・LOWの品質設定を使いますが、得点対象の前景波は品質を下げても隠しません。プレイ中の品質は固定し、HOMEやRESULTなどは最大30fpsで描画します。

## Phase 7C 音と振動

効果音はこれまでの契約を維持し、初期設定では鳴らしません。振動は`navigator.vibrate`を実行時に確認し、対応環境で利用者がHOMEから「あり」にした場合だけ使います。振動に対応しない環境では「非対応」と表示し、ゲームは音なし・振動なしで継続できます。画面非表示やページ終了時には、音声と振動を停止します。

## Phase 8A 自動試験

Pull Request #54で、共有成功・キャンセル・失敗時のクリップボード切替、画面導線、カウントダウン二重起動防止、WebGLからCanvas 2Dへの切替契約をNode.js標準テストへ追加しました。`npm test`は127/127成功し、GitHub Actions Run #91もNode.js 18・20・22で成功しています。実ブラウザと実機の確認は別工程です。

## Phase 8B 実機検収

Phase 8Bでは、同じ公開候補コミットでブラウザ表示、スマートフォン操作、描画復旧、音・振動、休止復帰、継続動作を確認します。現時点では実ブラウザ・実機の結果を記録していないため、G4・G7・G8、ランキング再開、公開判定は未完了です。記録欄と未確認範囲は[`docs/PHASE8B_DEVICE_TEST_REPORT_v3.md`](docs/PHASE8B_DEVICE_TEST_REPORT_v3.md)で管理します。

## 確認状態

Phase 1からPhase 5Aの監査、物理・得点回復のPull Request #42、時刻・入力回復のPull Request #43・#44、描画復旧のPull Request #45、ランキング安全化のPull Request #46〜#48、Phase 6AのPull Request #49、Phase 6BのPull Request #50、Phase 7AのPull Request #51、Phase 7BのPull Request #52、Phase 7CのPull Request #53、Phase 8AのPull Request #54まではmainへ統合済みです。Phase 8Bの実ブラウザ・実機検収は未完了です。G4「物理と得点」はiPhone短期確認と描画復旧の実機確認が終わるまで不合格を維持し、競技版公開とランキング再開を停止しています。

現在のmainでは、有限経路に対応する反射弧、無効な仮想接触の通知抑制、WebGL消失からの復帰、新canvasによるCanvas 2D切替、端末内保存、結果画面の終了導線、Phase 6Bの画面支援契約、Phase 7Bの水面・波帯・ガラス・ビーコン表現、Phase 7Cの任意振動通知、Phase 8Aの自動試験契約まで統合済みです。公式fixtureの実到達例は5481点（直接0、壁239、反射板429、2回反射4813）で、台帳合計・内訳合計・1800固定stepをgoldenとして固定し、6480はhard ceilingとして扱い探索最大値とは断定していません。実ブラウザの強制WebGL消失、iPhoneの最大波性能、長時間・反復・発熱、ランキング本番疎通、Phase 6Bの実機表示、Phase 7A・7Bの実ブラウザ性能、Phase 7Cの振動実動作は未確認です。実機で確認していない項目と確認済みの失敗は[`docs/REVIEW_CHECKLIST_v3.md`](docs/REVIEW_CHECKLIST_v3.md)で区別して管理します。


## 回復D D2.1の状態

D2のサーバー契約案は未適用のまま、Supabase公式RPC契約に合わせて7引数RPCを`submit_namioshi_score_v1`という専用名へ修正しています。既存の4引数`submit_score`、Supabase本番、ランキング送信、ランキング表示は変更していません。


## Phase 6A・6Bの状態

Phase 6Aでは公式ベスト、公式・練習のプレイ回数、結果画面の保存状態と終了導線を追加しました。Phase 6Bではsafe-area、横画面、読み上げ用の状態情報、フォーカス表示、`prefers-reduced-motion`を追加しています。Supabaseとランキングは無効のままです。自動検査は通過していますが、iPhone・iPadの実機確認とVoiceOverの確認は未完了です。
