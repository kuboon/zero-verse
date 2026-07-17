# zeroverse 🌐

**zeroverse** は、ゼロ次元のメタバース内で human 社会をシミュレートする対戦ゲームである。

プレイヤーは human の意思決定アルゴリズム（**brain**）を書いて投入する。world には複数プレイヤーの brain がそれぞれ多数の human に割り当てられ（例：100 human × 100 brain で 10000 人）、長期間（例：1000 年）回して社会の豊かさを競う。優れた brain が出揃った world には、時間の進みを落として人間が直接参加できる（3ヶ月で一生を疑似体験する人生シミュレータ）。

## 設計原則

設計原則は一つだけ。

> **human 以外の要素を world に用意しない。**

貨幣、家族、契約、評判、制度はすべて brain の戦略として創発させる。制度も「要素」であり、world 側に実装してはならない（例外は実験用パラメータとしての切り替えのみ）。

## ドキュメント

| パス | 内容 |
| --- | --- |
| [PLAN.md](./PLAN.md) | 実装計画（フェーズ分割・マイルストーン・合格基準） |
| [docs/design/](./docs/design/) | 設計ドキュメント（公理系、human / resource / skill / 市場 / 血縁 / 採点 / アーキテクチャ）。WIT の型定義は各トピックの md に分散 |
| [docs/design/09-wit-draft.md](./docs/design/09-wit-draft.md) | brain ⇔ engine 接続仕様（WIT）の全体像と分散マップ |

### 設計の原典

本リポジトリの設計ドキュメントは、claude.ai 上の設計セッション（2026-07）の引き継ぎ資料を展開したもの。原典は以下。

- [zeroverse 設計引き継ぎ](https://ol.kbn.one/doc/zeroverse-OJAc78Uo1G)
- [WIT インターフェース草案](https://ol.kbn.one/doc/wit-8Iy8e00jzV)

今後はこのリポジトリの `docs/design/` を source of truth とし、設計変更はここに反映する。

## ステータス

**計画フェーズ。実装は未着手。** 実装は [PLAN.md](./PLAN.md) のフェーズ 0 から始める。
