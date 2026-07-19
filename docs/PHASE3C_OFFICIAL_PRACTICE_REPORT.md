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
- 公開承認: 未完了

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

## 4. ランキング送信の扱い

Phase 3Cでは`src/main.js`から`submitScore`を呼ばない。

理由は、旧ランダム配置と現在の候補C固定配置が同じランキングへ混ざることを防ぐためである。また、Phase 4で得点式を変更するため、現在の得点をv3公式記録として送らない。

公式結果は「ランキング送信はPhase 5で開始します」と表示する。練習結果は「練習モードのためランキングへ送信しません」と表示する。

`src/services/ranking.js`には`RANKING_SERVICE_STATE`を追加し、Phase 5まで`enabled=false`とした。通信関数、URL、キー、RPC本文は変更していない。モード表示が停止状態を参照するため、公開物の到達可能性検査も維持できる。

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

この報告更新後の最新headでも同じworkflowを再実行し、結果はファイルを再更新せずPull Request #28のコメントへ記録する。

## 7. 変更していないもの

- 10秒
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

## 8. 未確認

- iPhone SE級で候補Cの端側ガラスを見分けられるか。
- HOMEの2つの開始カードが320×568で無理なく操作できるか。
- 公式から練習、練習から公式へ連続で切り替えられるか。
- WebGLとCanvas 2Dで候補Cが同じ位置に見えるか。
- Codeberg PagesでES Modulesを読み込めるか。
- Supabaseの正式ランキング契約。

## 9. 合否

Phase 3Cの自動検査は合格と判定する。

ただし、実機確認前の実装完了であり、公開承認は行わない。

G3の完全通過には、固定論理座標、候補C固定配置、公式・練習分離、同じ入力で同じ結果、実機での識別確認が必要である。

## 10. 次の作業

Pull Request #28の最新headで自動検査を再確認し、iPhoneで候補Cとモード切り替えを確認する。

重大な表示問題がなければPhase 4Aへ進む。端側ガラスが見づらい場合は候補Dの比較へ戻る。
