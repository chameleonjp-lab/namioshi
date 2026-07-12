# CURRENT_TASK: namioshi v3 Phase 1 現行UI・状態遷移の正しさ

## 今回の目的

現行ゲームのUIと状態遷移にある明確な不具合だけを修正する。ゲーム物理、得点式、公式配置、ランキング契約、WebGL描画、Canvas描画、ビルド構成は変更しない。

## 対象リポジトリ

- `https://github.com/chameleonjp-lab/namioshi`
- 作業ディレクトリ: `/workspace/namioshi`

## 基準ブランチ

- 作業開始時ブランチ: `work`
- 作業ブランチ: `codex/namioshi-v3-phase1-correctness`

## 基準コミット

- `3191603 Merge pull request #16 from chameleonjp-lab/codex/namioshi-v3`

## 開始時の未コミット差分

`git status --short` の開始時出力:

```text
?? node_modules/
?? vendor/vite/node_modules/
```

この2件は既存の未追跡依存ディレクトリとして扱い、削除・変更しない。

## 変更対象ファイル

- `src/main.ts`
- `src/services/share.ts`
- `src/ui/styles.css`
- `CURRENT_TASK.md`
- `docs/REVIEW_CHECKLIST_v3.md`
- `dist/**`

## 今回変更しないファイル

- `src/game/world.ts`
- `src/render/**`
- `src/config.ts`
- `src/services/ranking.ts`
- `scripts/**`
- `vendor/**`
- `package.json`
- `package-lock.json`
- Supabase関連SQL
- 画像、音声

## 完了条件

- 固定時間の見せかけLOADINGを削除し、状態を `HOME` / `RULES` / `COUNTDOWN` / `PLAYING` / `RESULT` / `ERROR` に整理する。
- `id="readyText"` を削除し、カウントダウン表示を `id="countdownText"` に統一する。
- RULES画面をHOMEから開き、閉じるとHOMEへ戻せるようにする。
- カウントダウンを 3:600ms、2:600ms、1:600ms、START:400ms にし、二重起動を防ぐ。
- 名前未入力では開始せず、正しい名前入力後はエラーを消し、開始時に入力欄を `blur()` する。
- ランキング送信失敗時に、端末へ保存していないのに保存済みと表示しない。
- 共有キャンセルと共有失敗を分け、共有状態をランキング状態へ書かない。
- `npm run build`、`npm run verify`、`npm run size` を実行する。

## 現行問題候補のコード読解結果

今回確認した範囲は静的読解であり、実行確認を伴わないものは `[実行確認が必要]` とする。

| # | 問題候補 | 分類 | 根拠 |
|---:|---|---|---|
| 1 | LOADINGとREADYで同じidを使用している | [確認済み] | 変更前の `src/main.ts` のHTML文字列で `LOADING` と `READY` の両方に `id="readyText"` があった。 |
| 2 | ルールボタンに処理がない | [確認済み] | 変更前の `src/main.ts` で `rule` 要素は作成されるが、クリック処理が設定されていなかった。 |
| 3 | 固定時間の見せかけLOADINGがある | [確認済み] | 変更前の `start()` が `LOADING` に遷移して `setTimeout(ready,180)` を実行していた。 |
| 4 | ゲーム座標が端末ピクセルへ直接依存している | [確認済み] | 現行コードでは `play()` が `world.reset(innerWidth, innerHeight)` を呼び、pointerdownの`clientX`/`clientY`を`World.tap()`へ渡している。 |
| 5 | 公式ランキングでも毎回ランダム配置になっている可能性 | [確認済み] | `World.reset()` がビーコンとガラスに `Math.random()` を使い、ランキング送信前に公式/練習の分岐がない。 |
| 6 | 壁反射波が反射元で即座に再反射する可能性 | [実行確認が必要] | 波ごとに `edges`/`glass` はあるが、親子間の反射元抑止や移動距離消費の仕組みは静的読解だけでは挙動確定できない。 |
| 7 | 同じタップ由来の複数波が同じビーコンへ重複加点する可能性 | [確認済み] | 現行波は `rootTapId` を持たず、波単位の `hit` Setで判定している。 |
| 8 | 全体コンボ倍率により入力順で得点が変わる可能性 | [確認済み] | `World.step()` で `combo` を使った倍率を加点に使っている。 |
| 9 | 「保存されました」と表示するが実際には保存していない | [確認済み] | ランキング送信失敗時の文言に対し、現行コードに結果保存処理はない。 |
| 10 | 共有キャンセル時にも手動コピー欄が開く可能性 | [確認済み] | 変更前の共有ボタン処理は `share()` の例外をすべて手動コピー表示へ送っていた。 |

## 実機未確認の範囲

この作業では実機確認を行わない。iPhone SE級、iPhone 11 Pro、iPhone 17 Pro、iPad Pro 2018縦、iPad Pro 2018横、Safari、Codeberg Pages公開環境、実Supabase通信はいずれも未確認とする。
