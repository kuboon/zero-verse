// ビューワの実行スレッド（module worker）。
//
// エンジン（wasm-bindgen）と component（jco transpile 済み）のロード・実行を
// UI スレッドから隔離する。brain は任意コードなので無限ループしうる
// （fuel 計量が無いため停止しない）。その場合も UI は固まらず、
// app.js 側の watchdog が worker ごと terminate して隔離する。
//
// プロトコル: {id, cmd, ...args} を受け、{id, ok, ...result} を返す。
//   init  {seed, campaign, brain}      → {state}
//   step  {months}                     → {state, series: [月ごとの集計]}
//   judge {}                           → {verdict: {cleared, score, note}}

import {
  loadEngine,
  loadComponent,
  makeBrainRunner,
  makeScenario,
  createRun,
} from './runtime.js';

// ビルトインの campaign / brain（docs/viewer/gen/ に build-web.sh が置く）
const CAMPAIGNS = {
  m1: { dir: 'gen/scenario-m1/', name: 'scenario-m1' },
};
const BRAINS = {
  forager: { dir: 'gen/brain-forager/', name: 'brain-forager' },
  idle: null,
};

let engine = null;
let run = null;

async function handle(cmd, args) {
  if (cmd === 'init') {
    if (!engine) {
      engine = await loadEngine(new URL('gen/engine/', import.meta.url));
    }
    const c = CAMPAIGNS[args.campaign];
    if (!c) throw new Error(`unknown campaign: ${args.campaign}`);
    const scenario = makeScenario(
      await loadComponent(new URL(c.dir, import.meta.url), c.name),
    );
    const brains = new Map();
    const b = BRAINS[args.brain];
    if (b === undefined) throw new Error(`unknown brain: ${args.brain}`);
    if (b) {
      const runner = makeBrainRunner(
        await loadComponent(new URL(b.dir, import.meta.url), b.name),
      );
      // どの brain-group にも同じ component を割り当てる（ランナー共有 = コード共有。
      // インスタンスは decide ごとに新規なのでテレパシーは起きない）
      for (let g = 0; g < 16; g++) brains.set(g, runner);
    }
    run = createRun(engine, scenario, brains, args.seed);
    return { state: run.world.state() };
  }
  if (!run) throw new Error('not initialized');
  if (cmd === 'step') {
    const series = [];
    for (let i = 0; i < args.months; i++) {
      run.world.step(1);
      const s = run.world.state();
      series.push({
        month: s.month,
        alive: s.alive,
        births: s.births,
        deaths: s.deaths,
        meanHealth:
          s.humans.length === 0
            ? 0
            : s.humans.reduce((a, h) => a + h.health, 0) / s.humans.length,
        envPrimary: s.env.filter((e) => !e.isWaste).reduce((a, e) => a + e.stock, 0),
      });
      if (s.alive === 0) break;
    }
    return { state: run.world.state(), series };
  }
  if (cmd === 'judge') {
    const v = run.judge();
    return {
      verdict: { cleared: v.cleared, score: v.score.toString(), note: v.note },
    };
  }
  throw new Error(`unknown cmd: ${cmd}`);
}

self.onmessage = async (e) => {
  const { id, cmd, ...args } = e.data;
  try {
    const result = await handle(cmd, args);
    self.postMessage({ id, ok: true, ...result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.stack ?? err) });
  }
};

self.postMessage({ id: 0, ok: true, ready: true });
