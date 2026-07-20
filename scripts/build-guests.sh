#!/usr/bin/env bash
# guest components をビルドして target/components/ に置く。
# 前提: rustup target add wasm32-unknown-unknown / cargo install wasm-tools
set -euo pipefail
cd "$(dirname "$0")/.."

cargo build --manifest-path guests/Cargo.toml --release --target wasm32-unknown-unknown
mkdir -p target/components
wasm-tools component new guests/target/wasm32-unknown-unknown/release/brain_forager.wasm \
  -o target/components/brain-forager.wasm
wasm-tools component new guests/target/wasm32-unknown-unknown/release/scenario_m1.wasm \
  -o target/components/scenario-m1.wasm
echo "built: target/components/{brain-forager,scenario-m1}.wasm"
