# skill の設計

**skill = 世界の法則を一本知っていること。** 教育・技術進歩・未知 resource の同定は、すべてこの一つのメカニズムに帰着する。

- 獲得経路は二つ。**教わる**（安いが教師が要る）か、**実験で発見する**（高く、確率的で、前提 skill が要る）。
- 深い法則の発見は複数の浅い skill の同時保持を要求する。寿命が有限なので一人では届かない深さがあり、分業と教育の高速化だけがその壁を越える。
- skill の所持が外部に漏れる瞬間は二つだけ：その skill でしか作れない resource を市場に出したとき、誰かに教えたとき。**秘密を守りたければ売れないし教えられない**（秘匿コスト = 機会損失）。
- 他人の生産物を観測し続けた brain は確率的に法則を逆算できる（リバースエンジニアリング）。売るほど模倣され、独占は放置しても崩れる。
- skill の真偽は買う前に検証できない。無価値な法則を有用と称して売る詐欺が構造的に可能で、これが徒弟制（分割払い）の選択圧になる。

## 教育の仕様

- `teach(student, skill)` と `learn(teacher, skill)` が**同月に対をなして**初めて 1ヶ月分の進捗。完了に T ヶ月かかる。T は教師の熟練度と学習者の若さで決まる。
- 両者ともアクション枠を消費する。
- **支払いは teach に含めない**。resource 移転は独立アクションのまま。エスクローも world に置かない。ホールドアップ問題を月単位で残すことで、分割払い（徒弟制）が brain の発明として出る余地を作る。
- standing order の `if-taught-me` 条件（「今月教育が進捗したら支払う」）で、**月単位のアトミック性だけ**は提供する。来月も教える保証は与えない。

## WIT：skill の型と操作

```wit
interface types {
  type skill-id = u64;  // world 生成時にシャッフル
}

// self-view に入る自分の skill（→ human.md）
record skill-view {
  skill: skill-id,
  proficiency: qty,
  // この skill が何をアンロックするかは書かない。
  // available-actions との差分から brain が推測する
}
```

教育アクション（[human.md](./human.md) の act から抜粋）：

```wit
variant act {
  teach(teach-args),
  learn(learn-args),
  // ...
}

record teach-args { student: human-id, skill: skill-id }
record learn-args { teacher: human-id, skill: skill-id }
```

支払い側は standing order の `if-taught-me` 条件で月単位アトミックにできる（型定義は [04-market.md](./04-market.md)）：

```wit
variant give-condition {
  // ...
  if-taught-me(skill-id),  // 徒弟制の分割払いを月単位でアトミックにする
}
```

関連イベント：`teach-progressed(teach-info)`、`skill-acquired(skill-id)`（[human.md](./human.md)）。

## 詰めるべき点

- [ ] `proficiency` の意味：教育速度 T の式（教師の熟練度 × 学習者の若さ）への入り方、熟練度の上げ方（使用回数か）。
- [ ] `teach-info` の定義（進捗の残り月数を学習者に見せるか。見せると「あと 1ヶ月」で持ち逃げする戦略が読みやすくなる）。
- [ ] 実験による発見の判定式：craft 試行がどう確率的発見につながるか、前提 skill の要求をどう表現するか。
- [ ] リバースエンジニアリングの確率モデル：他人の生産物の観測回数と逆算確率の関係。
- [ ] 同一 skill を複数人から並行して教わることを許すか。
