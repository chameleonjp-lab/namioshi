# namioshi v3 Supabase監査

- 監査日: 2026-08-09
- 対象ブランチ: `main`
- 対象基準コミット: `85c2deb1d8cd6df0af7e820defdc97a529e2d06f`（Pull Request #40マージ後）
- 対象Phase: Phase 5A（Supabaseと旧ランキングの監査）

## 結論

読み取り専用の監査で、Supabaseプロジェクト自体、RPCの定義、テーブル権限、`namioshi` の既存記録を確認した。

現時点で `namioshi` の本番スコアは0件で、旧記録との混在は確認されなかった。しかし、ランキング送信を有効にできる状態ではない。理由は次の4点である。

1. 現行コードの `SUPABASE_URL` が、確認できた正式Project URLと一致しない。
2. `public.games` に `namioshi` の登録がなく、現行 `submit_score` はこのslugを受け付けない。
3. `client_version` は `score_runs` に保存されるが、既存のランキング取得関数は `game_scores` を読むため、v3と旧版を分ける条件を持たない。
4. 現行クライアントはPublishable keyを使う一方、`Authorization: Bearer`も送る実装が残っている。これはPhase 5Bで修正する。

この文書では本番スコアを送信していない。SQL変更、テーブル変更、RPC変更、ランキング再開も行っていない。

2026-08-13追記: 上記1と4は後続のクライアント修正で、正式Project URLへの一致とBearer削除まで完了した。`namioshi`未登録、既存取得RPCの版分離不足、未適用の専用サーバー契約、実疎通未確認は残る。ランキングは引き続き無効である。

## 1. プロジェクト情報

| 項目 | 確認結果 |
|---|---|
| Supabase project name | `chameleonJP-Lab` |
| project ref | `mlpnjgezrnhdxsxolyzj` |
| 状態 | `ACTIVE_HEALTHY` |
| region | `ap-northeast-1` |
| 正式Project URL | `https://mlpnjgezrnhdxsxolyzj.supabase.co` |
| 添付 `SUPABASE_URL.txt` | 正式Project URLと一致 |
| DB | PostgreSQL 17.6.1 |

監査時点の`src/config.js`は別URLを使っていた。後続修正後の現行コードは、上表の正式Project URLへ一致している。

## 2. Publishable key

- Supabase projectには無効化されていないPublishable keyが1件ある。
- コードと添付資料は、Publishable key形式（`sb_publishable_...`）を使っている。
- この文書にはキーの実値を書かない。
- `src/config.js` と公開用生成物にsecret key、service_role keyを入れないことをPhase 5Bで再確認する。

今回の監査では、キーの実値を文書へ保存しない方針を優先した。コード内のキーとSupabase管理画面の有効キーの完全一致は、Phase 5B開始前に安全な環境で確認する。

## 3. RPCの定義

| RPC | 入力 | 戻り値 | 実行権限・方式 |
|---|---|---|---|
| `submit_score` | `p_display_name text`, `p_game_slug text`, `p_score integer`, `p_client_version text default ''` | `accepted`, 正規化名、表示名、初回得点、最高得点、プレイ回数、初回判定、新記録判定 | `SECURITY DEFINER`、ownerは`postgres`、`PUBLIC`と`anon`がEXECUTE |
| `get_best_score_ranking` | `p_game_slug text`, `p_limit integer default 100` | 順位、表示名、初回得点、最高得点、プレイ回数、更新日時 | `SECURITY DEFINER`、`PUBLIC`・`anon`・`authenticated`がEXECUTE |
| `get_first_try_ranking` | `p_game_slug text`, `p_limit integer default 100` | 順位、表示名、初回得点、最高得点、プレイ回数、更新日時 | `SECURITY DEFINER`、`PUBLIC`・`anon`・`authenticated`がEXECUTE |
| `get_game_play_stats` | `p_game_slug text` | 合計プレイ回数、参加人数 | `SECURITY DEFINER`、`PUBLIC`・`anon`・`authenticated`がEXECUTE |

`submit_score` は、名前の空欄・20文字超過、スコアの範囲、activeなゲームの存在を確認してから、`players`、`score_runs`、`game_scores`へ書き込む。`p_client_version`は`score_runs.client_version`へ保存される。

ただし、`get_best_score_ranking`と`get_first_try_ranking`は`game_scores`だけを読み、`client_version`を条件にしていない。`game_scores`にも`client_version`列はない。このため、将来旧記録が入った場合に、現在のRPCだけではv3記録だけのランキングを作れない。

## 4. `namioshi` の登録と既存記録

### `public.games`

`game_slug = 'namioshi'`で検索した結果は0行だった。したがって、次の表示設定はまだ確認できない。

- `score_order`
- `score_unit`
- `score_scale`
- `score_decimals`
- `score_label`
- `first_score_label`
- `best_score_label`
- `top_ranking_type`
- `submission_mode`

