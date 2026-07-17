# human の仕様

human は world に存在する唯一の要素である（[設計原則](./00-overview.md)）。

**brain と human は別物**：brain はプレイヤーが書く意思決定アルゴリズム、human は world 内の個体。1 つの brain が多数の human に割り当てられる。brain の同一性は観測できず、観測できるのは human の行動の履歴のみ（[公理 8](./01-axioms.md)）。

## ライフサイクル

1. **出生**：conceive の相互指定が成立すると誕生する（[05-kinship.md](./05-kinship.md)）。
2. **0〜6歳**：world 提供の共通 baby brain で動く。
3. **6歳**：父母どちらかの brain を 50% ずつの確率で引き継ぐ。切替は観測不能。
4. **老化**：stats が低下し、memory 上限が減る（物忘れ）。
5. **死**：寿命（`max-lifespan-months`）で死ぬ。死は知人にのみ `someone-died` イベントで通知される。

## stats（能力曲線）

- 身体能力は年齢の関数として変化し、実行可能なアクション（`available-actions`）を決める（[公理 3](./01-axioms.md)）。
- train で上げ、老化で下がる。移転不可・非保存（[保存クラス](./01-axioms.md)）。
- stat の名前は world 共通（health など）。resource-id と違いシャッフルしない。

## アクション枠

- 毎月の decide で `acts` を返し、枠数まで実行される。枠数は stats に依存する（基準値は `world-config.act-slots-base`）。
- teach と learn は教師・学習者の両方の枠を消費する（[03-skills.md](./03-skills.md)）。

## 思考コスト（fuel）

- decide の WASM fuel 消費は、その human の food 消費に写像される。重い brain は自分の食費で遅さを払う（[10-ideas.md](./10-ideas.md)）。
- 今月の思考予算 `fuel-budget` は food 残高から算出され、snapshot で渡される。
- fuel 切れ / trap / 不正 decision は「その月は idle」に潰される（[08-architecture.md](./08-architecture.md)）。

## 記憶（memory）

- decide はステートレスな純関数。状態は memory blob として明示的に出入りし、world 側が human の一部として保存する。
- memory サイズ上限（`memory-limit`）は年齢の関数。

## 知人（acquaintance）

- 獲得経路は introduce（triadic closure）と、確率 ε の偶発的出会い（[公理 6](./01-axioms.md)）。
- 知人について観測できるのは `apparent-age`（粗い年齢）、`alive`、`relation-hint`、`last-interaction` のみ。**相手の resource と stats は観測不能**。豊かさすら行動からしか推定できない。
- 知人リストの上限は未決（[90-open-questions.md](./90-open-questions.md) #2）。

## WIT：観測（human が見えるもの）

```wit
interface observation {
  use types.{human-id, resource-id, skill-id, qty, month, resource-stack};

  record snapshot {
    now: month,
    self-view: self-view,
    acquaintances: list<acquaintance>,
    events: list<event>,        // 先月自分に起きたこと
    market: list<board-quote>,  // 板の公開気配 → 04-market.md
  }

  record self-view {
    id: human-id,
    age-months: u32,
    stats: list<stat>,              // 名前は world 共通（health など）
    resources: list<resource-stack>,
    skills: list<skill-view>,       // → 03-skills.md
    available-actions: list<action-kind>,
    fuel-budget: u64,               // 今月の思考予算（food 残高から算出）
    memory-limit: u32,              // 今月の memory 上限バイト（年齢の関数）
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
    trade-executed(trade-info),     // → 04-market.md
    teach-progressed(teach-info),   // → 03-skills.md
    skill-acquired(skill-id),
    introduced(introduction-info),
    encountered(human-id),          // ε 由来の偶発的出会い
    child-born(human-id),           // → 05-kinship.md
    someone-died(human-id),         // 知人の死のみ通知
    proposal-received(proposal),
    action-failed(action-kind),     // 失敗理由は返さない
  }

  record transfer-info { from: human-id, stack: resource-stack }
  record introduction-info { via: human-id, subject: human-id }
}
```

設計判断：**snapshot に他人の推定を入れない**。「鉄を売っている → 製鉄 skill 持ち」の推論は events と market の生データから brain が自力で行う。world が推定を配ると無料の情報になる。snapshot に入れた情報は無料の全知になるので、「自分の内側は全部見える、他人は行動の痕跡だけ」の線を守る（[不変の原則](./09-wit-draft.md)）。

## WIT：行動（human ができること）

```wit
interface action {
  use types.{human-id, resource-id, skill-id, qty, resource-stack};

  record decision {
    acts: list<act>,               // 今月実行（枠数は stats に依存）
    orders: list<standing-order>,  // 毎月全交換 → 04-market.md
    memory: list<u8>,
  }

  variant act {
    harvest,                       // Φ を採る → 02-resources.md
    craft(craft-args),             // 変換を試す（実験を兼ねる）→ 02-resources.md
    train(stat-target),
    give(give-args),               // 一方的贈与 → 02-resources.md
    teach(teach-args),             // → 03-skills.md
    learn(learn-args),             // → 03-skills.md
    introduce(introduce-args),
    conceive(human-id),            // 相互指定で成立 → 05-kinship.md
    idle,
  }

  record introduce-args { to: human-id, subject: human-id }
}
```

設計判断：**拒否アクションはない**。応じない = 対応する act / order を出さない。

## 詰めるべき点

- [ ] `stat` / `stat-target` の確定：stat の一覧（health / strength / …？）、能力曲線の形、train の効果式。
- [ ] `action-kind` の確定：available-actions の粒度（act 種別のみか、対象込みか）。
- [ ] 餓死の有無：food を消費できない月に何が起きるか（stats 低下か即死か）。M1 の消費と生存モデルで確定する。
- [ ] `apparent-age` の粒度（年単位か、より粗いか）。
- [ ] `proposal` の定義：proposal-received が何を運ぶか（teach / conceive の申し出か。無料シグナルにならない設計にする必要がある → [06-communication.md](./06-communication.md)）。
- [ ] 知人リストの上限（[90-open-questions.md](./90-open-questions.md) #2。まず定数で入れる方針 → [PLAN.md](../../PLAN.md)）。
- [ ] 出生直後（0歳）の扱い：baby brain の decide は呼ばれるか、親の枠で養育するのか。
