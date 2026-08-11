# CURRENT_TASK: 回復D D2.1 RPC名の一意化（未適用・未有効化）

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準main: `adeb9a75e80b937f1720440095bc2321dcd9b569`（回復D D2 PR #47の統合後）
- 対応ブランチ: `agent/recovery-d-ranking-rpc-name`
- この作業で作るPull RequestはDraftのままにする
- `RANKING_SERVICE_STATE.enabled=false`を維持する

## 目的

回復D第一段階で整えたクライアント送信契約に対応する、サーバー側の共通安全契約を提案する。既存作品の共有ランキング記録へ書き込まず、`namioshi`だけを分離した未適用SQLとしてレビュー可能にする。

## 今回の変更

- クライアント本文へ `play_id`、許可したrule version、seasonを固定して送る
- RPC応答の `accepted` を確認し、拒否された送信を成功済みとして記録しない
- `play_id`、名前、整数スコア、0〜6480点、公式モードを送信前に検査する
- `private`スキーマの設定・記録・頻度制限テーブルと、専用名`submit_namioshi_score_v1`の7引数RPC、ランキング取得RPCをSQL提案として追加する
- privateテーブルのRLS、公開ロールの権限縮小、SECURITY DEFINERの空search_path、同一play_idの冪等性と競合直列化を定義する
- SQL提案と契約説明を `docs/` に記録し、サーバー契約の静的テストを追加する

## 変更しない範囲

- SQLをSupabase本番または非本番へ適用しない
- 既存の4引数版 `public.submit_score`、既存共有テーブル、`public.games` を変更しない
- `namioshi`を `public.games`へ登録しない
- クライアントのランキング送信、ランキング表示、結果画面接続を有効化しない
- self-reportedを競技性のあるランキングと主張しない
- iPhone実機、強制WebGLコンテキスト消失、長時間継続の未確認を確認済みと扱わない

## 検証結果

- `npm test`: 99/99
- `npm run build`: 成功
- `npm run verify`: 成功
- `npm run analyze:layouts`: human-decision-pendingを維持
- `npm run render:layouts`: 成功
- `npm run size`: 102,492 bytes（固定上限ではなく報告値）
- `git diff --check`: 成功
- Supabaseは読み取り専用監査のみ。SQL適用、書き込み、ランキング疎通は未実施
- GitHub Actions Run #78: Node.js 18・20・22の全ジョブ成功、npm test 99/99、build、verify、配置・SVG・サイズ検査成功

## D2.1で確認した問題

Supabase公式資料で、関数名だけが同じで引数が異なるRPC（オーバーロード）は使用できないことを確認した。D2の初案にあった同名7引数`submit_score`は未適用であり、既存の4引数RPCへ影響する前に専用名へ修正する。

## 次の判断

1. Draft PRのActionsと読み取り専用レビューを確認する。
2. 自己申告ランキングを採用するか、サーバー発行プレイ情報・入力記録・再計算を含む競技版を設計するかを決める。
3. SQLの非本番検証、本番適用、限定疎通、ランキング表示接続は、ユーザーの明示承認後に別工程で行う。
