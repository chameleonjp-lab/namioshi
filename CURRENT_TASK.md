# CURRENT_TASK: namioshi v3契約の確定

## 今回の目的

コード実装ではなく、namioshi v3のゲーム仕様、競技条件、スコア、ランキング、スマホ操作、性能、画面、視覚表現、実装順序を文書で確定する。目的は「v3契約の確定」であり、ゲームコード、描画コード、Supabase通信、SQL、公開用dist、ビルドスクリプト、画像、音声は変更しない。

## 対象リポジトリ

- `https://github.com/chameleonjp-lab/namioshi`
- 作業ディレクトリ: `/workspace/namioshi`

## 基準ブランチ

- 作業開始時ブランチ: `work`
- ローカルで確認できたGitHub default branch: 未確認。`origin` remoteが未設定のため取得できない。
- 作業ブランチ: `codex/namioshi-contract-v3`

## 基準コミット

- `07de190 Merge pull request #15 from chameleonjp-lab/codex/fix-readme-path-errors`

## 開始時の未コミット差分

`git status --short` の開始時出力:

```text
?? node_modules/
?? vendor/vite/node_modules/
```

この2件は既存の未追跡依存ディレクトリとして扱い、削除・変更しない。

## 変更対象ファイル

- `CURRENT_TASK.md`
- `DECISION_LOG.md`
- `docs/REQUIREMENTS_v3.md`
- `docs/SPEC_v3.md`
- `docs/IMPLEMENTATION_PLAN_v3.md`
- `docs/REVIEW_CHECKLIST_v3.md`
- `README.md`

## 今回変更しないファイル

- `index.html`
- `src/**`
- `dist/**`
- `scripts/**`
- `vendor/**`
- `package.json`
- `package-lock.json`
- `vite.config.js`
- `tsconfig.json`
- Supabase関連SQL
- 画像、音声、公開物
- 既存の旧仕様書が今後追加・確認された場合も削除しない

## 完了条件

- v3の正本文書が作成されている。
- READMEが、現在実装はv2相当でv3は未実装であることを案内している。
- 3MB上限、index.html 1ファイル強制、実装方式の固定をv3要件にしない。
- 10秒、最大3タップ、反射最大2回、360×640論理座標、公式/練習分離、rootTapId、最高候補得点方式、共通ランキングRPC、WebGL/Canvas 2D、性能・継続試験、実機未確認範囲を明記する。
- 今回の差分が文書だけである。

## 未確認事項

- GitHub上のdefault branch。
- mainの最新コミットとmainとの差分。`origin` remote未設定のため未確認。
- 未マージの最新実装が別ブランチにあるか。
- 正式Supabase URL。
- Publishable keyとURLが同じプロジェクトのものか。
- `submit_score` の実RPC疎通。
- `public.games` への `namioshi` 登録。
- 現在の旧ランキング件数。
- v3スコアを旧ランキングと分ける方法。
- 実験場トップの登録方式。
- 詳細ランキングの登録方式。
- iPhone/iPad実機動作。
- Codeberg Pages公開動作。

## 後続Phase

1. 現行コードの正しさ
2. 開発ソースとビルドの整理
3. 固定論理座標と公式配置
4. 反射と得点
5. ランキング契約
6. 画面とアクセシビリティ
7. 高品質WebGLと音
8. 性能、実機、公開

各Phaseは別Pull Requestに分け、得点、ランキング、WebGL、ビルド、画面を1つのPull Requestで同時に変更しない。

## 実機未確認の範囲

この作業では実機確認を行っていない。iPhone SE級、iPhone 11 Pro、iPhone 17 Pro、iPad Pro 2018縦、iPad Pro 2018横、Safari、PC主要ブラウザ、Codeberg Pages公開環境、実Supabase通信はいずれも未確認とする。

## 現行問題候補のコード読解結果

今回確認した範囲は静的読解であり、実行確認を伴わないものは `[実行確認が必要]` とする。

