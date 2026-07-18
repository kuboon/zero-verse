# 概要とコンセプト

## コンセプト

**zeroverse** は、ゼロ次元のメタバース内で human 社会をシミュレートする対戦ゲームである。

- プレイヤーは human の意思決定アルゴリズム（**brain**）を書いて投入する。
- world には複数プレイヤーの brain がそれぞれ多数の human に割り当てられる（例：100 human × 100 brain で 10000 人）。
- 長期間（例：1000 年）回して社会の豊かさを競う。
- 優れた brain が出揃った world には、時間の進みを落として人間が直接参加できる（3ヶ月で一生を疑似体験する人生シミュレータ）。

## 設計原則

設計原則は一つ。

> **human 以外の要素を world に用意しない。**

貨幣、家族、契約、評判、制度はすべて brain の戦略として創発させる。制度も「要素」であり、world 側に実装してはならない（例外は実験用パラメータとしての切り替えのみ）。

## ドキュメント構成

| ファイル | 内容 |
| --- | --- |
| [01-axioms.md](./01-axioms.md) | 公理系（9 項）と三つの保存クラス |
| [human.md](./human.md) | human の仕様（ライフサイクル・stats・sex・親密度・観測と行動の WIT） |
| [02-resources.md](./02-resources.md) | resource の設計（組成保存・自由エネルギー・craft の WIT） |
| [03-skills.md](./03-skills.md) | skill の設計と教育の仕様（teach/learn の WIT） |
| [04-market.md](./04-market.md) | 市場の設計（板・貨幣の創発・standing order の WIT） |
| [05-kinship.md](./05-kinship.md) | 血縁と婚姻（conceive・出産の観測非対称） |
| [06-communication.md](./06-communication.md) | 通信とシグナリング |
| [07-scoring.md](./07-scoring.md) | 採点（Shapley 値） |
| [08-architecture.md](./08-architecture.md) | 実装アーキテクチャと決定論チェックリスト |
| [09-wit-draft.md](./09-wit-draft.md) | WIT パッケージ全体像（型定義の分散マップ・不変の原則） |
| [10-ideas.md](./10-ideas.md) | 追加アイデア（採用方針） |
| [90-open-questions.md](./90-open-questions.md) | 未決事項 |
| [91-rejected.md](./91-rejected.md) | 経緯メモ（破棄した案） |

WIT の型定義は単一ファイルに集約せず、仕様を詰めるトピックごとの md に分散してある。全体の骨格と分散マップは [09-wit-draft.md](./09-wit-draft.md)。各 md 末尾の「詰めるべき点」チェックリストが P0-1（WIT 確定）の作業リストになる。
