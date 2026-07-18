# WIT パッケージ全体像

brain と engine の接続仕様（v0.1）。**型の定義は仕様を詰めやすいようトピックごとの md に分散してある**（下のマップ参照）。本書はパッケージの骨格、分散マップ、不変の原則を持つ。実装時に型は変わってよいが、「不変の原則」は変えない。

## 方針

1. **float 禁止**。量はすべて固定小数点（qty = 1/1000 単位の u64）。
2. ID はすべて不透明な u64。resource-id と skill-id は world 生成時にシャッフル。human-id は連番にしない。
3. decide は月一回呼ばれ、「即時アクション + standing orders（立て看板）」を **commit import で積み上げる**（戻り値は持たない）。fuel が途中で切れても commit 済みの宣言は有効（部分実行）。月内の相互作用はエンジンが宣言同士を突き合わせて解決する。

## 分散マップ

| WIT 要素 | 定義場所 |
| --- | --- |
| `types`（human-id, month）、`world brain`、`world-config`、`probe` | 本書（下記） |
| `types`（resource-id, qty, resource-stack）、`craft-args`、harvest / give | [02-resources.md](./02-resources.md) |
| `types`（skill-id）、`skill-view`、`teach-args` / `learn-args` | [03-skills.md](./03-skills.md) |
| `standing-order`、`limit-order`、`cond-give`、`give-condition`、`board-quote` | [04-market.md](./04-market.md) |
| `conceive`、出産の観測非対称 | [05-kinship.md](./05-kinship.md) |
| 通信の搬送路（専用型なし）、約束機構、`proposal` の要否 | [06-communication.md](./06-communication.md) |
| `snapshot`、`self-view`、`stat`、`sex`、`acquaintance`（親密度）、`event`、`commit`、`act` | [human.md](./human.md) |

## WIT：パッケージ骨格

```wit
package zeroverse:world@0.1.0;

interface types {
  type human-id = u64;     // 連番にしない（出生順 = 血縁の手がかり）
  type resource-id = u64;  // → 02-resources.md
  type skill-id = u64;     // → 03-skills.md
  type qty = u64;          // 固定小数点 1/1000
  type month = u32;        // world 開始からの通算月
}

interface probe {
  use types.{human-id, month};

  // fuel を追加消費する import。world 状態の読み取りのみで決定論的。
  // 「注意力の市場」：深掘り観測だけ pull にして課金する

  // 指定した知人の公開市場での売買履歴（板は記名）→ 04-market.md
  trade-history: func(who: human-id, since: month) -> list<public-trade>;

  // 紹介ネットワーク上の自分とのホップ数 → 06-communication.md
  graph-distance: func(who: human-id) -> option<u32>;
}

world brain {
  import probe;
  import commit;   // act / order / save-memory を積み上げる → human.md

  export init: func(config: world-config) -> ();
  // 戻り値なし。宣言は commit で積む。fuel 切れ時も commit 済みは有効
  export decide: func(snap: observation.snapshot, memory: list<u8>) -> ();
}

record world-config {
  months-per-year: u32,     // 12
  max-lifespan-months: u32,
  act-slots-base: u32,
  // 法則グラフに関する情報は一切含まれない
}
```

## 未定義 record 一覧（P0-1 で確定する）

| record | 定義場所（詰める場所） |
| --- | --- |
| `board-quote` | [04-market.md](./04-market.md) |
| `trade-info` / `public-trade` | [04-market.md](./04-market.md) |
| `teach-info` | [03-skills.md](./03-skills.md) |
| `proposal` | [06-communication.md](./06-communication.md)（要否から再検討） |
| `action-kind` | [human.md](./human.md) |
| `give-args` | [02-resources.md](./02-resources.md)（草案の抜け） |

## 不変の原則（型を変えても守る）

1. decide はステートレス。月を跨いで持ち越せる状態は memory blob 経由のみ（インスタンスは毎回破棄）。出力は commit import への積み上げで、fuel 切れでも commit 済みは有効。
2. 呼び出しごとに WASM インスタンスを新規化する。共有はテレパシーになる。
3. ABI に float を入れない。wasi をリンクしない。乱数はエンジンが決定論的シードとして渡す。
4. snapshot に入れた情報は無料の全知になる。「自分の内側は全部見える、他人は行動の痕跡だけ」の線を守る。
5. fuel 消費はその human の food 消費に写像する。memory 上限は年齢の関数。

## 言語サポート

WIT 一枚で各言語のバインディングが得られる：

- Rust（cargo component）
- TypeScript/JS（jco componentize）
- Python（componentize-py）
- Go（TinyGo + wit-bindgen）

WIT ファイル自体を「LLM に brain を書かせる」パイプラインのプロンプトとして機能させる。
