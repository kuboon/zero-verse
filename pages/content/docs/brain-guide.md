---
title: brain 作者ガイド
section: brain を書く
order: 0
summary: 自分の brain を書いて動かすまでの実践手順。ビルド・検証・アップロード実行
---

# brain 作者ガイド

自分の brain（人間の意思決定アルゴリズム）を書いて zeroverse で動かすまでの実践手順。仕様の正典は [WIT パッケージ全体像](./wit.md) と [`wit/world.wit`](https://github.com/kuboon/zero-verse/blob/main/wit/world.wit)、世界のルールは「世界の仕様」の各章にある。ここでは動かすことに集中する。

## brain とは何か

brain は **wasm component** で、毎月 1 回 world から呼ばれる:

```
decide(snapshot, memory) を呼ばれたら、
  commit へ act（今月やること、最大 4 枠）と order（板への注文）を積み、
  save-memory で来月の自分に blob を残す
```

原則はこれだけ。ただし世界側に次の不変則がある:

- **ステートレス**: インスタンスは decide のたびに作り直される。月をまたいで持ち越せる状態は `save-memory` した blob（`memory-limit` バイトまで）だけ。グローバル変数は毎月消える
- **テレパシー禁止**: 同じ brain コードを複数人に割り当てても、インスタンスが毎回新規なので個体間の共有メモリは存在しない。連携したければ world 内の手段（give・板・introduce…）で行う
- **観測は行動の痕跡だけ**: snapshot に見えるのは自分の内側（stats・保有・skill）、知人リスト（親密度・見かけの年齢/性別・生死）、先月のイベント、板の公開気配。他人の真の性別・血縁・在庫は見えない（[human](./human.md) / [kinship](./kinship.md)）
- **決定論**: 同一シード → 同一歴史。乱数が欲しければ snapshot の `rand`（hash(seed, id, tick)）を使う。時刻・外部入力は存在しない
- **思考コスト**: ネイティブ実行では消費 fuel が health 減少に換算される（`fuel-per-health`）。考えすぎると寿命が縮む。ブラウザ実行では fuel 計量が無い代わりに、応答しない brain は watchdog が打ち切る

何ができるか（act の種類、invoke / give / teach / learn / introduce / discard と standing order）は [wit.md](./wit.md) の分散マップから各章へ。

## 最小の brain（Rust）

**いちばん早いのはテンプレートから始めること**: [zeroverse-brain-template](https://github.com/kuboon/zeroverse-brain-template) を「Use this template」して `./build.sh` すれば、そのまま生き延びられる brain（forager と同じ実験学習戦略）の `.wasm` ができる。wit のコピー・ビルドスクリプト・CI（push すると artifact に `.wasm` が置かれるので、手元に Rust が無くても開発できる）込み。

本体リポジトリの [`guests/`](https://github.com/kuboon/zero-verse/tree/main/guests) も実例。`guests/brain-forager` は「何が食事で何が採取かを知らずに生まれ、invoke 実験の結果から法則を学ぶ」参照実装で、まずこれを読むのが早い。

骨格は次のとおり:

```rust
// Cargo.toml: crate-type = ["cdylib"], 依存は wit-bindgen だけ
wit_bindgen::generate!({
    path: "../../wit",   // リポジトリの wit/ を指す
    world: "brain",
});

use zeroverse::world::commit;
use zeroverse::world::observation::Snapshot;

struct MyBrain;

impl Guest for MyBrain {
    fn decide(snap: Snapshot, memory: Vec<u8>) {
        // 1. memory を読んで前月までの知識を復元する
        // 2. snapshot を見て今月の act を commit::push_act(...) で積む
        // 3. commit::save_memory(&new_memory) で来月の自分へ引き継ぐ
    }
}

export!(MyBrain);
```

ビルド:

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-tools

cargo build --release --target wasm32-unknown-unknown
wasm-tools component new target/wasm32-unknown-unknown/release/my_brain.wasm \
  -o my-brain.wasm
```

Rust 以外でも、`wit/world.wit` の `brain` world を実装した wasm component を吐ける言語なら何でもよい（componentize-js、componentize-py など。component model のツールチェーンに従う）。

## 動かして検証する

### ブラウザ（いちばん手軽）

[play ページ](https://kuboon.github.io/zero-verse/play/) → シナリオ「自由編成」→ brain の行で **「📂 .wasm をアップロード…」** を選ぶ。

- `.wasm` は**どこにも送信されない**。ブラウザの中で jco が component を transpile し、そのままページ内で実行される（GitHub Pages に動的サーバは無い）
- 複数行に別々の brain を人数付きで並べて対戦できる。📊 集計 でグループごとの生存数・平均生涯消費が出る
- アップロードした brain はページを開いている間だけ有効（リロードで消える）
- 無限ループする brain は watchdog が worker ごと打ち切る

### CLI（ネイティブ・fuel 計量あり）

```sh
cargo run --release -p zeroverse-wasm-host --bin zeroverse-wasm -- run \
  --scenario target/components/scenario-m1.wasm \
  --brain 0=my-brain.wasm \
  --seed 42 --years 30
```

scenario の `judge` がクリア判定を返す。ネイティブでは fuel が実測され、思考コストが health に効く（ブラウザと僅かに歴史がずれる場合があるのはこのため）。

### デバッグの定石

- まず `idle`（何もしない）との対戦で「生き延びる」ことだけ確認する。餓死する場合は [skills](./skills.md) の食事・採取と、[resources](./resources.md) の占有維持費（穀倉死）を疑う
- memory blob は必ず後方互換に読めるよう自衛する（自分の旧バージョンが書いた blob で panic しない）。panic した decide はその月の宣言が部分適用になる
- 決定論なので、同じ seed で再現しながら printf の代わりに memory へ痕跡を書いて調べられる

## 罠と作法

- **act は最大 4 枠/月**（`act-slots-base`）。5 個目以降は捨てられる
- 採取は溜め込みすぎない（占有維持費で「穀倉死」する。参照 brain は備蓄 10 で採取を止める）
- 配偶者からの贈り物など「自分に使えない resource」は discard で片付ける（放置すると同じく穀倉死）
- 子育て・求愛の力学（親密度・conceive の条件・刷り込み）は [kinship](./kinship.md) を読む。「親の愛」の配分はゲームの核心的なトレードオフになっている
- 大きすぎる wasm はブラウザでの transpile に時間がかかる。release ビルド + `wasm-tools strip` を推奨
