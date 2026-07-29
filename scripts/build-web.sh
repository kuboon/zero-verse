#!/usr/bin/env bash
# GitHub Pages ビューワ（pages/static/play/）の生成物を pages/static/play/gen/ に置く。
# 前提: rustup target add wasm32-unknown-unknown
#       cargo install wasm-bindgen-cli --version <crates/web の wasm-bindgen と同一>
#       node + npx（jco は npx で取得）
#
# 生成物はコミットする方針（pages/ の SSG ビルドが static/ ごと配信する）。
set -euo pipefail
cd "$(dirname "$0")/.."

JCO_VERSION=1.25.2
JCO_TRANSPILE_VERSION=0.4.2 # ブラウザ内 transpile（brain アップロード）用
ESBUILD_VERSION=0.25.6

# 1. guest components
./scripts/build-guests.sh

# 2. engine（wasm-bindgen）
cargo build -p zeroverse-web --release --target wasm32-unknown-unknown
mkdir -p pages/static/play/gen/engine
wasm-bindgen --target web --out-dir pages/static/play/gen/engine --no-typescript \
  target/wasm32-unknown-unknown/release/zeroverse_web.wasm

# 3. component → core wasm + JS glue（jco transpile。ブラウザは component model を
#    ネイティブ実行できないため）。--instantiation sync で decide ごとの新規
#    インスタンス化（テレパシー禁止）を呼び出し側から行えるようにする。
for comp in brain-forager scenario-m1; do
  out="pages/static/play/gen/$comp"
  rm -rf "$out"
  npx -y "@bytecodealliance/jco@$JCO_VERSION" transpile \
    "target/components/$comp.wasm" --instantiation sync -o "$out" >/dev/null
  # core wasm の一覧（ブラウザ側が事前 compile するためのマニフェスト）
  (cd "$out" && ls ./*.core*.wasm 2>/dev/null | sed 's|^\./||' \
    | node -e 'const fs=require("fs");const l=fs.readFileSync(0,"utf8").trim().split("\n");fs.writeFileSync("manifest.json",JSON.stringify({cores:l}))')
done

# 4. ブラウザ内 jco transpile バンドル（brain アップロード機能）。
#    ユーザーの .wasm component をブラウザだけで接続するため、jco の
#    transpile 本体（js-component-bindgen、wasm）を esbuild で 1 ファイルに束ねる。
#    アップロード時のみ動的 import されるので通常の閲覧では落ちてこない
TDIR=$(mktemp -d)
trap 'rm -rf "$TDIR"' EXIT
npm install --prefix "$TDIR" --silent --no-audit --no-fund \
  "@bytecodealliance/jco-transpile@$JCO_TRANSPILE_VERSION" "esbuild@$ESBUILD_VERSION"
cat > "$TDIR/entry.js" <<'EOF'
// zeroverse: ブラウザ内 jco transpile（brain アップロード用）の薄い入口
import {
  $init,
  generate,
} from './node_modules/@bytecodealliance/jco-transpile/vendor/js-component-bindgen-component.js';

/** wasm component bytes → { files: Array<[name, Uint8Array]> }（instantiation: sync） */
export async function transpileComponent(bytes, name) {
  await $init;
  return generate(bytes, {
    name,
    noTypescript: true,
    noNamespacedExports: true,
    instantiation: { tag: 'sync' },
  });
}
EOF
mkdir -p pages/static/play/gen/jco
# node:fs/promises は vendor 内の node 用フォールバック（ブラウザでは到達しない）
"$TDIR/node_modules/.bin/esbuild" "$TDIR/entry.js" --bundle --format=esm \
  --platform=browser --external:node:fs/promises \
  --outfile=pages/static/play/gen/jco/transpiler.js >/dev/null
cp "$TDIR/node_modules/@bytecodealliance/jco-transpile/vendor/js-component-bindgen-component.core.wasm" \
   "$TDIR/node_modules/@bytecodealliance/jco-transpile/vendor/js-component-bindgen-component.core2.wasm" \
   pages/static/play/gen/jco/

echo "built: pages/static/play/gen/{engine,brain-forager,scenario-m1,jco}"
