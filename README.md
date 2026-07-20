# zeroverse 🌐

**zeroverse** は、ゼロ次元のメタバース内で human 社会をシミュレートする対戦ゲームである。

プレイヤーは human の意思決定アルゴリズム（**brain**）を書いて投入する。world には複数プレイヤーの brain がそれぞれ多数の human に割り当てられ（例：100 human × 100 brain で 10000 人）、長期間（例：1000 年）回して社会の豊かさを競う。優れた brain が出揃った world には、時間の進みを落として人間が直接参加できる（3ヶ月で一生を疑似体験する人生シミュレータ）。

## 設計原則

設計原則は一つだけ。

> **human 以外の要素を world に用意しない。**

貨幣、家族、契約、評判、制度はすべて brain の戦略として創発させる。制度も「要素」であり、world 側に実装してはならない（例外は実験用パラメータとしての切り替えのみ）。

## ドキュメント

`docs/` は GitHub Pages として公開する（入口は [docs/index.md](./docs/index.md)）。

| パス | 内容 |
| --- | --- |
| [docs/PLAN.md](./docs/PLAN.md) | 実装計画（フェーズ分割・マイルストーン・合格基準） |
| [docs/design/](./docs/design/) | 設計ドキュメント（公理系、human / resource / skill / 市場 / 血縁 / 採点 / アーキテクチャ）。WIT の型定義は各トピックの md に分散 |
| [docs/design/09-wit-draft.md](./docs/design/09-wit-draft.md) | brain ⇔ engine 接続仕様（WIT）の全体像と分散マップ |

設計ドキュメントは `docs/` を source of truth とし、設計変更はここに反映する。

## ステータス

**P0（基盤 + wasmtime 統合）と M1（交易は自給自足に勝つか）を達成。** 決定論エンジン・環境循環・空間・skill（harvest / 食事）・参照 brain を実装済み。`cargo run -p zeroverse-cli -- m1` で交易 vs 自給自足の生涯消費比（全シードで > 1.0）を再現できる。brain と scenario（init + クリア判定）は **WASM component** として動く：`scripts/build-guests.sh` でビルドし、`zeroverse-wasm run --scenario ... --brain 0=...` で「法則を知らずに生まれた brain が実験から食事を発見して生き延びる」デモが走る。次は M2（貨幣の創発）。詳細は [docs/PLAN.md](./docs/PLAN.md)。

### 実装セッションの読み順

1. [docs/design/00-overview.md](./docs/design/00-overview.md) — 設計原則と全体像
2. [docs/design/01-axioms.md](./docs/design/01-axioms.md) — 公理系（11 項）。これが仕様の憲法
3. [docs/design/human.md](./docs/design/human.md) / [world.md](./docs/design/world.md) — 二大エンティティ
4. [docs/design/02-resources.md](./docs/design/02-resources.md) / [03-skills.md](./docs/design/03-skills.md) — M1 の中核メカニクス
5. [docs/design/09-wit-draft.md](./docs/design/09-wit-draft.md) — WIT の骨格・分散マップ・不変の原則
6. [docs/PLAN.md](./docs/PLAN.md) — P0 の作業項目と M1 の合格基準

各設計 md 末尾の「詰めるべき点」チェックリストと [90-open-questions.md](./docs/design/90-open-questions.md) が未決の全リスト。**M1 期限の未決（#2, #11〜#15）は P0-1 の WIT 確定時に仮決めしてよい**（決定は 90 と該当 md に反映すること）。
