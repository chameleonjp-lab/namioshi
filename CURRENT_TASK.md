# CURRENT_TASK: namioshi v3 Phase 3C 公式モードと練習モードの分離

## 今回の目的

候補C・開港型を公式配置として本番へ組み込み、従来のランダム配置を練習モードへ残す。

ランキングの公平性を守るため、練習結果は送信しない。旧ランダム配置の記録と新しい公式配置の記録を混ぜないため、公式結果の実送信もPhase 5まで停止する。

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準ブランチ: `main`
- 基準コミット: `c2cfeefe33058449c5ed34b01b03af9775e8fbe1`（Pull Request #27のマージ）
- 作業ブランチ: `codex/namioshi-v3-phase3c-official-practice`
- 対象Pull Request: `#28`
- ユーザー判断: 「候補Cでまずは実装」
- 選定状態: `selected-for-implementation`
- 対象ゲート: G3「公平な盤面」
- 自動検査: 合格
- 実機確認: 未完了

## 公式配置

```text
名称: 候補C・開港型
配置ID: candidate-c-open-harbor
配置指紋: fnv1a-fc71e804
ルール版: namioshi-v3-layout-study-001
```

ビーコンとガラス片の座標・速度はPhase 3Bの候補Cと一致する。正式値は`docs/OFFICIAL_LAYOUT_SELECTION_v3.md`へ記録した。

## 実装済み

### モードと配置

- `src/game/modes.js`へ`official`と`practice`を定義した。
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
- 320×568級でも画面を縦にスクロールして操作できるようにした。

### ランキング

- `src/main.js`から`submitScore`の参照と呼び出しを削除した。
- 公式はランキング候補だが、Phase 5まで`submitNow=false`とする。
- 練習はランキング候補外で、常に`submitNow=false`とする。
- `src/services/ranking.js`へ停止状態`RANKING_SERVICE_STATE`を追加した。
- URL、キー、RPC本文、通信関数の内容は変更していない。

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

この文書更新後の最新headでも同じworkflowを再実行し、結果はファイルを再更新せずPull Request #28のコメントへ記録する。

## 変更していない重要部分

- 10秒、最大3タップ
- 360×640固定論理座標
- 波速度、寿命、現在の反射処理
- 現在の得点式とコンボ
- WebGLとCanvas 2Dの描画方式
- 共有文と共有処理
- Supabase URLとPublishable key
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

G3の完全通過には、iPhoneで候補Cとモード切り替えを確認する必要がある。

## 戻し方

このPhaseを取り消す場合は、Phase 3CのPull Requestをrevertする。新しい公式スコアをSupabaseへ送らないため、ランキングデータの戻し作業は不要。

## 次の作業

Pull Request #28の最新headで自動検査を再確認し、iPhoneで候補Cとモード切り替えを確認する。

重大な表示問題がなければPhase 4A「波の親子関係と反射処理」へ進む。端側ガラスが見づらい場合は候補Dの比較へ戻る。
