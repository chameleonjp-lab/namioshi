# namioshi v3 Phase 3C 公式・練習モード実装報告

- 基準main: `c2cfeefe33058449c5ed34b01b03af9775e8fbe1`
- 作業ブランチ: `codex/namioshi-v3-phase3c-official-practice`
- 対象Pull Request: `#28`
- 公式配置: 候補C・開港型
- 配置ID: `candidate-c-open-harbor`
- 配置指紋: `fnv1a-fc71e804`
- ルール版: `namioshi-v3-layout-study-001`
- 選定状態: `selected-for-implementation`
- 自動検査: 合格
- 初回成功Run: `G2 Build Verification #26`
- Run ID: `29704853801`
- 成功対象head: `a72d504d0082f6a49116f6aa770300ba64af23d5`
- follow-up Pull Request: `#29`（マージ済み）
- follow-up head: `1f9428b91a2b7afea0d104fdb71dca477dbfb484`
- follow-up merge commit: `95f80a2eef4325e736835192864943d4c311e2dd`
- follow-up成功Run: `G2 Build Verification #30`
- follow-up Run ID: `30243727062`
- 公開承認: 未完了

## 0. Phase 3C follow-up 補修

Pull Request #28のマージ後監査で、RESULTからHOMEへ戻る導線がなく、公式から練習、練習から公式への切り替えを再読み込みなしでは試せないことが判明した。

基準main `3448cbac1ef8bc1312589c192e340d3bbfc9b5ac`から、`codex/namioshi-v3-phase3c1-mode-transition-hardening`で次を補修し、Pull Request #29としてmainへマージした。

- RESULTへ「モードを選び直す」を追加した。
- 名前を保持したままHOMEへ戻し、公式と練習を選び直せるようにした。
- HOME、RULES、COUNTDOWNを不透明にし、前回の盤面を次の開始前に見せないようにした。
- 公式と練習以外のモード値を拒否するようにした。
- `RANKING_SERVICE_STATE.enabled=false`の間は、`submitScore()`を直接呼んでも`fetch()`より前に拒否するようにした。

候補Cの座標、配置ID、指紋、ルール版、得点、反射、共有、Supabase URL、Publishable key、RPC本文は変更しない。

ローカルのNode.js 24では、21件の単体試験、配置分析、比較画像生成一致、build、verify、容量報告が成功した。Pull Request #29のGitHub ActionsでもNode.js 18、20、22の全検査が成功した。実機操作は未確認のまま残す。

## 1. 実装の目的

公式モードを全員同じ候補C配置へ固定し、従来のランダム配置を練習モードとして残す。

公式と練習をWorld、画面、結果、ランキング方針のすべてで区別する。

## 2. 追加した実行コード

### `src/game/modes.js`

次を一元管理する。

- `official`と`practice`
- 画面表示名
- 結果表示名
- ランキング候補かどうか
- 現段階で送信するかどうか

公式は将来のランキング候補だが、ランキングサービスが無効であるPhase 5までは送信しない。練習はランキング候補ではなく、常に送信しない。

### `src/game/layouts.js`

候補Cの座標、速度、配置ID、指紋、ルール版を本番用定数として持つ。

練習では、Phase 3C前のランダム生成規則を関数へ分離し、乱数関数を外から渡せるようにする。

### `src/game/world.js`

`World.reset({mode, random})`へ変更した。

公式モード:

- 候補Cを使う。
- `Math.random()`を初期化へ使わない。
- 見た目用粒子も毎回同じ固定乱数から始める。
- 配置ID、指紋、ルール版をWorldへ保持する。

練習モード:

- ランダム配置を使う。
- 注入した乱数で配置と粒子を作る。
- 公式用固定乱数を引き継がない。
- `rankingCandidate=false`とする。

## 3. 画面変更

HOMEへ「公式モード開始」と「練習モード開始」を追加した。

公式カードは候補C・開港型で全員同じ配置であることを表示する。練習カードは毎回ランダムでランキング送信なしと表示する。

COUNTDOWN、HUD、RESULTへモード名を表示する。練習では結果見出しを「練習結果」にする。

結果画面には配置IDを表示し、どの条件で遊んだか確認できるようにする。

Phase 3C follow-upではRESULTへ「モードを選び直す」を追加した。HOME、RULES、COUNTDOWNでは前回のWorldを背景へ透過表示しない。

## 4. ランキング送信の扱い

Phase 3Cでは`src/main.js`から`submitScore`を呼ばない。

理由は、旧ランダム配置と現在の候補C固定配置が同じランキングへ混ざることを防ぐためである。また、Phase 4で得点式を変更するため、現在の得点をv3公式記録として送らない。

公式結果は「ランキング送信はPhase 5で開始します」と表示する。練習結果は「練習モードのためランキングへ送信しません」と表示する。

`src/services/ranking.js`には`RANKING_SERVICE_STATE`を追加し、Phase 5まで`enabled=false`とした。通信関数、URL、キー、RPC本文は変更していない。モード表示が停止状態を参照するため、公開物の到達可能性検査も維持できる。

