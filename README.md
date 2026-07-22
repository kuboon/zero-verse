# zeroverse 🌐

**zeroverse** は、ゼロ次元のメタバース内で human 社会をシミュレートする対戦ゲームである。

プレイヤーは human の意思決定アルゴリズム（**brain**）を書いて投入する。world には複数プレイヤーの brain がそれぞれ多数の human に割り当てられ（例：100 human × 100 brain で 10000 人）、長期間（例：1000 年）回して社会の豊かさを競う。優れた brain が出揃った world には、時間の進みを落として人間が直接参加できる（3ヶ月で一生を疑似体験する人生シミュレータ）。

## 設計原則

設計原則は一つだけ。

> **human 以外の要素を world に用意しない。**

貨幣、家族、契約、評判、制度はすべて brain の戦略として創発させる。制度も「要素」であり、world 側に実装してはならない（例外は実験用パラメータとしての切り替えのみ）。

## サイトとドキュメント

サイトは [`pages/`](./pages) の Remix v3 SSG（[remix3-ssg-gh-pages](https://github.com/kuboon/remix3-ssg-gh-pages) 構成）でビルドし、GitHub Pages に公開する。

- **[landing](https://kuboon.github.io/zero-verse/)** — 入口
- **[play](https://kuboon.github.io/zero-verse/play/)** — ブラウザ内で engine と wasm component の brain を実行する観戦 UI（ソースは [`pages/static/play/`](./pages/static/play)）
- **[docs](https://kuboon.github.io/zero-verse/docs/)** — 設計ドキュメント（ソースは [`pages/content/docs/`](./pages/content/docs)）

| パス | 内容 |
| --- | --- |
| [pages/content/docs/plan.md](./pages/content/docs/plan.md) | 実装計画（フェーズ分割・マイルストーン・合格基準） |
| [pages/content/docs/](./pages/content/docs/) | 設計ドキュメント（公理系、human / resource / skill / 市場 / 血縁 / 採点 / アーキテクチャ）。WIT の型定義は各トピックの md に分散 |
| [pages/content/docs/wit.md](./pages/content/docs/wit.md) | brain ⇔ engine 接続仕様（WIT）の全体像と分散マップ |

設計ドキュメントは `pages/content/docs/` を source of truth とし、設計変更はここに反映する。

```sh
cd pages
deno task dev     # ローカル開発サーバ
deno task build   # 静的サイトを pages/dist に生成
```

## ステータス

**P0（基盤 + wasmtime 統合）と M1〜M4（交易・貨幣・教育・血縁投資の創発）を達成。** 決定論エンジン・環境循環・空間・skill・市場・血縁・参照 brain を実装済み。`cargo run -p zeroverse-cli -- m1` で交易 vs 自給自足の生涯消費比（全シードで > 1.0）を再現できる。brain と scenario（init + クリア判定）は **WASM component** として動く：`scripts/build-guests.sh` でビルドし、`zeroverse-wasm run --scenario ... --brain 0=...` で「法則を知らずに生まれた brain が実験から食事を発見して生き延びる」デモが走る。ブラウザでは [play ページ](https://kuboon.github.io/zero-verse/play/)で同じランを観戦できる。詳細は [pages/content/docs/plan.md](./pages/content/docs/plan.md)。

### 実装セッションの読み順

1. [overview.md](./pages/content/docs/overview.md) — 設計原則と全体像
2. [axioms.md](./pages/content/docs/axioms.md) — 公理系（11 項）。これが仕様の憲法
3. [human.md](./pages/content/docs/human.md) / [world.md](./pages/content/docs/world.md) — 二大エンティティ
4. [resources.md](./pages/content/docs/resources.md) / [skills.md](./pages/content/docs/skills.md) — M1 の中核メカニクス
5. [wit.md](./pages/content/docs/wit.md) — WIT の骨格・分散マップ・不変の原則
6. [plan.md](./pages/content/docs/plan.md) — フェーズ一覧とマイルストーンの合格基準

各設計 md 末尾の「詰めるべき点」チェックリストと [open-questions.md](./pages/content/docs/open-questions.md) が未決の全リスト。
