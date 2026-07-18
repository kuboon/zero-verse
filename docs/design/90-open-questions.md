# 未決事項

設計時点で意図的に未決のまま残した論点。決定期限の目安は [PLAN.md](../PLAN.md) の「未決事項の決定タイミング」を参照。番号は他の文書から参照されているため振り直さない。

1. ~~**conceive の成立**に spouse 状態を挟むか、毎回の相互指定のみか~~ → **決定**：spouse 状態は挟まない。相互指定＋異性＋fertility 窓のみで成立。relation-hint も廃止（[05-kinship.md](./05-kinship.md)）。
2. **知人リストの上限**。stats（cognition）の関数か定数か。親密度 0 の知人の忘却と合わせて決める（[human.md](./human.md)）。
3. **qty の刻み 1/1000 で足りるか**（贈与通信の帯域価格を決める）。
4. **v(S) の時間扱い**（年数総和か割引か、割引率の world パラメータ化）。
5. **escrow: on/off** を実験用 world パラメータとして持つか。
6. **親密度の増減式**：stats 依存の月次項の形と、action 種別ごとの増減量（[human.md](./human.md)）。
7. **if-intimacy（担保型の約束）を give-condition に足すか**：world に契約執行を半歩入れることになる。escrow を置かない方針との整合（[06-communication.md](./06-communication.md)）。
8. **時代プリセットの構成**：「概念を知っている」の実装形式（初期 memory 接種のフォーマット、brain 側の互換性）（[10-ideas.md](./10-ideas.md)）。