| # | 問題候補 | 分類 | 根拠 |
|---:|---|---|---|
| 1 | LOADINGとREADYで同じidを使用している可能性 | [確認済み] | `src/main.ts` のHTML文字列で `LOADING` と `READY` の両方に `id="readyText"` がある。 |
| 2 | ルールボタンに処理がない可能性 | [確認済み] | `src/main.ts` で `rule` 要素は作成されるが、クリック処理が設定されていない。 |
| 3 | 固定時間の見せかけLOADINGがある可能性 | [確認済み] | `start()` が `LOADING` に遷移して `setTimeout(ready,180)` を実行している。 |
| 4 | ゲーム座標が端末ピクセルへ直接依存している可能性 | [確認済み] | `resize()` が `world.reset(innerWidth,innerHeight)` を呼び、タップは `clientX/clientY` を渡している。 |
| 5 | 公式ランキングでも毎回ランダム配置になっている可能性 | [確認済み] | `World.reset()` がビーコンとガラスに `Math.random()` を使い、ランキング送信前に公式/練習の分岐がない。 |
| 6 | 壁反射波が反射元で即座に再反射する可能性 | [実行確認が必要] | 波ごとに `edges`/`glass` はあるが、親子間の反射元抑止や移動距離消費の仕組みは静的読解だけでは挙動確定できない。 |
| 7 | 同じタップ由来の複数波が同じビーコンへ重複加点する可能性 | [確認済み] | 現行波は `rootTapId` を持たず、波単位の `hit` Setで判定している。 |
| 8 | 全体コンボ倍率により入力順で得点が変わる可能性 | [確認済み] | `World.step()` で `combo` を使った倍率を加点に使っている。 |
| 9 | 「保存されました」と表示するが実際には保存していない可能性 | [確認済み] | ランキング送信失敗時の文言に対し、静的読解範囲では結果保存処理が見当たらない。 |
| 10 | Publishable keyをAuthorization: Bearerへ入れている可能性 | [確認済み] | `src/services/ranking.ts` が `Authorization: Bearer` にPublishable keyを入れている。 |
| 11 | Supabase URLが正式資料と一致していない可能性 | [仕様決定待ち] | コード上のURLは確認したが、正式資料・実プロジェクトとの一致は未確認。 |
| 12 | 結果画面に端末ベスト、内訳、終了、実験場、詳細ランキングが不足している可能性 | [確認済み] | `src/main.ts` の `RESULT` には最終点、送信状態、シェア、もう一度、共有テキストのみがある。 |
| 13 | WebGLで毎フレームTypedArrayやsliceを作っている可能性 | [確認済み] | `src/render/webgl.ts` の描画中に `new Float32Array` と `slice()` がある。 |
| 14 | WebGLで毎回attribute/uniform位置を検索している可能性 | [確認済み] | `src/render/webgl.ts` の描画系関数内で `getAttribLocation`/`getUniformLocation` を呼んでいる。 |
| 15 | 波の太さをgl.lineWidthへ依存している可能性 | [確認済み] | `drawLine()` が `gl.lineWidth(lineWidth)` を使用している。 |
| 16 | visibilitychangeへの対応がない可能性 | [確認済み] | `rg visibilitychange` で該当実装なし。 |
| 17 | webglcontextlostとwebglcontextrestoredへの対応がない可能性 | [確認済み] | `rg webglcontext` で該当実装なし。 |
| 18 | 同じidやタイマーが再挑戦で重複する可能性 | [実行確認が必要] | 重複idは確認済み。再挑戦時のタイマー重複は `again` が `ready()` を直接呼ぶため懸念があるが、実行確認が必要。 |
| 19 | 公式配置を変更した時のランキング分離方法がない可能性 | [仕様決定待ち] | 現行 `CLIENT_VERSION` はあるが、v3公式配置ID・ルール版・旧スコア分離方式は未決定。 |
| 20 | 実験場トップと詳細ランキングへの登録状態が未確認の可能性 | [仕様決定待ち] | 現行リポジトリ内では実験場トップと詳細ランキングの登録方式を確定できない。 |
