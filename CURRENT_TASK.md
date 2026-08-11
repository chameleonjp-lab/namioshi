# CURRENT_TASK: Phase 6A 端末内保存と結果画面（Draft・未統合）

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準main: `a3d7150d729175526bd0e81cedba1db4e8c8b51a`（回復D D2.1 PR #48の統合後）
- 対応ブランチ: `agent/phase6a-result-storage`
- このPull RequestはDraftのままにする
- `RANKING_SERVICE_STATE.enabled=false`を維持する

## 目的

Supabase連携を再開せず、Phase 6Aの端末内保存と結果画面を先に完成させる。通信がなくても結果を理解でき、公式と練習の記録が混ざらず、保存できない環境でもゲームを続けられる状態にする。

## 今回の実装

- `namioshi.displayName`へ名前を保存し、次回起動時に復元する
- `namioshi.bestScore`へ公式モードの端末ベストだけを保存する
- `namioshi.playCount`へ公式・練習を分けた回数を保存する
- `namioshi.lastClientVersion`を結果保存時に記録する
- 保存失敗時は保存済みと表示せず、結果画面の利用を継続する
- RESULTへNEW BEST、端末ベスト、モード別プレイ回数、保存可否を表示する
- 詳細ランキングは準備中の無効表示に留め、ランキング通信を追加しない
- RESULTから再挑戦、モード選択、ゲーム終了、実験場への移動を使えるようにする

## 変更しない範囲

- Supabase URL、Publishable key、SQL、RPC、RLS、本番データを変更しない
- ランキング送信、ランキング表示、ランキング有効化を行わない
- 公式の得点式、配置、30秒制限、6タップ、反射ルールを変更しない
- iPhone実機、実ブラウザの強制WebGL消失、長時間継続を自動試験済みと扱わない
- Ready化、マージ、公開を行わない

## 検証結果

- ローカル `npm test`: 103/103
- `npm run build`: 成功
- `npm run verify`: 成功
- `npm run analyze:layouts`: 成功（`human-decision-pending`を維持）
- `npm run render:layouts`: 成功
- `npm run size`: 108,986 bytes（固定上限ではなく報告値）
- `git diff --check`: 成功
- D2.1のランキング契約試験を含め、Supabaseへの通信・書き込みは実施していない

## 未完了

- GitHub Actionsの最終確認
- iPhone・iPad実機確認
- 実ブラウザでの保存拒否・強制WebGL消失確認
- 詳細ランキングとSupabase連携
- Phase 6Bのsafe-area、横画面、アクセシビリティ補修
