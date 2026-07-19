# zeroverse 🌐

**zeroverse** は、ゼロ次元のメタバース内で human 社会をシミュレートする対戦ゲームである。

プレイヤーは human の意思決定アルゴリズム（**brain**）を書いて投入する。world には複数プレイヤーの brain がそれぞれ多数の human に割り当てられ（例：100 human × 100 brain で 10000 人）、長期間（例：1000 年）回して社会の豊かさを競う。

設計原則は一つだけ。

> **human 以外の要素を world に用意しない。**

貨幣、家族、契約、評判、制度はすべて brain の戦略として創発させる。

## 実装計画

- [PLAN.md](./PLAN.md) — フェーズ分割（P0 基盤 / M1〜M4 / P5 スケール）、反証可能な合格基準、未決事項の決定期限

## 設計ドキュメント

| ページ | 内容 |
| --- | --- |
| [概要とコンセプト](./design/00-overview.md) | 設計原則とドキュメント構成 |
| [公理系](./design/01-axioms.md) | 11 項の公理と三つの保存クラス |
| [human の仕様](./design/human.md) | ライフサイクル・stats・sex・親密度・観測と行動の WIT |
| [world の仕様](./design/world.md) | 生成パイプライン・時代プリセット・キャンペーンモード |
| [resource の設計](./design/02-resources.md) | 組成保存・自由エネルギー・invoke の WIT |
| [skill の設計](./design/03-skills.md) | 教育の仕様・teach/learn の WIT |
| [市場の設計](./design/04-market.md) | 板・貨幣の創発・standing order の WIT |
| [血縁と婚姻](./design/05-kinship.md) | 50/50 継承・conceive・出産の観測非対称 |
| [通信とシグナリング](./design/06-communication.md) | 実コスト通信の原則 |
| [採点](./design/07-scoring.md) | Shapley 値と凹効用 |
| [実装アーキテクチャ](./design/08-architecture.md) | 決定論チェックリスト・三形態デプロイ |
| [WIT パッケージ全体像](./design/09-wit-draft.md) | 型定義の分散マップ・不変の原則 |
| [追加アイデア](./design/10-ideas.md) | 文字・思考コスト・LLM 前提 |
| [未決事項](./design/90-open-questions.md) | 意図的に未決の論点 |
| [破棄した案](./design/91-rejected.md) | 同じ案を再提案しないための記録 |

WIT の型定義は単一ファイルに集約せず、仕様を詰めるトピックごとのページに分散してある。各ページ末尾の「詰めるべき点」チェックリストが P0-1（WIT 確定）の作業リストになる。

## リポジトリ

- [kuboon/zero-verse](https://github.com/kuboon/zero-verse)
