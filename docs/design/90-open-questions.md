# 未決事項

設計時点で意図的に未決のまま残した論点。決定期限の目安は [PLAN.md](../PLAN.md) の「未決事項の決定タイミング」を参照。番号は他の文書から参照されているため振り直さない。

1. ~~**conceive の成立**に spouse 状態を挟むか、毎回の相互指定のみか~~ → **決定（再改訂）**：conceive はアクションから外し、相対親密度（相互 50% 超）＋異性＋fertility 窓＋非刷り込みで自動発生（[05-kinship.md](./05-kinship.md)）。
2. **知人リストの上限**。stats（cognition）の関数か定数か。親密度 0 の知人の忘却と合わせて決める（[human.md](./human.md)）。
3. **qty の刻み 1/1000 で足りるか**（贈与通信の帯域価格を決める）。
4. **v(S) の時間扱い**（年数総和か割引か、割引率の world パラメータ化）。
5. **escrow: on/off** を実験用 world パラメータとして持つか。
6. **親密度の増減式**：stats 依存の月次項の形と、action 種別ごとの増減量（[human.md](./human.md)）。
7. **if-intimacy（担保型の約束）を give-condition に足すか**：world に契約執行を半歩入れることになる。escrow を置かない方針との整合（[06-communication.md](./06-communication.md)）。
8. **時代プリセットの構成**：「概念を知っている」の実装形式（初期 memory 接種のフォーマット、brain 側の互換性）（[10-ideas.md](./10-ideas.md)）。
9. ~~**キャンペーンのクリア判定**：単一シードか複数シードでの成功率か~~ → **決定**：キャンペーンは 1 人用チュートリアルで、シード固定・過学習容認。スコアは自 brain 比率の低さ。競争的評価はリーグの Shapley 採点が担う（[world.md](./world.md)）。
10. **刷り込み（Westermarck）の閾値と判定タイミング**、相対親密度 50% 条件の world パラメータ化（[05-kinship.md](./05-kinship.md)）。
11. **fuel の写像先**：food 概念の廃止に伴い health 減少への写像を採用したが、係数（思考が食事何回分か）は未定（[human.md](./human.md)）。
12. **生得 skill**：baby brain 期に食事 skill の獲得をどう保証するか（[03-skills.md](./03-skills.md)）。
13. **環境ストックの観測**：harvest 歩留まりからの推定のみか、観測系 skill を置くか（[world.md](./world.md)）。
14. **死亡時の保有 resource**：全額環境還元とする提案の確定（相続は生前贈与で創発させる）（[world.md](./world.md)）。
15. **空間モデルの詳細**：体積 v の可視性、空間満杯時の harvest / 受領 / invoke 産出の挙動、身体体積の年齢関数、`space-free`（世界の空き）を snapshot で公開してよいか（[human.md](./human.md)、[world.md](./world.md)）。
