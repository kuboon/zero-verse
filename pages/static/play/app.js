// zeroverse viewer UI。実行本体は worker.js（別スレッド）。
// brain は任意コードで無限ループしうるため、RPC には watchdog を付け、
// 応答が無ければ worker ごと terminate して UI から隔離する。

const $ = (id) => document.getElementById(id);
const SPEEDS = [1, 2, 6, 12, 24, 60, 120]; // 月/秒

let worker = null;
let seq = 0;
const pending = new Map();
let state = null; // 最新の全知ビュー
let series = []; // 月ごとの推移
let running = false;
let busy = false; // step RPC 実行中
let owed = 0; // 消化していない月数
let lastT = 0;
let selected = null; // 選択中 human id
let viewMode = 'world'; // 'world' | 'tree'
let groupNames = null; // 自由編成: グループ番号 → brain 名（役割表示に使う）
// 自由編成の行（brain × 人数）
const CUSTOM_BRAINS = [
  ['forager', 'forager（wasm）'],
  ['idle', 'idle'],
];
let brainRows = [{ brain: 'forager', count: 10 }];

function renderBrainRows() {
  const box = $('brainRows');
  box.innerHTML = '';
  brainRows.forEach((row, i) => {
    const span = document.createElement('span');
    span.className = 'brow';
    const sel = document.createElement('select');
    for (const [v, label] of CUSTOM_BRAINS) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = label;
      if (v === row.brain) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => {
      row.brain = sel.value;
    });
    const num = document.createElement('input');
    num.type = 'number';
    num.min = '0';
    num.max = '200';
    num.value = String(row.count);
    num.addEventListener('change', () => {
      row.count = Math.max(0, Math.min(200, Number(num.value) | 0));
    });
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = '×';
    del.addEventListener('click', () => {
      brainRows.splice(i, 1);
      if (brainRows.length === 0) brainRows.push({ brain: 'forager', count: 10 });
      renderBrainRows();
    });
    span.append(sel, num, document.createTextNode('人'), del);
    box.appendChild(span);
  });
}
const seats = new Map(); // human id → 配置番号（安定）
let hitboxes = []; // {x, y, r, id}

// --- worker RPC ---------------------------------------------------------------

// app.js ↔ worker.js ↔ engine/component のプロトコル版。
// **init の引数・応答の形、engine の API、component の ABI を変えたら必ず上げる**。
// worker URL のクエリに付き、worker はこの値を自分の配下資産（runtime.js /
// engine / component）の URL にも伝搬させるので、ここを 1 つ上げれば
// HTTP キャッシュ由来の新旧取り違え（旧 worker や旧 engine の混在）が全部防げる
const PROTOCOL_VERSION = 3;

function newWorker() {
  if (worker) worker.terminate();
  pending.clear();
  busy = false;
  worker = new Worker(new URL(`worker.js?v=${PROTOCOL_VERSION}`, import.meta.url), {
    type: 'module',
  });
  worker.onmessage = (e) => {
    const { id, ok, error, ...result } = e.data;
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    clearTimeout(p.timer);
    if (ok) p.resolve(result);
    else p.reject(new Error(error));
  };
}

function rpc(cmd, args = {}, timeoutMs = 30000) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      onHang();
      reject(new Error('watchdog timeout'));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    worker.postMessage({ id, cmd, ...args });
  });
}

function onHang() {
  running = false;
  if (worker) worker.terminate();
  worker = null;
  setControls({ loaded: false });
  banner(
    'brain が応答しません（無限ループの疑い）。fuel 計量の無いブラウザでは思考は打ち切られません。⟳ 生成 でやり直してください。',
    'err',
  );
}

// --- UI 状態 -------------------------------------------------------------------

function banner(msg, cls = '') {
  const b = $('banner');
  if (!msg) {
    b.className = 'hidden';
    return;
  }
  b.textContent = msg;
  b.className = cls;
}

function setControls({ loaded }) {
  for (const id of ['play', 'step1', 'step12', 'judge']) $(id).disabled = !loaded;
  $('play').textContent = running ? '⏸ 一時停止' : '▶ 実行';
}

