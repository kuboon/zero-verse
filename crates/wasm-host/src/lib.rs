//! WASM Component 実行系（P0-2 の残り）。
//!
//! - brain component（wit/world.wit の world brain）を core の Brain trait に載せる。
//! - scenario component（wit-scenario/scenario.wit）で world の初期化とクリア判定を行う。
//!
//! 不変の原則（pages/content/docs/wit.md）の実装対応:
//! - 呼び出しごとに新規インスタンス化（InstancePre。Module 共有は可）
//! - fuel 計量は決定論的な命令数ベース。消費は health 減少に写像（Decision.fuel_used）
//! - fuel 切れ / trap は部分実行: それまでに push 済みの宣言は有効
//! - wasi は一切リンクしない（guest は wasm32-unknown-unknown でビルドし component 化）

use anyhow::{Context as _, Result};
use std::path::Path;
use wasmtime::component::{Component, Linker};
use wasmtime::{Config, Engine, Store};
use zeroverse_core::brain::{Brain, Decision, Snapshot};
use zeroverse_core::WorldParams;

mod brain_world {
    wasmtime::component::bindgen!({
        path: "../../wit",
        world: "brain",
    });
}

mod scenario_world {
    wasmtime::component::bindgen!({
        path: "../../wit-scenario",
        world: "scenario",
    });
}

use brain_world::zeroverse::world::types as wit_types;
use brain_world::zeroverse::world::{action, commit, observation, probe};

pub use scenario_world::exports::zeroverse::scenario::scenario_api as scn;

/// 決定論設定の wasmtime Engine を作る（NaN 正規化・fuel 計量）
pub fn make_engine() -> Result<Engine> {
    let mut config = Config::new();
    config.consume_fuel(true);
    config.cranelift_nan_canonicalization(true);
    Engine::new(&config).context("wasmtime engine")
}

/// decide 中の commit 積み上げ先（store data）
#[derive(Default)]
struct CommitState {
    acts: Vec<zeroverse_core::brain::Act>,
    orders: Vec<zeroverse_core::brain::StandingOrder>,
    memory: Option<Vec<u8>>,
}

struct HostState {
    commits: CommitState,
}

impl commit::Host for HostState {
    fn push_act(&mut self, a: action::Act) {
        use zeroverse_core::brain::Act as CoreAct;
        let act = match a {
            action::Act::Invoke(args) => CoreAct::Invoke {
                inputs: args.inputs.iter().map(|s| (s.resource, s.amount)).collect(),
                using_skills: args.using_skills,
            },
            action::Act::Give(g) => CoreAct::Give {
                to: g.to,
                resource: g.stack.resource,
                amount: g.stack.amount,
            },
            action::Act::Discard(s) => CoreAct::Discard {
                resource: s.resource,
                amount: s.amount,
            },
            action::Act::Idle => CoreAct::Idle,
            action::Act::Teach(t) => CoreAct::Teach {
                student: t.student,
                skill: t.skill,
            },
            action::Act::Learn(l) => CoreAct::Learn {
                teacher: l.teacher,
                skill: l.skill,
            },
            // introduce は M4 でエンジン側実装が入るまで idle 扱い
            action::Act::Introduce(_) => CoreAct::Idle,
        };
        self.commits.acts.push(act);
    }

    fn push_order(&mut self, o: action::StandingOrder) {
        use zeroverse_core::brain::StandingOrder as CoreOrder;
        match o {
            action::StandingOrder::LimitOrder(l) => {
                self.commits.orders.push(CoreOrder::Limit {
                    give_resource: l.give_resource,
                    give_amount: l.give_amount,
                    want_resource: l.want_resource,
                    want_amount: l.want_amount,
                    partial: l.partial,
                });
            }
            action::StandingOrder::ConditionalGive(c) => {
                use zeroverse_core::brain::GiveCondition as CoreCond;
                let condition = match c.condition {
                    action::GiveCondition::IfReceived(s) => CoreCond::IfReceived {
                        resource: s.resource,
                        amount: s.amount,
                    },
                    action::GiveCondition::IfTaughtMe(k) => CoreCond::IfTaughtMe(k),
                    action::GiveCondition::UnconditionalScheduled => CoreCond::Unconditional,
                };
                self.commits.orders.push(CoreOrder::ConditionalGive {
                    to: c.to,
                    resource: c.stack.resource,
                    amount: c.stack.amount,
                    condition,
                });
            }
        }
    }

