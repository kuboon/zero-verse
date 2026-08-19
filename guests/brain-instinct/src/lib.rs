//! Instinct v1 インタープリタ brain（wasm component）。
//!
//! ライトユーザが書いたルールスクリプト（`#!instinct/1`、src/interp.rs）を
//! 実行する汎用 brain。スクリプト本文は component には焼き込まず、
//! **ホスト（ビューワ / wasm-host）が memory チャネルの先頭に注入**する:
//!
//!   decide に渡る memory = [u32 LE script_len][script utf8][前月の状態]
//!   save-memory で返すのは状態だけ（ホストが翌月また script を前置する）
//!
//! これにより engine から見れば普通の brain であり、fuel 計装・決定論・
//! サンドボックスがそのまま効く。スクリプトは engine の memory-limit の
//! 外側（ホスト側）に住むので上限も食わない。
//!
//! 生存の土台（何が食事かの学習）は forager と同じ invoke-result 学習を
//! インタープリタに内蔵し、スクリプトには eat / harvest / explore などの
//! 高水準の動作と観測（health, food, ...）だけを見せる。

mod interp;

// ネイティブでは interp の単体テストだけをビルドする（cdylib の
// component エクスポート名が native リンカの version script と衝突するため）
#[cfg(target_arch = "wasm32")]
mod component {

    use crate::interp::{self, Action, Env, Program};

    wit_bindgen::generate!({
        path: "../../wit",
        world: "brain",
    });

    use zeroverse::world::action::{Act, InvokeArgs};
    use zeroverse::world::commit;
    use zeroverse::world::observation::{Event, Snapshot};
    use zeroverse::world::types::ResourceStack;
    use zeroverse::world::types::WorldConfig;

    /// forager と同じ学習知識 + Instinct の実行状態
    struct State {
        harvest: Vec<(u64, u64)>, // (skill, 産出 resource)
        eat: Vec<(u64, u64)>,     // (skill, 入力 resource)
        next_experiment: u64,
        give_rot: u64,
        vars: Vec<i64>,
    }

    impl State {
        fn parse(bytes: &[u8], n_vars: usize) -> State {
            let words: Vec<u64> = bytes
                .chunks_exact(8)
                .map(|c| u64::from_le_bytes(c.try_into().unwrap()))
                .collect();
            let mut i = 0usize;
            let mut next = || -> u64 {
                let v = words.get(i).copied().unwrap_or(0);
                i += 1;
                v
            };
            let n_harvest = next().min(64);
            let harvest = (0..n_harvest).map(|_| (next(), next())).collect();
            let n_eat = next().min(64);
            let eat = (0..n_eat).map(|_| (next(), next())).collect();
            let next_experiment = next();
            let give_rot = next();
            let stored_vars = next().min(256) as usize;
            let mut vars: Vec<i64> = (0..stored_vars).map(|_| next() as i64).collect();
            // スクリプトが編集されて var の数が変わっていたら合わせる（余りは捨て、不足は 0）
            vars.resize(n_vars, 0);
            State {
                harvest,
                eat,
                next_experiment,
                give_rot,
                vars,
            }
        }

        fn serialize(&self) -> Vec<u8> {
            let mut out = Vec::new();
            let mut push = |v: u64| out.extend_from_slice(&v.to_le_bytes());
            push(self.harvest.len() as u64);
            for &(s, r) in &self.harvest {
                push(s);
                push(r);
            }
            push(self.eat.len() as u64);
            for &(s, r) in &self.eat {
                push(s);
                push(r);
            }
            push(self.next_experiment);
            push(self.give_rot);
            push(self.vars.len() as u64);
            for &v in &self.vars {
                push(v as u64);
            }
            out
        }
    }

    fn held(snap: &Snapshot, resource: u64) -> u64 {
        snap.self_view
            .resources
            .iter()
            .find(|s| s.resource == resource)
            .map(|s| s.amount)
            .unwrap_or(0)
    }

    /// 学習済みの「食べられる resource とその skill 対」（eat と、それを産む harvest）
    fn plan(state: &State) -> Option<(u64, u64, u64)> {
        state.eat.iter().find_map(|&(eat_skill, food)| {
            state
                .harvest
                .iter()
                .find(|&&(_, out)| out == food)
                .map(|&(harvest_skill, _)| (harvest_skill, eat_skill, food))
        })
    }

    struct Instinct;

    impl exports::zeroverse::world::brain_api::Guest for Instinct {
        fn init(_config: WorldConfig) {}

