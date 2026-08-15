# CURRENT_TASK: 10回タップと水系効果音（Draft）

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準main: `c3ec10a6e74467bfd8e8ba727b02c634541d01d2`（Pull Request #66統合後）
- 対応ブランチ: `agent/namioshi-ten-taps-water-audio`
- Pull RequestはDraftのままにする
- ユーザー確認前にマージしない
- `RANKING_SERVICE_STATE.enabled=false`を維持する

## 前工程の結果

Pull Request #60で波速110と二段階の経路台帳、#61で初回案内の成功確認と練習配置制約、#62で同時確定時の反射種別集約通知、#63で結果画面の最高経路と次の目標、#64で波・反射板・ビーコンの凡例、#65で目的・得点条件・6回後の待機表示、#66で命中確認と得点確定の区別をmainへ統合した。各PRのNode.js 18・20・22 Actionsは成功済みである。

この自動結果は、実ブラウザ、iPhone・iPad、人が初見で経路を発見できることの証明ではない。ランキング、ランキング再開、Supabase、Ready化は停止中である。

## 今回の目的

プレイの判断回数を6回から10回へ増やし、30秒の中でより多くの反射経路を試せるようにする。タップ増加に伴うhard ceiling、ルール版、client version、ranking seasonを更新し、旧ルールの記録を分離する。さらに、タップ・反射・命中・得点確定・RESULTの各アクションへ水を想起させる短い合成SEを追加する。既存の判定音、音なし表示、物理、二段階台帳は維持する。

## 実装範囲

- `MAX_TAPS=10`、`SCORE_HARD_CEILING=10800`、client version / rule version / ranking seasonを更新する。
- HOME、RULES、PLAYING HUD、練習入口、10回後の待機表示を更新する。
- 戦略分析を10入力・1/4/7/10/13/16/19/22/25/28秒の共通時刻列へ更新し、snapshotを再生成する。
- タップを水面の波紋、壁・反射板を返る波、ビーコン命中を水しぶき、正の得点確定を水滴、RESULTを静かな水面として低音量の水系cueへ配線する。
- 既存の判定音、音量設定、初期オフ、visibility/pagehide停止、振動、物理、得点台帳、ランキング無効状態を変更しない。
- 命中確認と得点確定の表示文言、既知経路の0点表示、狭い画面で折り返せるCSS契約を維持する。

## 自動受入条件

| 条件 | 受入値 |
|---|---:|
| タップ上限 | 10回を受理し、11回目を拒否 |
| 構造上限 | 10根波×3ビーコン×360点 = 10800点、内訳と台帳が一致 |
| 戦略分析 | calibration/holdout、同地点、2地点、設計fixture、20/30/60/120Hzをsnapshot固定 |
| 水系SE | 水系cueが定義され、タップ/反射/命中/得点確定/RESULTへ接続 |
| 命中・精算表示 | 「命中確認：」「得点確定：+N」「発見済み（得点なし）」を維持 |
| 既存自動試験 | すべて成功 |

## 変更しない範囲

- 波速110、寿命3秒、最大2回反射、30秒、得点基礎値、公式配置ID・座標・指紋・配置版
- 二段階台帳の上限と経路選抜順序、命中確認と得点確定の表示、30秒締切精算
- 二段階台帳の上限と経路選抜順序、同時確定通知、結果画面の得点表示
- 公式・練習の保存分離、ランキング送信・表示、Supabase SQL/RPC/RLS、本番データ
- iPhone・iPad、実ブラウザ、水系SEの聞き分け、WebGL復旧、長時間動作の実機合格
- Ready化、ユーザー確認前のマージ

## 検証手順

```bash
npm test
npm run build
npm run analyze:layouts
npm run analyze:strategy
npm run render:layouts
npm run verify
npm run size
git diff --check
```

生成物`dist`はbuild後に差分がなく、Draft ActionsのNode.js 18・20・22で同じ検査を通すことを受入条件とする。

## 未確認として残す項目

- 実ブラウザで水系SEの聞き分けと音なし表示が妥当であること
- iPhone・iPadの狭い画面で10回表示と長い精算通知が読みやすいこと
- 初見3〜5プレイで10回の使い分けと反射経路を発見・再現できること
- ランキング再開、Supabase適用、Phase 8B/8C/8Dの完了

## 戻し方

このDraftのコミットだけをrevertし、PR #66統合後のmain `c3ec10a6e74467bfd8e8ba727b02c634541d01d2`へ戻す。外部サービスとランキングは無効のため、外部データの戻し作業は発生しない。
