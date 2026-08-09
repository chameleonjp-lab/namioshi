# CURRENT_TASK: namioshi Phase 5A Supabaseと旧ランキング監査

## 今回の目的

Pull Request #40でPhase 4Cの固定更新、単調増加時計、画面休止時の停止と復帰をmainへ統合した。

次に、ランキングを再開する前に、正式なSupabase接続先、RPC、`namioshi`登録、旧記録、権限、v3と旧版の分離方法を読み取り専用で監査する。

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準ブランチ: `main`
- 基準コミット: `85c2deb1d8cd6df0af7e820defdc97a529e2d06f`（Pull Request #40マージ後）
- Pull Request #37、#38、#39、#40はmainへマージ済み
- 変更はmainへ直接入れず、下書きPull Requestで提出する
- 本番スコアを送信しない
- SQL、RPC、RLS、権限、Supabaseデータを変更しない
- ランキング送信の有効化を行わない

## 今回のPhase 5A監査

- `docs/SUPABASE_AUDIT_v3.md`を作成する
- Supabase projectの正式URLと状態を確認する
- Publishable keyの種類と有効状態を確認する。実値は文書へ書かない
- `submit_score`とランキング取得RPCの引数、戻り値、実行権限、`SECURITY DEFINER`を確認する
- `public.games`の`namioshi`登録を確認する
- `score_runs`、`game_scores`、`game_play_events`の`namioshi`件数と`client_version`を確認する
- RLS、直接INSERT権限、RPC実行権限を確認する
- GitHub mainのSupabase URL、ヘッダー、送信停止状態と照合する

## 監査で確認した事実

- 正式Project URLは`https://mlpnjgezrnhdxsxolyzj.supabase.co`で、状態は`ACTIVE_HEALTHY`
- 現行`src/config.js`のURLは正式Project URLと一致しない
- `public.games`に`namioshi`は登録されていない
- `namioshi`の`score_runs`、`game_scores`、`game_play_events`はすべて0件
- `client_version`は`score_runs`へ保存されるが、既存ランキングRPCは`game_scores`を読むため、v3と旧版を絞り込まない
- 直接INSERT権限は`anon`にない。productionへのINSERT試験は行っていない
- `RANKING_SERVICE_STATE.enabled`は`false`のままである
- 現行クライアントには`Authorization: Bearer`が残っている

## 自動・読み取り確認

- Supabase projectメタデータ、Project URL、Publishable key一覧を読み取った
- publicスキーマのテーブル、列、RLS状態、行数を読み取った
- RPC定義、引数、戻り値、権限、関数本体を読み取った
- `pg_policies`、テーブル権限、関数権限を読み取った
- 本番スコア送信は0件

## 未確認

- コード内Publishable keyと正式Project URLの完全な組み合わせ確認
- `submit_score`のHTTP実RPC疎通
- `public.games`への登録内容とSQL変更案
- v3と旧版を分離するランキング取得方法のユーザー承認
- Phase 5Bの1プレイ1送信、公式限定、タイムアウト、失敗時の結果保持

## 後続停止条件

URLの対応、`namioshi`の登録、v3と旧版の分離方法が確定するまで、ランキング送信を有効にしない。SQL変更が必要な場合は、SQL案を別途提示し、ユーザー承認前には実行しない。

## 次の作業

1. この監査文書を独立レビューし、監査事実と推測が混ざっていないことを確認する。
2. ユーザー承認後に、URL、`public.games`登録、v3と旧版の分離方法を確定する。
3. Phase 5Bで送信クライアントを実装する。
4. Phase 5Cでサーバー側の上限・version検査と実RPC疎通を確認する。

## 戻し方

このPull Requestをrevertする。コード、Supabaseスキーマ、ランキングデータ、本番送信状態は変更していない。