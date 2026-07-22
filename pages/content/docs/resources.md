---
title: resource の設計
section: 世界の仕様
order: 3
summary: 組成保存・自由エネルギー・invoke の WIT
---

# resource の設計

## レシピ表を手書きしない

手書きのグラフからは裁定閉路（A→B→C→A で純増する経路）を排除しきれず、閉路が一本でもあれば全 brain がそれだけを回して終わる。

代わりに以下で**永久機関を構文的に不可能**にする。

- 各 resource に隠れた**組成ベクトル**を持たせ、全変換で保存を強制する。組成は world 全体（human の保有 + 環境ストック）で閉じて保存される。**組成が human と環境の境界を越える経路は harvest / 廃棄（discard）/ 死亡時還元の三つだけ**（[公理 4](./axioms.md)、[world.md](./world.md)）。
- 消費は resource を消滅させない。食事は「食べ物 → health + **廃棄物 resource**」の変換であり、**廃棄物は明示的に discard するまで保有し続ける**（空間を圧迫する。下記）。
- 各 resource に**自由エネルギー g** を持たせ、全変換で Σg_out < Σg_in を強制する。唯一の例外は**環境変換**（光合成）で、その g 増分は Φ が上限を与える。
- 各 resource に**体積 v** を持たせる（組成・g と並ぶ属性）。保有 resource の体積合計は空間を占有する（[公理 11](./axioms.md)、[world.md](./world.md)）。
- レシピは組成から手続き的に生成する。world ごとに異なる化学ができる。
- g は時間と共に減衰する（腐敗、錆）。実装は**自発変換**（下記）。劣化速度 λ の差が**貯蔵性**を生み、貨幣創発（[04-market.md](./market.md)）の選択圧になる。
- **保有コストは二重**：劣化（時間で腐る）と空間占有ペナルティ（かさばる分だけ health の維持費を払う。[human.md](./human.md)）。溜め込みには両方の税がかかる。かさばる原料を低体積の加工品に変換する「圧縮」は法則グラフから自然に出る倉庫技術になる。

## 劣化の実装：自発変換

「g が時間で減る」を per-stack の状態としては**持たない**。持つと同じ resource-id に鮮度差が生まれ、代替可能性（fungibility）が壊れて板が成立しなくなる。

- **g は resource 型ごとの定数**（組成・体積と並ぶ属性）。個体状態を持たず、在庫の状態は amount のみ。
- 各 resource 型には world 生成時に**劣化変換**が割り当てられる：「パン → カビた廃棄物（低 g）」「鉄 → 錆（低 g）」。毎 tick、保有 stack と環境ストックの amount の割合 λ がこの変換で自動的に転換される。
- つまり g の減衰は「在庫の量が減って低 g の劣化品が増える」現象として観測される。劣化品は廃棄物として在庫に残り、discard するまで空間を食う。
- 環境変換（[world.md](./world.md)）と同一機構：毎 tick、human の在庫と環境ストックに同じ「自発変換パス」を一括適用するだけでよい。
- 組成は劣化でも厳密に保存される（world 全体の組成保存アサーションがそのまま効く）。
- 固定小数点の端数は決定論的確率丸めで処理する（[08-architecture.md](./architecture.md)）。

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

harvest（環境ストックからの採取。獲得量はストック残量に依存）や食事（health 回復 + 廃棄物の産出）も専用アクションではなく skill の発動である（[03-skills.md](./skills.md)、[world.md](./world.md)）。

設計判断：

- **invoke にレシピ ID を渡さない**。任意の組み合わせを投入し、法則グラフに合致すれば産出、しなければ材料の一部を失い action-failed。レシピという概念は world に存在せず、brain の memory の中にだけ育つ。実験と生産は同一アクション。
- **action-failed は理由を返さない**。前提 skill 不足か、材料違いか、state 不足かは再試行で切り分ける。この不透明さが実験という行為を生む。

## 詰めるべき点

- [ ] `give-args` の定義（草案で未定義。おそらく `{ to: human-id, stack: resource-stack }`）。
- [ ] invoke 失敗時に失う「材料の一部」の割合（固定か、法則グラフとの距離に依存か）。
- [x] 組成保存と消費の整合：**廃棄物モデルで解決**。消費は廃棄物を生み、組成が環境に還るのは discard / 死亡時還元のみ。world 全体では厳密に保存される（[world.md](./world.md)）。
- [ ] 体積 v の可視性：組成同様に隠すか、保有分の体積（＝自分の占有量）は見えるか。板の注文に体積情報が漏れるか（[90-open-questions.md](./open-questions.md) #15）。
- [x] 自分の resource の g は見えるか：**自発変換モデルで解消**。per-stack の g は存在せず、劣化は在庫量の変化（量が減り劣化品が増える）としてのみ観測される。
- [ ] 劣化変換 λ の分布：型ごとの割り当て生成則（食品系は速く鉱物系は遅い、をどう手続き的に出すか）。
- [ ] 組成ベクトルの次元数と、レシピの手続き的生成則（M1 で resource 5 種から始める → [PLAN.md](./plan.md)）。
- [ ] qty の刻み 1/1000 の妥当性（[90-open-questions.md](./open-questions.md) #3。ABI に直結するため P0 で確定）。
