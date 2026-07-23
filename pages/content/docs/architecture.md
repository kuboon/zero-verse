---
title: 実装アーキテクチャ
section: brain を書く
order: 2
summary: 決定論チェックリスト・三形態デプロイ
---

# 実装アーキテクチャ

## コア

- コアは **Rust の単一クレート**。決定論 lockstep、シード固定。同一シード → バイト単位で同一の歴史。リプレイはシードだけで配布できる。
- 三形態に同じコアを載せる：
  1. **ネイティブ**（採点用大規模ラン）
  2. **Durable Objects**（スローモーの人間参加 realm）
  3. **ブラウザ WASM**（ローカル観戦とデバッグ）— 実装済み（`crates/web` + `pages/static/play/`）。ブラウザは component model をネイティブ実行できないため、brain / scenario component は jco transpile した core wasm + JS glue で接続する。JS glue が wasmtime Linker 相当（commit 収集・decide ごとの新規インスタンス化）。ただし **fuel 計量は無い**（fuel_used = 0）ので、思考コストが効く world ではネイティブと歴史が分かれる。公式ランは常にネイティブ形態。
     - **ブラウザ fuel の設計判断**（記録）: Worker 分割では fuel は得られない（得られるのは wall-clock watchdog = 非決定論的な暴走対策のみ）。ブラウザで決定論的な fuel が要るなら **core wasm への命令数カウンタ計装**（ビルド時に jco 出力の .core.wasm を変換）が正道。計装 fuel は決定論的だが wasmtime の計量とはスケールが異なるため、ネイティブとの hash 一致は fuel ゼロ域に限られる（現状と同じ）。
     - **brain ごとの Worker 分割**（記録）: component ABI とは独立に可能（jco 出力は Worker 上でも動く）。実益は暴走 brain の個別隔離（commit を逐次 postMessage すれば部分実行も保てる）と decide の並列化。ただし engine の step を非同期 2 相（snapshot 収集 → 決定回収 → 解決）に改造する必要がある。GitHub Pages はカスタムヘッダ不可で SharedArrayBuffer（同期ブロッキング）が使えないため、同期呼び出しのままの分割はできない。ユーザ投稿 brain（信頼できないコード）を載せる段で導入する

## brain 実行

- brain は **WASM Component Model**。詳細は [09-wit-draft.md](./wit.md)。
- **decide は完全ステートレス**。月を跨ぐ状態は memory blob として明示的に出入りし、world 側が human の一部として保存する。memory サイズ上限は年齢の関数（老化による物忘れ）。出力は戻り値でなく **commit import への積み上げ**（[human.md](./human.md)）。
- **呼び出しごとに新規インスタンス化**（InstancePre + pooling allocator）。インスタンス共有は同族間のゼロコスト秘密通信路（テレパシー）になり、識別不能公理と実コスト通信公理を同時に破壊するため厳禁。Module（コード）の共有は可。

## 決定論チェックリスト

- ABI から float 排除（qty は 1/1000 固定小数点 u64）。
- wasi を一切リンクしない。
- 乱数は human ID × tick のハッシュを snapshot で渡す。
- NaN 正規化有効。
- fuel 計量は wasmtime の決定論的な命令数ベース計量（`Config::consume_fuel(true)` / `Store::set_fuel` / `get_fuel`）。実行後の残量から消費を算出して health の減少に写像する。epoch interruption は実時間ベースで非決定論的なため使用禁止。
- fuel 切れ / trap は**部分実行**：それまでに commit 済みの宣言は有効に実行する（[human.md](./human.md)）。不正な宣言は月内解決時に個別に落とし、翌月 action-failed で通知する。
- 劣化・環境変換の固定小数点端数は**決定論的確率丸め**（hash(seed, holder, resource, tick) で丸め方向を決める）。floor 一律だと少量在庫が永遠に腐らない。代替案は holder × resource ごとの誤差累積（Bresenham 方式）。自発変換の適用は tick パイプラインの固定位相（snapshot 生成前）で全ストック一括。

## その他の設計判断

- **human-id は連番にしない**（出生順 = 血縁の手がかりが漏れる）。
- 観測は push（snapshot）が基本、深掘り観測だけ fuel 課金の import で pull（**注意力の市場**）。
- 月内の相互作用は standing order の突き合わせで解決。解決順序は「**teach/learn 成立 → conditional-give 判定 → 板マッチング**」で固定。
