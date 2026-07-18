# human の仕様

human は world に存在する唯一の要素である（[設計原則](./00-overview.md)）。

**brain と human は別物**：brain はプレイヤーが書く意思決定アルゴリズム、human は world 内の個体。1 つの brain が多数の human に割り当てられる。brain の同一性は観測できず、観測できるのは human の行動の履歴のみ（[公理 8](./01-axioms.md)）。

## ライフサイクル

1. **出生**：conceive の相互指定が成立すると誕生する（[05-kinship.md](./05-kinship.md)）。誕生時に sex が 1/2 で決まる（下記）。
2. **0〜6歳**：world 提供の共通 baby brain で動く。
3. **6歳**：父母どちらかの brain を 50% ずつの確率で引き継ぐ。切替は観測不能。
4. **老化**：stats が低下し、memory 上限が減る（物忘れ）。
5. **死**：寿命（`max-lifespan-months`）で死ぬ。死は知人にのみ `someone-died` イベントで通知される。

## stats（能力曲線）

- 身体能力は年齢の関数として変化し、実行可能なアクション（`available-actions`）を決める（[公理 3](./01-axioms.md)）。
- train で上げ、老化で下がる。移転不可・非保存（[保存クラス](./01-axioms.md)）。
- stat の名前は world 共通。resource-id と違いシャッフルしない。

### stat 一覧

stat は以下の 4 種で固定する。公理系と同じく「これ以上足さない」方針。追加したくなったら、まず既存 stat の閾値・係数で表現できないかを疑う。

| stat | 何を決めるか | 能力曲線 | train |
| --- | --- | --- | --- |
| **health**（体力） | 生存そのもの。0 で死。毎月の food 消費で維持し、不足すると低下。出産で一時低下 | 最大値が加齢で単調に低下 | 不可（food で維持する） |
| **strength**（筋力） | harvest の取り分係数、craft に一月で投入できる総量 | 青年期ピークの山型 | 可 |
| **cognition**（認知） | learn の進捗速度（教育速度 T の「学習者の若さ」の実体）、craft 実験での発見確率の係数 | 幼少期に高く、老化で緩やかに低下 | 可 |
| **fertility**（生殖） | conceive の成立可否と成功確率 | 年齢窓（思春期に開き、加齢で閉じる） | 不可 |

- **アクション枠**は `act-slots-base` を health と strength で補正して決める（具体式は M1 で数値決定）。
- **memory-limit は stat にしない**。年齢の関数のまま（[不変の原則](./09-wit-draft.md) 5）。train で記憶容量を買えると老化制約が骨抜きになる。
- **知人リスト上限**を cognition の関数にする案がある（[90-open-questions.md](./90-open-questions.md) #2 は未決のまま）。
- `available-actions` は stats の閾値で決まる（例：fertility が窓内にあるときだけ conceive が現れる。6歳未満はほとんどのアクションが閉じている）。

### WIT

```wit
enum stat-kind {
  health,     // 生存。0 で死
  strength,   // 身体作業の量
  cognition,  // 学習と発見
  fertility,  // conceive
}

record stat {
  kind: stat-kind,
  value: qty,      // 0 〜 100.000（qty 刻み）
}

// train の対象。health / fertility を指定した train は action-failed
type stat-target = stat-kind;
```

### apparent-age の算出

知人観測に出る `apparent-age` は実年齢そのものではなく、**実年齢と stats から算出される見かけの年齢**。

- 年齢標準値に対する health・strength の比から活力指数 vitality を作り、`apparent-age = age × (1 + β(1 − vitality))` を**年単位に量子化**して返す。補正係数 β は world パラメータ。
- 帰結 1：見かけ年齢は stats の**正直なシグナル**になる。若く見せるには train と food の実コストがかかるため、Zahavi 原則（[06-communication.md](./06-communication.md)）と整合する。配偶者選択・教師選択の手がかりはここに乗る。
- 帰結 2：実年齢は隠れる。出生順の推定が粗くなり、血縁の手がかり漏洩（human-id 非連番と同じ動機）をさらに弱める。

