# CURRENT_TASK: 回復D クライアントランキング安全化（未有効化）

## 今回の目的

Pull Request #45の回復Cがmainへ統合されたため、回復計画のまとまりDへ進む。ランキングを有効化せず、クライアント側の送信契約を安全に整える。SupabaseのSQL、RPC、RLS、public.games、本番データは変更しない。

## 基準

- 対象: chameleonjp-lab/namioshi
- 基準ブランチ: main
- 基準コミット: 9ce1aba6655178eb23156a5c89fde45eeb1ce9ab（Pull Request #45マージ後）
- 対応ブランチ: agent/recovery-d-ranking-safety-client
- RANKING_SERVICE_STATE.enabled=falseを維持する
- Ready化、マージ、本番公開はこのDraftの範囲外

## 今回の変更

- Supabase URLを、読み取り専用確認で一致した正式Project URLへ更新する
- コード内のPublishable keyが同じProjectの有効なキーであることを確認する。キーの実値は文書へ記録しない
- 公式モード以外の送信をクライアント入口で拒否する
- 名前、play ID、整数スコア、0〜6480点の範囲を送信前に検査する
- 同じplay IDの同時送信と成功後の再送を拒否し、失敗時だけ明示的な再試行を許可する
- リクエストを10秒で中断し、応答にはplay IDを付ける
- Authorization: BearerへPublishable keyを送らず、apikeyだけを使う
- 結果画面から送信する将来の処理に、現在のplay IDと画面状態を確認する古い応答抑制を入れる
- srcからdistを同期する

## 変更しない範囲

- RANKING_SERVICE_STATE.enabledの有効化
- Supabase SQL、RPC定義、RLS、public.games、ランキング記録
- 本番スコア送信、ランキング表示、競技版公開
- サーバー側のplay ID一意制約、版・season分離、異常隔離、頻度制限
- iPhone実機、強制WebGL消失、長時間・発熱の確認

## 検証契約

- 無効状態ではネットワークを呼ばない
- 公式モードの正常値だけを送信契約へ通す
- 練習モード、不正な名前、範囲外・小数スコア、空のplay IDを送信前に拒否する
- 成功済みplay IDの再送と同時送信を拒否する
- HTTP失敗後は同じplay IDを明示的に再試行できる
- 10秒経過時にAbortSignalで中断し、タイムアウトとして扱う
- リクエストヘッダーにAuthorizationがなく、本文のゲームslugとclient versionが固定される
- 古いplayの応答は、現在のRESULT画面を書き換えない
- npm test、npm run build、npm run verify、配置確認、容量報告、差分検査、GitHub Actionsを通す

## 未確認・保留

- 現在の共通submit_score RPCはp_play_idを受け取る契約へまだ変更していないため、ランキング送信は有効化できない
- サーバー側での許可版、rule version、season、play ID一意性、再送冪等性、頻度制限、異常スコア隔離は別提案が必要
- URLの正式性は今回読み取り専用で確認したが、本番通信は実行していない
- iPhone実機と強制WebGL消失は未確認

## 次に渡す担当

独立レビューで、送信停止を保ったままクライアント契約の抜けを確認する。次のサーバー側提案ではSQL/RPCの変更範囲と、自己申告ランキングと競技ランキングのどちらを採用するかをユーザー判断へ渡す。