        fn decide(snap: Snapshot, memory: Vec<u8>) {
            // memory 先頭のスクリプトを剥がす（ホストが注入している）
            if memory.len() < 4 {
                return; // スクリプト無し = 何もしない
            }
            let script_len = u32::from_le_bytes(memory[0..4].try_into().unwrap()) as usize;
            if memory.len() < 4 + script_len {
                return;
            }
            let Ok(script) = core::str::from_utf8(&memory[4..4 + script_len]) else {
                return;
            };
            // 構文エラーは memory にマーカーを書いて返す（wasm の panic はメッセージが
            // 失われるため）。ホスト側ランナーがこのマーカーを検出してユーザに表示する
            let prog: Program = match interp::parse(script) {
                Ok(p) => p,
                Err(e) => {
                    let msg = format!("instinct:parse:{}:{}", e.line, e.message);
                    commit::save_memory(msg.as_bytes());
                    return;
                }
            };
            let mut state = State::parse(&memory[4 + script_len..], prog.var_names.len());

            // 1. forager と同じ法則学習（invoke-result から）
            for ev in &snap.events {
                if let Event::InvokeResult(r) = ev {
                    if r.health_gain > 0 {
                        if let Some(inp) = r.consumed.first() {
                            if !state.eat.iter().any(|&(s, _)| s == r.skill) {
                                state.eat.push((r.skill, inp.resource));
                            }
                        }
                    } else if r.consumed.is_empty() {
                        if let Some(out) = r.produced.first() {
                            if !state.harvest.iter().any(|&(s, _)| s == r.skill) {
                                state.harvest.push((r.skill, out.resource));
                            }
                        }
                    }
                }
            }

            // 2. スクリプトの評価環境を作る
            let known = plan(&state);
            let food_units = known.map(|(_, _, f)| held(&snap, f) / 1000).unwrap_or(0);
            let health = snap
                .self_view
                .stats
                .iter()
                .find(|s| matches!(s.kind, zeroverse::world::types::StatKind::Health))
                .map(|s| s.value / 1000)
                .unwrap_or(0);
            let alive_acq: Vec<u64> = snap
                .acquaintances
                .iter()
                .filter(|a| a.alive)
                .map(|a| a.id)
                .collect();
            let env = Env {
                health: health as i64,
                food: food_units as i64,
                month: snap.now as i64,
                age: (snap.self_view.age_months / 12) as i64,
                acq: alive_acq.len() as i64,
                knows_food: known.is_some(),
                rand: (snap.rand % 1000) as i64,
            };

            // 3. ルールを上から評価。act は最大 4 枠（set は枠を使わない）
            let mut acts_used = 0u32;
            for rule in &prog.rules {
                if interp::eval(&rule.cond, &env, &state.vars) == 0 {
                    continue;
                }
                for action in &rule.actions {
                    if acts_used >= 4 {
                        break;
                    }
                    match action {
                        Action::Set(idx, expr) => {
                            let v = interp::eval(expr, &env, &state.vars);
                            if let Some(slot) = state.vars.get_mut(*idx) {
                                *slot = v;
                            }
                        }
                        Action::Harvest => {
                            if let Some((harvest_skill, _, _)) = known {
                                commit::push_act(&Act::Invoke(InvokeArgs {
                                    inputs: vec![],
                                    using_skills: vec![harvest_skill],
                                }));
                                acts_used += 1;
                            }
                        }
                        Action::Eat => {
                            if let Some((_, eat_skill, food)) = known {
                                if held(&snap, food) > 0 {
                                    commit::push_act(&Act::Invoke(InvokeArgs {
                                        inputs: vec![ResourceStack {
                                            resource: food,
                                            amount: u64::MAX,
                                        }],
                                        using_skills: vec![eat_skill],
                                    }));
                                    acts_used += 1;
                                }
                            }
                        }
                        Action::Discard => {
                            // 食料以外で最も多い保有を捨てる（forager と同じ。誤廃棄を
                            // 避けるため食料を学習するまでは何もしない）
                            if let Some((_, _, food)) = known {
                                let junk = snap
                                    .self_view
                                    .resources
                                    .iter()
                                    .filter(|s| s.resource != food)
                                    .max_by_key(|s| (s.amount, u64::MAX - s.resource));
                                if let Some(j) = junk {
                                    commit::push_act(&Act::Discard(ResourceStack {
                                        resource: j.resource,
                                        amount: j.amount,
                                    }));
                                    acts_used += 1;
                                }
                            }
                        }
                        Action::GiveFood => {
                            // 生存知人へ輪番で食料 1.0（親密度づくり）。備蓄 2.0 は残す
                            if let Some((_, _, food)) = known {
                                if held(&snap, food) > 2000 && !alive_acq.is_empty() {
                                    let to = alive_acq[(state.give_rot as usize) % alive_acq.len()];
                                    state.give_rot = state.give_rot.wrapping_add(1);
                                    commit::push_act(&Act::Give(
                                        zeroverse::world::action::GiveArgs {
                                            to,
                                            stack: ResourceStack {
                                                resource: food,
                                                amount: 1000,
                                            },
                                        },
                                    ));
                                    acts_used += 1;
                                }
                            }
                        }
                        Action::Mingle => {
                            // 出歩く。同月に mingle した者同士がエンジン側でペアリングされる
                            commit::push_act(&Act::Mingle);
                            acts_used += 1;
                        }
                        Action::Explore => {
                            // forager の実験を 1 手: (skill × 入力候補) を決定論で総当たり
                            let mut skills: Vec<u64> =
                                snap.self_view.skills.iter().map(|s| s.skill).collect();
                            skills.sort_unstable();
                            let mut resources: Vec<u64> = snap
                                .self_view
                                .resources
                                .iter()
                                .map(|s| s.resource)
                                .collect();
                            resources.sort_unstable();
                            let combos = (skills.len() as u64) * (1 + resources.len() as u64);
                            let mut tries = 0u64;
                            while tries < combos {
                                tries += 1;
                                let c = state.next_experiment % combos;
                                state.next_experiment += 1;
                                let skill = skills[(c / (1 + resources.len() as u64)) as usize];
                                let input = (c % (1 + resources.len() as u64)) as usize;
                                let known_skill = state.eat.iter().any(|&(s, _)| s == skill)
                                    || state.harvest.iter().any(|&(s, _)| s == skill);
                                if known_skill {
                                    continue;
                                }
                                let inputs = if input == 0 {
                                    vec![]
                                } else {
                                    vec![ResourceStack {
                                        resource: resources[input - 1],
                                        amount: 1000,
                                    }]
                                };
                                commit::push_act(&Act::Invoke(InvokeArgs {
                                    inputs,
                                    using_skills: vec![skill],
                                }));
                                acts_used += 1;
                                break;
                            }
                        }
                    }
                }
            }

            commit::save_memory(&state.serialize());
        }
    }

    export!(Instinct);
}
