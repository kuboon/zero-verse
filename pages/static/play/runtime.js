// zeroverse ビューワ実行系 glue（ブラウザ / node 共用。node はスモークテスト用）。
//
// ブラウザは wasm component をネイティブ実行できないため、jco transpile が生成した
// core wasm + JS glue（--instantiation sync）を接続する。ここが wasm-host（wasmtime）の
// Linker に相当する層で、次の責務を持つ:
//   - core wasm の事前 compile と instantiate ルーティング
//   - commit（push-act / push-order / save-memory）の収集 → engine への受け渡し
//   - decide ごとの新規インスタンス化（テレパシー禁止。wasm-host と同じ不変則）
//   - jco の lift 表現（BigUint64Array / Uint32Array / undefined val）の正規化
//
// 制約: fuel 計量は無い（fuel_used = 0 として engine 側に渡る）。トラップ時は
// そこまでに push 済みの宣言を有効とする（部分実行、wasm-host と同じ）。

/** url のバイト列を取得する。node では fetch が file: を扱えないため差し替え可能 */
export async function defaultFetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
  return await res.arrayBuffer();
}

/** wasm-bindgen 生成の engine モジュールをロードする */
export async function loadEngine(engineDirUrl, fetchBytes = defaultFetchBytes) {
  const mod = await import(new URL('zeroverse_web.js', engineDirUrl).href);
  const bytes = await fetchBytes(new URL('zeroverse_web_bg.wasm', engineDirUrl).href);
  await mod.default({ module_or_path: await WebAssembly.compile(bytes) });
  return mod;
}

/**
 * jco transpile の出力ディレクトリから component をロードする。
 * manifest.json が無い場合は <name>.core.wasm, core2, ... を順に探す。
 * 返り値: { instantiate(imports) => exports（呼ぶたびに新規インスタンス） }
 */
export async function loadComponent(dirUrl, name, fetchBytes = defaultFetchBytes) {
  const mod = await import(new URL(`${name}.js`, dirUrl).href);
  let cores;
  try {
    const m = JSON.parse(
      new TextDecoder().decode(await fetchBytes(new URL('manifest.json', dirUrl).href)),
    );
    cores = m.cores;
  } catch {
    cores = [];
    for (let i = 1; ; i++) {
      const file = i === 1 ? `${name}.core.wasm` : `${name}.core${i}.wasm`;
      try {
        await fetchBytes(new URL(file, dirUrl).href);
        cores.push(file);
      } catch {
        break;
      }
    }
  }
  const modules = new Map();
  for (const file of cores) {
    const bytes = await fetchBytes(new URL(file, dirUrl).href);
    modules.set(file, await WebAssembly.compile(bytes));
  }
  const getCoreModule = (path) => {
    const m = modules.get(path);
    if (!m) throw new Error(`core module not found: ${path}`);
    return m;
  };
  return { instantiate: (imports) => mod.instantiate(getCoreModule, imports) };
}

// --- jco lift 表現の正規化（engine 側 serde が読める形へ） ---------------------

function normalizeAct(a) {
  if (a.tag === 'invoke') {
    return {
      tag: 'invoke',
      val: {
        inputs: Array.from(a.val.inputs ?? []),
        usingSkills: Array.from(a.val.usingSkills ?? []),
      },
    };
  }
  if (a.val === undefined) return { tag: a.tag };
  return a;
}

function normalizeOrder(o) {
  if (o.tag === 'conditional-give' && o.val?.condition?.val === undefined) {
    return { tag: o.tag, val: { ...o.val, condition: { tag: o.val.condition.tag } } };
  }
  return o;
}

/** scenario の world-setup（Uint32Array 等を含む）を通常のオブジェクトへ */
export function normalizeSetup(setup) {
  return {
    humans: Array.from(setup.humans, (h) => ({
      brainGroup: h.brainGroup,
      skills: Array.from(h.skills, (s) => ({
        skillIndex: s.skillIndex,
        proficiency: s.proficiency,
      })),
      acquaintances: Array.from(h.acquaintances ?? []),
    })),
  };
}

// --- brain / scenario ランナー ------------------------------------------------

/**
 * brain component を「decide 1 回 = 新規インスタンス 1 個」で実行するランナー。
 * decide(snapshot, memory) は WebWorld.setDecider が要求する
 * {acts, orders, memory} を返す。トラップ時は push 済み分を返す（部分実行）。
 */
export function makeBrainRunner(component) {
  return {
    decide(snap, memory) {
      const commits = { acts: [], orders: [], memory: undefined };
      const commit = {
        pushAct: (a) => commits.acts.push(normalizeAct(a)),
        pushOrder: (o) => commits.orders.push(normalizeOrder(o)),
        saveMemory: (d) => {
          commits.memory = new Uint8Array(d);
        },
      };
      // forager は probe を参照しないが、参照する brain のためにスタブを置く
      // （wasm-host の probe::Host スタブと同じ応答）
      const probe = {
        tradeHistory: () => [],
        graphDistance: () => undefined,
      };
      // jco 生成 JS はバージョンなしのキー（'zeroverse:world/commit'）で import を
      // 参照する（.d.ts はバージョン付き）。両方のキーで渡しておく
      const imports = {};
      for (const [iface, impl] of [
        ['types', {}],
        ['action', {}],
        ['observation', {}],
        ['commit', commit],
        ['probe', probe],
      ]) {
        imports[`zeroverse:world/${iface}`] = impl;
        imports[`zeroverse:world/${iface}@0.1.0`] = impl;
      }
      try {
        const root = component.instantiate(imports);
        root.brainApi.decide(snap, memory);
      } catch {
        // トラップ = 部分実行。push 済みの宣言は有効
      }
      return commits;
    },
  };
}

/** scenario component（init / judge。呼び出しごとに新規インスタンス） */
export function makeScenario(component) {
  return {
    init(seed) {
      const root = component.instantiate({});
      return normalizeSetup(root.scenarioApi.init(BigInt(seed)));
    },
    judge(report) {
      const root = component.instantiate({});
      return root.scenarioApi.judge(report);
    },
  };
}

/**
 * 実行一式を組み立てる。
 *   engine:   loadEngine の戻り値
 *   scenario: makeScenario の戻り値
 *   brains:   Map<group(number), brainRunner>。無いグループは idle
 * 返り値: { world, setup, judge() }
 */
export function createRun(engine, scenario, brains, seed) {
  const setup = scenario.init(seed);
  const world = new engine.WebWorld(BigInt(seed), setup);
  // human-id 昇順 = setup index 順（wasm-host ランナーと同一規則）で group を対応付け
  const groupOf = new Map();
  {
    const ids = world
      .state()
      .humans.map((h) => h.id)
      .sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
    ids.forEach((id, i) => groupOf.set(id, setup.humans[i].brainGroup));
  }
  const defaultGroup = setup.humans[0]?.brainGroup ?? 0;
  world.setDecider((idStr, snap, memory) => {
    // 新生児など未知の id は defaultGroup の brain へ
    const g = groupOf.get(idStr) ?? defaultGroup;
    const runner = brains.get(g);
    if (!runner) return { acts: [], orders: [] };
    return runner.decide(snap, memory);
  });
  return {
    world,
    setup,
    judge: () => scenario.judge(world.report()),
  };
}
