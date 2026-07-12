# CURRENT_TASK: namioshi v3 Phase 1.1 共有フォールバックと確認結果の正確化

## 今回の目的

Phase 1で残った共有の手動コピー不具合を修正し、実機未確認項目の記録を正確にする。ゲーム物理、得点式、ランキング契約、WebGL描画、Canvas描画、ビルド構成は変更しない。

## 対象リポジトリ

- `https://github.com/chameleonjp-lab/namioshi`
- 作業ディレクトリ: `/workspace/namioshi`

## 基準ブランチ

- 作業開始時ブランチ: `work`
- 作業ブランチ: `codex/namioshi-v3-phase1-share-fallback`

## 基準コミット

- `ddc5da4 Merge pull request #17 from chameleonjp-lab/codex/fix-ui-and-state-transition-issues`

## 開始時の確認

```text
$ git status --short
?? node_modules/
?? vendor/vite/node_modules/

$ git branch --show-current
work

$ git log -5 --oneline
ddc5da4 Merge pull request #17 from chameleonjp-lab/codex/fix-ui-and-state-transition-issues
7b25d0f Fix v3 phase1 UI state correctness
3191603 Merge pull request #16 from chameleonjp-lab/codex/namioshi-v3
9f220be docs: define namioshi v3 contracts
07de190 Merge pull request #15 from chameleonjp-lab/codex/fix-readme-path-errors

$ git remote -v
```

`git remote -v` は出力なし。開始時の未追跡依存ディレクトリ `node_modules/` と `vendor/vite/node_modules/` は既存のものとして扱い、削除・変更しない。

## 編集前に列挙した変更予定ファイル

- `src/main.ts`
- `src/services/share.ts`
- `docs/REVIEW_CHECKLIST_v3.md`
- `CURRENT_TASK.md`
- `dist/**`（ビルド生成物）

## 変更内容

- 共有失敗時の手動コピー欄へ、例外メッセージではなく常に `shareText(score)` を入れる。
- 共有キャンセル（`AbortError`）時は「共有をキャンセルしました」を返し、クリップボードコピーや手動コピー欄表示へ進まない。
- `navigator.share` が使えない場合、または `AbortError` 以外で失敗した場合は、クリップボードコピーを試す。
- クリップボードコピー成功時は「シェア文をコピーしました」を表示し、手動コピー欄は開かない。
- クリップボードコピー失敗時だけ手動コピー欄を開き、「共有できないため、手動でコピーしてください」を表示する。
- 共有状態は `homeShareStatus` または `resultShareStatus` に表示し、ランキング状態 `rank` には書かない。
- レビュー・公開チェックリストで、実装上の `blur()` 実行と iPhone Safari 実機確認を分離する。

## ブラウザ確認と実機確認の範囲

この作業ではローカルのブラウザ操作確認、iPhone Safari実機確認、Codeberg Pages公開環境確認、実Supabase通信確認は行っていない。該当項目は未確認として扱う。

## 検証予定

- `npm run build`
- `npm run verify`
- `npm run size`
- 生成された `dist` の静的確認

## 実行した検証

- `npm run build`: 成功。
- `npm run verify`: 成功。
- `npm run size`: 成功。`dist total: 21846 bytes / 2900000`。
- `node --check dist/assets/main.js`: 成功。
- `node --check dist/assets/services/share.js`: 成功。
- `node --input-type=module ...`: 共有機能の差し替え確認6ケースに成功。ただしNode上の関数単体確認であり、ブラウザ実機確認ではない。
- `rg` による生成済み `dist` の静的確認で、手動コピー欄が `shareText(score)` を使うこと、`AbortError` 分岐、clipboard分岐、共有状態要素とランキング状態要素が分離していることを確認した。
