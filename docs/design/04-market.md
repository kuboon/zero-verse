# 市場の設計

- **通貨は用意しない**。resource ペアごとの指値注文の板を立てる。
- 板が薄い直接交換より、板の厚い resource を経由する間接交換が有利になり、正のフィードバックで一つの resource に収束する（メンガーの貨幣起源）。どれが選ばれるかは g 減衰率（貯蔵性）、分割可能性、需要の広さで決まる。**通貨を指名しない。**
- skill は分割不可・一意・売った瞬間に買い手が競合になるため**板に載らない**。skill 取引は相対交渉に分離する。
- 板は**記名**。匿名にすると評判も産業スパイも成立しない。
- マッチングは**価格優先、同価格内はシード付きシャッフル**。時間優先にすると decide の呼び出し順が情報チャネルになるため禁止。

## WIT：standing order（立て看板）

decide が返す `orders`（[human.md](./human.md) の decision から抜粋）。毎月全交換される宣言であり、月内の相互作用はエンジンが宣言同士を突き合わせて解決する。

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
}
```

月内解決順序は「**teach/learn 成立 → conditional-give 判定 → 板マッチング**」で固定（[08-architecture.md](./08-architecture.md)）。

## WIT：観測（板の公開気配と履歴）

- snapshot の `market: list<board-quote>` が板の公開気配（`board-quote` は未定義）。
- 深掘りは fuel 課金の probe（[09-wit-draft.md](./09-wit-draft.md)）：

```wit
// 指定した知人の公開市場での売買履歴（板は記名）
trade-history: func(who: human-id, since: month) -> list<public-trade>;
```

関連イベント：`trade-executed(trade-info)`（[human.md](./human.md)）。

## 詰めるべき点

- [ ] `board-quote` の定義：気配の粒度（ベスト気配のみか板の深さまでか）、記名情報をどこまで載せるか（板は記名だが、気配段階で名前が見えるか約定後か）。
- [ ] `trade-info` / `public-trade` の定義。
- [ ] `partial` 約定の規則：端数の丸め（qty 刻みとの関係）、部分約定後の残注文の扱い。
- [ ] limit-order の有効期間：「毎月全交換」なら 1ヶ月で消えるのが素直。板の「厚み」が月次リセットで壊れないか。
- [ ] 同一人物の複数 order・自己約定の扱い。
- [ ] cond-give の if-received が板マッチングより先に解決される順序で、OTC と板の裁定がどう出るか。
