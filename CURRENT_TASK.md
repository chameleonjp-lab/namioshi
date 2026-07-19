# CURRENT_TASK: namioshi v3 Phase 3B.1 公式配置の判断資料

## 今回の目的

Phase 3Bで比較した候補A・B・Cを、iPhoneからGitHub上で見比べられる静止画像と選定ガイドへまとめる。

この作業では公式配置を採用しない。本番ゲーム、得点、ランキング送信、公式モード、練習モードを変更しない。

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準ブランチ: `main`
- 基準コミット: `dd49724d236c2573e38baf8d7ecf99475983a060`（Pull Request #25のマージ）
- 作業ブランチ: `codex/namioshi-v3-phase3b1-decision-pack`
- 対象Pull Request: `#26`
- 前提: Phase 3Bの候補A・B・Cと分析結果がmainへ反映済み
- 採用状態: `human-decision-pending`
- 実機確認: 未完了

## 追加した判断資料

### 静止プレビュー

候補データと保存済み分析結果から、次のSVGを自動生成する。

- `docs/layout-previews/layout-comparison.svg`
- `docs/layout-previews/layout-comparison-mobile.svg`

横並び版は3候補を一画面で比較する。スマートフォン版は候補A・B・Cを縦へ並べ、iPhoneから拡大せず確認しやすくする。

両方の画像へ次を表示する。

- ビーコン3個の初期位置
- ビーコンの10秒移動経路
- ガラス片4個
- 共通3タップ地点
- ガラス反射経路数
- 2回反射経路数
- 共通3タップ参考得点
- ビーコン同士の最小間隔
- ビーコンとガラスの近接警告
- ガラス端点と画面端の最小余白

近接警告対象のガラス片は桃色で示す。

### 生成と検査

`tools/render-layout-previews.mjs`を追加した。

```text
npm run render:layouts
npm run render:layouts:write
```

通常の`render:layouts`は、候補データと分析結果から再生成した内容がコミット済みSVGと一致するか確認する。

候補データを意図的に変えた場合だけ`render:layouts:write`で画像を更新する。画像差分は人が確認し、機械的に受け入れない。

小数の見た目が同じでも実行環境によって長い表記へ変わる場合があるため、比較時は小数を2桁へそろえる。座標値や分析値そのものの差は検出する。

### 選定ガイド

`docs/OFFICIAL_LAYOUT_DECISION_GUIDE_v3.md`を追加した。

この文書では次を分けて記載した。

- 自動分析で確認した事実
- 各候補の注意点
- 分析だけでは判断できない内容
- 現時点の推薦
- 採用後の手順

## 現時点の推薦

候補C・開港型を、初回の実機確認へ進める優先候補として推薦する。

これは採用決定ではなく、次の事実を合わせた意見である。

- ビーコン同士の最小間隔が118.12pxで、3候補中で最も広い。
- ガラス反射経路が330あり、候補Aの359に近い。
- 共通3タップ参考得点が2650で、候補Aの2747に近い。
- ビーコンとガラスの近接警告が1件で、候補Aの2件より少ない。

注意点は、ガラス端点と画面端の最小余白が42pxで最も狭いことである。iPhone SE級で見づらい場合は、候補Cをそのまま採用せず、ガラス片を内側へ寄せた候補Dを別Pull Requestで作る。

## GitHub Actions結果

Pull Request #26のhead `6fe2163ff508a7f7c1a2602cdbebc349f19e92c7`に対する`G2 Build Verification` Run #22、Run ID `29703486545`は成功した。

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

自動検査では次を確認した。

- 選定ガイドが`human-decision-pending`を維持している。
- 候補Cを実機確認の優先候補として推薦し、採用決定とは書いていない。
- 候補A、B、C、Dの返答選択肢がある。
- 横・縦の比較SVGが候補A・B・Cを含む。
- 両SVGが画像としての説明を持つ。
- 候補データと分析結果から再生成したSVGがコミット済み内容と一致する。
- 既存の配置分析結果が変わっていない。
- build後の`dist`に差分がなく、本番公開物を変更していない。

この文書とレビュー表の更新後に起動する最終workflow結果は、ファイルを再更新せずPull Request #26のコメントへ記録する。

## 変更しなかった重要部分

- `src/**`
- `dist/**`
- root `index.html`
- 本番Worldのランダム配置
- 10秒、最大3タップ
- 波速度、寿命、反射処理
- 現在の得点式とコンボ
- Supabase URL、Publishable key、ランキング送信
- 共有文と共有処理
- WebGLとCanvas 2D
- 公式モードと練習モード
- 候補A・B・Cの座標と分析値

## 未確認の範囲

- GitHub上でSVGが正しく表示されること
- iPhoneでスマートフォン向け縦比較を読めること
- `tools/layout-lab.html`の実ブラウザ表示
- iPhone SE級での候補A・B・Cの見やすさ
- 実際に3タップして感じる難しさ
- 反射の分かりやすさ
- ビーコンとガラスの重なりが許容できるか
- 採用する公式配置
- Codeberg Pages
- Supabase実通信

自動検査の成功を、候補採用済みまたは実機確認済みという意味にはしない。

## 自動検査の判定

Phase 3B.1の初回自動検査は合格と判定する。

ただし、公式配置の採用は未決定である。採用状態は引き続き`human-decision-pending`とする。

## 完了条件

- 横並びとスマートフォン向け縦並びの比較画像がある。
- 画像が候補データと分析結果から再生成できる。
- 画像が古い場合にGitHub Actionsが失敗する。
- 選定ガイドが事実と推薦を分けている。
- 候補Cの推薦を採用決定と表現していない。
- 本番`src`と`dist`を変更していない。
- Node.js 18、20、22の全検査が成功する。
- 採用状態を`human-decision-pending`のまま維持する。

## 戻し方

この作業を取り消す場合は、Phase 3B.1のPull Requestをrevertする。本番ゲーム、公開物、Supabaseデータを変更しないため、ランキングやデータベースの戻し作業は不要。

## 次の作業

この判断資料を確認した後、ユーザーが次のいずれかを明示する。

```text
候補Aを採用
候補Bを採用
候補Cを採用
候補Dを追加して再比較
```

候補を選ぶまでは、Phase 3C「公式モードと練習モードの分離」を開始しない。
