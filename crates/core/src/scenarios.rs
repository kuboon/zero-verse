//! M1 シナリオ: 交易は自給自足に勝つか（pages/content/docs/plan.md M1）。
//!
//! セットアップ:
//! - human は「食べられる primary（食文化 E_edible）」と「高熟練の harvest（H_specialty）」
//!   を持ち、**specialty ≠ edible**（賦存のミスマッチ）。自分の食料の harvest は低熟練。
//! - 自給自足 brain: 低熟練で自分の食料を採り、食べる。
//! - 交易 brain: 高熟練で specialty を採り、補完的なパートナー（相手の edible = 自分の
//!   specialty）と give で交換して食べる。
//! - 生涯消費 = 食事の Δg 総和（pages/content/docs/scoring.md）。比 > 1.0 が M1 合格基準。
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

        // 交易ペアは初期知人（world 生成の初期知人グラフ → pages/content/docs/world.md）
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

/// M1 の集計（run_m1 と ExperimentSession が共有）。
fn m1_result(world: &World, autarky_ids: &[HumanId], trader_ids: &[HumanId]) -> M1Result {
    let consumption = world.lifetime_consumption();
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
    let autarky_mean = mean(autarky_ids);
    let trader_mean = mean(trader_ids);
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

/// M1 実験を回して生涯消費比を測る。
pub fn run_m1(seed: u64, n_pairs: usize, years: u32, params: WorldParams) -> M1Result {
    let mut setup = build_m1(seed, n_pairs, params);
    let months = years * setup.world.params.months_per_year;
    setup.world.run(months, &mut setup.brains);
    m1_result(&setup.world, &setup.autarky_ids, &setup.trader_ids)
}

// ---------------------------------------------------------------------------
// M2: 貨幣は創発するか（pages/content/docs/plan.md M2）
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

/// M2 の集計（run_m2 と ExperimentSession が共有）。
fn m2_result(world: &World) -> M2Result {
    use crate::laws::N_RESOURCES;
    let total: u64 = (0..N_RESOURCES)
        .map(|i| world.trade_volume.get(&i).copied().unwrap_or(0))
        .sum::<u64>()
        / 2; // 1 約定は 2 resource を含む
    let involvement: Vec<(u64, u64)> = (0..N_RESOURCES)
        .map(|i| {
            let v = world.trade_volume.get(&i).copied().unwrap_or(0);
            let share = (v * 1000).checked_div(total).unwrap_or(0);
            (share, world.laws.specs[i].decay_permille)
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

/// M2 実験: 取引が特定 resource に集中するか（貨幣の創発）。
pub fn run_m2(seed: u64, years: u32, params: WorldParams) -> M2Result {
    let mut setup = build_m2(seed, params);
    let months = years * setup.world.params.months_per_year;
    setup.world.run(months, &mut setup.brains);
    m2_result(&setup.world)
}

// ---------------------------------------------------------------------------
// M3: skill の売買は自発するか（pages/content/docs/plan.md M3）
//
// セットアップ: 教師 2 人（H_0 高熟練）と徒弟 4 人（harvest skill なし）。
// 徒弟は初期食料が尽きる前に H_0 を習得する必要があり、教育の対価を
// if-taught-me（「今月教育が進捗したら支払う」）の月払いで支払う。
// world 側に授業料も契約も存在しない。徒弟制はホールドアップ問題への brain の適応。
//
// 秘匿 vs 公開: open 教師は余剰食料を板で売る → 売りに出た resource は
// それを作る skill を確率的に漏らす（リバースエンジニアリング）。
// secret 教師は売らない → 漏れない（教える相手からしか広がらない）。
// ---------------------------------------------------------------------------

/// 教師 brain: 自分の skill を月払いの徒弟に教える。教えたのに払われなければ破門。
pub struct TeacherBrain {
    pub skill: SkillId,
    pub harvest_skill: SkillId, // = skill（食料生産と教材が同じ H_0）
    pub eat_skill: SkillId,
    pub food: ResourceId,
    pub fee_resource: ResourceId,
    pub fee_amount: Qty,
    /// 板で余剰食料を売るか（公開戦略）。売れば skill が漏れる
    pub sell_product: bool,
    roster: Vec<HumanId>,
    current: usize,
    taught_last_month: Option<HumanId>,
}

impl TeacherBrain {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        skill: SkillId,
        eat_skill: SkillId,
        food: ResourceId,
        fee_resource: ResourceId,
        fee_amount: Qty,
        sell_product: bool,
        roster: Vec<HumanId>,
    ) -> Self {
        TeacherBrain {
            skill,
            harvest_skill: skill,
            eat_skill,
            food,
            fee_resource,
            fee_amount,
            sell_product,
            roster,
            current: 0,
            taught_last_month: None,
        }
    }
}

impl Brain for TeacherBrain {
    fn decide(&mut self, snap: &Snapshot) -> Decision {
        use crate::brain::{Event, StandingOrder};

        // 先月教えた相手の支払いを確認。教えたのに払われなければ破門（次の徒弟へ）。
        // 進捗イベントが無ければ修了（または不成立）なので同じく次へ。
        if let Some(student) = self.taught_last_month.take() {
            let progressed = snap.events.iter().any(
                |e| matches!(e, Event::TeachProgressed { partner, .. } if *partner == student),
            );
            let paid = snap
                .events
                .iter()
                .any(|e| matches!(e, Event::ReceivedTransfer { from, resource, amount }
                    if *from == student && *resource == self.fee_resource && *amount >= self.fee_amount));
            if !progressed || !paid {
                self.current += 1; // 修了 or 不払い: 次の徒弟へ
            }
        }

        let mut acts = vec![
            Act::Invoke {
                inputs: vec![],
                using_skills: vec![self.harvest_skill],
            },
            Act::Invoke {
                inputs: vec![(self.food, QTY_SCALE)], // 必要分だけ食べ、余剰は売る
                using_skills: vec![self.eat_skill],
            },
        ];
        if let Some(&student) = self.roster.get(self.current % self.roster.len().max(1)) {
            acts.push(Act::Teach {
                student,
                skill: self.skill,
            });
            self.taught_last_month = Some(student);
        }
        acts.extend(discard_junk(snap, &[self.food, self.fee_resource], 1));

        let mut orders = Vec::new();
        if self.sell_product {
            let surplus = held(snap, self.food).saturating_sub(2 * QTY_SCALE);
            if surplus > 0 {
                orders.push(StandingOrder::Limit {
                    give_resource: self.food,
                    give_amount: surplus,
                    want_resource: self.fee_resource,
                    want_amount: surplus,
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

/// 徒弟 brain: 習得まで learn + if-taught-me の月払い。習得後は自活する。
pub struct ApprenticeBrain {
    pub teacher: HumanId,
    pub skill: SkillId,
    pub eat_skill: SkillId,
    pub food: ResourceId,
    pub fee_resource: ResourceId,
    pub fee_amount: Qty,
}

impl Brain for ApprenticeBrain {
    fn decide(&mut self, snap: &Snapshot) -> Decision {
        use crate::brain::{GiveCondition, StandingOrder};
        let acquired = snap.skills.iter().any(|&(s, _)| s == self.skill);
        let mut acts = Vec::new();
        let mut orders = Vec::new();

        if acquired {
            acts.push(Act::Invoke {
                inputs: vec![],
                using_skills: vec![self.skill],
            });
        } else {
            acts.push(Act::Learn {
                teacher: self.teacher,
                skill: self.skill,
            });
            // 徒弟制: 「今月教育が進捗したら支払う」— 月単位のアトミック性だけが担保
            orders.push(StandingOrder::ConditionalGive {
                to: self.teacher,
                resource: self.fee_resource,
                amount: self.fee_amount,
                condition: GiveCondition::IfTaughtMe(self.skill),
            });
        }
        // 食いつなぎ（節約: health が下がったときだけ食べる）
        if snap.health < 90 * QTY_SCALE && held(snap, self.food) > 0 {
            acts.push(Act::Invoke {
                inputs: vec![(self.food, QTY_SCALE)],
                using_skills: vec![self.eat_skill],
            });
        }
        acts.extend(discard_junk(snap, &[self.food, self.fee_resource], 1));

        Decision {
            acts,
            orders,
            memory: None,
            fuel_used: 0,
        }
    }
}

pub struct M3Setup {
    pub world: World,
    pub brains: BTreeMap<HumanId, Box<dyn Brain>>,
    pub teacher_ids: Vec<HumanId>,
    pub apprentice_ids: Vec<HumanId>,
    /// H_0 の内部 skill index（習得判定用）
    pub skill_idx: usize,
}

/// M3 実験世界: 教師 2 + 徒弟 4。secret=true なら教師は板で売らない（秘匿戦略）。
pub fn build_m3(seed: u64, secret: bool, params: WorldParams) -> M3Setup {
    let mut world = World::new(seed, 6, params);
    let ids: Vec<HumanId> = world.humans.keys().copied().collect();
    let (teachers, apprentices) = (&ids[..2], &ids[2..]);

    let rid = |w: &World, p: usize| w.laws.id_of_index[p];
    let sid = |w: &World, s: usize| w.laws.skill_id_of_index[s];

    // 全員 E_0（食文化は共通）。教師だけ H_0 を持つ。
    for &hid in &ids {
        world.grant_skill(hid, N_PRIMARY, STAT_MAX); // E_0
    }
    for &t in teachers {
        world.grant_skill(t, 0, STAT_MAX); // H_0
    }
    // 教師と徒弟は初期知人（徒弟 2 人ずつ）
    for (i, &a) in apprentices.iter().enumerate() {
        world.add_acquaintance(teachers[i % 2], a);
    }

    let food = rid(&world, 0);
    let fee = rid(&world, 3);
    let skill = sid(&world, 0);
    let eat = sid(&world, N_PRIMARY);
    let fee_amount = QTY_SCALE; // 1.000 / 月

    let mut brains: BTreeMap<HumanId, Box<dyn Brain>> = BTreeMap::new();
    for (i, &t) in teachers.iter().enumerate() {
        let roster: Vec<HumanId> = apprentices
            .iter()
            .enumerate()
            .filter(|(j, _)| j % 2 == i)
            .map(|(_, &a)| a)
            .collect();
        brains.insert(
            t,
            Box::new(TeacherBrain::new(
                skill, eat, food, fee, fee_amount, !secret, roster,
            )),
        );
    }
    for &a in apprentices {
        let teacher = teachers[apprentices.iter().position(|&x| x == a).unwrap() % 2];
        brains.insert(
            a,
            Box::new(ApprenticeBrain {
                teacher,
                skill,
                eat_skill: eat,
                food,
                fee_resource: fee,
                fee_amount,
            }),
        );
    }

    M3Setup {
        world,
        brains,
        teacher_ids: teachers.to_vec(),
        apprentice_ids: apprentices.to_vec(),
        skill_idx: 0,
    }
}

pub struct M3Result {
    pub apprentices_with_skill: usize,
    pub apprentices_total: usize,
    pub paid_teach_transfers: u64,
    pub re_acquisitions: u64,
    pub alive: usize,
}

/// M3 の集計（run_m3 と ExperimentSession が共有）。
fn m3_result(world: &World, apprentice_ids: &[HumanId], skill_idx: usize) -> M3Result {
    let with_skill = apprentice_ids
        .iter()
        .filter(|id| {
            world
                .humans
                .get(id)
                .map(|h| h.skills.contains_key(&skill_idx))
                .unwrap_or(false)
        })
        .count();
    M3Result {
        apprentices_with_skill: with_skill,
        apprentices_total: apprentice_ids.len(),
        paid_teach_transfers: world.paid_teach_transfers,
        re_acquisitions: world.re_acquisitions,
        alive: world.humans.len(),
    }
}

/// M3 実験を回す。
pub fn run_m3(seed: u64, secret: bool, years: u32, params: WorldParams) -> M3Result {
    let mut setup = build_m3(seed, secret, params);
    let months = years * setup.world.params.months_per_year;
    setup.world.run(months, &mut setup.brains);
    m3_result(&setup.world, &setup.apprentice_ids, setup.skill_idx)
}

// ---------------------------------------------------------------------------
// M4: 血縁は投資行動に現れるか（pages/content/docs/plan.md M4）
//
// world 側に家族という概念は無い。あるのは親密度（公理 10）と出産の観測非対称だけ。
// - 夫婦: 月次の贈与が親密度を積み、相対親密度が相互 50% を超えると conceive が自動発生
// - 母は child-born で子を確実に知る。父は「0 歳の知人が現れた」から推測する
// - 親は子に無償で teach する（血縁投資）。子の認識は brain の状態にだけ存在する
// - 出産後は母の親密度ポートフォリオが子に傾き、夫への相対親密度が薄まって
//   出産間隔が自然に空く（子への愛情が避妊になる）
// ---------------------------------------------------------------------------

/// 成人の家族 brain: 自活しつつ、配偶者に贈与し、知っている子に無償で教える。
pub struct FamilyBrain {
    pub edible: ResourceId,
    pub harvest_skill: SkillId,
    pub eat_skill: SkillId,
    pub partner: Option<HumanId>,
    children: Vec<HumanId>,
    known_acquaintances: Vec<HumanId>,
    teach_cursor: usize,
}

impl FamilyBrain {
    pub fn new(
        edible: ResourceId,
        harvest_skill: SkillId,
        eat_skill: SkillId,
        partner: Option<HumanId>,
    ) -> Self {
        FamilyBrain {
            edible,
            harvest_skill,
            eat_skill,
            partner,
            children: Vec::new(),
            known_acquaintances: Vec::new(),
            teach_cursor: 0,
        }
    }
}

impl Brain for FamilyBrain {
    fn decide(&mut self, snap: &Snapshot) -> Decision {
        use crate::brain::Event;

        // 母: child-born で確実に知る。父: 新しく現れた知人（配偶者以外）を子と推測する
        //（父性不確実性: ε 出会いの新知人を我が子と誤認しうる。それが仕様）
        for ev in &snap.events {
            if let Event::ChildBorn(c) = ev {
                if !self.children.contains(c) {
                    self.children.push(*c);
                }
            }
        }
        for a in snap.acquaintances.iter().map(|v| v.id) {
            if !self.known_acquaintances.contains(&a) {
                if !self.known_acquaintances.is_empty()
                    && Some(a) != self.partner
                    && !self.children.contains(&a)
                {
                    self.children.push(a);
                }
                self.known_acquaintances.push(a);
            }
        }
        if self.known_acquaintances.is_empty() {
            self.known_acquaintances = snap.acquaintances.iter().map(|v| v.id).collect();
        }

        let mut acts = vec![
            Act::Invoke {
                inputs: vec![],
                using_skills: vec![self.harvest_skill],
            },
            Act::Invoke {
                inputs: vec![(self.edible, QTY_SCALE)],
                using_skills: vec![self.eat_skill],
            },
        ];

        // 贈与: 子がいれば子への給餌を優先（食文化は母系 → 自分の edible を渡す）。
        // いなければ配偶者への求愛贈与。偶数月は贈与、奇数月は片付け。
        if snap.now.is_multiple_of(2) {
            let target = if self.children.is_empty() {
                self.partner
            } else {
                Some(self.children[(snap.now as usize / 2) % self.children.len()])
            };
            if let Some(to) = target {
                if held(snap, self.edible) > QTY_SCALE {
                    acts.push(Act::Give {
                        to,
                        resource: self.edible,
                        amount: QTY_SCALE,
                    });
                }
            }
        } else {
            acts.extend(discard_junk(snap, &[self.edible], 1));
        }

        // 血縁投資: 知っている子に無償で teach（対価は求めない）
        if !self.children.is_empty() {
            let child = self.children[self.teach_cursor % self.children.len()];
            self.teach_cursor += 1;
            acts.push(Act::Teach {
                student: child,
                skill: self.harvest_skill,
            });
        }

        Decision {
            acts,
            orders: vec![],
            memory: None,
            fuel_used: 0,
        }
    }
}

/// 0〜6歳の baby brain（world 提供の共通 brain に相当）。もらった食料を食べるだけ。
pub struct BabyBrain {
    pub edible: ResourceId,
    pub eat_skill: SkillId,
}

impl Brain for BabyBrain {
    fn decide(&mut self, snap: &Snapshot) -> Decision {
        let mut acts = Vec::new();
        if snap.health < 90 * QTY_SCALE && held(snap, self.edible) > 0 {
            acts.push(Act::Invoke {
                inputs: vec![(self.edible, QTY_SCALE)],
                using_skills: vec![self.eat_skill],
            });
        }
        Decision {
            acts,
            orders: vec![],
            memory: None,
            fuel_used: 0,
        }
    }
}

/// 6〜18歳の子 brain: 両親から learn し、習得後は自活する。
pub struct KidBrain {
    pub mother: HumanId,
    pub father: HumanId,
    pub mother_skill: SkillId,
    pub father_skill: SkillId,
    pub edible: ResourceId,
    pub eat_skill: SkillId,
}

impl Brain for KidBrain {
    fn decide(&mut self, snap: &Snapshot) -> Decision {
        let has = |s: SkillId| snap.skills.iter().any(|&(k, _)| k == s);
        let mut acts = Vec::new();
        if has(self.mother_skill) {
            acts.push(Act::Invoke {
                inputs: vec![],
                using_skills: vec![self.mother_skill],
            });
        } else {
            acts.push(Act::Learn {
                teacher: self.mother,
                skill: self.mother_skill,
            });
        }
        if !has(self.father_skill) {
            acts.push(Act::Learn {
                teacher: self.father,
                skill: self.father_skill,
            });
        }
        if snap.health < 90 * QTY_SCALE && held(snap, self.edible) > 0 {
            acts.push(Act::Invoke {
                inputs: vec![(self.edible, QTY_SCALE)],
                using_skills: vec![self.eat_skill],
            });
        }
        acts.extend(discard_junk(snap, &[self.edible], 1));
        Decision {
            acts,
            orders: vec![],
            memory: None,
            fuel_used: 0,
        }
    }
}

pub struct M4Result {
    pub births: u64,
    pub population: usize,
    pub deaths: u64,
    /// 近親（親子・きょうだい）ペアからの出生数（刷り込みが効いていれば 0）
    pub incest_births: u64,
    /// 8 歳以上で harvest skill を持つ子 / 8 歳以上の子（血縁経由の技能伝達）
    pub kids_taught: (usize, usize),
    pub imprinted_pairs: usize,
    /// 母から子への投資の総計（一方的贈与の qty, teach 進捗月数）
    pub mother_invest: (Qty, u64),
    /// 父（と信じる側）から子への投資の総計
    pub father_invest: (Qty, u64),
}

/// 家族系シナリオの共通ハーネス。毎月 step し、
/// 新生児 → baby brain（食文化は母から）、6 歳 → kid brain（両親から learn）、
/// 18 歳 → 自活成人、の切替を行う。
fn run_family_loop(
    world: &mut World,
    brains: &mut BTreeMap<HumanId, Box<dyn Brain>>,
    edible_of: &mut BTreeMap<HumanId, usize>,
    months: u32,
) {
    for _ in 0..months {
        world.step(brains);
        family_transition_step(world, brains, edible_of);
    }
}

/// 家族系ハーネスの月末遷移（run_family_loop と ExperimentSession が共有）。
fn family_transition_step(
    world: &mut World,
    brains: &mut BTreeMap<HumanId, Box<dyn Brain>>,
    edible_of: &mut BTreeMap<HumanId, usize>,
) {
    {
        // 新生児に baby brain を割り当てる（食文化は母から: 生得の eat skill と一致）
        let newborns: Vec<HumanId> = world
            .humans
            .keys()
            .copied()
            .filter(|id| !brains.contains_key(id))
            .collect();
        for c in newborns {
            let (mother, _) = world.parentage[&c];
            let e = edible_of[&mother];
            edible_of.insert(c, e);
            let rid = world.laws.id_of_index[e];
            let es = world.laws.skill_id_of_index[N_PRIMARY + e];
            brains.insert(
                c,
                Box::new(BabyBrain {
                    edible: rid,
                    eat_skill: es,
                }),
            );
        }

        // 6 歳: brain 継承（kid へ切替）。18 歳: 成人（自活。第二世代は独身のまま）
        let transitions: Vec<(HumanId, u32)> = world
            .humans
            .iter()
            .filter(|(id, _)| world.parentage.contains_key(id))
            .map(|(&id, h)| (id, h.age_months))
            .collect();
        for (id, age) in transitions {
            let (mother, father) = world.parentage[&id];
            let e = edible_of[&id];
            let rid = world.laws.id_of_index[e];
            let es = world.laws.skill_id_of_index[N_PRIMARY + e];
            if age == 6 * 12 {
                let ms = world.laws.skill_id_of_index[edible_of.get(&mother).copied().unwrap_or(e)];
                let fs = world.laws.skill_id_of_index[edible_of.get(&father).copied().unwrap_or(e)];
                brains.insert(
                    id,
                    Box::new(KidBrain {
                        mother,
                        father,
                        mother_skill: ms,
                        father_skill: fs,
                        edible: rid,
                        eat_skill: es,
                    }),
                );
            } else if age == 18 * 12 {
                let hs = world.laws.skill_id_of_index[e];
                brains.insert(id, Box::new(FamilyBrain::new(rid, hs, es, None)));
            }
        }
    }
}

pub struct M4Setup {
    pub world: World,
    pub brains: BTreeMap<HumanId, Box<dyn Brain>>,
    pub edible_of: BTreeMap<HumanId, usize>,
    /// 初期成人の役割ラベル（ビューワの凡例用）
    pub roles: BTreeMap<HumanId, &'static str>,
}

/// M4 実験世界: 夫婦 6 組。ハーネス（run_family_loop / ExperimentSession）が
/// 6 歳（baby → kid）と 18 歳（kid → adult）で brain を切り替える。
pub fn build_m4(seed: u64, params: WorldParams) -> M4Setup {
    let n_adults = 12;
    let mut world = World::new(seed, n_adults, params);
    let ids: Vec<HumanId> = world.humans.keys().copied().collect();

    // 性別で分けて夫婦を作る（conceive は異性ペアのみ）
    let females: Vec<HumanId> = ids
        .iter()
        .copied()
        .filter(|id| world.humans[id].sex == crate::state::Sex::Female)
        .collect();
    let males: Vec<HumanId> = ids
        .iter()
        .copied()
        .filter(|id| world.humans[id].sex == crate::state::Sex::Male)
        .collect();

    let mut brains: BTreeMap<HumanId, Box<dyn Brain>> = BTreeMap::new();
    // 各人の食文化（edible）記録: 子は母の edible を継ぐ
    let mut edible_of: BTreeMap<HumanId, usize> = BTreeMap::new();

    for (k, &hid) in ids.iter().enumerate() {
        let e = k % N_PRIMARY;
        edible_of.insert(hid, e);
        world.grant_skill(hid, N_PRIMARY + e, STAT_MAX); // E_e
        world.grant_skill(hid, e, STAT_MAX); // H_e
    }
    let mut roles: BTreeMap<HumanId, &'static str> = BTreeMap::new();
    for (i, (&f, &m)) in females.iter().zip(males.iter()).enumerate() {
        let _ = i;
        world.add_acquaintance(f, m);
        for &(hid, partner) in &[(f, m), (m, f)] {
            let e = edible_of[&hid];
            let rid = world.laws.id_of_index[e];
            let hs = world.laws.skill_id_of_index[e];
            let es = world.laws.skill_id_of_index[N_PRIMARY + e];
            brains.insert(hid, Box::new(FamilyBrain::new(rid, hs, es, Some(partner))));
            roles.insert(hid, "夫婦");
        }
    }
    // あぶれた性別の人は独身の自活 brain
    for &hid in females
        .iter()
        .skip(males.len())
        .chain(males.iter().skip(females.len()))
    {
        let e = edible_of[&hid];
        let rid = world.laws.id_of_index[e];
        let hs = world.laws.skill_id_of_index[e];
        let es = world.laws.skill_id_of_index[N_PRIMARY + e];
        brains.insert(hid, Box::new(FamilyBrain::new(rid, hs, es, None)));
        roles.insert(hid, "独身");
    }

    M4Setup {
        world,
        brains,
        edible_of,
        roles,
    }
}

/// M4 の集計（run_m4 と ExperimentSession が共有）。
fn m4_result(world: &World) -> M4Result {
    let is_kin = |a: HumanId, b: HumanId| -> bool {
        let pa = world.parentage.get(&a);
        let pb = world.parentage.get(&b);
        // 親子
        if pa.map(|&(m, f)| m == b || f == b).unwrap_or(false)
            || pb.map(|&(m, f)| m == a || f == a).unwrap_or(false)
        {
            return true;
        }
        // きょうだい（親を共有）
        if let (Some(&(ma, fa)), Some(&(mb, fb))) = (pa, pb) {
            return ma == mb || fa == fb;
        }
        false
    };
    let incest_births = world
        .parentage
        .values()
        .filter(|&&(m, f)| is_kin(m, f))
        .count() as u64;
    let kids: Vec<HumanId> = world
        .humans
        .keys()
        .copied()
        .filter(|id| world.parentage.contains_key(id))
        .filter(|id| world.humans[id].age_months >= 8 * 12)
        .collect();
    let taught = kids
        .iter()
        .filter(|id| {
            world.humans[id]
                .skills
                .keys()
                .any(|&k| matches!(world.laws.skills[k], crate::laws::SkillKind::Harvest(_)))
        })
        .count();

    // 母 vs 父の投資差（血縁投資台帳を親の役割で集計）
    let mut mother_invest = (0u64, 0u64);
    let mut father_invest = (0u64, 0u64);
    for (&(p, c), &(gives, teach_months)) in &world.parental_investment {
        let (m, f) = world.parentage[&c];
        let tgt = if p == m {
            &mut mother_invest
        } else if p == f {
            &mut father_invest
        } else {
            continue;
        };
        tgt.0 += gives;
        tgt.1 += teach_months;
    }

    M4Result {
        births: world.births,
        population: world.humans.len(),
        deaths: world.deaths,
        incest_births,
        kids_taught: (taught, kids.len()),
        imprinted_pairs: world.imprinted.len(),
        mother_invest,
        father_invest,
    }
}

/// M4 実験: 夫婦 6 組から始め、出生・継承・血縁投資を観測する。
pub fn run_m4(seed: u64, years: u32, params: WorldParams) -> M4Result {
    let mut setup = build_m4(seed, params);
    let months = years * setup.world.params.months_per_year;
    run_family_loop(
        &mut setup.world,
        &mut setup.brains,
        &mut setup.edible_of,
        months,
    );
    m4_result(&setup.world)
}

// ---------------------------------------------------------------------------
// M4 派生実験 1: 同族内婚は不利か（pages/content/docs/plan.md M4 持ち越し）
//
// 2 つの氏族（clan）に別々の食文化と harvest 技能を持たせる。
// - 同族内婚（endogamy）: 夫婦とも同じ氏族 → 子に流れる技能は 1 系統
// - 族外婚（exogamy）: 夫婦が別氏族 → 子は母系の食文化 + 両親の harvest 2 系統
// 参加者・夫婦数は両条件で同一（ペアの組み方だけが違う）。
// 計測: 育った子（8 歳以上）1 人あたりの harvest skill 種数と平均生涯消費。
// ---------------------------------------------------------------------------

pub struct ClanResult {
    pub births: u64,
    pub population: usize,
    pub deaths: u64,
    /// 8 歳以上に育った子の数
    pub grown_children: usize,
    /// 育った子 1 人あたりの harvest skill 種数（×1000）
    pub child_harvest_skills_permille: u64,
    /// 育った子の平均生涯消費（1/1000 Δg）
    pub child_mean_consumed: u64,
}

pub struct M4ClansSetup {
    pub world: World,
    pub brains: BTreeMap<HumanId, Box<dyn Brain>>,
    pub edible_of: BTreeMap<HumanId, usize>,
    pub roles: BTreeMap<HumanId, &'static str>,
}

pub fn build_m4_clans(seed: u64, exogamy: bool, params: WorldParams) -> M4ClansSetup {
    let n_adults = 16;
    let mut world = World::new(seed, n_adults, params);
    let ids: Vec<HumanId> = world.humans.keys().copied().collect();

    let females: Vec<HumanId> = ids
        .iter()
        .copied()
        .filter(|id| world.humans[id].sex == crate::state::Sex::Female)
        .collect();
    let males: Vec<HumanId> = ids
        .iter()
        .copied()
        .filter(|id| world.humans[id].sex == crate::state::Sex::Male)
        .collect();

    // ペア数を偶数に揃え、女性 i・男性 i に氏族 i % 2 を割り当てる。
    // 同族内婚は f_i × m_i（同氏族）、族外婚は f_i × m_{i+1}（異氏族）。
    // 参加者集合とペア数は両条件で同一になり、組み方だけが実験変数になる
    let pairs = females.len().min(males.len()) & !1usize;
    let clan_of = |i: usize| i % 2; // 氏族 c の食文化 = primary c

    let mut brains: BTreeMap<HumanId, Box<dyn Brain>> = BTreeMap::new();
    let mut edible_of: BTreeMap<HumanId, usize> = BTreeMap::new();

    // 氏族の技能を賦与（自氏族の harvest / eat のみ）
    let mut setup = |world: &mut World, hid: HumanId, clan: usize| {
        edible_of.insert(hid, clan);
        world.grant_skill(hid, clan, STAT_MAX); // H_clan
        world.grant_skill(hid, N_PRIMARY + clan, STAT_MAX); // E_clan
    };
    for i in 0..pairs {
        setup(&mut world, females[i], clan_of(i));
        setup(&mut world, males[i], clan_of(i));
    }
    // ペア外の成人は独身の自活 brain（氏族 0 とする）
    for &hid in females.iter().skip(pairs).chain(males.iter().skip(pairs)) {
        setup(&mut world, hid, 0);
    }

    let mut roles: BTreeMap<HumanId, &'static str> = BTreeMap::new();
    for i in 0..pairs {
        let f = females[i];
        let m = if exogamy {
            males[(i + 1) % pairs]
        } else {
            males[i]
        };
        world.add_acquaintance(f, m);
        for &(hid, partner) in &[(f, m), (m, f)] {
            let e = edible_of[&hid];
            let rid = world.laws.id_of_index[e];
            let hs = world.laws.skill_id_of_index[e];
            let es = world.laws.skill_id_of_index[N_PRIMARY + e];
            brains.insert(hid, Box::new(FamilyBrain::new(rid, hs, es, Some(partner))));
            roles.insert(
                hid,
                if edible_of[&hid] == 0 {
                    "氏族A"
                } else {
                    "氏族B"
                },
            );
        }
    }
    for &hid in females.iter().skip(pairs).chain(males.iter().skip(pairs)) {
        let e = edible_of[&hid];
        let rid = world.laws.id_of_index[e];
        let hs = world.laws.skill_id_of_index[e];
        let es = world.laws.skill_id_of_index[N_PRIMARY + e];
        brains.insert(hid, Box::new(FamilyBrain::new(rid, hs, es, None)));
        roles.insert(hid, "独身");
    }

    M4ClansSetup {
        world,
        brains,
        edible_of,
        roles,
    }
}

/// 同族内婚/族外婚の集計（run_m4_clans と ExperimentSession が共有）。
fn clan_result(world: &World) -> ClanResult {
    // 集計: 育った子の harvest skill 種数と生涯消費
    let consumption = world.lifetime_consumption();
    let grown: Vec<HumanId> = world
        .humans
        .keys()
        .copied()
        .filter(|id| world.parentage.contains_key(id))
        .filter(|id| world.humans[id].age_months >= 8 * 12)
        .collect();
    let harvest_total: u64 = grown
        .iter()
        .map(|id| {
            world.humans[id]
                .skills
                .keys()
                .filter(|&&k| matches!(world.laws.skills[k], crate::laws::SkillKind::Harvest(_)))
                .count() as u64
        })
        .sum();
    let consumed_total: u128 = grown
        .iter()
        .map(|id| consumption.get(id).copied().unwrap_or(0))
        .sum();
    let n = grown.len() as u64;
    ClanResult {
        births: world.births,
        population: world.humans.len(),
        deaths: world.deaths,
        grown_children: grown.len(),
        child_harvest_skills_permille: harvest_total * 1000 / n.max(1),
        child_mean_consumed: (consumed_total / (n as u128).max(1) / 1000).min(u64::MAX as u128)
            as u64,
    }
}

pub fn run_m4_clans(seed: u64, exogamy: bool, years: u32, params: WorldParams) -> ClanResult {
    let mut setup = build_m4_clans(seed, exogamy, params);
    let months = years * setup.world.params.months_per_year;
    run_family_loop(
        &mut setup.world,
        &mut setup.brains,
        &mut setup.edible_of,
        months,
    );
    clan_result(&setup.world)
}

// ---------------------------------------------------------------------------
// M4 派生実験 2: 婚姻契約は繰り返しゲームとして維持されるか（未決 #7 の判断材料）
//
// world に契約は存在しない。あるのは「贈与 = 親密度の増加」「received-transfer の観測」
// だけ。貞節 brain は**しっぺ返し**で贈与する: 相手からの贈与が K ヶ月途絶えたら
// 自分も止める（許し付き TFT。相手が再開すれば自分も再開する）。
// 浮気 brain は贈与を全知人へ薄く回す。
// 予測: 貞節ペアは相互贈与の均衡（高親密度）を維持して子をもうけ、
// 浮気者は誰とも相対親密度 50% を超えられず子を残せない。
// 「一定以上他人と親密にならない」という婚姻契約が、執行機構なしに
// 相互性の均衡として立ち上がるかを見る。
// ---------------------------------------------------------------------------

/// 貞節 brain（許し付きしっぺ返し）: 配偶者からの贈与が途絶えたら自分の贈与も止める。
pub struct SpouseBrain {
    pub edible: ResourceId,
    pub harvest_skill: SkillId,
    pub eat_skill: SkillId,
    pub partner: HumanId,
    /// 相手からの贈与をこれだけの月数見なかったら協調を止める
    pub patience_months: u32,
    months_since_received: u32,
}

impl Brain for SpouseBrain {
    fn decide(&mut self, snap: &Snapshot) -> Decision {
        use crate::brain::Event;
        let received = snap
            .events
            .iter()
            .any(|ev| matches!(ev, Event::ReceivedTransfer { from, .. } if *from == self.partner));
        if received {
            self.months_since_received = 0;
        } else {
            self.months_since_received = self.months_since_received.saturating_add(1);
        }

        let mut acts = vec![
            Act::Invoke {
                inputs: vec![],
                using_skills: vec![self.harvest_skill],
            },
            Act::Invoke {
                inputs: vec![(self.edible, QTY_SCALE)],
                using_skills: vec![self.eat_skill],
            },
        ];
        // 協調（月 0 は先に手を差し出す）。破綻中は贈与しない = 離婚状態。
        // 相手が再開すれば received で復縁する。年に一度は「和解の手」を出す:
        // 不作などの騒音で相互破綻（TFT の吸収状態）に落ちても、双方が貞節なら
        // 年始の相互贈与で協調が再点火する。浮気者相手では実らず低親密度のまま
        let olive_branch = snap.now.is_multiple_of(12);
        let cooperate =
            snap.now == 0 || self.months_since_received <= self.patience_months || olive_branch;
        // 贈与額は軽くてよい: 親密度の増分は相互作用の回数で決まり量に依らない
        //（トークン贈与。M4 の親密度仕様 → pages/content/docs/human.md）
        if cooperate && held(snap, self.edible) > QTY_SCALE {
            acts.push(Act::Give {
                to: self.partner,
                resource: self.edible,
                amount: QTY_SCALE / 2,
            });
        }
        acts.extend(discard_junk(snap, &[self.edible], 1));
        Decision {
            acts,
            orders: vec![],
            memory: None,
            fuel_used: 0,
        }
    }
}

/// 浮気 brain: 贈与を全知人に薄く回す（配偶者を特別扱いしない）。
pub struct PhilandererBrain {
    pub edible: ResourceId,
    pub harvest_skill: SkillId,
    pub eat_skill: SkillId,
    cursor: usize,
}

impl Brain for PhilandererBrain {
    fn decide(&mut self, snap: &Snapshot) -> Decision {
        let mut acts = vec![
            Act::Invoke {
                inputs: vec![],
                using_skills: vec![self.harvest_skill],
            },
            Act::Invoke {
                inputs: vec![(self.edible, QTY_SCALE)],
                using_skills: vec![self.eat_skill],
            },
        ];
        if !snap.acquaintances.is_empty() && held(snap, self.edible) > QTY_SCALE {
            let to = snap.acquaintances[self.cursor % snap.acquaintances.len()].id;
            self.cursor += 1;
            acts.push(Act::Give {
                to,
                resource: self.edible,
                amount: QTY_SCALE,
            });
        }
        acts.extend(discard_junk(snap, &[self.edible], 1));
        Decision {
            acts,
            orders: vec![],
            memory: None,
            fuel_used: 0,
        }
    }
}

pub struct MarriageResult {
    /// 貞節×貞節ペア数 / その出生数 / ラン終了時のペア親密度平均（1/1000）
    pub faithful_couples: usize,
    pub faithful_births: u64,
    pub faithful_mean_intimacy: Qty,
    /// 両者存命の貞節ペアに限った親密度平均（死別ペアは配偶者の死後に減衰するだけなので分ける）
    pub faithful_intact_pairs: usize,
    pub faithful_intact_intimacy: Qty,
    /// 貞節×浮気ペア数 / その出生数 / ペア親密度平均
    pub mixed_couples: usize,
    pub mixed_births: u64,
    pub mixed_mean_intimacy: Qty,
    pub births: u64,
    pub deaths: u64,
}

pub struct M4MarriageSetup {
    pub world: World,
    pub brains: BTreeMap<HumanId, Box<dyn Brain>>,
    pub edible_of: BTreeMap<HumanId, usize>,
    pub roles: BTreeMap<HumanId, &'static str>,
    /// (妻, 夫, 夫が浮気者か)
    pub couples: Vec<(HumanId, HumanId, bool)>,
}

pub fn build_m4_marriage(seed: u64, params: WorldParams) -> M4MarriageSetup {
    let n_adults = 16;
    let mut world = World::new(seed, n_adults, params);
    let ids: Vec<HumanId> = world.humans.keys().copied().collect();

    let females: Vec<HumanId> = ids
        .iter()
        .copied()
        .filter(|id| world.humans[id].sex == crate::state::Sex::Female)
        .collect();
    let males: Vec<HumanId> = ids
        .iter()
        .copied()
        .filter(|id| world.humans[id].sex == crate::state::Sex::Male)
        .collect();
    let pairs = females.len().min(males.len());

    let mut brains: BTreeMap<HumanId, Box<dyn Brain>> = BTreeMap::new();
    let mut edible_of: BTreeMap<HumanId, usize> = BTreeMap::new();

    for (k, &hid) in ids.iter().enumerate() {
        let e = k % N_PRIMARY;
        edible_of.insert(hid, e);
        world.grant_skill(hid, e, STAT_MAX);
        world.grant_skill(hid, N_PRIMARY + e, STAT_MAX);
    }

    // 前半のペアは貞節×貞節、後半は貞節（妻）×浮気（夫）
    let n_faithful = pairs / 2;
    let mut roles: BTreeMap<HumanId, &'static str> = BTreeMap::new();
    let mut couples: Vec<(HumanId, HumanId, bool)> = Vec::new(); // (妻, 夫, 夫が浮気者か)
    for i in 0..pairs {
        let (f, m) = (females[i], males[i]);
        let phil = i >= n_faithful;
        couples.push((f, m, phil));
        world.add_acquaintance(f, m);

        let brain_for = |hid: HumanId, partner: HumanId, world: &World| -> Box<dyn Brain> {
            let e = edible_of[&hid];
            Box::new(SpouseBrain {
                edible: world.laws.id_of_index[e],
                harvest_skill: world.laws.skill_id_of_index[e],
                eat_skill: world.laws.skill_id_of_index[N_PRIMARY + e],
                partner,
                patience_months: 6,
                months_since_received: 0,
            })
        };
        brains.insert(f, brain_for(f, m, &world));
        roles.insert(f, "貞節");
        roles.insert(m, if phil { "浮気者" } else { "貞節" });
        if phil {
            let e = edible_of[&m];
            brains.insert(
                m,
                Box::new(PhilandererBrain {
                    edible: world.laws.id_of_index[e],
                    harvest_skill: world.laws.skill_id_of_index[e],
                    eat_skill: world.laws.skill_id_of_index[N_PRIMARY + e],
                    cursor: 0,
                }),
            );
        } else {
            brains.insert(m, brain_for(m, f, &world));
        }
    }
    // 浮気者は「顔が広い」: 全員と知人で、既に付き合い（初期親密度）がある。
    // 配偶者だけを特別扱いしない社会関係を初期条件として与える
    for &(f, m, phil) in &couples {
        if phil {
            for &other in &ids {
                if other != m {
                    world.add_acquaintance(m, other);
                    if other != f {
                        let key = (m.min(other), m.max(other));
                        world.intimacy.insert(key, 10 * QTY_SCALE);
                    }
                }
            }
        }
    }
    // あぶれた成人は独身の自活 brain
    for &hid in females.iter().skip(pairs).chain(males.iter().skip(pairs)) {
        let e = edible_of[&hid];
        let rid = world.laws.id_of_index[e];
        let hs = world.laws.skill_id_of_index[e];
        let es = world.laws.skill_id_of_index[N_PRIMARY + e];
        brains.insert(hid, Box::new(FamilyBrain::new(rid, hs, es, None)));
        roles.insert(hid, "独身");
    }

    M4MarriageSetup {
        world,
        brains,
        edible_of,
        roles,
        couples,
    }
}

/// 婚姻実験の集計（run_m4_marriage と ExperimentSession が共有）。
fn marriage_result(world: &World, couples: &[(HumanId, HumanId, bool)]) -> MarriageResult {
    // 集計: 出生をペア種別に帰属し、ペア親密度の平均を取る
    let mut faithful = (0usize, 0u64, 0u64); // (couples, births, intimacy 総和)
    let mut mixed = (0usize, 0u64, 0u64);
    let mut intact = (0usize, 0u64); // 両者存命の貞節ペア
    for &(f, m, phil) in couples {
        let births = world
            .parentage
            .values()
            .filter(|&&(mo, fa)| (mo, fa) == (f, m) || (mo, fa) == (m, f))
            .count() as u64;
        let intimacy = world.intimacy_of(f, m);
        let tgt = if phil { &mut mixed } else { &mut faithful };
        tgt.0 += 1;
        tgt.1 += births;
        tgt.2 += intimacy;
        if !phil && world.humans.contains_key(&f) && world.humans.contains_key(&m) {
            intact.0 += 1;
            intact.1 += intimacy;
        }
    }
    MarriageResult {
        faithful_couples: faithful.0,
        faithful_births: faithful.1,
        faithful_mean_intimacy: faithful.2 / (faithful.0 as u64).max(1),
        faithful_intact_pairs: intact.0,
        faithful_intact_intimacy: intact.1 / (intact.0 as u64).max(1),
        mixed_couples: mixed.0,
        mixed_births: mixed.1,
        mixed_mean_intimacy: mixed.2 / (mixed.0 as u64).max(1),
        births: world.births,
        deaths: world.deaths,
    }
}

pub fn run_m4_marriage(seed: u64, years: u32, params: WorldParams) -> MarriageResult {
    let mut setup = build_m4_marriage(seed, params);
    let months = years * setup.world.params.months_per_year;
    run_family_loop(
        &mut setup.world,
        &mut setup.brains,
        &mut setup.edible_of,
        months,
    );
    marriage_result(&setup.world, &setup.couples)
}

// ---------------------------------------------------------------------------
// ExperimentSession: ビューワ用の月ステップ実行
//
// CLI の run_* と同一のビルダー・月遷移・集計を共有するので、同一シードなら
// ビューワの再現ランは CLI と同じ歴史を辿る。summary はラベルと値の組で返し、
// 表示側（docs/viewer/）は整形するだけにする。
// ---------------------------------------------------------------------------

enum SessionKind {
    M1 {
        autarky_ids: Vec<HumanId>,
        trader_ids: Vec<HumanId>,
    },
    M2,
    M3 {
        apprentice_ids: Vec<HumanId>,
        skill_idx: usize,
    },
    M4 {
        edible_of: BTreeMap<HumanId, usize>,
    },
    M4Clans {
        edible_of: BTreeMap<HumanId, usize>,
    },
    M4Marriage {
        edible_of: BTreeMap<HumanId, usize>,
        couples: Vec<(HumanId, HumanId, bool)>,
    },
}

pub struct ExperimentSession {
    pub world: World,
    brains: BTreeMap<HumanId, Box<dyn Brain>>,
    kind: SessionKind,
    /// 初期成人の役割ラベル（凡例・色分け用。子は年齢と血縁台帳から導出できる）
    pub roles: BTreeMap<HumanId, &'static str>,
}

impl ExperimentSession {
    /// kind: "m1" | "m2" | "m3-open" | "m3-secret" | "m4" |
    ///       "m4-clans-endo" | "m4-clans-exo" | "m4-marriage"
    /// パラメータは CLI の各サブコマンドと同一（M3 は re_permille=20）。
    pub fn new(kind: &str, seed: u64) -> Option<ExperimentSession> {
        let params = WorldParams::default();
        Some(match kind {
            "m1" => {
                let s = build_m1(seed, 5, params);
                let mut roles = BTreeMap::new();
                for &id in &s.autarky_ids {
                    roles.insert(id, "自給自足");
                }
                for &id in &s.trader_ids {
                    roles.insert(id, "交易");
                }
                ExperimentSession {
                    world: s.world,
                    brains: s.brains,
                    kind: SessionKind::M1 {
                        autarky_ids: s.autarky_ids,
                        trader_ids: s.trader_ids,
                    },
                    roles,
                }
            }
            "m2" => {
                let s = build_m2(seed, params);
                let roles = s.world.humans.keys().map(|&id| (id, "商人")).collect();
                ExperimentSession {
                    world: s.world,
                    brains: s.brains,
                    kind: SessionKind::M2,
                    roles,
                }
            }
            "m3-open" | "m3-secret" => {
                let secret = kind == "m3-secret";
                let params = WorldParams {
                    re_permille: 20,
                    ..params
                };
                let s = build_m3(seed, secret, params);
                let mut roles = BTreeMap::new();
                for &id in &s.teacher_ids {
                    roles.insert(id, "教師");
                }
                for &id in &s.apprentice_ids {
                    roles.insert(id, "徒弟");
                }
                ExperimentSession {
                    world: s.world,
                    brains: s.brains,
                    kind: SessionKind::M3 {
                        apprentice_ids: s.apprentice_ids,
                        skill_idx: s.skill_idx,
                    },
                    roles,
                }
            }
            "m4" => {
                let s = build_m4(seed, params);
                ExperimentSession {
                    world: s.world,
                    brains: s.brains,
                    kind: SessionKind::M4 {
                        edible_of: s.edible_of,
                    },
                    roles: s.roles,
                }
            }
            "m4-clans-endo" | "m4-clans-exo" => {
                let s = build_m4_clans(seed, kind == "m4-clans-exo", params);
                ExperimentSession {
                    world: s.world,
                    brains: s.brains,
                    kind: SessionKind::M4Clans {
                        edible_of: s.edible_of,
                    },
                    roles: s.roles,
                }
            }
            "m4-marriage" => {
                let s = build_m4_marriage(seed, params);
                ExperimentSession {
                    world: s.world,
                    brains: s.brains,
                    kind: SessionKind::M4Marriage {
                        edible_of: s.edible_of,
                        couples: s.couples,
                    },
                    roles: s.roles,
                }
            }
            _ => return None,
        })
    }

    /// 1 ヶ月進める（家族系は月末の brain 切替も行う）。
    pub fn step_month(&mut self) {
        self.world.step(&mut self.brains);
        match &mut self.kind {
            SessionKind::M4 { edible_of }
            | SessionKind::M4Clans { edible_of }
            | SessionKind::M4Marriage { edible_of, .. } => {
                family_transition_step(&mut self.world, &mut self.brains, edible_of);
            }
            _ => {}
        }
    }

    /// 現時点の実験サマリ（ラベル, 値）。CLI の run_* と同じ集計。
    pub fn summary(&self) -> Vec<(String, String)> {
        let w = &self.world;
        match &self.kind {
            SessionKind::M1 {
                autarky_ids,
                trader_ids,
            } => {
                let r = m1_result(w, autarky_ids, trader_ids);
                vec![
                    ("交易の平均生涯消費".into(), format!("{:.0}", r.trader_mean)),
                    (
                        "自給自足の平均生涯消費".into(),
                        format!("{:.0}", r.autarky_mean),
                    ),
                    ("消費比（合格基準 > 1.0）".into(), format!("{:.3}", r.ratio)),
                ]
            }
            SessionKind::M2 => {
                let r = m2_result(w);
                let mut out = vec![
                    (
                        "媒介 resource（内部 #）".into(),
                        format!(
                            "#{}{}",
                            r.top,
                            if r.top >= N_PRIMARY {
                                "（廃棄物）"
                            } else {
                                ""
                            }
                        ),
                    ),
                    ("媒介の取引関与率".into(), format!("{}‰", r.top_share)),
                    (
                        "媒介の劣化率 λ".into(),
                        format!(
                            "{}‰（貯蔵性の低い順位 {}）",
                            r.involvement[r.top].1, r.top_lambda_rank
                        ),
                    ),
                ];
                for (i, &(share, lambda)) in r.involvement.iter().enumerate() {
                    if share > 0 {
                        out.push((
                            format!("#{i} 関与率"),
                            format!(
                                "{share}‰  λ={lambda}‰{}",
                                if i >= N_PRIMARY {
                                    "（廃棄物）"
                                } else {
                                    ""
                                }
                            ),
                        ));
                    }
                }
                out
            }
            SessionKind::M3 {
                apprentice_ids,
                skill_idx,
            } => {
                let r = m3_result(w, apprentice_ids, *skill_idx);
                vec![
                    (
                        "skill を習得した徒弟".into(),
                        format!("{}/{}", r.apprentices_with_skill, r.apprentices_total),
                    ),
                    (
                        "月払いの授業回数".into(),
                        r.paid_teach_transfers.to_string(),
                    ),
                    (
                        "リバースエンジニアリング".into(),
                        r.re_acquisitions.to_string(),
                    ),
                    ("生存".into(), r.alive.to_string()),
                ]
            }
            SessionKind::M4 { .. } => {
                let r = m4_result(w);
                let (taught, total) = r.kids_taught;
                vec![
                    ("出生".into(), r.births.to_string()),
                    ("近親出生（基準 0）".into(), r.incest_births.to_string()),
                    ("8 歳以上で技能を得た子".into(), format!("{taught}/{total}")),
                    ("刷り込みペア".into(), r.imprinted_pairs.to_string()),
                    (
                        "母の投資（給/教月）".into(),
                        format!(
                            "{:.1} / {}",
                            r.mother_invest.0 as f64 / 1000.0,
                            r.mother_invest.1
                        ),
                    ),
                    (
                        "父の投資（給/教月）".into(),
                        format!(
                            "{:.1} / {}",
                            r.father_invest.0 as f64 / 1000.0,
                            r.father_invest.1
                        ),
                    ),
                ]
            }
            SessionKind::M4Clans { .. } => {
                let r = clan_result(w);
                vec![
                    ("出生".into(), r.births.to_string()),
                    ("育った子（8 歳以上）".into(), r.grown_children.to_string()),
                    (
                        "harvest 技能種 / 子".into(),
                        format!("{:.2}", r.child_harvest_skills_permille as f64 / 1000.0),
                    ),
                    ("子の平均生涯消費".into(), r.child_mean_consumed.to_string()),
                ]
            }
            SessionKind::M4Marriage { couples, .. } => {
                let r = marriage_result(w, couples);
                vec![
                    (
                        "貞節ペアの出生".into(),
                        format!("{}（{} 組）", r.faithful_births, r.faithful_couples),
                    ),
                    (
                        "浮気者ペアの出生".into(),
                        format!("{}（{} 組）", r.mixed_births, r.mixed_couples),
                    ),
                    (
                        "貞節ペアの親密度".into(),
                        format!("{:.1}", r.faithful_mean_intimacy as f64 / 1000.0),
                    ),
                    (
                        "浮気者ペアの親密度".into(),
                        format!("{:.1}", r.mixed_mean_intimacy as f64 / 1000.0),
                    ),
                ]
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// M1 合格基準: 交易 brain の生涯消費 ÷ 自給自足 brain の生涯消費 > 1.0 が
    /// 複数シードで安定して成立する（pages/content/docs/plan.md）。
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
    /// 選ばれる resource が劣化率 λ（貯蔵性）と整合する（pages/content/docs/plan.md）。
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

    /// M4 合格基準（pages/content/docs/plan.md）:
    /// - 血縁構造が投資行動に現れる: world 側に家族概念を書かずに、親から子への
    ///   無償の teach で harvest skill が世代間伝達される
    /// - conceive は親密度から自動発生し（出生 > 0）、Westermarck 刷り込みにより
    ///   近親（親子・きょうだい）からの出生がゼロ
    #[test]
    fn kinship_investment_and_incest_avoidance() {
        for seed in 1..=3 {
            let r = run_m4(seed, 35, WorldParams::default());
            assert!(r.births >= 3, "seed {seed}: only {} births", r.births);
            assert_eq!(
                r.incest_births, 0,
                "seed {seed}: {} incest births (imprinting failed)",
                r.incest_births
            );
            let (taught, total) = r.kids_taught;
            assert!(
                total > 0 && taught * 10 >= total * 8,
                "seed {seed}: only {taught}/{total} kids taught by kin"
            );
            assert!(
                r.population < 60,
                "seed {seed}: population exploded to {}",
                r.population
            );
            // 母 vs 父の投資: 双方が子に投資している（贈与か teach の少なくとも一方）
            assert!(
                r.mother_invest.0 + r.mother_invest.1 > 0,
                "seed {seed}: mothers never invested"
            );
            assert!(
                r.father_invest.0 + r.father_invest.1 > 0,
                "seed {seed}: fathers never invested"
            );
        }
    }

    /// M4 派生実験 1: 同族内婚は技能流入で不利になる。
    /// 同じ参加者・同じペア数で、組み方（同族内 / 族外）だけを変えると、
    /// 族外婚の子のほうが多くの harvest 系統を身につける
    #[test]
    fn exogamy_brings_more_skills_than_endogamy() {
        for seed in 1..=3 {
            let endo = run_m4_clans(seed, false, 30, WorldParams::default());
            let exo = run_m4_clans(seed, true, 30, WorldParams::default());
            assert!(
                endo.grown_children > 0 && exo.grown_children > 0,
                "seed {seed}: no grown children (endo {}, exo {})",
                endo.grown_children,
                exo.grown_children
            );
            assert!(
                exo.child_harvest_skills_permille > endo.child_harvest_skills_permille,
                "seed {seed}: exogamy {}‰ <= endogamy {}‰ harvest skills per child",
                exo.child_harvest_skills_permille,
                endo.child_harvest_skills_permille
            );
        }
    }

    /// M4 派生実験 2: 婚姻契約（相互の贈与均衡）は執行機構なしの繰り返しゲームとして
    /// 維持される。貞節ペアは高親密度を保って子をもうけ、贈与を薄く広げる浮気者は
    /// 配偶者との相対親密度が 50% を超えられず子を残せない（未決 #7 の判断材料）
    #[test]
    fn marriage_persists_as_repeated_game() {
        for seed in 1..=3 {
            let r = run_m4_marriage(seed, 25, WorldParams::default());
            assert!(
                r.faithful_couples > 0 && r.mixed_couples > 0,
                "seed {seed}: bad setup ({} faithful, {} mixed couples)",
                r.faithful_couples,
                r.mixed_couples
            );
            assert!(
                r.faithful_births > r.mixed_births,
                "seed {seed}: faithful {} births <= mixed {} births",
                r.faithful_births,
                r.mixed_births
            );
            assert!(
                r.faithful_mean_intimacy > r.mixed_mean_intimacy,
                "seed {seed}: faithful intimacy {} <= mixed {}",
                r.faithful_mean_intimacy,
                r.mixed_mean_intimacy
            );
        }
    }

    /// M3 合格基準（pages/content/docs/plan.md）:
    /// - world 側に価格も契約も置かずに、skill の対価付き教育（if-taught-me の月払いを
    ///   伴う teach/learn の対）が継続的に成立する
    /// - 秘匿（売らない）と公開（売って模倣される）の両戦略が観測される:
    ///   公開教師の世界では RE による無償習得が発生し、秘匿教師の世界では発生しない
    #[test]
    fn paid_teaching_works_and_secrecy_controls_leakage() {
        // 実験を短くするため漏洩率を上げる
        let params = WorldParams {
            re_permille: 20,
            ..Default::default()
        };
        for seed in 1..=3 {
            let open = run_m3(seed, false, 20, params.clone());
            let secret = run_m3(seed, true, 20, params.clone());
            for (name, r) in [("open", &open), ("secret", &secret)] {
                assert_eq!(
                    r.apprentices_with_skill, r.apprentices_total,
                    "seed {seed} {name}: {}/{} apprentices acquired the skill",
                    r.apprentices_with_skill, r.apprentices_total
                );
                assert!(
                    r.paid_teach_transfers >= 8,
                    "seed {seed} {name}: only {} paid lessons",
                    r.paid_teach_transfers
                );
                // M4 以降、教育の相互作用が親密度を積んで出生が起きうる（人口は増える方向）。
                // ここで検証したいのは「誰も餓死しない」こと
                assert!(r.alive >= 6, "seed {seed} {name}: someone starved");
            }
            assert!(
                open.re_acquisitions > 0,
                "seed {seed}: open teacher never got reverse-engineered"
            );
            assert_eq!(
                secret.re_acquisitions, 0,
                "seed {seed}: secret teacher leaked anyway"
            );
        }
    }

    /// ExperimentSession は CLI の run_* と同一の歴史を辿る（ビューワ再現の根拠）
    #[test]
    fn experiment_session_matches_cli_runs() {
        // M1（単純ループ）
        let mut s = ExperimentSession::new("m1", 7).unwrap();
        for _ in 0..120 {
            s.step_month();
        }
        let mut b = build_m1(7, 5, WorldParams::default());
        b.world.run(120, &mut b.brains);
        assert_eq!(s.world.state_hash(), b.world.state_hash(), "m1");

        // M4 marriage（家族遷移つきループ）
        let mut s = ExperimentSession::new("m4-marriage", 7).unwrap();
        for _ in 0..120 {
            s.step_month();
        }
        let mut m = build_m4_marriage(7, WorldParams::default());
        run_family_loop(&mut m.world, &mut m.brains, &mut m.edible_of, 120);
        assert_eq!(s.world.state_hash(), m.world.state_hash(), "m4-marriage");
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
