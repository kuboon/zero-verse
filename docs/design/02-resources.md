# resource の設計

## レシピ表を手書きしない

手書きのグラフからは裁定閉路（A→B→C→A で純増する経路）を排除しきれず、閉路が一本でもあれば全 brain がそれだけを回して終わる。

代わりに以下で**永久機関を構文的に不可能**にする。

- 各 resource に隠れた**組成ベクトル**を持たせ、全変換で保存を強制する。組成は world 全体（human の保有 + 環境ストック）で閉じて保存される。**組成が human と環境の境界を越える経路は harvest / 廃棄（discard）/ 死亡時還元の三つだけ**（[公理 4](./01-axioms.md)、[world.md](./world.md)）。
- 消費は resource を消滅させない。食事は「食べ物 → health + **廃棄物 resource**」の変換であり、**廃棄物は明示的に discard するまで保有し続ける**（空間を圧迫する。下記）。
- 各 resource に**自由エネルギー g** を持たせ、全変換で Σg_out < Σg_in を強制する。唯一の例外は**環境変換**（光合成）で、その g 増分は Φ が上限を与える。
- 各 resource に**体積 v** を持たせる（組成・g と並ぶ属性）。保有 resource の体積合計は空間を占有する（[公理 11](./01-axioms.md)、[world.md](./world.md)）。
- レシピは組成から手続き的に生成する。world ごとに異なる化学ができる。
- g は tick ごとに自然減衰する（腐敗、錆）。減衰率の差が**貯蔵性**を生み、貨幣創発（[04-market.md](./04-market.md)）の選択圧になる。
- **保有コストは二重**：g 減衰（時間で腐る）と空間占有（かさばる）。溜め込みには両方の税がかかる。かさばる原料を低体積の加工品に変換する「圧縮」は法則グラフから自然に出る倉庫技術になる。

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
  invoke(invoke-args),      // skill の発動。harvest・食事・変換をすべて含む
  give(give-args),          // 一方的贈与
  discard(resource-stack),  // 環境への廃棄。占有空間を空ける
  // ...
}

record invoke-args {
  inputs: list<resource-stack>,  // 組み合わせ自由。レシピ ID は存在しない
  using-skills: list<skill-id>,
}
```

harvest（環境ストックからの採取。獲得量はストック残量に依存）や食事（health 回復 + 廃棄物の産出）も専用アクションではなく skill の発動である（[03-skills.md](./03-skills.md)、[world.md](./world.md)）。

設計判断：

- **invoke にレシピ ID を渡さない**。任意の組み合わせを投入し、法則グラフに合致すれば産出、しなければ材料の一部を失い action-failed。レシピという概念は world に存在せず、brain の memory の中にだけ育つ。実験と生産は同一アクション。
- **action-failed は理由を返さない**。前提 skill 不足か、材料違いか、state 不足かは再試行で切り分ける。この不透明さが実験という行為を生む。

## 詰めるべき点

- [ ] `give-args` の定義（草案で未定義。おそらく `{ to: human-id, stack: resource-stack }`）。
- [ ] invoke 失敗時に失う「材料の一部」の割合（固定か、法則グラフとの距離に依存か）。
- [x] 組成保存と消費の整合：**廃棄物モデルで解決**。消費は廃棄物を生み、組成が環境に還るのは discard / 死亡時還元のみ。world 全体では厳密に保存される（[world.md](./world.md)）。
- [ ] 体積 v の可視性：組成同様に隠すか、保有分の体積（＝自分の占有量）は見えるか。板の注文に体積情報が漏れるか（[90-open-questions.md](./90-open-questions.md) #15）。
- [ ] 自分の resource の g（自由エネルギー残量）は self-view から見えるか。見えないなら減衰は在庫量の目減りとしてだけ現れるのか。
- [ ] 組成ベクトルの次元数と、レシピの手続き的生成則（M1 で resource 5 種から始める → [PLAN.md](../PLAN.md)）。
- [ ] qty の刻み 1/1000 の妥当性（[90-open-questions.md](./90-open-questions.md) #3。ABI に直結するため P0 で確定）。
