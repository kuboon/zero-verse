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
        Decision {
            acts,
            orders: vec![],
            memory: None,
            fuel_used: 0,
        }
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
        Decision {
            acts,
            orders: vec![],
            memory: None,
            fuel_used: 0,
        }
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

// ---------------------------------------------------------------------------
// M2: 貨幣は創発するか（docs/PLAN.md M2）
//
// セットアップ: human k は specialty = k%5 を高熟練で採り、edible = (k+2)%5 しか
// 食べられない。+2 シフトにより**直接の двой方向一致（欲望の二重の一致）が存在しない**:
// 全ての交換は媒介 resource を経由するしかない。
//
// market brain は媒介 M を自力で選ぶ:
// 1. 最初の OBS ヶ月、初期保有の候補 resource（食料・specialty 以外）を放置して
//    劣化を観測し、**最も残った（= 劣化が遅い）resource** を M の初期候補にする。
// 2. 市場が開いたら、公開気配の厚み（板の総量）を観測し、自分の M より 2 倍厚い
//    resource があればそちらに乗り換える（メンガーの正のフィードバック）。
// 貨幣を指名する world 側の仕組みは存在しない。
// ---------------------------------------------------------------------------

/// M2 の market brain。
pub struct MarketBrain {
    pub edible: ResourceId,
    pub specialty: ResourceId,
    pub eat_skill: SkillId,
    pub harvest_skill: SkillId,
    pub obs_months: u32,
    // 観測状態（ネイティブ brain の内部状態。wasm 版では memory blob に載せる）
    candidates: Vec<(ResourceId, Qty)>, // 初回 snapshot の (候補, 初期量)
    medium: Option<ResourceId>,
}

impl MarketBrain {
    pub fn new(
        edible: ResourceId,
        specialty: ResourceId,
        eat_skill: SkillId,
        harvest_skill: SkillId,
    ) -> Self {
        MarketBrain {
            edible,
            specialty,
            eat_skill,
            harvest_skill,
            obs_months: 6,
            candidates: Vec::new(),
            medium: None,
        }
    }
}

impl Brain for MarketBrain {
    fn decide(&mut self, snap: &Snapshot) -> Decision {
        use crate::brain::StandingOrder;

        // 初回: 媒介候補（食料・specialty 以外の保有）と初期量を記録
        if snap.now == 0 && self.candidates.is_empty() {
            self.candidates = snap
                .resources
                .iter()
                .filter(|&&(r, _)| r != self.edible && r != self.specialty)
                .copied()
                .collect();
        }

        // 劣化観測が済んだら、最も残っている候補（= 貯蔵性が高い）を媒介に選ぶ
        if self.medium.is_none() && snap.now >= self.obs_months {
            self.medium = self
                .candidates
                .iter()
                .map(|&(r, init)| {
                    let now = held(snap, r);
                    // 残存率（1/1000）。init==0 は候補外
                    let survival = if init == 0 {
                        0
                    } else {
                        (now as u128 * 1000 / init as u128) as u64
                    };
                    (survival, u64::MAX - r, r) // 残存率降順、tie は id 昇順
                })
                .max()
                .map(|(_, _, r)| r);
        }

        // 板の厚み feedback（メンガーの正のフィードバック）:
        // 公開気配に現れる任意の resource のうち、自分の媒介より 2 倍厚いものへ乗り換える。
        // 乗り換え先が自分の食料・特産でも構わない（縮退した注文は出ないだけ）
        if let Some(current) = self.medium {
            let depth = |r: ResourceId| -> u128 {
                snap.market
                    .iter()
                    .map(|q| {
                        let mut d = 0u128;
                        if q.give_resource == r {
                            d += q.give_amount as u128;
                        }
                        if q.want_resource == r {
                            d += q.want_amount as u128;
                        }
                        d
                    })
                    .sum()
            };
            let cur_depth = depth(current);
            let mut seen: Vec<ResourceId> = snap
                .market
                .iter()
                .flat_map(|q| [q.give_resource, q.want_resource])
                .collect();
            seen.sort_unstable();
            seen.dedup();
            // 全員が同じ公開気配を見るので、素朴な argmax でも一斉に同じ結論になり
            // 正のフィードバックが閉じる（tie は id 昇順で決定論的）
            let best = seen.into_iter().map(|r| (depth(r), u64::MAX - r, r)).max();
            if let Some((best_depth, _, best_r)) = best {
                if best_r != current && best_depth > cur_depth {
                    self.medium = Some(best_r);
                }
            }
        }

        // act: 採取して食べる。媒介決定後は不要品を捨てる
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
        if let Some(m) = self.medium {
            acts.extend(discard_junk(snap, &[self.edible, self.specialty, m], 2));
        }

        // orders: specialty → M、M → edible（1:1 の素朴な指値。板が価格を作るのは後续）
        let mut orders = Vec::new();
        if let Some(m) = self.medium {
            let spec_held = held(snap, self.specialty);
            if spec_held > 0 {
                orders.push(StandingOrder::Limit {
                    give_resource: self.specialty,
                    give_amount: spec_held,
                    want_resource: m,
                    want_amount: spec_held,
                    partial: true,
                });
            }
            let m_held = held(snap, m);
            if m_held > 0 {
                orders.push(StandingOrder::Limit {
                    give_resource: m,
                    give_amount: m_held,
                    want_resource: self.edible,
                    want_amount: m_held,
                    partial: true,
                });
            }
        }

        Decision {
            acts,
            orders,
            memory: None,
            fuel_used: 0,
        }
    }
}

