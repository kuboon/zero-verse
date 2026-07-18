# 血縁と婚姻

50/50 継承則（[公理 7](./01-axioms.md)）は一遺伝子座半数体と同型で、血縁度が厳密に出る（親子 1/2、兄弟 1/2、祖父母孫 1/4、いとこ 1/8）。Hamilton 則 rB > C が外生ルールなしで数値的に成立する。

- 血縁は **brain 同一性の唯一の（確率的）証明**である。子に教えるのは確実に自陣営投資、他人に教えるのは敵陣営強化の可能性。「家族には無償で教える」は情報の非対称性から演繹され、world 側に家族という概念を書く必要がない。
- relation-hint の廃止により、**world が血縁を証明する箇所はゼロになった**。血縁を確実に知るのは産んだ母だけ。父は conceive の時期と 0歳知人の出現タイミングの相関から確率的に推定するしかない（父性不確実性）。子は母から教わり、母を信じるしかない。母系の知識だけが確実、という非対称が投資戦略の非対称（母系相続の有利さ）として現れるはず。
- 6歳での切替は観測不能。期待血縁度が 1/2 に固定され、「外れくじの子を捨てる」戦略が原理的に実行不能。
- 両親の期待持ち分が対称に 1/2 なので共同養育が均衡になりうる。子の帰属交渉は不要になった（旧案の「婚姻を帰属交渉契約にする」は破棄。[91-rejected.md](./91-rejected.md) 参照）。
- 配偶者選択 = 子の半分を委ねるアルゴリズム選び。行動履歴から相手の brain の質を推定するので、協力性が配偶市場を通じて伝播する。
- 最大の抜け穴は**同族内婚**（両親同一 brain なら r = 1）。抑止は二つ：同族を確実に見つけられないこと、内婚に閉じると skill 流入が減り技術が止まること。**外婚は skill を買い、内婚は brain を守る**という戦略軸として残す。人工ペナルティは足さない。
- **marriage アクションは置かない**。conceive の相互指定のみ。婚姻という制度も brain が発明する。

## WIT：血縁に関わる型と操作

```wit
variant act {
  conceive(human-id),   // 相互指定で成立。異性ペアのみ（sex は不可視 → human.md）
  // ...
}
```

- **conceive の成立**：同月の相互指定 ＋ 異性ペア ＋ 双方の fertility 窓内。不成立でも理由は返さない（相手の sex・fertility は判別できない）。
- **出産の観測非対称**：`child-born` は母にのみ届く。父には 0歳の知人が現れるだけで、通知はない。
- **親子の初期親密度**：母子ペアは高い初期値、それ以外（父子を含む）は 0（[human.md](./human.md) の親密度）。
- **relation-hint は廃止**。world が関係（親子・配偶者）を保証する仕組みは存在しない。spouse もシステムでは付与しない：婚姻は約束機構（[06-communication.md](./06-communication.md)）の上に brain が発明する。

関連イベント：`someone-died(human-id)`（[human.md](./human.md)）。

継承関連の world パラメータ（[09-wit-draft.md](./09-wit-draft.md) の world-config）：`max-lifespan-months` など。

## 詰めるべき点

- [x] conceive の成立条件：**決定**。spouse 状態は挟まず、相互指定＋異性＋fertility 窓のみ（[90-open-questions.md](./90-open-questions.md) #1 解決）。
- [x] `relation-hint` の矛盾：**relation-hint 自体を廃止して解決**。spouse はシステム付与せず、婚姻契約は約束機構（[06-communication.md](./06-communication.md)）で創発させる。
- [ ] 妊娠期間と出産コスト：conceive 成立から child-born までの月数、妊娠中の行動制約（アクション枠・harvest 効率の低下？）。health 低下を女性が負うことは決定済み（[human.md](./human.md)）。
- [x] conceive できる年齢範囲：fertility stat の年齢窓で表現する（[human.md](./human.md)）。窓が開いている間だけ available-actions に conceive が現れる。窓の具体値は M4 で確定。
- [ ] 片親が死んだ場合の baby brain 期間の扱いと、6歳継承の抽選タイミング。
