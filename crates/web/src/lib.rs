//! ブラウザ実行系（GitHub Pages ビューワ → docs/viewer/）。
//!
//! エンジン（zeroverse-core）を wasm-bindgen でブラウザ用 wasm にし、
//! brain / scenario component は jco transpile した JS glue から接続する。
//! ブラウザは component model をネイティブ実行できないため、
//! wasm-host（wasmtime）が担う WIT 境界の写像をここでは JS 境界で再現する:
//!
//! - snapshot は wasm-host の `wit_snapshot` と同形（camelCase、variant は {tag, val}、
//!   u64 は BigInt）で JS へ渡し、jco の lowering にそのまま流せるようにする。
//! - decide の戻りは JS glue が commit（push-act / push-order / save-memory）を
//!   収集した {acts, orders, memory} で、wasm-host の HostState と同じ規則で
//!   core の Decision へ変換する（introduce は idle 扱い）。
//! - 呼び出しごとの新規インスタンス化（テレパシー禁止）は JS glue 側の責務。
//!
//! ブラウザ側の既知の制約: wasmtime の fuel 計量が無いため fuel_used = 0
//! （思考コストによる health 減少が発生しない）。同一シードでもネイティブ実行とは
//! 歴史が一致しない。ビューワは観測用のメタ層であり、公式のランはネイティブ側。

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use wasm_bindgen::prelude::*;
use zeroverse_core::brain::{Act, Brain, Decision, Event, GiveCondition, Snapshot, StandingOrder};
use zeroverse_core::laws::SkillKind;
use zeroverse_core::state::{Sex, World};
use zeroverse_core::{HumanId, WorldParams};

// ---------------------------------------------------------------------------
// WIT 形状（brain へ渡す snapshot。wasm-host::wit_snapshot と同形）
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StackW {
    resource: u64,
    amount: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "kebab-case")]
enum SexW {
    Female,
    Male,
}

#[derive(Serialize)]
#[serde(rename_all = "kebab-case")]
enum StatKindW {
    Health,
    Strength,
    Cognition,
    Fertility,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StatW {
    kind: StatKindW,
    value: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "kebab-case")]
