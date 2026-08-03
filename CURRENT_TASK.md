# CURRENT_TASK: namioshi v3 PR #33〜#35完了記録の同期とG3停止位置の確認

## 今回の目的

Pull Request #33〜#35で完了した音声の安定化、反射元の二重通知防止、10秒未満の早期終了防止を文書へ同期し、G3の確認済み範囲、未確認範囲、後続Phaseの停止条件を正確に記録する。

この同期では製品コード、候補Cの配置、得点、共有、Supabase設定を変更しない。Pull Request #34の最小反射修正をPhase 4A全体の完了とは扱わない。

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準ブランチ: `main`
- 進捗反映基準: `baa45977fd6da10c86e09a9b227c39cb553b9fa1`（Pull Request #35のマージ）
- 完了Pull Request: `#33`、`#34`、`#35`
- 完了merge commit: `393da058284bb503c8f9d0f83a552817169e282a`、`b7bbe1badc98ce20e52d878ab5e3271835bf0d5d`、`baa45977fd6da10c86e09a9b227c39cb553b9fa1`
- ユーザー判断: 「候補Cでまずは実装」
- 選定状態: `selected-for-implementation`
- 対象ゲート: G3「公平な盤面」
- ローカル自動検査: 合格
- GitHub Actions: Pull Request #33〜#35のNode.js 18、20、22で合格
- ローカルChromiumのモード遷移: 合格
- 10秒契約: Pull Request #35の境界試験で、5.8秒では継続し0秒で終了することを確認。iPhone実機では未確認
- 実機確認: 未完了
- 公開承認: 未完了

## 公式配置

```text
名称: 候補C・開港型
配置ID: candidate-c-open-harbor
配置指紋: fnv1a-fc71e804
ルール版: namioshi-v3-layout-study-001
```

ビーコンとガラス片の座標・速度はPhase 3Bの候補Cと一致する。正式値は`docs/OFFICIAL_LAYOUT_SELECTION_v3.md`へ記録した。

マージ後監査と後続Phaseへ残す問題は`docs/POST_PHASE3C_AUDIT.md`へ記録した。

## Pull Request #33〜#35で補修済み

- Pull Request #33で、音声再開失敗を処理し、画面非表示時に再生中・予約中の効果音を止め、復帰後に古い音を再生しないようにした。
- Pull Request #34で、壁またはガラスから作られた反射波へ反射元を処理済みとして引き継ぎ、同じ1回の接触から反射通知を二重に出す経路を防いだ。
- Pull Request #35で、終了条件を残り時間だけへ分離し、3タップ済みまたは波0件を理由に10秒未満でRESULTへ進まないようにした。
- 3件とも、得点式、公式配置、練習配置、ランキング、共有は変更していない。
- 3件とも、GitHub ActionsのNode.js 18、20、22で検査に合格した。

Pull Request #34は、現在の実装で反射元を直ちに二重通知する経路への最小修正である。`rootTapId`、`parentWaveId`、`surfaceHistory`、有限線分判定、再判定距離、寿命継承、24波上限時の処理はPhase 4Aに残る。

## 実装済み

### モードと配置

- `src/game/modes.js`へ`official`と`practice`を定義した。
- 公式と練習以外の値を公式へ読み替えず、エラーとして拒否する。
- `src/game/layouts.js`へ候補Cの固定配置と練習ランダム生成を分離した。
- 公式配置ID、指紋、ルール版を`src/config.js`へ固定した。
- 練習用乱数を外から渡せるようにした。

### World

`World.reset({mode, random})`へ変更した。

公式:

- 候補Cを使う。
- 初期化で`Math.random()`を呼ばない。
- 見た目用粒子も固定乱数から開始する。
- `mode`、`layoutId`、`ruleVersion`、`layoutFingerprint`、`rankingCandidate`を保持する。

練習:

- 従来のランダム配置を使う。
- 注入した乱数で配置と粒子を生成する。
- 公式用固定乱数を練習へ引き継がない。
- `rankingCandidate=false`とする。

### 画面

- HOMEへ「公式モード開始」と「練習モード開始」を追加した。
- 公式カードへ候補Cの固定配置を表示した。
- 練習カードへランダム配置と送信なしを表示した。
- COUNTDOWN、HUD、RESULTへモード名を表示した。
- 練習結果は「練習結果」と表示する。
- 結果画面へ配置IDを表示する。
- 結果画面へ「モードを選び直す」を追加し、名前を保持してHOMEへ戻れるようにする。
- HOME、RULES、COUNTDOWNを不透明な背景にし、前回の盤面や練習配置を次の開始前に見せない。
- 320×568級でも画面を縦にスクロールして操作できるようにした。

### ランキング

- `src/main.js`から`submitScore`の参照と呼び出しを削除した。
- 公式はランキング候補だが、Phase 5まで`submitNow=false`とする。
- 練習はランキング候補外で、常に`submitNow=false`とする。
- `src/services/ranking.js`へ停止状態`RANKING_SERVICE_STATE`を追加した。
- `submitScore()`自体も停止状態を確認し、Phase 5までは`fetch()`より前に拒否する。
- URL、キー、RPC本文は変更していない。

## 自動試験

`tests/modes.test.mjs`で次を確認した。

