# 通信とシグナリング

- **say / message アクションは置かない**。同族認識をしたい brain は既存アクション（特定数量の贈与など）でプロトコルを自作する。
- world が無料のシグナルを提供すると詐欺師に即コピーされ無意味化する（Zahavi）。**すべての情報伝達に実コスト**（resource か時間）を持たせる。贈与数量にビットを乗せる通信は許容し、量子化の粗さ（qty の刻み）が通信帯域の価格を決める。
- プロトコルを模倣する詐欺師は、偽装利得と偽装コストが釣り合う比率で均衡する。**これは意図した仕様。**

## WIT：通信の搬送路

通信専用の型は**存在しない**のがこの設計の要点。情報は既存アクションに乗る：

- `give`（[02-resources.md](./02-resources.md)）：贈与数量にビットを乗せる。量子化の粗さ（qty の刻み 1/1000、[90-open-questions.md](./90-open-questions.md) #3）が通信帯域の価格を決める。
- `introduce` / `introduced` / `encountered`（[human.md](./human.md)）：紹介そのものがシグナル（紹介コスト = アクション枠）。
- `limit-order`（[04-market.md](./04-market.md)）：板は記名なので、注文の出し方自体が公開シグナルになる。

## 詰めるべき点

- [ ] `proposal` / `proposal-received` の定義（[human.md](./human.md)）：teach や conceive の申し出を event として運ぶなら、それは**無料のシグナルにならないか**。Zahavi 原則と整合させるには、proposal の発行にアクション枠か resource のコストが要るはず。proposal を削って「give プロトコルで申し出も自作させる」選択肢も含めて決める。
- [ ] probe の `graph-distance`（[09-wit-draft.md](./09-wit-draft.md)）が返す紹介ネットワーク距離は、同族推定の強力な手がかりになる。fuel 価格でどこまで絞るか。
