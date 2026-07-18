# CURRENT_TASK: namioshi v3 Phase 3A 360×640固定論理座標

## 今回の目的

端末の画面サイズが波の距離、速度、反射時刻、得点へ影響しないようにする。ゲーム内部を360×640へ固定し、画面への拡大縮小とPointer入力の座標変換だけを導入する。

得点式、公式配置、練習モード、ランキング送信、WebGLの高品質化は変更しない。

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準ブランチ: `main`
- 基準コミット: `7dd230211195f855743f14411092a80b9ac1e253`（Pull Request #23のマージ）
- 作業ブランチ: `codex/namioshi-v3-phase3a-logical-viewport`
- 対象Pull Request: `#24`
- 前提ゲート: G2「開発構成」通過済み
- 対象ゲート: G3「公平な盤面」のうち固定論理座標
- 実機確認: 未完了

## 実装契約

```text
論理幅: 360
論理高: 640
表示倍率: min(viewWidth / 360, viewHeight / 640)
表示幅: 360 × 表示倍率
表示高: 640 × 表示倍率
左右余白: (viewWidth - 表示幅) / 2
上下余白: (viewHeight - 表示高) / 2
```

入力変換:

```text
logicalX = (clientX - canvasRect.left - offsetX) / scale
logicalY = (clientY - canvasRect.top  - offsetY) / scale
```

論理領域外の入力は拒否する。

## 実装内容

### 設定と共通変換

- `src/config.js`へ`LOGICAL_WIDTH=360`と`LOGICAL_HEIGHT=640`を追加した。
- `src/game/viewport.js`を追加した。
- 表示倍率、表示範囲、余白、座標変換を一か所へまとめた。

### World

- `World.w / World.h`を360×640へ固定した。
- `World.reset()`へ画面サイズを渡さない。
- resizeと画面回転相当の処理でWorldを作り直さない。
- 現在のランダム配置、波、反射、得点を維持した。

### 入力

- `clientX / clientY`を直接`World.tap()`へ渡さない。
- Canvasの`getBoundingClientRect()`を基準に論理座標へ変換する。
- 余白とゲーム領域外の入力をタップ数へ加えない。
- `PLAYING`中の主Pointerだけを受ける。
- `pointercancel`を処理する。

### 描画

- WebGLとCanvas 2Dへ同じviewportを渡す。
- ゲーム領域を切り取らず中央へ配置する。
- 余白を暗い水面背景で埋める。
- Device Pixel Ratioは描画解像度だけへ使う。
- resizeでは表示変換と描画解像度だけを更新する。

### 自動試験

`tests/viewport.test.mjs`へ5件の試験を追加した。

対象画面サイズ:

- 320×568
- 375×812
- 390×844
- 1024×1366

確認内容:

- 左上、中央、右下の変換誤差0.25以内
- 余白入力の拒否
- viewport変更でWorld状態が不変
- 同じ乱数列と論理タップなら画面サイズが違っても同じ得点とWorld状態
- ゲーム領域全体が切り取られない

## GitHub Actions結果

Pull Request #24のhead `1e860545a18c6cbf9b99549ecbdc477fed55afe1`に対するRun #10、Run ID `29638102137`は成功した。

| 実行環境 | build | viewport試験5件 | verify | size | dist再現性 |
|---|---|---|---|---|---|
| Node.js 18 | 成功 | 成功 | 成功 | 成功 | 成功 |
| Node.js 20 | 成功 | 成功 | 成功 | 成功 | 成功 |
| Node.js 22 | 成功 | 成功 | 成功 | 成功 | 成功 |

詳細は`docs/PHASE3A_VIEWPORT_REPORT.md`へ記録した。

この文書更新後のPull Request最新headでも同じworkflowを実行し、失敗している状態ではマージしない。

## 変更しなかった重要部分

- 10秒、最大3タップ
- ビーコンとガラス片の現在のランダム配置
- 波速度、寿命、反射回数
- 現在の得点式、コンボ、ランキング上限
- Supabase URL、Publishable key、Authorizationヘッダー、送信本文
- 共有文と共有処理
- HOME / RULES / COUNTDOWN / PLAYING / RESULT / ERROR
- 公式配置
- 公式モードと練習モード
- WebGLの帯状波、高品質な光、音

## 未確認の範囲

- rootとdistのブラウザ操作
- iPhoneとiPad実機
- iPhone Safariで余白タップが拒否されること
- 画面回転中の見た目と操作
- WebGL実表示
- Canvas 2Dへの実切り替え
- Codeberg Pages
- Supabase実通信

自動試験の成功を、実機確認済みという意味にはしない。

## 自動検査の判定

Phase 3Aの自動検査は合格と判定する。

- Worldは常に360×640である。
- resizeはWorld状態を変更しない。
- WebGLとCanvas 2Dが同じviewportを使う。
- 余白上の入力を拒否する。
- 4つの画面サイズで同じ論理入力が同じ結果になる。
- 5件の自動試験がNode.js 18、20、22ですべて成功した。
- build、verify、size、dist再現性が成功した。
- 得点式、公式配置、ランキング送信を変更していない。

## 戻し方

このPhaseを取り消す場合は、Phase 3AのPull Requestをrevertする。Supabaseデータや旧ランキングの変更は含まないため、データベースの戻し作業は不要。

## 次の作業

Pull Request #24のレビューとマージ後、Phase 3B「公式配置比較ラボ」を開始する。