## 性別（sex）

- sex は誕生時に 1/2 の確率で決まる（female / male）。**本人以外には不可視**。self-view にだけ入り、acquaintance には出ない。
- conceive は異性ペアでのみ成立する。不成立でも理由は返さない（action-failed の一般則）ので、相手の sex は conceive の試行からも確率的にしか判らない（fertility 窓外・相互指定不成立との区別がつかない）。
- 妊娠・出産のコスト（health の一時低下）は女性が負う。
- **出産の観測は非対称**：女性は `child-born` イベントで自分の子を確実に知る。男性には何も通知されず、**0歳の知人が 1 人増えるだけ**。父性の確実な証明は world のどこにも存在しない（[05-kinship.md](./05-kinship.md)）。

```wit
enum sex { female, male }   // self-view にのみ含まれる
```

## 親密度（intimacy）

human のペアは**親密度**を持つ（[公理 10](./01-axioms.md)）。stats の対人版であり、state クラス（非保存・移転不可）に属する。

- **可視性**：当事者二人だけに見え、**両者から同じ値が見える**。第三者間の親密度は観測できない。つまり配偶者は「相手が他の誰かとどれだけ親密か」を直接見ることはできない。
- **増減**：毎月、両者の stats に応じた自然増減が起きる。加えて、当事者間で action のやり取り（give / teach / learn / 板での約定 / introduce / conceive など）があるたびに増減する。具体式は未決（[90-open-questions.md](./90-open-questions.md) #6）。
- **初期値**：出生時、母子ペアには高い初期値が与えられる。それ以外のペアは 0 から始まる。relation-hint の廃止後、親子の認識はこの初期値と養育の履歴に一本化される。
- 婚姻契約「他の人と一定以上親密にならない」の判定基盤になる（[06-communication.md](./06-communication.md) の約束機構）。

## アクション枠

- 毎月の decide で `acts` を返し、枠数まで実行される。枠数は stats に依存する（基準値は `world-config.act-slots-base`）。
- teach と learn は教師・学習者の両方の枠を消費する（[03-skills.md](./03-skills.md)）。

## 思考コスト（fuel）

- decide の WASM fuel 消費は、その human の food 消費に写像される。重い brain は自分の食費で遅さを払う（[10-ideas.md](./10-ideas.md)）。
- 今月の思考予算 `fuel-budget` は food 残高から算出され、snapshot で渡される。
- **fuel 切れは部分実行**：decide が途中で fuel 切れ（または trap）しても、それまでに commit 済みの宣言は有効に実行される（下記「WIT：行動」）。全損の idle 潰しはしない。
- 帰結：**思考の順序も戦略になる**。重要な決定を安く先に commit する brain は、fuel 切れに強い。

## 記憶（memory）

- decide はステートレスな純関数。状態は memory blob として明示的に出入りし、world 側が human の一部として保存する。
- memory サイズ上限（`memory-limit`）は年齢の関数。

## 知人（acquaintance）

