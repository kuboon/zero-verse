# WIT インターフェース草案

> 原典：[WIT インターフェース草案](https://ol.kbn.one/doc/wit-8Iy8e00jzV)（v0.1、claude.ai セッション 2026-07 時点）

brain と engine の接続仕様の草案。設計判断の背景は親文書（[08-architecture.md](./08-architecture.md) ほか）を参照。**実装時に型は変わってよいが、末尾の「不変の原則」は変えない。**

## 方針

1. **float 禁止**。量はすべて固定小数点（qty = 1/1000 単位の u64）。
2. ID はすべて不透明な u64。resource-id と skill-id は world 生成時にシャッフル。human-id は連番にしない。
3. decide は「即時アクション + standing orders（立て看板）」を返す。月内の相互作用はエンジンが宣言同士を突き合わせて解決する。decide の呼び出しは月一回。

## WIT 草案

```wit
package zeroverse:world@0.1.0;

interface types {
  type human-id = u64;
  type resource-id = u64;
  type skill-id = u64;
  type qty = u64;          // 固定小数点 1/1000
  type month = u32;        // world 開始からの通算月

  record resource-stack {
    resource: resource-id,
    amount: qty,
  }
}

interface observation {
  use types.{human-id, resource-id, skill-id, qty, month, resource-stack};

  record snapshot {
    now: month,
    self-view: self-view,
    acquaintances: list<acquaintance>,
    events: list<event>,        // 先月自分に起きたこと
    market: list<board-quote>,  // 板の公開気配
  }

  record self-view {
    id: human-id,
    age-months: u32,
    stats: list<stat>,              // 名前は world 共通（health など）
    resources: list<resource-stack>,
    skills: list<skill-view>,
    available-actions: list<action-kind>,
    fuel-budget: u64,               // 今月の思考予算（food 残高から算出）
    memory-limit: u32,              // 今月の memory 上限バイト（年齢の関数）
  }

  record skill-view {
    skill: skill-id,
    proficiency: qty,
    // この skill が何をアンロックするかは書かない。
    // available-actions との差分から brain が推測する
  }

  record acquaintance {
    id: human-id,
    apparent-age: u32,        // 粗い年齢のみ
    alive: bool,
    relation: relation-hint,
    last-interaction: option<month>,
  }

  // world が保証できる関係だけを列挙。それ以外は unknown
  enum relation-hint {
    self-child,
    self-parent,
    spouse,
    unknown,
  }

  variant event {
    received-transfer(transfer-info),
    trade-executed(trade-info),
    teach-progressed(teach-info),
    skill-acquired(skill-id),
    introduced(introduction-info),
    encountered(human-id),          // ε 由来の偶発的出会い
    child-born(human-id),
    someone-died(human-id),         // 知人の死のみ通知
    proposal-received(proposal),
    action-failed(action-kind),     // 失敗理由は返さない
  }

  record transfer-info { from: human-id, stack: resource-stack }
  record introduction-info { via: human-id, subject: human-id }
}

interface action {
  use types.{human-id, resource-id, skill-id, qty, resource-stack};

  record decision {
    acts: list<act>,               // 今月実行（枠数は stats に依存）
    orders: list<standing-order>,  // 毎月全交換
    memory: list<u8>,
  }

  variant act {
    harvest,                       // Φ を採る
    craft(craft-args),             // 変換を試す（実験を兼ねる）
    train(stat-target),
    give(give-args),               // 一方的贈与
    teach(teach-args),
    learn(learn-args),
    introduce(introduce-args),
    conceive(human-id),            // 相互指定で成立
    idle,
  }

  record craft-args {
    inputs: list<resource-stack>,  // 組み合わせ自由。レシピ ID は存在しない
    using-skills: list<skill-id>,
  }

  record teach-args { student: human-id, skill: skill-id }
  record learn-args { teacher: human-id, skill: skill-id }
  record introduce-args { to: human-id, subject: human-id }

  variant standing-order {
    limit-order(limit-order),
    conditional-give(cond-give),
  }

  record limit-order {
    give-resource: resource-id,
    give-amount: qty,
    want-resource: resource-id,
    want-amount: qty,      // 価格 = want/give
    partial: bool,
  }

  record cond-give {
    to: human-id,
    stack: resource-stack,
    condition: give-condition,
  }

  variant give-condition {
    if-received(resource-stack),
    if-taught-me(skill-id),        // 徒弟制の分割払いを月単位でアトミックにする
    unconditional-scheduled,
  }
}

interface probe {
  use types.{human-id, month};

  // fuel を追加消費する import。world 状態の読み取りのみで決定論的

  // 指定した知人の公開市場での売買履歴（板は記名）
  trade-history: func(who: human-id, since: month) -> list<public-trade>;

  // 紹介ネットワーク上の自分とのホップ数
  graph-distance: func(who: human-id) -> option<u32>;
}

world brain {
  import probe;

  export init: func(config: world-config) -> ();
  export decide: func(snap: observation.snapshot, memory: list<u8>)
    -> action.decision;
}

record world-config {
  months-per-year: u32,     // 12
  max-lifespan-months: u32,
  act-slots-base: u32,
  // 法則グラフに関する情報は一切含まれない
}
```

**未定義**：`board-quote`、`trade-info`、`teach-info`、`proposal`、`stat`、`stat-target`、`action-kind`、`public-trade` は未定義。実装時に確定する（[PLAN.md](../../PLAN.md) フェーズ 0 の作業）。

## 設計判断の要点

- **craft にレシピ ID を渡さない**。任意の組み合わせを投入し、法則グラフに合致すれば産出、しなければ材料の一部を失い action-failed。レシピという概念は world に存在せず、brain の memory の中にだけ育つ。実験と生産は同一アクション。
- **action-failed は理由を返さない**。前提 skill 不足か、材料違いか、state 不足かは再試行で切り分ける。この不透明さが実験という行為を生む。
- **snapshot に他人の推定を入れない**。「鉄を売っている → 製鉄 skill 持ち」の推論は events と market の生データから brain が自力で行う。world が推定を配ると無料の情報になる。
- **相手の resource と stats は観測不能**。豊かさすら行動からしか推定できない。
- **拒否アクションはない**。応じない = 対応する act / order を出さない。
- 月内解決順序は「teach/learn 成立 → conditional-give 判定 → 板マッチング」で固定。
- 板マッチングは価格優先、同価格内はシード付きシャッフル（時間優先は decide 呼び出し順を情報チャネルにするため禁止）。
- probe の trade-history は板が記名であることを前提とする。

## 不変の原則（型を変えても守る）

1. decide はステートレスな純関数。状態は memory blob 経由のみ。
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
