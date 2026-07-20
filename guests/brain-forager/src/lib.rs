//! forager brain（wasm component 参照実装）。
//!
//! 何が食事で何が採取かを**知らずに**生まれ、invoke の実験と
//! invoke-result イベント（先月の結果）から法則を学んで生き延びる。
//! zeroverse の設計原則そのままのデモ:
//! - レシピは world に存在せず、brain の memory の中にだけ育つ
//! - 状態は memory blob 経由のみ（decide はステートレス）
//! - 宣言は commit（push-act / save-memory）への積み上げ
//!
//! memory blob 形式（u64 LE 列）:
//!   [n_harvest, (skill, out_resource) * n_harvest,
//!    n_eat,     (skill, in_resource) * n_eat,
//!    next_experiment]

wit_bindgen::generate!({
    path: "../../wit",
    world: "brain",
});

use zeroverse::world::action::{Act, InvokeArgs};
use zeroverse::world::commit;
use zeroverse::world::observation::{Event, Snapshot};
use zeroverse::world::types::ResourceStack;
use zeroverse::world::types::WorldConfig;

struct Knowledge {
    harvest: Vec<(u64, u64)>, // (skill, 産出 resource)
    eat: Vec<(u64, u64)>,     // (skill, 入力 resource)
    next_experiment: u64,
}

impl Knowledge {
    fn parse(memory: &[u8]) -> Knowledge {
        let words: Vec<u64> = memory
            .chunks_exact(8)
            .map(|c| u64::from_le_bytes(c.try_into().unwrap()))
            .collect();
        let mut i = 0usize;
        let mut next = || -> u64 {
            let v = words.get(i).copied().unwrap_or(0);
            i += 1;
            v
        };
        let n_harvest = next();
        let harvest = (0..n_harvest).map(|_| (next(), next())).collect();
        let n_eat = next();
        let eat = (0..n_eat).map(|_| (next(), next())).collect();
        let next_experiment = next();
        Knowledge {
            harvest,
            eat,
            next_experiment,
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
        out
    }
}

struct Forager;

impl exports::zeroverse::world::brain_api::Guest for Forager {
    fn init(_config: WorldConfig) {}

    fn decide(snap: Snapshot, memory: Vec<u8>) {
        let mut know = Knowledge::parse(&memory);

        // 1. 先月の invoke-result から法則を学ぶ
        for ev in &snap.events {
            if let Event::InvokeResult(r) = ev {
                if r.health_gain > 0 {
                    if let Some(inp) = r.consumed.first() {
                        if !know.eat.iter().any(|&(s, _)| s == r.skill) {
                            know.eat.push((r.skill, inp.resource));
                        }
                    }
                } else if r.consumed.is_empty() {
                    if let Some(out) = r.produced.first() {
                        if !know.harvest.iter().any(|&(s, _)| s == r.skill) {
                            know.harvest.push((r.skill, out.resource));
                        }
                    }
                }
            }
        }

        let held = |resource: u64| -> u64 {
            snap.self_view
                .resources
                .iter()
                .find(|s| s.resource == resource)
                .map(|s| s.amount)
                .unwrap_or(0)
        };

        // 2. 知っている法則で生きる:
        //    食べられる resource を産出する harvest を選び、採って食べる
        let mut acted = 0u32;
        let plan = know.eat.iter().find_map(|&(eat_skill, food)| {
            know.harvest
                .iter()
                .find(|&&(_, out)| out == food)
                .map(|&(harvest_skill, _)| (harvest_skill, eat_skill, food))
        });
        if let Some((harvest_skill, eat_skill, food)) = plan {
            commit::push_act(&Act::Invoke(InvokeArgs {
                inputs: vec![],
                using_skills: vec![harvest_skill],
            }));
            acted += 1;
            if held(food) > 0 {
                commit::push_act(&Act::Invoke(InvokeArgs {
                    inputs: vec![ResourceStack {
                        resource: food,
                        amount: u64::MAX,
                    }],
                    using_skills: vec![eat_skill],
                }));
                acted += 1;
            }
        }

        // 3. 片付けは経済行動（docs/design/human.md）:
        //    食料以外で最も多い resource を捨てて占有維持費を抑える。
        //    ただし何が食料かを知るまでは何も捨てない（誤って食料を捨てると死ぬ。
        //    無知の間の維持費は学習の授業料）
        let food_ids: Vec<u64> = know.eat.iter().map(|&(_, r)| r).collect();
        if !food_ids.is_empty() {
            let junk = snap
                .self_view
                .resources
                .iter()
                .filter(|s| !food_ids.contains(&s.resource))
                .max_by_key(|s| (s.amount, u64::MAX - s.resource));
            if let Some(j) = junk {
                commit::push_act(&Act::Discard(ResourceStack {
                    resource: j.resource,
                    amount: j.amount,
                }));
                acted += 1;
            }
        }

        // 4. 残り枠で実験: (skill × 入力候補) を決定論的に総当たり
        //    入力候補 = なし(harvest 仮説) or 保有 resource 1 種(eat 仮説)
        let mut skills: Vec<u64> = snap.self_view.skills.iter().map(|s| s.skill).collect();
        skills.sort_unstable();
        let mut resources: Vec<u64> = snap
            .self_view
            .resources
            .iter()
            .map(|s| s.resource)
            .collect();
        resources.sort_unstable();
        let combos = (skills.len() as u64) * (1 + resources.len() as u64);
        while acted < 4 && combos > 0 {
            let c = know.next_experiment % combos;
            know.next_experiment += 1;
            let skill = skills[(c / (1 + resources.len() as u64)) as usize];
            let input = (c % (1 + resources.len() as u64)) as usize;
            let known = know.eat.iter().any(|&(s, _)| s == skill)
                || know.harvest.iter().any(|&(s, _)| s == skill);
            if known {
                continue;
            }
            let inputs = if input == 0 {
                vec![]
            } else {
                vec![ResourceStack {
                    resource: resources[input - 1],
                    amount: 1000, // 1.000 だけ試す（実験コストを抑える）
                }]
            };
            commit::push_act(&Act::Invoke(InvokeArgs {
                inputs,
                using_skills: vec![skill],
            }));
            acted += 1;
        }

        // 5. 学んだことを覚えて終わる
        commit::save_memory(&know.serialize());
    }
}

export!(Forager);