1. 本番配置がPhase 3Bの候補Cと一致する。
2. 配置ID、指紋、ルール版が一致する。
3. 公式初期化で`Math.random()`を呼ばない。
4. 公式を2回作ると同じ初期状態になる。
5. 同じ公式3タップと同じ更新回数で同じ得点と見た目状態になる。
6. 練習は同じ注入乱数で同じ配置になる。
7. 練習は異なる注入乱数で異なる配置になる。
8. 公式と練習のランキング方針が分かれる。
9. ランキングサービスがPhase 5まで無効である。
10. `src/main.js`が`submitScore`を参照しない。
11. 不明なモード値を拒否する。
12. 停止中の`submitScore()`が通信を始める前に拒否する。
13. RESULTに再挑戦とモード再選択の両方がある。
14. HOME、RULES、COUNTDOWNで前回盤面を透過表示しない。

既存のviewport、候補分析、比較画像の試験も維持した。

## GitHub Actions結果

Pull Request #29のhead `1f9428b91a2b7afea0d104fdb71dca477dbfb484`に対する`G2 Build Verification #30`、Run ID `30243727062`は成功した。

Node.js 18、20、22のすべてで次が成功した。

```text
npm run build
npm test
npm run analyze:layouts
npm run render:layouts
npm run verify
npm run size
git diff --exit-code -- dist
```

自動検査上、候補C固定、公式の再現性、練習乱数、送信停止、既存分析、`src`と`dist/assets`の一致を確認した。

Phase 3C follow-upのローカル検査でも、21件の単体試験、配置分析、比較画像生成一致、build、verify、容量報告が成功した。

## ローカルブラウザ確認

Chromium 149を320×568 CSSピクセル相当で起動し、root `index.html`と`dist/index.html`の両方で次を確認した。

- HOMEが表示され、横方向にはみ出さない。
- 公式、練習、公式の順に再読み込みなしで切り替えられる。
- モード選択へ戻った後も名前を保持する。
- HOMEとCOUNTDOWNの背景は不透明で、前回盤面を透過表示しない。
- 公式結果と練習結果を区別して表示する。
- Supabaseへの通信は0件である。
- ページエラーとconsole errorは0件である。

これはChromiumでの確認であり、iPhone Safariの実機確認には置き換えない。

## 変更していない重要部分

- 10秒という仕様値と最大3タップ（早期終了条件はPull Request #35で修正済み）
- 360×640固定論理座標
- 波速度、寿命、現在の反射処理
- 現在の得点式とコンボ
- WebGLとCanvas 2Dの描画方式
- 共有文と共有処理
- Supabase URL、Publishable key、既存のHTTPヘッダー
- 共通`submit_score` RPCの通信内容
- Phase 4の反射親子関係と最高候補得点
- Phase 5の正式ランキング契約

## 未確認の範囲

- iPhone SE級で候補Cの端側ガラスを識別できること
- 公式から練習、練習から公式への実機切り替え
- HOMEの2つの開始カードが320×568で操作しやすいこと
- WebGLとCanvas 2Dで候補Cが同じ配置に見えること
- 連続再挑戦
- Codeberg Pages
- Supabase実通信

自動試験とローカルChromium確認の成功を、iPhone実機確認済みまたは公開承認済みという意味にはしない。

## 後続Phaseの停止条件

再監査とPull Request #33〜#35後の状態で次を確認した。

- 3タップ後に波がなくなると10秒を待たずRESULTへ進む問題は、Pull Request #35で修正済みである。Phase 4Cには、単調増加時計、固定更新、画面非表示時の締切処理が残る。
- `src/game/world.js`のガラス反射判定は、有限線分の外側でも延長線上で反射できる。配置分析は有限線分を前提としているため、Phase 4Aで判定と分析の前提を一致させる。
- 反射元を次の更新で二重通知する直接経路はPull Request #34で修正済みである。ただし、反射子波は依然として正式な親子関係、面履歴、再判定距離、寿命継承を持たないため、Phase 4Aで作り直す。
- 同じ候補Cと同じ3タップでも、60分割は24,525点、120分割は24,012点になる。Phase 4Cの固定更新で解消する。
- WebGLの低画質では、判定中の波の一部を描画しない。Phase 7で、判定する波を簡略表示でもすべて見せる。

## 判定

Phase 3CとPull Request #29の自動検査、ローカルChromiumでのモード遷移、Pull Request #33〜#35の自動検査は合格と判定する。

G3の「同じ入力で同じ結果」は、同じタップと同じ物理step列を与えた場合の再現性を指す。この条件は自動試験で確認済みである。60Hz相当と120Hz相当のように物理step列が異なる場合の一致は、Phase 4Cの固定更新とG4で解消する。

G3は未完了とする。完全通過には、残るiPhoneでの候補C識別とモード切り替えを確認する必要がある。後続Phaseの既知問題も、担当Phaseの完了条件から外さない。

## 戻し方

Pull Request #33〜#35の補修だけを取り消す場合は、依存の逆順でPull Request #35、#34、#33のマージコミットを個別にrevertする。得点やランキングデータの戻し作業は不要である。

Phase 3C follow-upだけを取り消す場合は、Pull Request #29のマージコミット `95f80a2eef4325e736835192864943d4c311e2dd`をrevertする。Pull Request #28は維持する。

Phase 3C全体を取り消す場合だけ、後続変更との依存順を確認したうえでPull Request #28も別にrevertする。新しい公式スコアをSupabaseへ送っていないため、ランキングデータの戻し作業は不要。

## 次の作業

G3の残りとして、iPhoneで候補Cの端側ガラス、公式・練習カード、公式と練習の往復、前回盤面を次の配置と誤認しないことを確認する。

実機結果を記録するまでG3を完了にせず、Phase 4Aへ進めない。端側ガラスが見づらい場合は候補Dの比較へ戻る。
