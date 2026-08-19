---
title: Instinct（スクリプト brain）
section: brain を書く
order: 1
summary: ブラウザで書ける brain 専用ルール言語。#!instinct/1
---

# Instinct — ブラウザで書ける brain 専用言語

**Instinct** はライトユーザ向けの brain 専用ルール言語です。Rust やツールチェーンなしで、[play ページ](https://kuboon.github.io/zero-verse/play/)の自由編成にあるエディタに書いてそのまま実行できます。まず動くもの（雛形）が入っているので、書き換えながら覚えるのが早いです。

- 1 行目は必ず **`#!instinct/1`**（言語とバージョンの宣言。将来の別バージョンや後継言語はこの行で識別します）
- スクリプトはどこにも送信されません。ブラウザ内のインタープリタ（wasm）で実行されます
- 実行の実体は普通の wasm brain なので、**fuel 計量・決定論・サンドボックスは Rust の brain と同じ**です。書いた量・複雑さに応じて思考コスト（health）を払います

## 文法

```text
#!instinct/1
# コメント（# から行末まで）
var <名前>                      # 月をまたぐ変数（整数、初期値 0）
when <条件> do <動作>[, <動作>]  # 毎月、上から順に評価される
```

毎月、全ルールを上から評価し、条件が真（非 0）のルールの動作を順に実行します。**act は月に最大 4 つ**（`set` は数に入りません）。5 個目以降の act は実行されません。

## 観測（条件式で使える値）

| 名前 | 意味 |
| --- | --- |
| `health` | 体力 0〜100。0 で死 |
| `food` | 学習済みの食料の保有量（単位） |
| `knows_food` | 何が食料か学習済みなら 1、まだなら 0 |
| `month` | 現在の月（0 始まり） |
| `age` | 自分の年齢（年） |
| `acq` | 生きている知人の数 |
| `rand` | 0〜999 の決定論的な乱数（月ごとに変わる） |

演算子: `+ - * / %`、比較 `< <= > >= == !=`、論理 `&& || !`、括弧。整数のみ（0 除算は 0）。

## 動作

| 動作 | 意味 |
| --- | --- |
| `explore` | 何が食料か・どう採るかを実験して学ぶ（1 回 1 手） |
| `harvest` | 学習済みの採取を 1 回 |
| `eat` | 学習済みの食料を食べる（持っているだけ） |
| `discard` | 食料以外で一番多い持ち物を捨てる（溜め込むと維持費で「穀倉死」します） |
| `give_food` | 生きている知人へ輪番で食料 1.0 を贈る（親密度づくり。備蓄 2.0 は残す） |
| `mingle` | 出歩く。同じ月に mingle した人同士が引き合わされ、知らない相手なら知人になる（`acq` が増える） |
| `set <var> = <式>` | 変数に代入（act 枠を使わない） |

適用できない動作（食料未学習の `eat` など）は**枠を消費せずスキップ**されます。

## 例: 雛形（そのまま生き延びる）

```text
#!instinct/1
# はじめての brain: 学んで、食べて、たまに配る
var kindness

when !knows_food             do explore   # 何が食べ物かを実験で学ぶ
when food < 10               do harvest   # 備蓄が薄ければ採取
when health < 90 && food > 0 do eat       # お腹が減ったら食べる
when month % 2 == 1          do discard   # 余り物を片付ける（穀倉死対策）
when food > 6 && acq > 0     do give_food, set kindness = kindness + 1
```

## 仕組みと制約

- インタープリタ本体は Rust 製の wasm brain（`guests/brain-instinct`）で、スクリプトはホストが memory チャネルに注入します。engine から見れば普通の brain です
- 構文エラーは実行開始時にバナーで行番号つきで表示されます
- v1 の語彙は生存と初歩の社交まで。teach / 板 / 求愛などの高度な行動は Rust の brain（[brain 作者ガイド](./brain-guide.md)）で書いてください — Instinct は入口、wasm が本編です
- ネイティブ（公式ラン）でも同じインタープリタ + スクリプトで実行できます:

```sh
cargo run --release -p zeroverse-wasm-host --bin zeroverse-wasm -- run \
  --scenario target/components/scenario-m1.wasm \
  --brain 0=target/components/brain-instinct.wasm \
  --instinct 0=my-brain.instinct \
  --seed 42 --years 30
```
