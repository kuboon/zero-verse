#!/usr/bin/env bash
# GitHub Pages ビューワ（docs/viewer/）の生成物を docs/viewer/gen/ に置く。
# 前提: rustup target add wasm32-unknown-unknown
#       cargo install wasm-bindgen-cli --version <crates/web の wasm-bindgen と同一>
#       node + npx（jco は npx で取得）
#
# 生成物はコミットする方針（Pages の Jekyll がそのまま配信する）。
set -euo pipefail
cd "$(dirname "$0")/.."

JCO_VERSION=1.25.2

# 1. guest components
./scripts/build-guests.sh

# 2. engine（wasm-bindgen）
cargo build -p zeroverse-web --release --target wasm32-unknown-unknown
mkdir -p docs/viewer/gen/engine
wasm-bindgen --target web --out-dir docs/viewer/gen/engine --no-typescript \
  target/wasm32-unknown-unknown/release/zeroverse_web.wasm

# 3. component → core wasm + JS glue（jco transpile。ブラウザは component model を
#    ネイティブ実行できないため）。--instantiation sync で decide ごとの新規
#    インスタンス化（テレパシー禁止）を呼び出し側から行えるようにする。
for comp in brain-forager scenario-m1; do
  out="docs/viewer/gen/$comp"
  rm -rf "$out"
  npx -y "@bytecodealliance/jco@$JCO_VERSION" transpile \
    "target/components/$comp.wasm" --instantiation sync -o "$out" >/dev/null
  # core wasm の一覧（ブラウザ側が事前 compile するためのマニフェスト）
  (cd "$out" && ls ./*.core*.wasm 2>/dev/null | sed 's|^\./||' \
    | node -e 'const fs=require("fs");const l=fs.readFileSync(0,"utf8").trim().split("\n");fs.writeFileSync("manifest.json",JSON.stringify({cores:l}))')
done

echo "built: docs/viewer/gen/{engine,brain-forager,scenario-m1}"
