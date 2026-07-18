# CURRENT_TASK: namioshi v3 Phase 3B 公式配置比較ラボ

## 今回の目的

公式モードへ配置を組み込む前に、3つの候補を同じ条件で比較し、人が採用候補を判断できる資料と道具を作る。

今回は本番ゲームの配置、得点、ランキング送信、公式モード、練習モードを変更しない。

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準ブランチ: `main`
- 基準コミット: `15aed890aedd03399b0bc474ebf2c4bc7cd3c858`（Pull Request #24のマージ）
- 作業ブランチ: `codex/namioshi-v3-phase3b-layout-lab`
- 対象Pull Request: `#25`
- 前提: Phase 3Aの360×640固定論理座標がmainへ反映済み
- 対象ゲート: G3「公平な盤面」のうち公式配置候補の比較
- 採用状態: `human-decision-pending`
- 実機確認: 未完了

## 追加した候補

同じルール版`namioshi-v3-layout-study-001`で、次の3候補を定義した。

- 候補A・交差流: `candidate-a-cross-current`
- 候補B・段流路: `candidate-b-stair-channel`
- 候補C・開港型: `candidate-c-open-harbor`

各候補は、ビーコン3個の初期位置と固定速度、ガラス片4個の端点、候補ID、説明文を持つ。候補データには`selected`または`official`を入れていない。

## 比較条件

- 360×640論理座標
- 121タップ地点
- 0.25秒から3.00秒までの56到達時刻
- 画面4辺とガラス片4個
- 直接波、壁反射、ガラス反射、2回反射
- 共通3タップ: `(90,140)`, `(180,340)`, `(270,490)`

比較する値は、各反射種類の経路数とビーコン到達、共通3タップの参考得点、直接経路の割合、反射経路の分散、ビーコン同士とガラスとの最小間隔、近接警告、画面端との余白、候補指紋である。

## 追加したファイル

### 候補と分析

- `tools/layout-candidates.js`
- `tools/layout-analysis.js`
- `tools/analyze-layouts.mjs`
- `tools/layout-analysis.snapshot.json`

候補データが変わり、保存済み分析結果と一致しなくなった場合は自動検査を失敗させる。

### 比較画面

- `tools/layout-lab.html`
- `tools/layout-lab.js`

比較画面では、候補の切り替え、360×640上のビーコンとガラス片、10秒間のビーコン移動、共通3タップ地点、主要な分析値、候補IDと指紋を確認できる。

比較画面は本番`src`と`dist`へ入れていない。

### 試験と文書

- `tests/layouts.test.mjs`
- `docs/OFFICIAL_LAYOUT_STUDY_v3.md`
- `README.md`
- `docs/REVIEW_CHECKLIST_v3.md`

## 比較結果

| 指標 | 候補A | 候補B | 候補C |
|---|---:|---:|---:|
| ガラス反射経路 | 359 | 146 | 330 |
| 2回反射経路 | 652 | 546 | 516 |
| 共通3タップの最良参考得点 | 2747 | 2192 | 2650 |
| ビーコン最小間隔 | 44.18 | 50.12 | 118.12 |
| ビーコン・ガラス近接警告 | 2 | 1 | 1 |

この表は採用順位ではない。分析方法、完全な数値、各候補の注意点は`docs/OFFICIAL_LAYOUT_STUDY_v3.md`へ記録した。

## GitHub Actions結果

### 初回成功

Pull Request #25のhead `b4d6591f9136d301f02d350d81382628685ea0ac`に対する`G2 Build Verification` Run #15、Run ID `29650585832`は成功した。

### 文書更新後の成功

head `b490329a58fbeece17acab526b53b666095acafe`に対するRun #18、Run ID `29650717139`も成功した。

Node.js 18、20、22のすべてで次が成功した。

```text
npm run build
npm test
npm run analyze:layouts
npm run verify
npm run size
git diff --exit-code -- dist
```

自動試験では次を確認した。

- 候補が3件あり、全候補が同じルール版を使う。
- 各候補がビーコン3個とガラス片4個を持つ。
- 候補は未選択である。
- 指紋と保存済み分析結果が現在の候補データと一致する。
- 直接、壁、ガラス、2回反射の経路候補が全ビーコンへ存在する。
- 共通3タップの参考得点がv3候補上限3240以下である。
- build後の`dist`に差分がなく、本番公開物を変更していない。

この最終記録更新後に起動するworkflow結果は、ファイルを再更新せずPull Request #25のコメントへ記録する。

## 変更しなかった重要部分

- `src/**`
- `dist/**`
- root `index.html`
- 現在のランダム配置を使う本番World
- 10秒、最大3タップ
- 波速度、寿命、反射処理
- 現在の得点式とコンボ
- Supabase URL、Publishable key、ランキング送信
- 共有文と共有処理
- WebGLとCanvas 2D
- 公式モードと練習モード

分析内で波速度と参考得点を使うが、本番コードは変更していない。

## 未確認の範囲

- `tools/layout-lab.html`の実ブラウザ表示
- iPhone SE級での候補A、B、Cの見やすさ
- 実際に3タップして感じる難しさ
- 反射の分かりやすさ
- ビーコンとガラスの重なりが許容できるか
- 採用する公式配置
- Codeberg Pages
- Supabase実通信

自動分析の成功を、候補採用済みまたは実機確認済みという意味にはしない。

## 自動検査の判定

Phase 3Bの自動検査は合格と判定する。

ただし、Phase 3B全体は人の候補選択が必要である。採用状態は引き続き`human-decision-pending`とする。

## 戻し方

このPhaseを取り消す場合は、Phase 3BのPull Requestをrevertする。本番ゲーム、公開物、Supabaseデータは変更していないため、ランキングやデータベースの戻し作業は不要。

## 次の作業

Pull Request #25のレビュー後、ユーザーが次のいずれかを明示する。

- 候補Aを採用
- 候補Bを採用
- 候補Cを採用
- 候補Dを追加して再比較

採用判断を別の記録作業で確定した後、Phase 3C「公式モードと練習モードの分離」へ進む。
