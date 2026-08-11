---
title: 市場の設計
section: 創発する社会
order: 1
summary: 板・貨幣の創発・standing order の WIT
---

# 市場の設計

- **通貨は用意しない**。resource ペアごとの指値注文の板を立てる。
- 板が薄い直接交換より、板の厚い resource を経由する間接交換が有利になり、正のフィードバックで一つの resource に収束する（メンガーの貨幣起源）。どれが選ばれるかは g 減衰率（貯蔵性）、**体積（携帯性・保管コスト → [02-resources.md](./resources.md)）**、分割可能性、需要の広さで決まる。**通貨を指名しない。**
- skill は分割不可・一意・売った瞬間に買い手が競合になるため**板に載らない**。skill 取引は相対交渉に分離する。
- 板は**記名**。匿名にすると評判も産業スパイも成立しない。
- マッチングは**価格優先、同価格内はシード付きシャッフル**。時間優先にすると decide の呼び出し順が情報チャネルになるため禁止。
- 約定価格は双方の指値の**中点**（M2 仮決定。同時手番なので maker/taker の区別が無い）。実装は `crates/core/src/market.rs`。
- **M2 の実験結果**: 貯蔵性駆動の媒介選択は多くのシードで **λ=0 の廃棄物**に収束した（腐らないが消費価値ゼロの資産が貨幣になる。貝殻貨幣・不換紙幣と同型）。廃棄物は誰でも産出できるため長期的には供給過多（インフレ）の圧力を持つ——価格が動く brain が現れたときに何が起きるかは今後の観測対象。

## WIT：standing order（立て看板）

decide が `commit.order` で積む宣言（[human.md](./human.md)）。毎月全交換され、月内の相互作用はエンジンが宣言同士を突き合わせて解決する。

```wit
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
  if-received(resource-stack),   // 相対交換（OTC）
  if-taught-me(skill-id),        // 徒弟制の分割払い → 03-skills.md
  unconditional-scheduled,
  // 検討中：if-intimacy（担保型の約束）→ 06-communication.md、未決 #7
}
```

月内解決順序は「**teach/learn 成立 → conditional-give 判定 → 板マッチング**」で固定（[08-architecture.md](./architecture.md)）。

## WIT：観測（板の公開気配と履歴）

- snapshot の `market: list<board-quote>` が板の公開気配（`board-quote` は未定義）。
- 深掘りは fuel 課金の probe（[09-wit-draft.md](./wit.md)）：

```wit
// 指定した知人の公開市場での売買履歴（板は記名）
trade-history: func(who: human-id, since: month) -> list<public-trade>;
```

関連イベント：`trade-executed(trade-info)`（[human.md](./human.md)）。

## M2′：板は必要か（板なし世界の商人実験）

「市場をシステムで用意せず、取引を受け持つ専門 brain で代替できるか」の検証。`world-params.board-enabled = false` の世界（時代プリセットの軸）では板が存在せず、交換手段は conditional-give（店先の約束）と give（先払い）だけになる。

**取引プロトコル**（月内解決順序「一方向 act → conditional-give 判定」を利用）:

- 売り手（全員・常設）: 各知人に「特産以外の取引財 R をロットぶんくれたら特産を渡す」を R ごとに約束する（act 枠外・毎月出し直し）
- 買い手（act）: 供給者へ**先払い**する。同月内に売り手の cond-give が発火して商品が届く。供給者は受領イベントで学習し、見つかるまで知人を輪番で探査する
- 支払い資源 = **最も受け取る資源**（受領統計 = 板の厚みの局所版）。なければ保有最大

**結果**（20 商人・20 年・3 シード、`money_partially_emerges_without_board`）:

- 経済は回る（全員が自分では作れない食料を取引で得て生きる）。支払いは常に**貯蔵性最良（λ=0 の廃棄物）へ集中**する — メンガーの機構は板なしでも働く
- ただし収束は**部分的**: 累計の支払い集中度 37〜43%、期間別のピークでも 50〜61%。板あり M2 の 90%+（実測 1000‰）に遠く及ばない
- 受領統計の導入前は、各商人が「自分の食事の副生成物」を通貨として鋳造し、**λ=0 の地域通貨が 4〜5 種に分立**した（自由な貨幣鋳造の均衡）
- 終盤に人口が減ると知人ネットワークが千切れ、通貨が再分裂する（収束の脆弱性）

**結論**: 交換そのものは専門商人 brain で代替できる。板が固有に提供していたのは**公開情報による収束と安定化**（同等に貯蔵性の高い候補が複数あるとき、そこから一つを全員に選ばせる装置）で、局所観測だけの OTC ではこれが弱い。板の有無は制度の時代差として `board-enabled` で表現する。

## 詰めるべき点

- [ ] `board-quote` の定義：気配の粒度（ベスト気配のみか板の深さまでか）、記名情報をどこまで載せるか（板は記名だが、気配段階で名前が見えるか約定後か）。
- [ ] `trade-info` / `public-trade` の定義。
- [ ] `partial` 約定の規則：端数の丸め（qty 刻みとの関係）、部分約定後の残注文の扱い。
- [ ] limit-order の有効期間：「毎月全交換」なら 1ヶ月で消えるのが素直。板の「厚み」が月次リセットで壊れないか。
- [ ] 同一人物の複数 order・自己約定の扱い。
- [ ] cond-give の if-received が板マッチングより先に解決される順序で、OTC と板の裁定がどう出るか。
