// ビューワの実行スレッド（module worker）。
//
// 2 種類のシナリオを実行する:
// - campaign:   wasm component（scenario + 選択した brain）を jco glue で接続
// - experiment: M1〜M4 実験の再現。brains は zeroverse-core のネイティブ参照実装で、
//               engine wasm（WebExperiment）の中で動く。CLI と同一シード同一歴史
//
// brain は任意コードなので無限ループしうる（fuel 計量が無いため停止しない）。
// その場合も UI は固まらず、app.js 側の watchdog が worker ごと terminate する。
//
// プロトコル: {id, cmd, ...args} を受け、{id, ok, ...result} を返す。
//   init  {seed, scenario, brain}      → {state, isExperiment}
//   step  {months}                     → {state, series: [月ごとの集計]}
//   judge {}                           → {result: {type:'verdict'|'summary', ...}}

import {
  loadEngine,
  loadComponent,
  makeBrainRunner,
  makeScenario,
  createRun,
} from './runtime.js';

// ビルトインのシナリオ（campaign の dir/name は docs/viewer/gen/ に build-web.sh が置く）
const SCENARIOS = {
  'campaign-m1': { type: 'component', dir: 'gen/scenario-m1/', name: 'scenario-m1' },
  'exp-m1': { type: 'experiment', kind: 'm1' },
  'exp-m2': { type: 'experiment', kind: 'm2' },
  'exp-m3-open': { type: 'experiment', kind: 'm3-open' },
  'exp-m3-secret': { type: 'experiment', kind: 'm3-secret' },
  'exp-m4': { type: 'experiment', kind: 'm4' },
  'exp-m4-clans-endo': { type: 'experiment', kind: 'm4-clans-endo' },
  'exp-m4-clans-exo': { type: 'experiment', kind: 'm4-clans-exo' },
  'exp-m4-marriage': { type: 'experiment', kind: 'm4-marriage' },
};
const BRAINS = {
  forager: { dir: 'gen/brain-forager/', name: 'brain-forager' },
  idle: null,
};

let engine = null;
let run = null; // {world: WebWorld|WebExperiment, judge: () => result}

async function handle(cmd, args) {
  if (cmd === 'init') {
    if (!engine) {
      engine = await loadEngine(new URL('gen/engine/', import.meta.url));
    }
    // args.campaign はプロトコル v1（旧 app.js）の互換。キャッシュ由来の
    // 旧 app + 新 worker の組でも campaign-m1 として動くようにする
    const key = args.scenario ?? (args.campaign ? `campaign-${args.campaign}` : undefined);
    const sc = SCENARIOS[key];
    if (!sc) throw new Error(`unknown scenario: ${key}`);

    if (sc.type === 'experiment') {
      const world = new engine.WebExperiment(sc.kind, BigInt(args.seed));
      run = {
        world,
        judge: () => ({ type: 'summary', lines: world.summary() }),
      };
    } else {
      const scenario = makeScenario(
        await loadComponent(new URL(sc.dir, import.meta.url), sc.name),
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
      const r = createRun(engine, scenario, brains, args.seed);
      run = {
        world: r.world,
        judge: () => {
          const v = r.judge();
          return {
            type: 'verdict',
            cleared: v.cleared,
            score: v.score.toString(),
            note: v.note,
          };
        },
      };
    }
    return { state: run.world.state(), isExperiment: sc.type === 'experiment' };
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
    return { result: run.judge() };
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
