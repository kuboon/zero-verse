# resource の設計

## レシピ表を手書きしない

手書きのグラフからは裁定閉路（A→B→C→A で純増する経路）を排除しきれず、閉路が一本でもあれば全 brain がそれだけを回して終わる。

代わりに以下で**永久機関を構文的に不可能**にする。

- 各 resource に隠れた**組成ベクトル**を持たせ、全変換で保存を強制する。
- 各 resource に**自由エネルギー g** を持たせ、全変換で Σg_out < Σg_in を強制する。
- レシピは組成から手続き的に生成する。world ごとに異なる化学ができる。
- g は tick ごとに自然減衰する（腐敗、錆）。減衰率の差が**貯蔵性**を生み、貨幣創発（[04-market.md](./04-market.md)）の選択圧になる。

## ID シャッフル

resource-id と skill-id は world 生成時にシャッフルする。brain は起動時に「何が何に変わるか」を知らず、試行（invoke の失敗を含む）と他者の観測から法則を復元するしかない。

単なる名前の難読化は brain に効かない（brain は名前を読まない）ので、シャッフルするのは**法則グラフへの対応そのもの**である。

## WIT：resource の型と操作

```wit
interface types {
  type resource-id = u64;  // world 生成時にシャッフル
  type qty = u64;          // 固定小数点 1/1000

  record resource-stack {
    resource: resource-id,
    amount: qty,
  }
}
```

resource に触るアクション（[human.md](./human.md) の act から抜粋）：

```wit
variant act {
  invoke(invoke-args), // skill の発動。harvest・食事・変換をすべて含む
  give(give-args),     // 一方的贈与
  // ...
}

record invoke-args {
  inputs: list<resource-stack>,  // 組み合わせ自由。レシピ ID は存在しない
  using-skills: list<skill-id>,
}
```

harvest（Φ の採取。取り分は採取人数で割られる）や食事（health 回復）も専用アクションではなく skill の発動である（[03-skills.md](./03-skills.md)）。

設計判断：

- **invoke にレシピ ID を渡さない**。任意の組み合わせを投入し、法則グラフに合致すれば産出、しなければ材料の一部を失い action-failed。レシピという概念は world に存在せず、brain の memory の中にだけ育つ。実験と生産は同一アクション。
- **action-failed は理由を返さない**。前提 skill 不足か、材料違いか、state 不足かは再試行で切り分ける。この不透明さが実験という行為を生む。

## 詰めるべき点

- [ ] `give-args` の定義（草案で未定義。おそらく `{ to: human-id, stack: resource-stack }`）。
- [ ] invoke 失敗時に失う「材料の一部」の割合（固定か、法則グラフとの距離に依存か）。
- [ ] 組成保存と消費の整合：食事など「resource → stats」変換で消えた resource の組成のシンクをどう扱うか（体内蓄積・排出・公理の例外扱い）（[03-skills.md](./03-skills.md)）。
- [ ] 自分の resource の g（自由エネルギー残量）は self-view から見えるか。見えないなら減衰は在庫量の目減りとしてだけ現れるのか。
- [ ] 組成ベクトルの次元数と、レシピの手続き的生成則（M1 で resource 5 種から始める → [PLAN.md](../PLAN.md)）。
- [ ] qty の刻み 1/1000 の妥当性（[90-open-questions.md](./90-open-questions.md) #3。ABI に直結するため P0 で確定）。
