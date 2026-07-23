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
  custom: { type: 'custom' },
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
      const world = new engine.WebExperiment(sc.kind, BigInt(args.seed), args.scale || 1);
      run = {
        world,
        judge: () => ({ type: 'summary', lines: world.summary() }),
      };
    } else if (sc.type === 'custom') {
      // 自由編成: 行ごとの brain × 人数。scenario component なし（賦存は engine 側の
      // M1 風デフォルト）。judge の代わりにグループ別レポートを集計として返す
      const rows = (args.comp ?? []).filter((r) => (r.count | 0) > 0);
      if (rows.length === 0) throw new Error('brain の行がありません');
      const world = engine.WebWorld.freeRun(
        BigInt(args.seed),
        Uint32Array.from(rows.map((r) => r.count | 0)),
      );
      const cache = new Map();
      const runners = [];
      for (const row of rows) {
        if (row.brain === 'idle') {
          runners.push(null);
          continue;
        }
        const b = BRAINS[row.brain];
        if (!b) throw new Error(`unknown brain: ${row.brain}`);
        if (!cache.has(row.brain)) {
          cache.set(
            row.brain,
            makeBrainRunner(await loadComponent(new URL(b.dir, import.meta.url), b.name)),
          );
        }
        runners.push(cache.get(row.brain));
      }
      const groupOf = new Map();
      for (const h of world.state().humans) groupOf.set(h.id, h.group ?? 0);
      world.setDecider((idStr, snap, memory) => {
        // 新生児など未知の id はグループ 0 の brain へ
        const g = groupOf.get(idStr) ?? 0;
        const runner = runners[g];
        if (!runner) return { acts: [], orders: [] };
        return runner.decide(snap, memory);
      });
      const names = rows.map((r, i) => `${r.brain}#${i + 1}`);
      run = {
        world,
        judge: () => {
          const rep = world.report();
          return {
            type: 'summary',
            lines: rep.groups.map((g) => [
              names[g.group] ?? `group${g.group}`,
              `生存 ${g.alive}/${g.total}　平均生涯消費 ${g.meanConsumed.toString()}`,
            ]),
          };
        },
      };
      return { state: world.state(), isExperiment: false, groupNames: names };
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
