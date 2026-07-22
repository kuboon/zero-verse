---
title: 未決事項
section: プロジェクト
order: 3
summary: 意図的に未決の論点
---

# 未決事項

設計時点で意図的に未決のまま残した論点。決定期限の目安は [PLAN.md](./plan.md) の「未決事項の決定タイミング」を参照。番号は他の文書から参照されているため振り直さない。

1. ~~**conceive の成立**に spouse 状態を挟むか、毎回の相互指定のみか~~ → **決定（再改訂）**：conceive はアクションから外し、相対親密度（相互 50% 超）＋異性＋fertility 窓＋非刷り込みで自動発生（[05-kinship.md](./kinship.md)）。
2. **知人リストの上限**。stats（cognition）の関数か定数か。親密度 0 の知人の忘却と合わせて決める（[human.md](./human.md)）。→ **P0-1 仮決定**：定数（world-config の `acquaintance-cap`）。stats 関数化は M4 で再検討。
3. **qty の刻み 1/1000 で足りるか**（贈与通信の帯域価格を決める）。→ **P0-1 確定**：1/1000 を採用（`wit/world.wit` の qty-scale）。
4. **v(S) の時間扱い**（年数総和か割引か、割引率の world パラメータ化）。
5. **escrow: on/off** を実験用 world パラメータとして持つか。
6. **親密度の増減式**：stats 依存の月次項の形と、action 種別ごとの増減量（[human.md](./human.md)）。→ **M4 仮決定**：月次は単純減衰（20‰）、相互作用（give / teach / 約定）ごとに固定増分。stats 依存項は保留。
7. ~~**if-intimacy（担保型の約束）を give-condition に足すか**~~ → **M4 派生実験で判断: 導入見送り**。婚姻契約（相互の贈与均衡）は執行機構なしの繰り返しゲーム（許し付きしっぺ返し + 年次の和解）として維持され、貞節ペアだけが子を残した（浮気者は相対親密度 50% を超えられない）。world に契約執行を入れる必要が現時点で示されなかった。深い契約（多期の債務など）が必要になったら再検討（[06-communication.md](./communication.md)、docs/PLAN.md M4 状態）。
8. **時代プリセットの構成**：「概念を知っている」の実装形式（初期 memory 接種のフォーマット、brain 側の互換性）（[10-ideas.md](./ideas.md)）。
9. ~~**キャンペーンのクリア判定**：単一シードか複数シードでの成功率か~~ → **決定**：キャンペーンは 1 人用チュートリアルで、シード固定・過学習容認。スコアは自 brain 比率の低さ。競争的評価はリーグの Shapley 採点が担う（[world.md](./world.md)）。
10. **刷り込み（Westermarck）の閾値と判定タイミング**、相対親密度 50% 条件の world パラメータ化（[05-kinship.md](./kinship.md)）。
11. **fuel の写像先**：food 概念の廃止に伴い health 減少への写像を採用したが、係数（思考が食事何回分か）は未定（[human.md](./human.md)）。→ **P0-1 仮決定**：係数は world-config の `fuel-per-health` としてパラメータ化。値は M1 で調整。
12. ~~**生得 skill**：baby brain 期に食事 skill の獲得をどう保証するか~~ → **M4 決定**：出生時に母の食事 skill を生得付与する（食文化は母系継承。[05-kinship.md](./kinship.md)）。
13. **環境ストックの観測**：harvest 歩留まりからの推定のみか、観測系 skill を置くか（[world.md](./world.md)）。
14. **死亡時の保有 resource**：全額環境還元とする提案の確定（相続は生前贈与で創発させる）（[world.md](./world.md)）。
15. **空間モデルの詳細**：体積 v の可視性、空間満杯時の harvest / 受領 / invoke 産出の挙動、身体体積の年齢関数、占有維持費 κ の形（定数か混雑比例か）、`space-free`（世界の空き）を snapshot で公開してよいか（[human.md](./human.md)、[world.md](./world.md)）。