function clock() {
  if (!state) return '—';
  const y = Math.floor(state.month / 12);
  const m = state.month % 12;
  return `${y}年${m}月 / 生存 ${state.alive} / 出生 ${state.births} / 死亡 ${state.deaths}`;
}

function applyState(s, extra = []) {
  state = s;
  for (const e of extra) series.push(e);
  $('clock').textContent = clock();
  if (state.alive === 0 && running) {
    running = false;
    setControls({ loaded: true });
    banner('全滅しました。⚖ 判定 で結果を確認するか、⟳ 生成 でやり直してください。', 'err');
  }
  draw();
  drawChart();
  drawAges();
  drawEnv();
  drawMarket();
  drawInspector();
}

// --- 初期化・実行ループ ---------------------------------------------------------

function isExperimentSelected() {
  return $('campaign').value.startsWith('exp-');
}

function syncScenarioControls() {
  const v = $('campaign').value;
  const isExp = v.startsWith('exp-');
  const isCustom = v === 'custom';
  // 実験再現は brain 内蔵、自由編成は行エディタで指定するので brain 選択は無効
  $('brain').disabled = isExp || isCustom;
  $('brainLabel').classList.toggle('hidden', isCustom);
  $('brainRows').classList.toggle('hidden', !isCustom);
  $('addBrainRow').classList.toggle('hidden', !isCustom);
  $('scaleWrap').classList.toggle('hidden', !isExp);
  $('judge').textContent = isExp || isCustom ? '📊 集計' : '⚖ 判定';
  if (isCustom) renderBrainRows();
}

async function init() {
  running = false;
  series = [];
  seats.clear();
  roleColorMap.clear();
  selected = null;
  owed = 0;
  banner('ロード中…');
  setControls({ loaded: false });
  syncScenarioControls();
  newWorker();
  try {
    const seed = Math.max(0, Math.floor(Number($('seed').value) || 0));
    const scale = Math.max(1, Math.min(10, Number($('scale').value) | 0 || 1));
    const r = await rpc(
      'init',
      {
        seed,
        scenario: $('campaign').value,
        brain: $('brain').value,
        scale,
        comp: brainRows.map((row) => ({ brain: row.brain, count: row.count })),
      },
      60000,
    );
    groupNames = r.groupNames ?? null;
    banner(null);
    applyState(r.state);
    setControls({ loaded: true });
  } catch (e) {
    banner(`ロード失敗: ${e.message}`, 'err');
  }
}

function frame(t) {
  const dt = Math.min((t - lastT) / 1000, 0.5);
  lastT = t;
  if (running && !busy && state && state.alive > 0) {
    owed += dt * SPEEDS[$('speed').value];
    const n = Math.min(Math.floor(owed), 12);
    if (n > 0) {
      owed -= n;
      busy = true;
      rpc('step', { months: n }, 20000)
        .then((r) => applyState(r.state, r.series))
        .catch(() => {})
        .finally(() => {
          busy = false;
        });
    }
  }
  requestAnimationFrame(frame);
}

async function stepOnce(months) {
  if (busy || !state) return;
  busy = true;
  try {
    const r = await rpc('step', { months }, 20000);
    applyState(r.state, r.series);
  } catch {
    /* watchdog 済み */
  } finally {
    busy = false;
  }
}

async function judge() {
  try {
    const r = await rpc('judge', {}, 20000);
    const res = r.result;
    if (res.type === 'summary') {
      const y = state ? `${Math.floor(state.month / 12)}年${state.month % 12}月` : '';
      const lines = res.lines.map(([label, value]) => `${label}: ${value}`).join('\n');
      banner(`実験サマリ（${y}時点。CLI と同一の集計）\n${lines}`, 'ok');
    } else {
      banner(
        `判定: ${res.cleared ? 'クリア 🎉' : '未達'}  score=${res.score}  ${res.note}`,
        res.cleared ? 'ok' : '',
      );
    }
  } catch (e) {
    banner(`判定失敗: ${e.message}`, 'err');
  }
}

// --- 描画: world --------------------------------------------------------------

function seatOf(id) {
  if (!seats.has(id)) seats.set(id, seats.size);
  return seats.get(id);
}