enum ActionKindW {
    Invoke,
    Give,
    Discard,
    Teach,
    Learn,
    Idle,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SkillViewW {
    skill: u64,
    proficiency: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SelfViewW {
    id: u64,
    age_months: u32,
    sex: SexW,
    stats: Vec<StatW>,
    resources: Vec<StackW>,
    space_used: u64,
    space_free: u64,
    skills: Vec<SkillViewW>,
    available_actions: Vec<ActionKindW>,
    fuel_budget: u64,
    memory_limit: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AcquaintanceW {
    id: u64,
    apparent_age: u32,
    alive: bool,
    intimacy: u64,
    last_interaction: Option<u32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TransferInfoW {
    from: u64,
    stack: StackW,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TradeInfoW {
    counterparty: u64,
    gave: StackW,
    got: StackW,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TeachInfoW {
    partner: u64,
    skill: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InvokeResultInfoW {
    skill: u64,
    consumed: Vec<StackW>,
    produced: Vec<StackW>,
    health_gain: u64,
}

#[derive(Serialize)]
#[serde(tag = "tag", content = "val", rename_all = "kebab-case")]
enum EventW {
    ReceivedTransfer(TransferInfoW),
    TradeExecuted(TradeInfoW),
    TeachProgressed(TeachInfoW),
    SkillAcquired(u64),
    Encountered(u64),
    ChildBorn(u64),
    SomeoneDied(u64),
    InvokeResult(InvokeResultInfoW),
    ActionFailed(ActionKindW),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BoardQuoteW {
    seller: u64,
    give_resource: u64,
    give_amount: u64,
    want_resource: u64,
    want_amount: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SnapshotW {
    now: u32,
    rand: u64,
    self_view: SelfViewW,
    acquaintances: Vec<AcquaintanceW>,
    events: Vec<EventW>,
    market: Vec<BoardQuoteW>,
}

fn stack((r, a): (u64, u64)) -> StackW {
    StackW {
        resource: r,
        amount: a,
    }
}

fn wit_snapshot(snap: &Snapshot, fuel_budget: u64) -> SnapshotW {
    SnapshotW {
        now: snap.now,
        rand: snap.rand,
        self_view: SelfViewW {
            id: snap.id,
            age_months: snap.age_months,
            sex: match snap.sex {
                Sex::Female => SexW::Female,
                Sex::Male => SexW::Male,
            },
            stats: vec![
                StatW {
                    kind: StatKindW::Health,
                    value: snap.health,
                },
                StatW {
                    kind: StatKindW::Strength,
                    value: snap.strength,
                },
                StatW {
                    kind: StatKindW::Cognition,
                    value: snap.cognition,
                },
                StatW {
                    kind: StatKindW::Fertility,
                    value: snap.fertility,
                },
            ],
            resources: snap.resources.iter().copied().map(stack).collect(),
            space_used: snap.space_used,
            space_free: snap.space_free,
            skills: snap
                .skills
                .iter()
                .map(|&(skill, proficiency)| SkillViewW { skill, proficiency })
                .collect(),
            available_actions: vec![
                ActionKindW::Invoke,
                ActionKindW::Give,
                ActionKindW::Discard,
                ActionKindW::Teach,
                ActionKindW::Learn,
                ActionKindW::Idle,
            ],
            fuel_budget,
            memory_limit: 64 * 1024,
        },
        acquaintances: snap
            .acquaintances
            .iter()
            .map(|&(id, intimacy)| AcquaintanceW {
                id,
                // apparent-age / last-interaction はエンジン側未実装のスタブ（wasm-host と同じ）
                apparent_age: 0,
                alive: true,
                intimacy,
                last_interaction: None,
            })
            .collect(),
        events: snap
            .events
            .iter()
            .map(|ev| match ev {
                Event::ReceivedTransfer {
                    from,
                    resource,
                    amount,
                } => EventW::ReceivedTransfer(TransferInfoW {
                    from: *from,
                    stack: stack((*resource, *amount)),
                }),
                Event::Encountered(id) => EventW::Encountered(*id),
                Event::SomeoneDied(id) => EventW::SomeoneDied(*id),
                Event::TradeExecuted {
                    counterparty,
                    gave,
                    got,
                } => EventW::TradeExecuted(TradeInfoW {
                    counterparty: *counterparty,
                    gave: stack(*gave),
                    got: stack(*got),
                }),
                Event::InvokeResult {
                    skill,
                    consumed,
                    produced,
                    health_gain,
                } => EventW::InvokeResult(InvokeResultInfoW {
                    skill: *skill,
                    consumed: consumed.iter().copied().map(stack).collect(),
                    produced: produced.iter().copied().map(stack).collect(),
                    health_gain: *health_gain,
                }),
                Event::TeachProgressed { partner, skill } => EventW::TeachProgressed(TeachInfoW {
                    partner: *partner,
                    skill: *skill,
                }),
                Event::SkillAcquired(s) => EventW::SkillAcquired(*s),
                Event::ChildBorn(c) => EventW::ChildBorn(*c),
                Event::ActionFailed => EventW::ActionFailed(ActionKindW::Invoke),
            })
            .collect(),
        market: snap
            .market
            .iter()
            .map(|q| BoardQuoteW {
                seller: q.seller,
                give_resource: q.give_resource,
                give_amount: q.give_amount,
                want_resource: q.want_resource,
                want_amount: q.want_amount,
            })
            .collect(),
    }
}

// ---------------------------------------------------------------------------
// WIT 形状（JS glue が収集した decision / scenario setup / report）
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StackIn {
    resource: u64,
    amount: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InvokeArgsIn {
    #[serde(default)]
    inputs: Vec<StackIn>,
    #[serde(default)]
    using_skills: Vec<u64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GiveArgsIn {
    to: u64,
    stack: StackIn,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TeachArgsIn {
    student: u64,
    skill: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LearnArgsIn {
    teacher: u64,
    skill: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct IntroduceArgsIn {
    to: u64,
    subject: u64,
}

#[derive(Deserialize)]
#[serde(tag = "tag", content = "val", rename_all = "kebab-case")]
enum ActIn {
    Invoke(InvokeArgsIn),
    Give(GiveArgsIn),
    Discard(StackIn),
    Teach(TeachArgsIn),
    Learn(LearnArgsIn),
    #[allow(dead_code)]
    Introduce(IntroduceArgsIn),
    Idle,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LimitOrderIn {
    give_resource: u64,
    give_amount: u64,
    want_resource: u64,
    want_amount: u64,
    partial: bool,
}

#[derive(Deserialize)]
#[serde(tag = "tag", content = "val", rename_all = "kebab-case")]
enum GiveCondIn {
    IfReceived(StackIn),
    IfTaughtMe(u64),
    UnconditionalScheduled,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CondGiveIn {
    to: u64,
    stack: StackIn,
    condition: GiveCondIn,
}

#[derive(Deserialize)]
#[serde(tag = "tag", content = "val", rename_all = "kebab-case")]
enum OrderIn {
    LimitOrder(LimitOrderIn),
    ConditionalGive(CondGiveIn),
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DecisionIn {
    #[serde(default)]
    acts: Vec<ActIn>,
    #[serde(default)]
    orders: Vec<OrderIn>,
    #[serde(default)]
    memory: Option<serde_bytes::ByteBuf>,
}

/// wasm-host の HostState::push_act / push_order と同じ変換規則
fn to_core_decision(d: DecisionIn) -> Decision {
    let acts = d
        .acts
        .into_iter()
        .map(|a| match a {
            ActIn::Invoke(args) => Act::Invoke {
                inputs: args.inputs.iter().map(|s| (s.resource, s.amount)).collect(),
                using_skills: args.using_skills,
            },
            ActIn::Give(g) => Act::Give {
                to: g.to,
                resource: g.stack.resource,
                amount: g.stack.amount,
            },
            ActIn::Discard(s) => Act::Discard {
                resource: s.resource,
                amount: s.amount,
            },
            ActIn::Teach(t) => Act::Teach {
                student: t.student,
                skill: t.skill,
            },
            ActIn::Learn(l) => Act::Learn {
                teacher: l.teacher,
                skill: l.skill,
            },
            // introduce は M4 でエンジン側実装が入るまで idle 扱い（wasm-host と同じ）
            ActIn::Introduce(_) => Act::Idle,
            ActIn::Idle => Act::Idle,
        })
        .collect();
    let orders = d
        .orders
        .into_iter()
        .map(|o| match o {
            OrderIn::LimitOrder(l) => StandingOrder::Limit {
                give_resource: l.give_resource,
                give_amount: l.give_amount,
                want_resource: l.want_resource,
                want_amount: l.want_amount,
                partial: l.partial,
            },
            OrderIn::ConditionalGive(c) => StandingOrder::ConditionalGive {
                to: c.to,
                resource: c.stack.resource,
                amount: c.stack.amount,
                condition: match c.condition {
                    GiveCondIn::IfReceived(s) => GiveCondition::IfReceived {
                        resource: s.resource,
                        amount: s.amount,
                    },
                    GiveCondIn::IfTaughtMe(k) => GiveCondition::IfTaughtMe(k),
                    GiveCondIn::UnconditionalScheduled => GiveCondition::Unconditional,
                },
            },
        })
        .collect();
    Decision {
        acts,
        orders,
        memory: d.memory.map(|b| b.into_vec()),
        // ブラウザには fuel 計量が無い（モジュール docコメント参照）
        fuel_used: 0,
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SkillGrantIn {
    skill_index: u32,
    proficiency: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct HumanSetupIn {
    brain_group: u32,
    #[serde(default)]
    skills: Vec<SkillGrantIn>,
    #[serde(default)]
    acquaintances: Vec<u32>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorldSetupIn {
    humans: Vec<HumanSetupIn>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GroupReportW {
    group: u32,
    alive: u32,
    total: u32,
    mean_consumed: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WorldReportW {
    month: u32,
    groups: Vec<GroupReportW>,
}

// ---------------------------------------------------------------------------
// ビューワ用の全知ビュー（メタ層。brain には見えない内部 index / g / 血縁も含む）
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VizStack {
    idx: u32,
    id: String,
    amount: u64,
    is_waste: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VizSkill {
    idx: u32,
    id: String,
    kind: String,
    proficiency: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VizAcq {
    id: String,
    intimacy: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VizHuman {
    id: String,
    group: Option<u32>,
    sex: String,
    age_months: u32,
    health: u64,
    strength: u64,
    cognition: u64,
    fertility: u64,
    pregnant: bool,
    space_used: u64,
    consumed_dg: f64,
    memory_len: u32,
    inventory: Vec<VizStack>,
    skills: Vec<VizSkill>,
    acquaintances: Vec<VizAcq>,
    pending_events: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VizEnv {
    idx: u32,
    stock: u64,
    g: u64,
    volume: u64,
    decay_permille: u64,
    is_waste: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VizQuote {
    seller: String,
    give_idx: u32,
    give_amount: u64,
    want_idx: u32,
    want_amount: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VizIntimacy {
    a: String,
    b: String,
    v: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VizParentage {
    child: String,
    mother: String,
    father: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VizState {
    month: u32,
    alive: u32,
    deaths: u64,
    births: u64,
    total_space: u64,
    space_used: u64,
    env: Vec<VizEnv>,
    humans: Vec<VizHuman>,
    quotes: Vec<VizQuote>,
    intimacy: Vec<VizIntimacy>,
    parentage: Vec<VizParentage>,
    state_hash: String,
}

// ---------------------------------------------------------------------------
// JsBrain: 単一の decider コールバック（JS 側で component へルーティング）
// ---------------------------------------------------------------------------

struct JsBrain {
    f: js_sys::Function,
    fuel_per_health: u64,
}

impl Brain for JsBrain {
    fn decide(&mut self, snap: &Snapshot) -> Decision {
        // 思考予算の算出は wasm-host と同一（表示・glue 側の参考値。ブラウザでは非計量）
        let budget = snap.health / 1000 * self.fuel_per_health;
        let ser =
            serde_wasm_bindgen::Serializer::new().serialize_large_number_types_as_bigints(true);
        let snap_js = match wit_snapshot(snap, budget).serialize(&ser) {
            Ok(v) => v,
            Err(_) => return Decision::default(),
        };
        let mem_js = js_sys::Uint8Array::from(&snap.memory[..]);
        let ret = self.f.call3(
            &JsValue::NULL,
            &JsValue::from_str(&snap.id.to_string()),
            &snap_js,
            &mem_js,
        );
        match ret {
            Ok(v) => match serde_wasm_bindgen::from_value::<DecisionIn>(v) {
                Ok(d) => to_core_decision(d),
                Err(_) => Decision::default(),
            },
            // glue 側の例外は idle 扱い（部分実行の回収は glue 内の try/catch が担う）
            Err(_) => Decision::default(),
        }
    }
}

// ---------------------------------------------------------------------------
// WebWorld: wasm-bindgen 公開 API
// ---------------------------------------------------------------------------

#[wasm_bindgen]
pub struct WebWorld {
    world: World,
    decider: Option<js_sys::Function>,
    /// scenario setup の human（index 順 = human-id 昇順）。report はこの集合で集計
    initial: Vec<HumanId>,
    groups: BTreeMap<HumanId, u32>,
}

#[wasm_bindgen]
impl WebWorld {
    /// scenario component の init(seed) が返した world-setup から world を構築する。
    /// index → human-id の対応は id 昇順（wasm-host ランナーと同一規則）。
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u64, setup: JsValue) -> Result<WebWorld, JsValue> {
        console_error_panic_hook::set_once();
        let setup: WorldSetupIn = serde_wasm_bindgen::from_value(setup)
            .map_err(|e| JsValue::from_str(&format!("world-setup parse error: {e}")))?;
        let n = setup.humans.len();
        let world = World::new(seed, n, WorldParams::default());
        let ids: Vec<HumanId> = world.humans.keys().copied().collect();
        let mut w = WebWorld {
            world,
            decider: None,
            initial: ids.clone(),
            groups: BTreeMap::new(),
        };
        for (i, hs) in setup.humans.iter().enumerate() {
            w.groups.insert(ids[i], hs.brain_group);
            for g in &hs.skills {
                w.world
                    .grant_skill(ids[i], g.skill_index as usize, g.proficiency);
            }
            for &a in &hs.acquaintances {
                if (a as usize) < n {
                    w.world.add_acquaintance(ids[i], ids[a as usize]);
                }
            }
        }
        Ok(w)
    }

    /// decider: (idString, snapshot, memory: Uint8Array) => {acts, orders, memory?}
    /// snapshot / 戻り値は WIT 形状（jco の表現規則: camelCase / {tag, val} / u64 = BigInt）。
    #[wasm_bindgen(js_name = setDecider)]
    pub fn set_decider(&mut self, f: js_sys::Function) {
        self.decider = Some(f);
    }

    /// n ヶ月進める。新生児を含む全 human が decider 経由で決定する
    /// （decider 未設定なら全員 idle）。
    pub fn step(&mut self, months: u32) {
        let fuel_per_health = self.world.params.fuel_per_health;
        for _ in 0..months {
            let mut brains: BTreeMap<HumanId, Box<dyn Brain>> = BTreeMap::new();
            for &id in self.world.humans.keys() {
                let b: Box<dyn Brain> = match &self.decider {
                    Some(f) => Box::new(JsBrain {
                        f: f.clone(),
                        fuel_per_health,
                    }),
                    None => Box::new(zeroverse_core::brain::IdleBrain),
                };
                brains.insert(id, b);
            }
            self.world.step(&mut brains);
        }
    }

    pub fn month(&self) -> u32 {
        self.world.month
    }

    pub fn alive(&self) -> u32 {
        self.world.humans.len() as u32
    }

    /// ビューワ用の全知ビュー。id は精度保持のため文字列、qty は Number。
    pub fn state(&self) -> Result<JsValue, JsValue> {
        let laws = &self.world.laws;
        let humans = self
            .world
            .humans
            .values()
            .map(|h| VizHuman {
                id: h.id.to_string(),
                group: self.groups.get(&h.id).copied(),
                sex: match h.sex {
                    Sex::Female => "F".into(),
                    Sex::Male => "M".into(),
                },
                age_months: h.age_months,
                health: h.stats.health,
                strength: h.stats.strength,
                cognition: h.stats.cognition,
                fertility: h.stats.fertility,
                pregnant: h.pregnant.is_some(),
                space_used: h.space_used(laws, &self.world.params),
                consumed_dg: h.consumed_dg as f64 / 1_000_000.0,
                memory_len: h.memory.len() as u32,
                inventory: h
                    .inventory
                    .iter()
                    .map(|(&idx, &amount)| VizStack {
                        idx: idx as u32,
                        id: laws.id_of_index[idx].to_string(),
                        amount,
                        is_waste: idx >= zeroverse_core::laws::N_PRIMARY,
                    })
                    .collect(),
                skills: h
                    .skills
                    .iter()
                    .map(|(&idx, &proficiency)| VizSkill {
                        idx: idx as u32,
                        id: laws.skill_id_of_index[idx].to_string(),
                        kind: match laws.skills[idx] {
                            SkillKind::Harvest(i) => format!("harvest{i}"),
                            SkillKind::Eat(i) => format!("eat{i}"),
                        },
                        proficiency,
                    })
                    .collect(),
                acquaintances: h
                    .acquaintances
                    .iter()
                    .map(|&a| VizAcq {
                        id: a.to_string(),
                        intimacy: self.world.intimacy_of(h.id, a),
                    })
                    .collect(),
                pending_events: h.pending_events.iter().map(|e| format!("{e:?}")).collect(),
            })
            .collect();
        let state = VizState {
            month: self.world.month,
            alive: self.world.humans.len() as u32,
            deaths: self.world.deaths,
            births: self.world.births,
            total_space: self.world.params.total_space,
            space_used: self.world.space_used_total(),
            env: self
                .world
                .env
                .iter()
                .enumerate()
                .map(|(idx, &stock)| VizEnv {
                    idx: idx as u32,
                    stock,
                    g: laws.specs[idx].g,
                    volume: laws.specs[idx].volume,
                    decay_permille: laws.specs[idx].decay_permille,
                    is_waste: idx >= zeroverse_core::laws::N_PRIMARY,
                })
                .collect(),
            humans,
            quotes: self
                .world
                .last_quotes
                .iter()
                .map(|&(seller, gi, ga, wi, wa)| VizQuote {
                    seller: seller.to_string(),
                    give_idx: gi as u32,
                    give_amount: ga,
                    want_idx: wi as u32,
                    want_amount: wa,
                })
                .collect(),
            intimacy: self
                .world
                .intimacy
                .iter()
                .map(|(&(a, b), &v)| VizIntimacy {
                    a: a.to_string(),
                    b: b.to_string(),
                    v,
                })
                .collect(),
            parentage: self
                .world
                .parentage
                .iter()
                .map(|(&c, &(m, f))| VizParentage {
                    child: c.to_string(),
                    mother: m.to_string(),
                    father: f.to_string(),
                })
                .collect(),
            state_hash: format!("{:016x}", self.world.state_hash()),
        };
        serde_wasm_bindgen::to_value(&state).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// scenario の judge へ渡す world-report（WIT 形状・u64 は BigInt）。
    /// 集計対象は setup 時点の human 集合（wasm-host ランナーと同一規則）。
    pub fn report(&self) -> Result<JsValue, JsValue> {
        let consumption = self.world.lifetime_consumption();
        let mut groups: BTreeMap<u32, (u32, u32, u128)> = BTreeMap::new();
        for &id in &self.initial {
            let g = self.groups.get(&id).copied().unwrap_or(0);
            let e = groups.entry(g).or_insert((0, 0, 0));
            e.1 += 1;
            if self.world.humans.contains_key(&id) {
                e.0 += 1;
            }
            e.2 += consumption.get(&id).copied().unwrap_or(0);
        }
        let report = WorldReportW {
            month: self.world.month,
            groups: groups
                .iter()
                .map(|(&group, &(alive, total, sum))| GroupReportW {
                    group,
                    alive,
                    total,
                    // 生の積（1/1000^2）→ 1/1000 スケールへ丸め（wasm-host ランナーと同一）
                    mean_consumed: (sum / (total as u128).max(1) / 1000).min(u64::MAX as u128)
                        as u64,
                })
                .collect(),
        };
        let ser =
            serde_wasm_bindgen::Serializer::new().serialize_large_number_types_as_bigints(true);
        report
            .serialize(&ser)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
}