    fn save_memory(&mut self, data: Vec<u8>) {
        self.commits.memory = Some(data);
    }
}

impl wit_types::Host for HostState {}
impl action::Host for HostState {}
impl observation::Host for HostState {}

impl probe::Host for HostState {
    // M2/M4 で本実装。fuel 追加課金つきの読み取り専用 import
    fn trade_history(&mut self, _who: u64, _since: u32) -> Vec<probe::PublicTrade> {
        Vec::new()
    }
    fn graph_distance(&mut self, _who: u64) -> Option<u32> {
        None
    }
}

/// brain component を core::brain::Brain として実行する。
pub struct WasmBrain {
    engine: Engine,
    pre: brain_world::BrainPre<HostState>,
    params: WorldParams,
}

impl WasmBrain {
    pub fn load(engine: &Engine, path: &Path, params: &WorldParams) -> Result<Self> {
        let component = Component::from_file(engine, path)
            .with_context(|| format!("load component {}", path.display()))?;
        let mut linker: Linker<HostState> = Linker::new(engine);
        brain_world::Brain::add_to_linker::<HostState, wasmtime::component::HasSelf<HostState>>(
            &mut linker,
            |s| s,
        )?;
        let pre = brain_world::BrainPre::new(linker.instantiate_pre(&component)?)?;
        Ok(WasmBrain {
            engine: engine.clone(),
            pre,
            params: params.clone(),
        })
    }

    fn wit_snapshot(&self, snap: &Snapshot, fuel_budget: u64) -> observation::Snapshot {
        use zeroverse_core::brain::Event as E;
        let stack = |(r, a): (u64, u64)| wit_types::ResourceStack {
            resource: r,
            amount: a,
        };
        observation::Snapshot {
            now: snap.now,
            rand: snap.rand,
            self_view: observation::SelfView {
                id: snap.id,
                age_months: snap.age_months,
                sex: match snap.sex {
                    zeroverse_core::state::Sex::Female => wit_types::Sex::Female,
                    zeroverse_core::state::Sex::Male => wit_types::Sex::Male,
                },
                stats: vec![
                    wit_types::Stat {
                        kind: wit_types::StatKind::Health,
                        value: snap.health,
                    },
                    wit_types::Stat {
                        kind: wit_types::StatKind::Strength,
                        value: snap.strength,
                    },
                    wit_types::Stat {
                        kind: wit_types::StatKind::Cognition,
                        value: snap.cognition,
                    },
                    wit_types::Stat {
                        kind: wit_types::StatKind::Fertility,
                        value: snap.fertility,
                    },
                ],
                resources: snap.resources.iter().copied().map(stack).collect(),
                space_used: snap.space_used,
                space_free: snap.space_free,
                skills: snap
                    .skills
                    .iter()
                    .map(|&(skill, proficiency)| observation::SkillView { skill, proficiency })
                    .collect(),
                available_actions: vec![
                    observation::ActionKind::Invoke,
                    observation::ActionKind::Give,
                    observation::ActionKind::Discard,
                    observation::ActionKind::Teach,
                    observation::ActionKind::Learn,
                    observation::ActionKind::Idle,
                ],
                fuel_budget,
                memory_limit: 64 * 1024,
            },
            acquaintances: snap
                .acquaintances
                .iter()
                .map(|v| observation::Acquaintance {
                    id: v.id,
                    apparent_age: v.apparent_age,
                    alive: v.alive,
                    intimacy: v.intimacy,
                    // last-interaction はエンジン側未実装のスタブ
                    last_interaction: None,
                })
                .collect(),
            events: snap
                .events
                .iter()
                .map(|ev| match ev {
                    E::ReceivedTransfer {
                        from,
                        resource,
                        amount,
                    } => observation::Event::ReceivedTransfer(observation::TransferInfo {
                        from: *from,
                        stack: stack((*resource, *amount)),
                    }),
                    E::Encountered(id) => observation::Event::Encountered(*id),
                    E::SomeoneDied(id) => observation::Event::SomeoneDied(*id),
                    E::TradeExecuted {
                        counterparty,
                        gave,
                        got,
                    } => observation::Event::TradeExecuted(observation::TradeInfo {
                        counterparty: *counterparty,
                        gave: stack(*gave),
                        got: stack(*got),
                    }),
                    E::InvokeResult {
                        skill,
                        consumed,
                        produced,
                        health_gain,
                    } => observation::Event::InvokeResult(observation::InvokeResultInfo {
                        skill: *skill,
                        consumed: consumed.iter().copied().map(stack).collect(),
                        produced: produced.iter().copied().map(stack).collect(),
                        health_gain: *health_gain,
                    }),
                    E::TeachProgressed { partner, skill } => {
                        observation::Event::TeachProgressed(observation::TeachInfo {
                            partner: *partner,
                            skill: *skill,
                        })
                    }
                    E::SkillAcquired(s) => observation::Event::SkillAcquired(*s),
                    E::ChildBorn(c) => observation::Event::ChildBorn(*c),
                    E::ActionFailed => {
                        observation::Event::ActionFailed(observation::ActionKind::Invoke)
                    }
                })
                .collect(),
            market: snap
                .market
                .iter()
                .map(|q| observation::BoardQuote {
                    seller: q.seller,
                    give_resource: q.give_resource,
                    give_amount: q.give_amount,
                    want_resource: q.want_resource,
                    want_amount: q.want_amount,
                })
                .collect(),
        }
    }
}

