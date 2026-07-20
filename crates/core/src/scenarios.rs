//! M1 シナリオ: 交易は自給自足に勝つか（docs/PLAN.md M1）。
//!
//! セットアップ:
//! - human は「食べられる primary（食文化 E_edible）」と「高熟練の harvest（H_specialty）」
//!   を持ち、**specialty ≠ edible**（賦存のミスマッチ）。自分の食料の harvest は低熟練。
//! - 自給自足 brain: 低熟練で自分の食料を採り、食べる。
//! - 交易 brain: 高熟練で specialty を採り、補完的なパートナー（相手の edible = 自分の
//!   specialty）と give で交換して食べる。
//! - 生涯消費 = 食事の Δg 総和（docs/design/07-scoring.md）。比 > 1.0 が M1 合格基準。
//!
//! 参照 brain は snapshot と自分の割り当て（生得知識に相当）だけで動く。
//! 他人の在庫・skill は観測していない。

use crate::brain::{Act, Brain, Decision, Snapshot};
use crate::laws::{SkillId, N_PRIMARY};
use crate::state::World;
use crate::{HumanId, Qty, ResourceId, WorldParams, QTY_SCALE, STAT_MAX};
use std::collections::BTreeMap;

/// 自給自足 brain: 自分の食料を（低熟練で）採り、全部食べ、ゴミを捨てる。
pub struct AutarkyBrain {
    pub edible: ResourceId,
    pub harvest_skill: SkillId, // H_edible（低熟練）
    pub eat_skill: SkillId,     // E_edible
}

impl Brain for AutarkyBrain {
    fn decide(&mut self, snap: &Snapshot) -> Decision {
        let mut acts = vec![
            Act::Invoke {
                inputs: vec![],
                using_skills: vec![self.harvest_skill],
            },
            Act::Invoke {
                inputs: vec![(self.edible, Qty::MAX)],
                using_skills: vec![self.eat_skill],
            },
        ];
        acts.extend(discard_junk(snap, &[self.edible], 2));
        Decision { acts, memory: None }
    }
}

/// 交易 brain: specialty を高熟練で採り、パートナーに渡し、受け取った食料を食べる。
pub struct TraderBrain {
    pub edible: ResourceId,
    pub specialty: ResourceId,
    pub harvest_skill: SkillId, // H_specialty（高熟練）
    pub eat_skill: SkillId,     // E_edible
    pub partner: HumanId,
}

impl Brain for TraderBrain {
    fn decide(&mut self, snap: &Snapshot) -> Decision {
        let held_specialty = held(snap, self.specialty);
        let mut acts = vec![Act::Invoke {
            inputs: vec![],
            using_skills: vec![self.harvest_skill],
        }];
        if held_specialty > 0 {
            acts.push(Act::Give {
                to: self.partner,
                resource: self.specialty,
                amount: held_specialty,
            });
        }
        acts.push(Act::Invoke {
            inputs: vec![(self.edible, Qty::MAX)],
            using_skills: vec![self.eat_skill],
        });
        acts.extend(discard_junk(snap, &[self.edible, self.specialty], 1));
        Decision { acts, memory: None }
    }
}

fn held(snap: &Snapshot, resource: ResourceId) -> Qty {
    snap.resources
        .iter()
        .find_map(|&(r, a)| (r == resource).then_some(a))
        .unwrap_or(0)
}

/// keep に無い保有 resource を大きい順に max_acts 件まで捨てる（占有維持費対策）
fn discard_junk(snap: &Snapshot, keep: &[ResourceId], max_acts: usize) -> Vec<Act> {
    let mut junk: Vec<(ResourceId, Qty)> = snap
        .resources
        .iter()
        .filter(|(r, _)| !keep.contains(r))
        .copied()
        .collect();
    junk.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
    junk.into_iter()
        .take(max_acts)
        .map(|(resource, amount)| Act::Discard { resource, amount })
        .collect()
}

pub struct M1Setup {
    pub world: World,
    pub brains: BTreeMap<HumanId, Box<dyn Brain>>,
    pub autarky_ids: Vec<HumanId>,
    pub trader_ids: Vec<HumanId>,
}

