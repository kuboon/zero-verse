# 血縁と婚姻

50/50 継承則（[公理 7](./01-axioms.md)）は一遺伝子座半数体と同型で、血縁度が厳密に出る（親子 1/2、兄弟 1/2、祖父母孫 1/4、いとこ 1/8）。Hamilton 則 rB > C が外生ルールなしで数値的に成立する。

- 血縁は **brain 同一性の唯一の（確率的）証明**である。子に教えるのは確実に自陣営投資、他人に教えるのは敵陣営強化の可能性。「家族には無償で教える」は情報の非対称性から演繹され、world 側に家族という概念を書く必要がない。
- 6歳での切替は観測不能。期待血縁度が 1/2 に固定され、「外れくじの子を捨てる」戦略が原理的に実行不能。
- 両親の期待持ち分が対称に 1/2 なので共同養育が均衡になりうる。子の帰属交渉は不要になった（旧案の「婚姻を帰属交渉契約にする」は破棄。[91-rejected.md](./91-rejected.md) 参照）。
- 配偶者選択 = 子の半分を委ねるアルゴリズム選び。行動履歴から相手の brain の質を推定するので、協力性が配偶市場を通じて伝播する。
- 最大の抜け穴は**同族内婚**（両親同一 brain なら r = 1）。抑止は二つ：同族を確実に見つけられないこと、内婚に閉じると skill 流入が減り技術が止まること。**外婚は skill を買い、内婚は brain を守る**という戦略軸として残す。人工ペナルティは足さない。
- **marriage アクションは置かない**。conceive の相互指定のみ。婚姻という制度も brain が発明する。

## WIT：血縁に関わる型と操作

```wit
variant act {
  conceive(human-id),   // 相互指定で成立
  // ...
}

// acquaintance.relation に入る（→ human.md）
// world が保証できる関係だけを列挙。それ以外は unknown
enum relation-hint {
  self-child,
  self-parent,
  spouse,
  unknown,
}
```

関連イベント：`child-born(human-id)`、`someone-died(human-id)`（[human.md](./human.md)）。

継承関連の world パラメータ（[09-wit-draft.md](./09-wit-draft.md) の world-config）：`max-lifespan-months` など。

## 詰めるべき点

- [ ] conceive の成立条件：spouse 状態を挟むか、毎回の相互指定のみか（[90-open-questions.md](./90-open-questions.md) #1。まず相互指定のみで試す → [PLAN.md](../PLAN.md)）。
- [ ] `relation-hint` の `spouse` の定義：marriage アクションが無いのに world が spouse を保証できるのか。conceive 成立実績から world が認定するのか、それとも spouse hint 自体を削るのか。**現状の草案は自己矛盾気味であり要決着。**
- [ ] 妊娠期間と出産コスト：conceive 成立から child-born までの月数、出産の health 低下をどちらが（どう）負うか。性別を置くかの論点と表裏（→ [human.md](./human.md)）。
- [x] conceive できる年齢範囲：fertility stat の年齢窓で表現する（[human.md](./human.md)）。窓が開いている間だけ available-actions に conceive が現れる。窓の具体値は M4 で確定。
- [ ] 片親が死んだ場合の baby brain 期間の扱いと、6歳継承の抽選タイミング。