- 獲得経路は introduce（triadic closure）と、確率 ε の偶発的出会い（[公理 6](./01-axioms.md)）。
- 知人について観測できるのは `apparent-age`（実年齢と stats から算出される見かけの年齢。上記）、`alive`、`intimacy`（親密度。上記）、`last-interaction` のみ。**相手の resource と stats は直接観測不能**。豊かさすら行動からしか推定できない（apparent-age に漏れるのは stats の合成値一つ分だけ）。
- relation-hint（world による関係の保証）は**廃止した**。world が human 間の関係を証明する仕組みは存在しない（[05-kinship.md](./05-kinship.md)）。
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
    sex: sex,                       // 本人以外には不可視
    stats: list<stat>,              // stat 一覧は上記 4 種で固定
    resources: list<resource-stack>,
    skills: list<skill-view>,       // → 03-skills.md
    available-actions: list<action-kind>,
    fuel-budget: u64,               // 今月の思考予算（food 残高から算出）
    memory-limit: u32,              // 今月の memory 上限バイト（年齢の関数）
  }

  record acquaintance {
    id: human-id,
    apparent-age: u32,        // 見かけの年齢（年単位。実年齢と stats から算出）
    alive: bool,
    intimacy: qty,            // 親密度。両者から同じ値が見える
    last-interaction: option<month>,
  }

  variant event {
    received-transfer(transfer-info),
    trade-executed(trade-info),     // → 04-market.md
    teach-progressed(teach-info),   // → 03-skills.md
    skill-acquired(skill-id),
    introduced(introduction-info),
    encountered(human-id),          // ε 由来の偶発的出会い
    child-born(human-id),           // 出産。母にのみ届く → 05-kinship.md
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

decide は宣言を**戻り値で一括返却しない**。commit import を呼んで宣言を積み上げる。fuel が途中で切れても、**commit 済みの宣言はそのまま有効**。

```wit
interface commit {
  use action.{act, standing-order};

  // 今月の act を積む。呼んだ順に実行を試みる。枠数（stats 依存）の超過分は無効
  act: func(a: act);

  // standing order を積む（毎月全交換 → 04-market.md）
  order: func(o: standing-order);

  // memory を保存する。複数回呼ぶと上書き。一度も呼ばなければ先月のまま
  save-memory: func(data: list<u8>);
}

interface action {
  use types.{human-id, resource-id, skill-id, qty, resource-stack};

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

設計判断：

- **拒否アクションはない**。応じない = 対応する act / order を出さない。
- **commit は fire-and-forget**。戻り値を持たず、その場での検証結果を返さない（返すと無料の情報になる）。不正な宣言（枠超過、持っていない resource の give 等）は月内解決時に個別に落とされ、翌月の `action-failed` で知る。
- **act の実行順は commit した順**。月内の自分の行動順序を brain が自分で決められる（他人との相互作用の解決順序は別途固定 → [08-architecture.md](./08-architecture.md)）。

## 詰めるべき点

- [x] `stat` / `stat-target` の確定：health / strength / cognition / fertility の 4 種で固定（上記）。曲線の具体式・train の効果式・アクション枠の補正式は M1 で数値決定。
- [x] `apparent-age` の粒度と算出：実年齢と stats（vitality）から算出し年単位に量子化（上記）。補正係数 β の値は M1 で決める。
- [ ] `action-kind` の確定：available-actions の粒度（act 種別のみか、対象込みか）。
- [ ] 餓死の有無：food を消費できない月に何が起きるか。health の仕様上「food 不足 → health 低下 → 0 で死」の緩衝付き餓死が既定路線。低下速度は M1 の消費と生存モデルで確定する。
- [x] 性別：出生時に 1/2 で決定、本人のみ可視（上記）。妊娠・出産の health 低下は女性が負う。fertility 曲線の男女差を入れるかは M4 で決める。
- [ ] 親密度の増減式：stats 依存の月次項と、action 種別ごとの増減量（[90-open-questions.md](./90-open-questions.md) #6）。
- [ ] 母子の初期親密度の値と、養育（give 給餌）による増分のバランス。
- [ ] 知人リストと親密度の関係：親密度 0 になった知人をリストから落とすか（忘却）。上限問題（#2）と一緒に決める。
- [ ] `proposal` の定義：proposal-received が何を運ぶか（teach / conceive の申し出か。無料シグナルにならない設計にする必要がある → [06-communication.md](./06-communication.md)）。
- [ ] 知人リストの上限（[90-open-questions.md](./90-open-questions.md) #2。まず定数で入れる方針 → [PLAN.md](../PLAN.md)）。
- [ ] 出生直後（0歳）の扱い：baby brain の decide は呼ばれるか、親の枠で養育するのか。
- [ ] commit 自体の fuel コスト：commit 呼び出しに少額の fuel を課すか（大量 commit の spam 防止）。save-memory のコストをサイズ比例にするか。
- [ ] fuel 切れ時の memory：save-memory 前に fuel が切れると記憶は先月のまま（「考えすぎて記録し損ねる」）。この仕様で良いか、それとも部分書き込みを許すか。