/// M1 実験世界を構築する。
///
/// n_pairs ごとに 4 人を作る: 交易ペア (A, B) と、同じ賦存を持つ自給自足 (A', B')。
/// 賦存が同一なので、両群の差は戦略（交易するかどうか）だけになる。
pub fn build_m1(seed: u64, n_pairs: usize, params: WorldParams) -> M1Setup {
    let n_humans = n_pairs * 4;
    let mut world = World::new(seed, n_humans, params);
    let ids: Vec<HumanId> = world.humans.keys().copied().collect();

    let high = STAT_MAX; // 熟練 100%
    let low = 30 * QTY_SCALE; // 熟練 30%

    let mut brains: BTreeMap<HumanId, Box<dyn Brain>> = BTreeMap::new();
    let mut autarky_ids = Vec::new();
    let mut trader_ids = Vec::new();

    for pair in 0..n_pairs {
        let ea = pair % N_PRIMARY; // A の食料
        let eb = (pair + 1) % N_PRIMARY; // B の食料（= A の specialty）
        let ids4 = &ids[pair * 4..pair * 4 + 4];
        let (a, b, a2, b2) = (ids4[0], ids4[1], ids4[2], ids4[3]);

        // 賦存: edible=X を食べられ、Y≠X の harvest が高熟練、X の harvest は低熟練
        for &(hid, edible, specialty) in &[(a, ea, eb), (a2, ea, eb), (b, eb, ea), (b2, eb, ea)] {
            world.grant_skill(hid, N_PRIMARY + edible, high); // E_edible
            world.grant_skill(hid, specialty, high); // H_specialty（高）
            world.grant_skill(hid, edible, low); // H_edible（低）
        }

        // 交易ペアは初期知人（world 生成の初期知人グラフ → docs/design/world.md）
        world.add_acquaintance(a, b);

        let rid = |p: usize| world.laws.id_of_index[p];
        let sid = |s: usize| world.laws.skill_id_of_index[s];

        brains.insert(
            a,
            Box::new(TraderBrain {
                edible: rid(ea),
                specialty: rid(eb),
                harvest_skill: sid(eb),
                eat_skill: sid(N_PRIMARY + ea),
                partner: b,
            }),
        );
        brains.insert(
            b,
            Box::new(TraderBrain {
                edible: rid(eb),
                specialty: rid(ea),
                harvest_skill: sid(ea),
                eat_skill: sid(N_PRIMARY + eb),
                partner: a,
            }),
        );
        trader_ids.push(a);
        trader_ids.push(b);

        for &(hid, e) in &[(a2, ea), (b2, eb)] {
            brains.insert(
                hid,
                Box::new(AutarkyBrain {
                    edible: rid(e),
                    harvest_skill: sid(e), // 低熟練の H_edible
                    eat_skill: sid(N_PRIMARY + e),
                }),
            );
            autarky_ids.push(hid);
        }
    }

    M1Setup {
        world,
        brains,
        autarky_ids,
        trader_ids,
    }
}

pub struct M1Result {
    pub autarky_mean: f64,
    pub trader_mean: f64,
    /// 交易 / 自給自足 の生涯消費比（M1 合格基準: > 1.0）
    pub ratio: f64,
}

/// M1 実験を回して生涯消費比を測る。
pub fn run_m1(seed: u64, n_pairs: usize, years: u32, params: WorldParams) -> M1Result {
    let mut setup = build_m1(seed, n_pairs, params);
    let months = years * setup.world.params.months_per_year;
    setup.world.run(months, &mut setup.brains);

    let consumption = setup.world.lifetime_consumption();
    let mean = |ids: &[HumanId]| -> f64 {
        if ids.is_empty() {
            return 0.0;
        }
        let sum: u128 = ids
            .iter()
            .map(|id| consumption.get(id).copied().unwrap_or(0))
            .sum();
        sum as f64 / ids.len() as f64
    };
    let autarky_mean = mean(&setup.autarky_ids);
    let trader_mean = mean(&setup.trader_ids);
    let ratio = if autarky_mean > 0.0 {
        trader_mean / autarky_mean
    } else {
        f64::INFINITY
    };
    M1Result {
        autarky_mean,
        trader_mean,
        ratio,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// M1 合格基準: 交易 brain の生涯消費 ÷ 自給自足 brain の生涯消費 > 1.0 が
    /// 複数シードで安定して成立する（docs/PLAN.md）。
    #[test]
    fn trade_beats_autarky_across_seeds() {
        for seed in 1..=5 {
            let r = run_m1(seed, 5, 60, WorldParams::default());
            assert!(
                r.ratio > 1.0,
                "seed {seed}: ratio {:.3} (trader {:.0} vs autarky {:.0})",
                r.ratio,
                r.trader_mean,
                r.autarky_mean
            );
        }
    }

    /// 交易あり世界でも決定論・保存則が保たれる
    #[test]
    fn m1_world_is_deterministic_and_conservative() {
        let mut hashes = Vec::new();
        for _ in 0..2 {
            let mut s = build_m1(42, 5, WorldParams::default());
            let before = s.world.composition_totals();
            for _ in 0..240 {
                s.world.step(&mut s.brains);
                assert_eq!(
                    before,
                    s.world.composition_totals(),
                    "month {}",
                    s.world.month
                );
                assert!(s.world.space_used_total() <= s.world.params.total_space);
            }
            hashes.push(s.world.state_hash());
        }
        assert_eq!(hashes[0], hashes[1]);
    }
}
