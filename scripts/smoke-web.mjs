// ブラウザ実行系（pages/static/play/）のヘッドレススモークテスト。
// jco transpile した brain / scenario component を wasm-bindgen 版 engine に接続し、
// ネイティブの E2E（zeroverse-wasm run --seed 42 --years 30）と同じランを回して
// クリア判定まで通す。ブラウザ固有なのは DOM だけで、実行経路はビューワと同一。
//
// 使い方: node scripts/smoke-web.mjs  （要: scripts/build-web.sh 済み）
import { readFile } from 'node:fs/promises';
import {
  loadEngine,
  loadComponent,
  loadComponentFromFiles,
  loadMeter,
  makeBrainRunner,
  makeInstinctRunner,
  makeScenario,
  createRun,
} from '../pages/static/play/runtime.js';

// ブラウザ内 transpile バンドル（gen/jco/）は fetch で core wasm を取りに行く。
// node の fetch は file: を扱えないので、ここでだけポリフィルする
{
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, ...rest) => {
    const u = String(url);
    if (u.startsWith('file:')) {
      const bytes = await readFile(new URL(u));
      return new Response(bytes, { headers: { 'content-type': 'application/wasm' } });
    }
    return origFetch(url, ...rest);
  };
}

const gen = new URL('../pages/static/play/gen/', import.meta.url);
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
for (const kind of ['m1', 'm2', 'm2-otc', 'm2-mingle', 'm3-open', 'm4', 'm4-clans-exo', 'm4-marriage']) {
  const a = new engine.WebExperiment(kind, 7n, 1);
  a.step(10 * 12);
  const lines = a.summary();
  const b = new engine.WebExperiment(kind, 7n, 1);
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
// 自由編成（freeRun）: グループ割当・レポート・決定論
{
  const w = engine.WebWorld.freeRun(11n, Uint32Array.from([3, 2]));
  const st = w.state();
  const g0 = st.humans.filter((h) => h.group === 0).length;
  const g1 = st.humans.filter((h) => h.group === 1).length;
  if (g0 !== 3 || g1 !== 2) {
    console.error(`FAIL: freeRun groups ${g0}/${g1}`);
    process.exit(1);
  }
  w.step(24);
  const rep = w.report();
  if (rep.groups.length !== 2) {
    console.error('FAIL: freeRun report groups');
    process.exit(1);
  }
  console.log(`freeRun: alive=${w.alive()} groups=${rep.groups.length}`);

  // 時代プリセット: era 指定が効いて（別歴史になる）、かつ決定論的であること
  const hunt1 = engine.WebWorld.freeRun(11n, Uint32Array.from([3, 2]), 'hunting');
  const hunt2 = engine.WebWorld.freeRun(11n, Uint32Array.from([3, 2]), 'hunting');
  hunt1.step(24);
  hunt2.step(24);
  if (hunt1.state().stateHash !== hunt2.state().stateHash) {
    console.error('FAIL: era freeRun not deterministic');
    process.exit(1);
  }
  if (hunt1.state().stateHash === w.state().stateHash) {
    console.error('FAIL: era has no effect on freeRun');
    process.exit(1);
  }
  let eraErr = null;
  try {
    engine.WebWorld.freeRun(11n, Uint32Array.from([1]), 'bronze');
  } catch (e) {
    eraErr = e;
  }
  if (!eraErr) {
    console.error('FAIL: unknown era not rejected');
    process.exit(1);
  }
  console.log(`era: ok (hunting は基準と別歴史・決定論・未知 era は拒否)`);
}
// brain アップロード経路: bytes → ブラウザ内 jco transpile → fuel 計装 → files 接続。
// ビルトイン（ビルド時計装）と同一歴史になること
{
  const { transpileComponent } = await import('../pages/static/play/gen/jco/transpiler.js');
  const meter = await loadMeter(new URL('meter/', gen), fetchBytes);
  const bytes = await readFile(new URL('../target/components/brain-forager.wasm', import.meta.url));
  const out = await transpileComponent(new Uint8Array(bytes), 'ubrain');
  const files = out.files.map(([f, b]) => (f === 'ubrain.core.wasm' ? [f, meter.meterFuel(b)] : [f, b]));
  const uploaded = makeBrainRunner(await loadComponentFromFiles(files, 'ubrain'));
  const runHash = (runner) => {
    const w = engine.WebWorld.freeRun(11n, Uint32Array.from([5]));
    w.setDecider((id, snap, mem) => runner.decide(snap, mem));
    w.step(20 * 12);
    return w.state().stateHash;
  };
  const h1 = runHash(brain);
  const h2 = runHash(uploaded);
  if (h1 !== h2) {
    console.error(`FAIL: upload path history differs (${h1} != ${h2})`);
    process.exit(1);
  }
  console.log(`upload path: ok (transpile + meter in browser path → same history ${h2})`);

  // fuel 計装の検証:
  // - 計装済み brain は fuel_used > 0 を返す
  // - 予算を使い切ると trap で止まる（無限ループの決定論的停止と同じ機構）
  //   trap までに push した宣言は有効（部分実行）で fuel_used = 予算全額
  // 注: forager の消費は health 量子（fuel-per-health = 100 万）未満なので、
  //     歴史はネイティブ同様 fuel ゼロ域のまま変わらない
  const w = engine.WebWorld.freeRun(13n, Uint32Array.from([3]));
  let sampled = 0n;
  let snap0 = null;
  w.setDecider((id, snap, mem) => {
    if (!snap0) snap0 = snap;
    const d = uploaded.decide(snap, mem);
    if (d.fuelUsed) sampled = BigInt(d.fuelUsed);
    return d;
  });
  w.step(12);
  if (sampled <= 0n) {
    console.error('FAIL: metered brain reported fuel_used = 0');
    process.exit(1);
  }
  const tiny = structuredClone(snap0);
  tiny.selfView.fuelBudget = 10n;
  const starved = uploaded.decide(tiny, new Uint8Array());
  if (starved.fuelUsed !== 10 || starved.acts.length !== 0) {
    console.error(
      `FAIL: budget exhaustion not enforced (fuelUsed=${starved.fuelUsed} acts=${starved.acts.length})`,
    );
    process.exit(1);
  }
  console.log(`fuel: ok (decide あたり ~${sampled} 消費、予算 10 では trap して全額消費)`);
}
// Instinct（スクリプト brain）: 雛形スクリプトで 20 年生存 + 決定論 + 構文エラー trap
{
  const instinct = await loadComponent(new URL('brain-instinct/', gen), 'brain-instinct', fetchBytes);
  const starter = `#!instinct/1
var kindness
when !knows_food             do explore
when food < 10               do harvest
when health < 90 && food > 0 do eat
when month % 2 == 1          do discard
when food > 6 && acq > 0     do give_food, set kindness = kindness + 1
`;
  const runHash = (script) => {
    const w = engine.WebWorld.freeRun(21n, Uint32Array.from([5]));
    const runner = makeInstinctRunner(instinct, script);
    w.setDecider((id, snap, mem) => runner.decide(snap, mem));
    w.step(20 * 12);
    return { hash: w.state().stateHash, alive: w.alive() };
  };
  const a = runHash(starter);
  const b = runHash(starter);
  if (a.hash !== b.hash) {
    console.error('FAIL: instinct not deterministic');
    process.exit(1);
  }
  if (a.alive < 4) {
    console.error(`FAIL: instinct starter does not survive (alive=${a.alive})`);
    process.exit(1);
  }
  // mingle: スクリプトで宣言した者同士だけが知人になる（5 人全員が毎偶数月 mingle）
  {
    const social = '#!instinct/1\nwhen !knows_food do explore\nwhen food < 10 do harvest\nwhen health < 90 && food > 0 do eat\nwhen month % 2 == 0 do mingle\n';
    const w = engine.WebWorld.freeRun(21n, Uint32Array.from([5]));
    const runner = makeInstinctRunner(instinct, social);
    w.setDecider((id, snap, mem) => runner.decide(snap, mem));
    w.step(24);
    const rep = w.report();
    if (rep.groups.length !== 1) {
      console.error('FAIL: mingle freeRun report');
      process.exit(1);
    }
    if (w.alive() !== 5) {
      console.error(`FAIL: mingle script world died (alive=${w.alive()})`);
      process.exit(1);
    }
    // 自由編成の初期知人はリング（各 2 人）。mingle で知人グラフが育つ
    //（5 人の完全グラフは各 4 人 = 総和 20。ε の寄与は 24 ヶ月では僅少）
    const totalDeg = w.state().humans.reduce((a, h) => a + h.acquaintances.length, 0);
    if (totalDeg < 16) {
      console.error(`FAIL: mingle did not grow the graph (total degree ${totalDeg})`);
      process.exit(1);
    }
    console.log(`instinct mingle: ok (2 年で知人次数 計 ${totalDeg}/20)`);
  }
  // 構文エラーは行番号つきの trap として表面化する
  const bad = makeInstinctRunner(instinct, '#!instinct/1\nwhen oops > 0 do eat\n');
  const w = engine.WebWorld.freeRun(21n, Uint32Array.from([1]));
  let err = null;
  w.setDecider((id, snap, mem) => {
    try {
      return bad.decide(snap, mem);
    } catch (e) {
      err = String(e);
      return { acts: [], orders: [] };
    }
  });
  w.step(1);
  if (!err || !err.includes('instinct:parse:2:')) {
    console.error(`FAIL: instinct parse error not surfaced (${err})`);
    process.exit(1);
  }
  console.log(`instinct: ok (20年生存 ${a.alive}/5・決定論・構文エラーは行番号つき trap)`);
}
console.log('smoke ok');