function seatPos(i, w, h) {
  // 黄金角スパイラル。人数が増えても重なりにくい
  const r = 46 + 26 * Math.sqrt(i);
  const a = i * 2.399963;
  return [w / 2 + r * Math.cos(a), h / 2 + r * Math.sin(a)];
}

function healthColor(health) {
  const t = Math.max(0, Math.min(1, health / 100000));
  return `hsl(${(t * 120).toFixed(0)} 70% 52%)`;
}

// 役割（実験再現ランの群）ごとの色。初期成人の役割は engine から、
// 子は血縁台帳から導出する
const ROLE_COLORS = ['#4fc3f7', '#ffb74d', '#ba68c8', '#e57373', '#fff176', '#90a4ae', '#f06292'];
const roleColorMap = new Map();
function colorForRole(role) {
  if (!roleColorMap.has(role)) {
    roleColorMap.set(role, ROLE_COLORS[roleColorMap.size % ROLE_COLORS.length]);
  }
  return roleColorMap.get(role);
}
function roleOf(h, childSet) {
  const fromGroup = groupNames && h.group != null ? groupNames[h.group] : null;
  return h.role ?? fromGroup ?? (childSet.has(h.id) ? '子' : null);
}
function childSetOf(s) {
  return new Set(s.parentage.map((p) => p.child));
}

// ノード 1 個の描画（世界ビューと系図ビューで共通）。
// dead は灰色 + †、shape は sex の符号（故人で sex 不明なら役割から推定した値を渡す）
function drawNode(ctx, { x, y, r, sex, fill, stroke, strokeWidth, label, dead, pregnant, isSelected }) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = strokeWidth;
  if (sex < 0) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (sex > 0) {
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.strokeRect(x - r, y - r, r * 2, r * 2);
  } else {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  if (pregnant) {
    ctx.strokeStyle = '#f48fb1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (isSelected) {
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = dead ? '#5c6370' : '#7c8494';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + r + 10);
}

function draw() {
  if (viewMode === 'tree') {
    drawTree();
  } else {
    drawWorld();
  }
}

