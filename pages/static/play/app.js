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
const seats = new Map(); // human id → 配置番号（安定）
let hitboxes = []; // {x, y, r, id}

// --- worker RPC ---------------------------------------------------------------

// app.js ↔ worker.js のプロトコル版。init の引数や応答の形を変えたら上げる。
// worker URL のクエリに付けて、HTTP キャッシュ由来の新旧取り違え
// （新 app + 旧 worker）でプロトコルがずれるのを防ぐ
const PROTOCOL_VERSION = 2;

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
  drawEnv();
  drawMarket();
  drawInspector();
}

// --- 初期化・実行ループ ---------------------------------------------------------

function isExperimentSelected() {
  return $('campaign').value.startsWith('exp-');
}

function syncScenarioControls() {
  const isExp = isExperimentSelected();
  // 実験再現は brain 内蔵（CLI と同一のネイティブ参照実装）なので brain 選択は無効
  $('brain').disabled = isExp;
  $('judge').textContent = isExp ? '📊 集計' : '⚖ 判定';
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
    const r = await rpc(
      'init',
      { seed, scenario: $('campaign').value, brain: $('brain').value },
      60000,
    );
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
  return h.role ?? (childSet.has(h.id) ? '子' : null);
}
function childSetOf(s) {
  return new Set(s.parentage.map((p) => p.child));
}

function draw() {
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
    ctx.fillStyle = healthColor(h.health);
    ctx.strokeStyle = role ? colorForRole(role) : '#0e1014';
    ctx.lineWidth = role ? 2 : 1;
    if (h.sex < 0) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (h.sex > 0) {
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
    if (h.pregnant) {
      ctx.strokeStyle = '#f48fb1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (h.id === selected) {
      ctx.strokeStyle = '#ffd54f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#7c8494';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(h.id.slice(-4), x, y + r + 10);
    hitboxes.push({ x, y, r: r + 6, id: h.id });
  }

  // 役割の凡例（枠線の色）
  $('roleLegend').innerHTML = [...rolesPresent]
    .map((role) => `<span style="color:${colorForRole(role)}">◯</span> ${role}`)
    .join('　');
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
