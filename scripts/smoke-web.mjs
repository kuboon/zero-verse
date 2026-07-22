// ブラウザ実行系（docs/viewer/）のヘッドレススモークテスト。
// jco transpile した brain / scenario component を wasm-bindgen 版 engine に接続し、
// ネイティブの E2E（zeroverse-wasm run --seed 42 --years 30）と同じランを回して
// クリア判定まで通す。ブラウザ固有なのは DOM だけで、実行経路はビューワと同一。
//
// 使い方: node scripts/smoke-web.mjs  （要: scripts/build-web.sh 済み）
import { readFile } from 'node:fs/promises';
import {
  loadEngine,
  loadComponent,
  makeBrainRunner,
  makeScenario,
  createRun,
} from '../docs/viewer/runtime.js';

const gen = new URL('../docs/viewer/gen/', import.meta.url);
// node の fetch は file: を扱えないので readFile で差し替える
const fetchBytes = async (url) => (await readFile(new URL(url))).buffer;

const engine = await loadEngine(new URL('engine/', gen), fetchBytes);
const scenario = makeScenario(
  await loadComponent(new URL('scenario-m1/', gen), 'scenario-m1', fetchBytes),
);
const brain = makeBrainRunner(
  await loadComponent(new URL('brain-forager/', gen), 'brain-forager', fetchBytes),
);

const seed = 42;
const years = 30;
const run = createRun(engine, scenario, new Map([[0, brain]]), seed);
const t0 = performance.now();
for (let y = 0; y < years; y++) {
  run.world.step(12);
  if (y % 10 === 9) {
    const s = run.world.state();
    console.log(`y${y + 1}: alive=${s.alive} deaths=${s.deaths} births=${s.births}`);
  }
}
const elapsed = ((performance.now() - t0) / 1000).toFixed(2);

const state = run.world.state();
const verdict = run.judge();
console.log(`state hash : ${state.stateHash}`);
console.log(`elapsed    : ${elapsed}s`);
console.log(`verdict    : cleared=${verdict.cleared} score=${verdict.score} note=${verdict.note}`);

// 決定論チェック: 同一シードでもう一度回して state hash が一致すること
const run2 = createRun(engine, scenario, new Map([[0, brain]]), seed);
run2.world.step(years * 12);
const hash2 = run2.world.state().stateHash;
if (hash2 !== state.stateHash) {
  console.error(`FAIL: determinism broken (${state.stateHash} != ${hash2})`);
  process.exit(1);
}
console.log('determinism: ok (same seed → same state hash)');

if (!verdict.cleared) {
  console.error('FAIL: scenario not cleared');
  process.exit(1);
}

// 実験再現ラン（WebExperiment）: 集計が出ること + 決定論
for (const kind of ['m1', 'm2', 'm3-open', 'm4', 'm4-clans-exo', 'm4-marriage']) {
  const a = new engine.WebExperiment(kind, 7n);
  a.step(10 * 12);
  const lines = a.summary();
  const b = new engine.WebExperiment(kind, 7n);
  b.step(10 * 12);
  if (a.state().stateHash !== b.state().stateHash) {
    console.error(`FAIL: experiment ${kind} not deterministic`);
    process.exit(1);
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    console.error(`FAIL: experiment ${kind} summary empty`);
    process.exit(1);
  }
  console.log(`exp ${kind}: alive=${a.alive()} ${lines[0][0]}=${lines[0][1]}`);
}
console.log('smoke ok');