function drawWorld() {
  const cv = $('world');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (!state) return;

  // id 昇順で座席を安定確保
  const humans = [...state.humans].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
  const pos = new Map();
  for (const h of humans) pos.set(h.id, seatPos(seatOf(h.id), cv.width, cv.height));

  // 親密度エッジ
  for (const e of state.intimacy) {
    const pa = pos.get(e.a);
    const pb = pos.get(e.b);
    if (!pa || !pb || e.v < 2000) continue;
    ctx.strokeStyle = `rgba(233, 30, 99, ${Math.min(0.85, e.v / 60000)})`;
    ctx.lineWidth = Math.min(3, 0.5 + e.v / 25000);
    ctx.beginPath();
    ctx.moveTo(pa[0], pa[1]);
    ctx.lineTo(pb[0], pb[1]);
    ctx.stroke();
  }
  // 母子エッジ（全知ビュー）
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = 'rgba(160, 160, 160, 0.45)';
  ctx.lineWidth = 1;
  for (const p of state.parentage) {
    const pc = pos.get(p.child);
    const pm = pos.get(p.mother);
    if (!pc || !pm) continue;
    ctx.beginPath();
    ctx.moveTo(pm[0], pm[1]);
    ctx.lineTo(pc[0], pc[1]);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  hitboxes = [];
  const childSet = childSetOf(state);
  const rolesPresent = new Set();
  for (const h of humans) {
    const [x, y] = pos.get(h.id);
    const r = 5 + Math.min(7, (h.ageMonths / 12) * 0.14);
    const role = roleOf(h, childSet);
    if (role) rolesPresent.add(role);
    drawNode(ctx, {
      x,
      y,
      r,
      sex: h.sex,
      fill: healthColor(h.health),
      stroke: role ? colorForRole(role) : '#0e1014',
      strokeWidth: role ? 2 : 1,
      label: h.id.slice(-4),
      dead: false,
      pregnant: h.pregnant,
      isSelected: h.id === selected,
    });
    hitboxes.push({ x, y, r: r + 6, id: h.id });
  }

  // 役割の凡例（枠線の色）
  $('roleLegend').innerHTML = [...rolesPresent]
    .map((role) => `<span style="color:${colorForRole(role)}">◯</span> ${role}`)
    .join('　');
}

// --- 描画: 家系図 ---------------------------------------------------------------
//
// parentage（全知ビュー）から世代レイヤーを組み、夫婦を桃線・親子を灰線で結ぶ。
// 故人は world から消えているので灰色 + † で描く（sex は親役割から推定: 母 = ○、父 = □）

function drawTree() {
  const cv = $('world');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  hitboxes = [];
  if (!state) return;
  if (state.parentage.length === 0) {
    ctx.fillStyle = '#7c8494';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('まだ家系がありません（出生が起きると系図が生えます）', cv.width / 2, cv.height / 2);
    $('roleLegend').innerHTML = '';
    return;
  }

  // 夫婦（= 共に子を持つペア）と世代
  const couples = new Map();
  for (const p of state.parentage) {
    const key = `${p.mother}|${p.father}`;
    if (!couples.has(key)) couples.set(key, { mother: p.mother, father: p.father, children: [] });
    couples.get(key).children.push(p.child);
  }
  const parentOf = new Map(state.parentage.map((p) => [p.child, p]));
  const gen = new Map();
  const genOf = (id, depth = 0) => {
    if (gen.has(id)) return gen.get(id);
    const p = parentOf.get(id);
    const g = p && depth < 32 ? Math.max(genOf(p.mother, depth + 1), genOf(p.father, depth + 1)) + 1 : 0;
    gen.set(id, g);
    return g;
  };
  const ids = new Set();
  for (const p of state.parentage) {
    ids.add(p.child);
    ids.add(p.mother);
    ids.add(p.father);
  }
  for (const id of ids) genOf(id);
  const maxGen = Math.max(...gen.values());

  // 行ごとの並び: 夫婦の相方を隣接させ、子は夫婦単位でまとめる
  const rows = Array.from({ length: maxGen + 1 }, () => []);
  const placed = new Set();
  const place = (id) => {
    if (!placed.has(id)) {
      rows[gen.get(id)].push(id);
      placed.add(id);
    }
  };
  for (const c of couples.values()) {
    place(c.mother);
    place(c.father);
    for (const ch of c.children) place(ch);
  }
  for (const id of ids) place(id);

  // 世代間隔は詰める（世代が少ないときに間延びしない）。
  // 子は「両親の中点」に近い順で並べ、親の下に来るようにする（交差の削減）
  const rowH = Math.min(150, (cv.height - 110) / Math.max(1, maxGen));
  const rowY = (g) => 50 + g * rowH;
  const pos = new Map();
  rows.forEach((row, g) => {
    const desired = row.map((id, i) => {
      const p = parentOf.get(id);
      if (p && pos.has(p.mother) && pos.has(p.father)) {
        return [(pos.get(p.mother)[0] + pos.get(p.father)[0]) / 2, id];
      }
      return [i * 10000, id]; // 親が上段にいない（始祖）は元の並び順を維持
    });
    desired.sort((a, b) => a[0] - b[0]);
    desired.forEach(([, id], i) => {
      pos.set(id, [((i + 1) * cv.width) / (row.length + 1), rowY(g)]);
    });
  });

  // 夫婦リンク（桃）と親子リンク（灰）
  for (const c of couples.values()) {
    const pm = pos.get(c.mother);
    const pf = pos.get(c.father);
    ctx.strokeStyle = 'rgba(233, 30, 99, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pm[0], pm[1]);
    ctx.lineTo(pf[0], pf[1]);
    ctx.stroke();
    const mid = [(pm[0] + pf[0]) / 2, (pm[1] + pf[1]) / 2];
    ctx.strokeStyle = 'rgba(160, 160, 160, 0.6)';
    ctx.lineWidth = 1;
    for (const ch of c.children) {
      const pc = pos.get(ch);
      ctx.beginPath();
      ctx.moveTo(mid[0], mid[1]);
      ctx.lineTo(pc[0], pc[1]);
      ctx.stroke();
    }
  }

  // ノード（故人は灰 + †。sex 不明の故人は親役割から推定）
  const mothers = new Set(state.parentage.map((p) => p.mother));
  const fathers = new Set(state.parentage.map((p) => p.father));
  const childSet = childSetOf(state);
  for (const id of ids) {
    const [x, y] = pos.get(id);
    const h = state.humans.find((hh) => hh.id === id);
    if (h) {
      const role = roleOf(h, childSet);
      drawNode(ctx, {
        x,
        y,
        r: 8,
        sex: h.sex,
        fill: healthColor(h.health),
        stroke: role ? colorForRole(role) : '#0e1014',
        strokeWidth: role ? 2 : 1,
        label: h.id.slice(-4),
        dead: false,
        pregnant: h.pregnant,
        isSelected: h.id === selected,
      });
      hitboxes.push({ x, y, r: 14, id });
    } else {
      const sex = mothers.has(id) ? -1 : fathers.has(id) ? 1 : 0;
      drawNode(ctx, {
        x,
        y,
        r: 8,
        sex,
        fill: '#3a3f4a',
        stroke: '#5c6370',
        strokeWidth: 1,
        label: `${id.slice(-4)}†`,
        dead: true,
        pregnant: false,
        isSelected: false,
      });
    }
  }

  $('roleLegend').innerHTML =
    '桃線 = 夫婦（子を持つペア）　灰線 = 親子　灰ノード† = 故人　世代が上から下へ';
}

// --- 描画: 推移チャート ---------------------------------------------------------

const CHART_LINES = [
  { key: 'alive', color: '#4fc3f7', label: '生存', max: (s) => Math.max(...s.map((e) => e.alive), 1) },
  { key: 'meanHealth', color: '#81c784', label: '平均health', max: () => 100000 },
  { key: 'envPrimary', color: '#ffb74d', label: '環境(primary)', max: (s) => Math.max(...s.map((e) => e.envPrimary), 1) },
];

function drawChart() {
  const cv = $('chart');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  $('chartLegend').innerHTML = CHART_LINES.map(
    (l) => `<span style="color:${l.color}">■</span> ${l.label}`,
  ).join('　');
  if (series.length < 2) return;
  const x = (i) => (i / (series.length - 1)) * (cv.width - 8) + 4;
  for (const line of CHART_LINES) {
    const max = line.max(series);
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    series.forEach((e, i) => {
      const y = cv.height - 4 - (e[line.key] / max) * (cv.height - 8);
      if (i === 0) ctx.moveTo(x(i), y);
      else ctx.lineTo(x(i), y);
    });
    ctx.stroke();
  }
}

// --- 描画: 年齢分布（人口ピラミッド） --------------------------------------------
//
// 生存者を 5 歳刻みでビン分けし、女性（sex<0）を左、男性（sex>0）を右に描く。
// 中性（sex=0）は中央の細い灰バー。applyState のたびに再描画 = 実行中は動き続ける

function drawAges() {
  const cv = $('ages');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (!state || state.humans.length === 0) return;

  const BIN = 5;
  const MAX_AGE = 85; // 最上段は 80+
  const nBins = MAX_AGE / BIN;
  const f = new Array(nBins).fill(0);
  const m = new Array(nBins).fill(0);
  const n = new Array(nBins).fill(0);
  for (const h of state.humans) {
    const b = Math.min(nBins - 1, Math.floor(h.ageMonths / 12 / BIN));
    if (h.sex < 0) f[b]++;
    else if (h.sex > 0) m[b]++;
    else n[b]++;
  }
  const maxSide = Math.max(1, ...f.map((v, i) => v + n[i] / 2), ...m.map((v, i) => v + n[i] / 2));

  const cx = cv.width / 2;
  const top = 6;
  const rowH = (cv.height - top - 16) / nBins;
  const halfW = cv.width / 2 - 44;
  const scale = halfW / maxSide;

  ctx.font = '9px monospace';
  for (let b = 0; b < nBins; b++) {
    // 若い世代を下、高齢を上に（人口ピラミッドの慣習）
    const y = top + (nBins - 1 - b) * rowH;
    const h2 = Math.max(1, rowH - 2);
    if (f[b] > 0) {
      ctx.fillStyle = '#f06292';
      ctx.fillRect(cx - f[b] * scale, y, f[b] * scale, h2);
    }
    if (m[b] > 0) {
      ctx.fillStyle = '#4fc3f7';
      ctx.fillRect(cx, y, m[b] * scale, h2);
    }
    if (n[b] > 0) {
      ctx.fillStyle = '#90a4ae';
      const w = Math.max(2, n[b] * scale * 0.5);
      ctx.fillRect(cx - w / 2, y, w, h2);
    }
    // 数値（バーの外側）
    ctx.fillStyle = '#7c8494';
    ctx.textAlign = 'right';
    if (f[b] > 0) ctx.fillText(String(f[b]), cx - f[b] * scale - 3, y + h2 - 1);
    ctx.textAlign = 'left';
    if (m[b] > 0) ctx.fillText(String(m[b]), cx + m[b] * scale + 3, y + h2 - 1);
    // 年齢ラベル（20 歳ごと）
    if ((b * BIN) % 20 === 0) {
      ctx.fillStyle = '#5c6370';
      ctx.textAlign = 'right';
      ctx.fillText(String(b * BIN), cv.width - 2, y + h2 - 1);
    }
  }
  // 中央軸
  ctx.strokeStyle = '#2c313c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.lineTo(cx, cv.height - 14);
  ctx.stroke();
}

// --- 描画: 環境 / 板 / インスペクタ ---------------------------------------------

function qty(v) {
  return (v / 1000).toLocaleString('ja-JP', { maximumFractionDigits: 1 });
}

function drawEnv() {
  if (!state) return;
  const maxStock = Math.max(...state.env.map((e) => e.stock), 1);
  $('env').innerHTML = state.env
    .map((e) => {
      const w = Math.max(1, (e.stock / maxStock) * 150);
      const cls = e.isWaste ? 'waste' : '';
      const label = e.isWaste ? `廃棄物${e.idx - 5}` : `primary${e.idx}`;
      return `<div class="envrow ${cls}">
        <span style="width:6.5em">${label}</span>
        <span class="ebar" style="width:${w}px;background:hsl(${e.idx * 36} 60% 50%)"></span>
        <span>${qty(e.stock)}</span>
        <span class="dim">g=${qty(e.g)} λ=${e.decayPermille}‰</span>
      </div>`;
    })
    .join('');
}

function drawMarket() {
  if (!state) return;
  if (state.quotes.length === 0) {
    $('market').innerHTML = '<span class="dim">板は空</span>';
    return;
  }
  $('market').innerHTML =
    '<table>' +
    state.quotes
      .map(
        (q) =>
          `<tr><td class="click" data-id="${q.seller}">${q.seller.slice(-4)}</td>
           <td>#${q.giveIdx} ${qty(q.giveAmount)}</td><td>→</td>
           <td>#${q.wantIdx} ${qty(q.wantAmount)}</td></tr>`,
      )
      .join('') +
    '</table>';
}

function statRow(label, v) {
  const pct = Math.max(0, Math.min(100, v / 1000));
  return `<tr><th>${label}</th><td><span class="bar"><i style="width:${pct}%"></i></span></td>
    <td>${qty(v)}</td></tr>`;
}

function drawInspector() {
  const el = $('inspector');
  if (!state) return;
  const h = state.humans.find((x) => x.id === selected);
  if (!h) {
    el.innerHTML = '<p class="dim">human をクリックすると詳細を表示（一時停止中も可）</p>';
    return;
  }
  const acq = [...h.acquaintances].sort((a, b) => b.intimacy - a.intimacy);
  const role = roleOf(h, childSetOf(state));
  el.innerHTML = `
    <h2>human ${h.id.slice(-4)} <span class="dim">(${h.id})</span></h2>
    <table>
      ${role ? `<tr><th>役割</th><td colspan="2"><span style="color:${colorForRole(role)}">◯</span> ${role}</td></tr>` : ''}
      <tr><th>性別</th><td colspan="2">${h.sex < 0 ? '女性 ○' : h.sex > 0 ? '男性 □' : '中性 ◇'}（sex ${h.sex}）${h.pregnant ? '（妊娠中）' : ''}</td></tr>
      <tr><th>年齢</th><td colspan="2">${Math.floor(h.ageMonths / 12)}歳${h.ageMonths % 12}ヶ月</td></tr>
      ${statRow('health', h.health)}
      ${statRow('strength', h.strength)}
      ${statRow('cognition', h.cognition)}
      ${statRow('fertility', h.fertility)}
      <tr><th>占有空間</th><td colspan="2">${qty(h.spaceUsed)}</td></tr>
      <tr><th>生涯消費 Δg</th><td colspan="2">${h.consumedDg.toFixed(1)}</td></tr>
      <tr><th>memory</th><td colspan="2">${h.memoryLen} bytes</td></tr>
      ${h.group !== null && h.group !== undefined ? `<tr><th>brain group</th><td colspan="2">${h.group}</td></tr>` : ''}
    </table>
    <h2>保有 resource</h2>
    <table>${
      h.inventory
        .map(
          (s) =>
            `<tr class="${s.isWaste ? 'waste' : ''}"><td>#${s.idx}${s.isWaste ? '（廃棄物）' : ''}</td>
             <td>${qty(s.amount)}</td></tr>`,
        )
        .join('') || '<tr><td class="dim">なし</td></tr>'
    }</table>
    <h2>skill</h2>
    <table>${
      h.skills
        .map((s) => `<tr><td>${s.kind}</td><td>${qty(s.proficiency)}%</td></tr>`)
        .join('') || '<tr><td class="dim">なし</td></tr>'
    }</table>
    <h2>知人と親密度</h2>
    <table>${
      acq
        .map(
          (a) =>
            `<tr><td class="click" data-id="${a.id}">${a.id.slice(-4)}</td>
             <td>${qty(a.intimacy)}</td></tr>`,
        )
        .join('') || '<tr><td class="dim">なし</td></tr>'
    }</table>
    <h2>今月のイベント <span class="dim">(来月 brain に届く)</span></h2>
    ${
      h.pendingEvents.length
        ? `<ul class="dim">${h.pendingEvents.map((e) => `<li>${e}</li>`).join('')}</ul>`
        : '<p class="dim">なし</p>'
    }`;
}

// --- イベント配線 ---------------------------------------------------------------

$('reset').addEventListener('click', init);
$('campaign').addEventListener('change', syncScenarioControls);
$('addBrainRow').addEventListener('click', () => {
  brainRows.push({ brain: 'forager', count: 10 });
  renderBrainRows();
});
$('play').addEventListener('click', () => {
  if (!state) return;
  running = !running;
  owed = 0;
  banner(null);
  setControls({ loaded: true });
});
$('step1').addEventListener('click', () => stepOnce(1));
$('step12').addEventListener('click', () => stepOnce(12));
$('judge').addEventListener('click', judge);
for (const [btn, mode] of [
  ['tabWorld', 'world'],
  ['tabTree', 'tree'],
]) {
  $(btn).addEventListener('click', () => {
    viewMode = mode;
    $('tabWorld').classList.toggle('active', mode === 'world');
    $('tabTree').classList.toggle('active', mode === 'tree');
    draw();
  });
}
$('speed').addEventListener('input', () => {
  $('speedLabel').textContent = `${SPEEDS[$('speed').value]} 月/秒`;
});
$('world').addEventListener('click', (e) => {
  const rect = e.target.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * e.target.width;
  const y = ((e.clientY - rect.top) / rect.height) * e.target.height;
  let best = null;
  for (const hb of hitboxes) {
    const d = Math.hypot(hb.x - x, hb.y - y);
    if (d <= hb.r + 4 && (!best || d < best.d)) best = { d, id: hb.id };
  }
  selected = best ? best.id : null;
  draw();
  drawInspector();
});
document.body.addEventListener('click', (e) => {
  const id = e.target?.dataset?.id;
  if (id) {
    selected = id;
    draw();
    drawInspector();
  }
});

$('speedLabel').textContent = `${SPEEDS[$('speed').value]} 月/秒`;
requestAnimationFrame(frame);
init();

// テスト用フック（UI からは使わない）
window.zv = {
  get state() {
    return state;
  },
  select(id) {
    selected = id;
    draw();
    drawInspector();
  },
};
