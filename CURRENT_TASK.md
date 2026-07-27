# CURRENT_TASK: namioshi v3 Phase 3C follow-up モード遷移と送信停止の補修

## 今回の目的

マージ済みのPhase 3Cを監査し、結果画面から公式と練習を選び直せない問題と、停止中の送信関数を直接呼ぶと通信できる問題を補修する。

候補Cの配置、得点、反射、共有、Supabase設定は変更しない。

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準ブランチ: `main`
- 基準コミット: `3448cbac1ef8bc1312589c192e340d3bbfc9b5ac`（Pull Request #28のマージ）
- 作業ブランチ: `codex/namioshi-v3-phase3c1-mode-transition-hardening`
- 前段Pull Request: `#28`
- ユーザー判断: 「候補Cでまずは実装」
- 選定状態: `selected-for-implementation`
- 対象ゲート: G3「公平な盤面」
- 前段の自動検査: 合格
- 今回のローカル自動検査: 合格
- 今回のGitHub Actions: 未確認
- 実機確認: 未完了

## 公式配置

```text
名称: 候補C・開港型
配置ID: candidate-c-open-harbor
配置指紋: fnv1a-fc71e804
ルール版: namioshi-v3-layout-study-001
```

ビーコンとガラス片の座標・速度はPhase 3Bの候補Cと一致する。正式値は`docs/OFFICIAL_LAYOUT_SELECTION_v3.md`へ記録した。

マージ後監査と後続Phaseへ残す問題は`docs/POST_PHASE3C_AUDIT.md`へ記録した。

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

Pull Request #28のhead `a72d504d0082f6a49116f6aa770300ba64af23d5`に対する`G2 Build Verification` Run #26、Run ID `29704853801`は成功した。

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

Phase 3C follow-upのローカル検査では、21件の単体試験、配置分析、比較画像生成一致、build、verify、容量報告が成功した。GitHub ActionsのNode.js 18、20、22はPull Request作成後に確認し、結果はPull Requestのコメントへ記録する。

## 変更していない重要部分

- 10秒、最大3タップ
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

- rootとdistの実ブラウザ操作
- iPhone SE級で候補Cの端側ガラスを識別できること
- 公式から練習、練習から公式への実機切り替え
- HOMEの2つの開始カードが320×568で操作しやすいこと
- WebGLとCanvas 2Dで候補Cが同じ配置に見えること
- 連続再挑戦
- Codeberg Pages
- Supabase実通信

自動試験の成功を、実機確認済みまたは公開承認済みという意味にはしない。

## 判定

Phase 3Cの自動検査は合格と判定する。

G3の「同じ入力で同じ結果」は、同じタップと同じ物理step列を与えた場合の再現性を指す。この条件は自動試験で確認済みである。60Hz相当と120Hz相当のように物理step列が異なる場合の一致は、Phase 4Cの固定更新とG4で解消する。

G3の完全通過には、残るiPhoneでの候補C識別とモード切り替えを確認する必要がある。

## 戻し方

このfollow-upだけを取り消す場合は、今回作成するPull Requestまたはそのマージコミットをrevertする。基準であるPull Request #28は維持する。

Phase 3C全体を取り消す場合だけ、後続変更との依存順を確認したうえでPull Request #28も別にrevertする。新しい公式スコアをSupabaseへ送っていないため、ランキングデータの戻し作業は不要。

## 次の作業

Phase 3C follow-upのGitHub Actionsを確認し、iPhoneで候補Cとモード切り替えを確認する。

重大な表示問題がなければPhase 4A「波の親子関係と反射処理」へ進む。端側ガラスが見づらい場合は候補Dの比較へ戻る。