Phase 3C follow-upでは停止状態を`submitScore()`の入口でも強制し、停止中は通信を開始しないようにした。

## 5. 自動試験

`tests/modes.test.mjs`へ次を追加した。

- 本番公式配置と比較候補Cの完全一致
- 配置ID、指紋、ルール版の一致
- 公式初期化で`Math.random()`を呼ばないこと
- 公式初期状態の再現性
- 同じ公式入力と更新回数による得点・見た目状態の再現性
- 練習の注入乱数による再現性
- 異なる練習乱数による配置差
- 公式と練習のランキング方針
- ランキングサービスがPhase 5まで無効であること
- `src/main.js`が`submitScore`を参照しないこと
- 不明なモード値を拒否すること
- 停止中の送信関数が`fetch()`を呼ばないこと
- RESULTからモード選択へ戻る導線があること
- 次の開始前に前回盤面を背景へ透過表示しないこと

選定ガイドの試験も更新し、候補Cの正式記録、ID、指紋、ルール版を確認する。

## 6. GitHub Actions結果

Pull Request #28のhead `a72d504d0082f6a49116f6aa770300ba64af23d5`に対するRun #26、Run ID `29704853801`は成功した。

Node.js 18、20、22の各環境で次がすべて成功した。

```text
npm run build
npm test
npm run analyze:layouts
npm run render:layouts
npm run verify
npm run size
git diff --exit-code -- dist
```

自動検査で確認できた内容:

- 本番配置が候補Cと一致する。
- 公式初期化は`Math.random()`を呼ばない。
- 公式の同じ入力と更新回数は同じ結果になる。
- 練習は注入した乱数で再現でき、別の乱数では別配置になる。
- 公式と練習の送信方針を分けている。
- ランキングサービスは無効である。
- 既存の候補分析と比較画像が変わっていない。
- `src`と`dist/assets`が一致する。
- build後の`dist`差分がない。

Pull Request #28では最終head `38158ffea5d51923b5f146121b58328fbb766a09`まで同じworkflowを実行し、Node.js 18、20、22の全検査が成功した。

Pull Request #29のhead `1f9428b91a2b7afea0d104fdb71dca477dbfb484`に対する`G2 Build Verification #30`、Run ID `30243727062`でも、Node.js 18、20、22の全検査が成功した。

## 7. 変更していないもの

- 10秒という仕様値（ただし早期終了問題は未修正）
- 最大3タップ
- 360×640固定論理座標
- 波速度
- 波寿命
- 現在の反射処理
- 現在の得点式とコンボ
- WebGLの描画内容
- Canvas 2Dの描画内容
- 共有文と共有処理
- Supabase URLとPublishable key
- 共通`submit_score` RPCの通信内容

## 8. ブラウザ確認と未確認

320×568相当のローカルChromium 149で、root `index.html`と`dist/index.html`の両方を確認した。

- 公式、練習、公式の順に再読み込みなしで切り替えられる。
- HOMEへ戻った後も名前を保持する。
- HOMEとCOUNTDOWNは不透明である。
- Supabaseへの通信は0件である。
- ページエラーとconsole errorは0件である。

この確認で、3タップ後に波がなくなると約6秒でRESULTへ進む既存問題も再現した。10秒契約に反するため、Phase 4Cの必須修正とする。

次はローカルChromiumではなく、引き続き未確認である。

- iPhone SE級で候補Cの端側ガラスを見分けられるか。
- HOMEの2つの開始カードが320×568で無理なく操作できるか。
- 公式から練習、練習から公式へ連続で切り替える実機操作。
- 再挑戦とモード再選択で、前回盤面を次の配置と誤認しないか。
- WebGLとCanvas 2Dで候補Cが同じ位置に見えるか。
- Codeberg PagesでES Modulesを読み込めるか。
- Supabaseの正式ランキング契約。

## 9. 合否

Phase 3CとPull Request #29の自動検査、ローカルChromiumでのモード遷移は合格と判定する。

ただし、Phase 3Cとfollow-upの実装範囲が完了したという意味であり、iPhone実機確認、G3通過、公開承認は未完了である。

G3の「同じ入力で同じ結果」は、同じタップと同じ物理step列での再現性を指し、自動試験で確認済みである。実描画間隔が異なる場合の一致は、Phase 4Cの固定更新とG4で扱う。

G3の完全通過には、固定論理座標、候補C固定配置、公式・練習分離、同じ物理step列での再現性、実機での識別確認が必要である。

## 10. 次の作業

iPhoneで候補Cの端側ガラス、公式・練習カード、公式と練習の往復、前回盤面を次の配置と誤認しないことを確認する。確認結果を記録するまでG3を完了にせず、Phase 4Aへ進めない。端側ガラスが見づらい場合は候補Dの比較へ戻る。

Phase 4A開始前には、有限線分の外側で反射する問題と、同一面を再判定できる移動距離の契約を正本へ反映する。Phase 4Cでは、3タップ後の早期終了と60Hz相当・120Hz相当の差を必ず修正する。