impl Brain for WasmBrain {
    fn decide(&mut self, snap: &Snapshot) -> Decision {
        // 思考予算 fuel-budget = health × fuel-per-health（pages/content/docs/human.md）
        let budget = snap.health / 1000 * self.params.fuel_per_health;
        let mut store = Store::new(
            &self.engine,
            HostState {
                commits: CommitState::default(),
            },
        );
        if store.set_fuel(budget).is_err() {
            return Decision::default();
        }

        // 呼び出しごとに新規インスタンス化（テレパシー禁止）
        let result = (|| -> Result<()> {
            let instance = self.pre.instantiate(&mut store)?;
            let api = instance.zeroverse_world_brain_api();
            let wit_snap = self.wit_snapshot(snap, budget);
            api.call_decide(&mut store, &wit_snap, &snap.memory)?;
            Ok(())
        })();

        // fuel 切れ / trap は部分実行: push 済みの宣言はそのまま有効
        let _ = &result;
        let fuel_used = budget.saturating_sub(store.get_fuel().unwrap_or(0));
        let commits = std::mem::take(&mut store.data_mut().commits);
        Decision {
            acts: commits.acts,
            orders: commits.orders,
            memory: commits.memory,
            fuel_used,
        }
    }
}

/// scenario component（init + judge）
pub struct Scenario {
    engine: Engine,
    pre: scenario_world::ScenarioPre<()>,
}

impl Scenario {
    pub fn load(engine: &Engine, path: &Path) -> Result<Self> {
        let component = Component::from_file(engine, path)
            .with_context(|| format!("load component {}", path.display()))?;
        let linker: Linker<()> = Linker::new(engine);
        let pre = scenario_world::ScenarioPre::new(linker.instantiate_pre(&component)?)?;
        Ok(Scenario {
            engine: engine.clone(),
            pre,
        })
    }

    fn call<R>(
        &self,
        f: impl FnOnce(&scenario_world::Scenario, &mut Store<()>) -> Result<R>,
    ) -> Result<R> {
        let mut store = Store::new(&self.engine, ());
        // scenario はメタ層なので fuel 予算は固定の大きな値
        store.set_fuel(u64::MAX / 2)?;
        let instance = self.pre.instantiate(&mut store)?;
        f(&instance, &mut store)
    }

    pub fn init(&self, seed: u64) -> Result<scn::WorldSetup> {
        self.call(|inst, store| {
            inst.zeroverse_scenario_scenario_api()
                .call_init(store, seed)
                .context("scenario init")
        })
    }

    pub fn judge(&self, report: &scn::WorldReport) -> Result<scn::Verdict> {
        self.call(|inst, store| {
            inst.zeroverse_scenario_scenario_api()
                .call_judge(store, report)
                .context("scenario judge")
        })
    }
}
