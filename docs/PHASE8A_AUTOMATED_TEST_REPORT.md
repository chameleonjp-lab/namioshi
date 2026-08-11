# Phase 8A 自動試験レポート

## 基準

- 対象: `chameleonjp-lab/namioshi`
- 基準main: `31f02de3b7e06f3840b99865980bb94fe73599c7`（Phase 7C PR #53統合後）
- 目的: 公開前の回帰を、物理・画面・共有・ランキング・生成物の契約として再実行できるようにする
- ランキング: `RANKING_SERVICE_STATE.enabled=false`を維持

## 今回の追加

- シェア文の得点、ゲームURL、本文を固定する試験を追加
- ネイティブ共有の成功、キャンセル、予期しない失敗からのクリップボード切替を追加
- クリップボードだけが使える環境、共有機能がない環境、コピー失敗を追加
- HOME、RULES、COUNTDOWN、PLAYING、RESULT、ERRORの画面契約を追加
- カウントダウンとプレイ開始の二重起動防止を追加確認
- RESULTのシェア、再挑戦、モード選択、終了導線を追加確認
- 入力上限とWebGLからCanvas 2Dへの切替契約を追加確認

## 自動検証

- `npm test`: 127/127成功
- `npm run build`: 成功
- `npm run verify`: 成功
- `npm run analyze:layouts`: 成功（`human-decision-pending`を維持）
- `npm run render:layouts`: 成功（SVG 2件）
- `npm run size`: 成功（容量は報告値）
- `git diff --check`: 成功

既存の物理・得点・時刻・viewport・音声・振動・端末保存・ランキング契約・描画復旧試験も同じ`npm test`で再実行する。

## 確認できない範囲

この作業場にはChromium、WebKit、Playwrightの実行環境がないため、ブラウザ自動操作は追加していない。したがって、次は未確認のまま残す。

- 実ブラウザのHOMEからRESULTまでの操作
- WebGL実コンテキスト消失とCanvas 2D切替
- iPhone・iPadの振動、safe-area、性能、長時間稼働
- Codeberg Pages上の公開確認
- Supabaseの非本番適用、本番疎通、ランキング再開

Node試験の成功を、実ブラウザ・実機確認済みとは扱わない。
