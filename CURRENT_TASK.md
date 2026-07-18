# CURRENT_TASK: namioshi v3 Phase 3A 360×640固定論理座標

## 今回の目的

端末の画面サイズが波の距離、速度、反射時刻、得点へ影響しないようにする。ゲーム内部を360×640へ固定し、画面への拡大縮小とPointer入力の座標変換だけを導入する。

得点式、公式配置、練習モード、ランキング送信、WebGLの高品質化は変更しない。

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準ブランチ: `main`
- 基準コミット: `7dd230211195f855743f14411092a80b9ac1e253`（Pull Request #23のマージ）
- 作業ブランチ: `codex/namioshi-v3-phase3a-logical-viewport`
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

## 変更内容

### 設定と共通変換

- `src/config.js`へ`LOGICAL_WIDTH=360`と`LOGICAL_HEIGHT=640`を追加する。
- `src/game/viewport.js`を追加する。
- 表示倍率、表示範囲、余白を一か所で計算する。
- 画面座標と論理座標の変換を一か所へまとめる。

### World

- `World.w / World.h`を360×640へ固定する。
- `World.reset()`へ画面サイズを渡さない。
- resizeと画面回転でWorldを作り直さない。
- 現在のランダム配置、波、反射、得点は維持する。

### 入力

- `clientX / clientY`を直接`World.tap()`へ渡さない。
- Canvasの`getBoundingClientRect()`を基準に変換する。
- 余白とゲーム領域外の入力をタップ数へ加えない。
- `PLAYING`中の主Pointerだけを受ける。
- `pointercancel`を処理する。

### 描画

- WebGLとCanvas 2Dへ同じviewportを渡す。
- ゲーム領域を切り取らず中央へ配置する。
- 余白は暗い水面背景で埋める。
- Device Pixel Ratioは描画解像度だけへ使う。
- resizeでは表示変換と描画解像度だけを更新する。

### 自動試験

`tests/viewport.test.mjs`で次を確認する。

- 320×568
- 375×812
- 390×844
- 1024×1366
- 左上、中央、右下の変換誤差0.25以内
- 余白入力の拒否
- 画面回転相当のviewport変更でWorld状態が不変
- 同じ乱数列と論理タップなら画面サイズが違っても同じ得点とWorld状態

GitHub ActionsのNode.js 18、20、22で`npm test`を実行する。

## 変更しない重要部分

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

## 検証状態

GitHubへ実装と試験を追加済み。Pull Request作成後の自動検査結果は未確認。

別のNode.js環境で作成した同等の試験では、5件が成功した。ただし、GitHub上の正式結果はGitHub Actions完了後に記録する。

未確認:

- GitHub ActionsのNode.js 18、20、22
- build、verify、size、dist再現性
- rootとdistのブラウザ操作
- iPhoneとiPad実機
- WebGL実表示
- Canvas 2Dへの実切り替え
- Codeberg Pages
- Supabase実通信

## 完了条件

- Worldが常に360×640である。
- resizeがWorld状態を変更しない。
- WebGLとCanvas 2Dが同じviewportを使う。
- 余白上の入力が拒否される。
- 4つの画面サイズで同じ論理入力が同じ結果になる。
- 5件の自動試験がNode.js 18、20、22ですべて成功する。
- build、verify、size、dist再現性が成功する。
- 得点式、公式配置、ランキング送信を変更していない。
- 実機未確認を成功扱いにしない。

## 戻し方

このPhaseを取り消す場合は、Phase 3AのPull Requestをrevertする。Supabaseデータや旧ランキングの変更は含まないため、データベースの戻し作業は不要。

## 次の作業

Phase 3Aの自動検査とレビュー完了後、Phase 3B「公式配置比較ラボ」を開始する。