pub struct M2Setup {
    pub world: World,
    pub brains: BTreeMap<HumanId, Box<dyn Brain>>,
}

/// M2 実験世界: 20 human、+2 シフト賦存（直接交換の двой重一致なし）。
pub fn build_m2(seed: u64, params: WorldParams) -> M2Setup {
    let n_humans = 20;
    let mut world = World::new(seed, n_humans, params);
    let ids: Vec<HumanId> = world.humans.keys().copied().collect();
    let mut brains: BTreeMap<HumanId, Box<dyn Brain>> = BTreeMap::new();

    for (k, &hid) in ids.iter().enumerate() {
        let specialty = k % N_PRIMARY;
        let edible = (k + 2) % N_PRIMARY;
        world.grant_skill(hid, N_PRIMARY + edible, STAT_MAX); // E_edible
        world.grant_skill(hid, specialty, STAT_MAX); // H_specialty
        let rid = |p: usize| world.laws.id_of_index[p];
        let sid = |s: usize| world.laws.skill_id_of_index[s];
        brains.insert(
            hid,
            Box::new(MarketBrain::new(
                rid(edible),
                rid(specialty),
                sid(N_PRIMARY + edible),
                sid(specialty),
            )),
        );
    }

    M2Setup { world, brains }
}

pub struct M2Result {
    /// resource（全 10 種）ごとの (取引関与率 1/1000, 劣化率 λ‰)。
    /// 関与率 = その resource を含む約定 / 全約定
    pub involvement: Vec<(u64, u64)>,
    /// 最も関与率の高い resource の内部 index
    pub top: usize,
    /// top の関与率（1/1000）
    pub top_share: u64,
    /// top の λ が全 resource 中で何番目に低いか（0 = 最も貯蔵性が高い）
    pub top_lambda_rank: usize,
}

/// M2 実験: 取引が特定 resource に集中するか（貨幣の創発）。
pub fn run_m2(seed: u64, years: u32, params: WorldParams) -> M2Result {
    use crate::laws::N_RESOURCES;
    let mut setup = build_m2(seed, params);
    let months = years * setup.world.params.months_per_year;
    setup.world.run(months, &mut setup.brains);

    let total: u64 = (0..N_RESOURCES)
        .map(|i| setup.world.trade_volume.get(&i).copied().unwrap_or(0))
        .sum::<u64>()
        / 2; // 1 約定は 2 resource を含む
    let involvement: Vec<(u64, u64)> = (0..N_RESOURCES)
        .map(|i| {
            let v = setup.world.trade_volume.get(&i).copied().unwrap_or(0);
            let share = (v * 1000).checked_div(total).unwrap_or(0);
            (share, setup.world.laws.specs[i].decay_permille)
        })
        .collect();
    let top = involvement
        .iter()
        .enumerate()
        .max_by_key(|(_, &(s, _))| s)
        .map(|(i, _)| i)
        .unwrap_or(0);
    let top_share = involvement[top].0;
    let mut lambdas: Vec<u64> = involvement.iter().map(|&(_, l)| l).collect();
    lambdas.sort_unstable();
    let top_lambda_rank = lambdas
        .iter()
        .position(|&l| l == involvement[top].1)
        .unwrap_or(N_RESOURCES);

    M2Result {
        involvement,
        top,
        top_share,
        top_lambda_rank,
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

    /// M2 合格基準: 取引が特定の一つの resource を経由する間接交換に集中し（貨幣の創発）、
    /// 選ばれる resource が劣化率 λ（貯蔵性）と整合する（docs/PLAN.md）。
    ///
    /// 「整合」の定式化: 選ばれた媒介の λ が、最も貯蔵性の高い primary の λ 以下。
    /// シードによっては λ=0 の**廃棄物**が媒介に選ばれる（腐らないが無価値 —
    /// 貝殻貨幣・不換紙幣と同型の創発。貯蔵性原理そのもの）。
    #[test]
    fn money_emerges_and_matches_storability() {
        for seed in 1..=3 {
            let r = run_m2(seed, 20, WorldParams::default());
            assert!(
                r.top_share > 900,
                "seed {seed}: top involvement {}/1000 (media did not converge): {:?}",
                r.top_share,
                r.involvement
            );
            let min_primary_lambda = r.involvement[..crate::laws::N_PRIMARY]
                .iter()
                .map(|&(_, l)| l)
                .min()
                .unwrap();
            let top_lambda = r.involvement[r.top].1;
            assert!(
                top_lambda <= min_primary_lambda,
                "seed {seed}: medium lambda {top_lambda} > best primary {min_primary_lambda}: {:?}",
                r.involvement
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