`submit_score`はactiveな`public.games`行を先に検索するため、現状のデータベースでは`p_game_slug = 'namioshi'`を送っても`game not found`になると判断できる。実スコア送信による確認は行っていない。

### 既存記録

| 対象 | `namioshi`の件数 |
|---|---:|
| `public.score_runs` | 0 |
| `public.game_scores` | 0 |
| `public.game_play_events` | 0 |
| `score_runs.client_version`が`namioshi-v3`で始まる記録 | 0 |
| 上記以外の`score_runs`記録 | 0 |

現時点では、`namioshi`の旧記録を保全・アーカイブする作業は発生していない。ただし、旧版とv3を分けて表示する仕組みはまだないため、送信再開前の判断は残る。

## 5. 権限と直接書き込み

- `public.games`、`public.players`、`public.game_scores`、`public.score_runs`、`public.game_play_events`は、確認時点でRLSが有効だった。
- `anon`には`public.games`のSELECTポリシー（`is_active = true`）がある。
- `anon`には`public.score_runs`のSELECT権限がない。
- `anon`には`public.score_runs`のINSERT権限がない。
- `authenticated`にも`public.score_runs`のINSERT権限がない。
- `anon`から`submit_score(text,text,integer,text)`をEXECUTEできる権限がある。

直接INSERTについては、権限メタデータで`anon_insert_score_runs = false`を確認した。productionへINSERTを試す検査は実行していない。したがって、ここでの結論は「直接INSERT権限はない」であり、HTTP経由の拒否応答まで確認したという意味ではない。

`submit_score`は`SECURITY DEFINER`で、公開されたRPCからテーブルへ書き込む設計である。Phase 5Cでは、現在の汎用上限だけでなく、namioshi v3の理論上限、許可する`client_version`、ゲームslug、異常スコアの扱いを別途確認する。

## 6. 現行クライアントとの照合

| 確認項目 | 現行状態 |
|---|---|
| `GAME_SLUG` | `namioshi` |
| `CLIENT_VERSION` | `namioshi-v3.2.0-official003` |
| 送信状態 | `RANKING_SERVICE_STATE.enabled = false`。明示承認まで停止 |
| 送信関数 | `src/services/ranking.js`に存在するが、現行`main.js`から送信開始されていない |
| 本文 | 専用RPC向けの名前、slug、score、client version、play ID、rule version、seasonの7項目 |
| `apikey` | Publishable keyを設定 |
| `Authorization` | 送らない |
| URL | 正式Project URLと一致 |

ランキング送信を停止しているため、今回確認した0件は「停止中だから送信されていない」状態と整合する。

## 7. v3と旧記録の分離判断

現時点で`namioshi`の既存記録は0件なので、旧記録の移行やアーカイブは不要である。しかし、将来の混在を防ぐ設計は未決定である。

次のいずれかをユーザー承認後に決める。

1. `client_version`を条件にしたv3専用ランキング取得を追加する。
2. `score_runs`からv3用の集計を作り、既存の`game_scores`ランキングと分ける。
3. 旧記録を別期間・別シーズンとして扱う。
4. `game_slug`を分ける。ただし、現在の`DECISION_LOG.md`にある`namioshi`固定の決定変更が必要である。

現時点の推奨は、`game_slug`を変えず、v3用の判定条件をサーバー側へ追加してから送信を再開する方法である。具体的なSQLやRPC変更は、Phase 5Cで別提案し、ユーザー承認前には実行しない。

## 8. 今回の監査で行っていないこと

- `submit_score`の本番呼び出し
- 架空スコアの送信
- `public.games`への登録
- SQL、RPC、RLS、権限、データの変更
- ランキング送信の有効化
- Codeberg Pagesへの公開

## 9. 次の作業

1. URLとPublishable keyの対応を確定する。
2. `namioshi`の`public.games`登録内容をユーザー承認付きで決める。
3. v3と旧版を分離するサーバー側の方法を決める。
4. Phase 5BでURL、ヘッダー、1プレイ1送信、公式モード限定、失敗時の結果保持を実装する。
5. Phase 5Cで理論上限、許可version、RPC実疎通、実験場の登録条件を確認する。

## 監査方法

- Supabase接続済みプロジェクトのメタデータ取得
- project URLとPublishable key一覧の読み取り
- `public`スキーマのテーブル、列、RLS状態、行数の読み取り
- `information_schema`、`pg_proc`、`pg_policies`、権限情報の読み取り
- GitHub mainの`src/config.js`、`src/services/ranking.js`、`src/main.js`との照合

本書の件数・定義・権限は、監査日時点の読み取り結果である。後からデータや権限が変わった場合は、Phase 5BまたはPhase 5C開始前に再確認する。
