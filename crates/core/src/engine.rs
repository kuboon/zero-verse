//! tick パイプライン。
//!
//! 月内の固定位相（pages/content/docs/architecture.md）:
//!   1. 自発変換（劣化）: 環境 + 全 human 在庫
//!   2. 環境変換（再生）: Φ を上限に廃棄物 → primary、続けて ε 出会い（公理 6）
//!   3. decide: 全 human 同時手番（lockstep）
//!   4. resolve: commit 順に act を適用（不正な宣言は個別に落とす）
//!   5. upkeep: health 自然減・占有維持費・strength 回復・加齢・死（死亡時は環境還元）
//!
//! 解決順序 teach/learn → conditional-give → 板マッチングは M2/M3 で 4 の内部に入る。

use crate::brain::{Act, Brain, Decision, Event, Snapshot};
use crate::laws::{LawGraph, SkillKind, N_PRIMARY, N_RESOURCES};
use crate::rng::{div_round_stochastic, hash3, hash4};
use crate::state::{clamp_stat, Human, Stats, World, SEX_MAX};
use crate::{HumanId, Qty, WorldParams, QTY_SCALE, STAT_MAX};
use std::collections::BTreeMap;

/// 出生時の sex 値（-10〜+10）。符号は 1/2（公理を維持）、大きさは二峰型:
/// 90% は 4〜10 のはっきりした性徴、10% は 0〜3 の曖昧域（0 = 中性）。
/// 曖昧さを常態でなく「尾」にすることで、apparent-sex の面白さが例外側に宿る。
fn draw_sex(h: u64) -> i8 {
    let mag = if (h >> 1) % 100 < 10 {
        ((h >> 8) % 4) as i8 // 0..=3（曖昧域）
    } else {
        (4 + (h >> 8) % 7) as i8 // 4..=10
    };
    if h & 1 == 0 {
        -mag
    } else {
        mag
    }
}

impl World {
    pub fn new(seed: u64, n_humans: usize, params: WorldParams) -> World {
        let laws = LawGraph::generate(seed);
        let mut env = vec![0; N_RESOURCES];
        for (i, e) in env.iter_mut().enumerate().take(N_PRIMARY) {
            *e = params.initial_env_stock + hash3(seed, 0xE0, i as u64) % QTY_SCALE;
        }

        let mut humans = BTreeMap::new();
        for i in 0..n_humans {
            // human-id は非連番（出生順を漏らさない）
            let mut salt = 0u64;
            let id: HumanId = loop {
                let cand = hash3(seed, 0xB10, (i as u64) << 8 | salt);
                if cand != 0 && !humans.contains_key(&cand) {
                    break cand;
                }
                salt += 1;
            };
            let h = hash3(seed, 0xB11, i as u64);
            let sex = draw_sex(h);
            let age_months = 18 * 12 + (hash3(h, 0xA6E, 0) % (22 * 12)) as u32; // 18〜40歳
            let mut inventory = BTreeMap::new();
            for idx in 0..N_PRIMARY {
                inventory.insert(idx, params.initial_human_stock);
            }
            humans.insert(
                id,
                Human {
                    id,
                    sex,
                    age_months,
                    stats: Stats {
                        health: 80 * QTY_SCALE,
                        strength: 60 * QTY_SCALE,
                        cognition: 60 * QTY_SCALE,
                        fertility: 50 * QTY_SCALE,
                    },
                    pregnant: None,
                    postpartum_until: 0,
                    inventory,
                    skills: BTreeMap::new(),
                    learning: BTreeMap::new(),
                    acquaintances: Default::default(),
                    consumed_dg: 0,
                    pending_events: Vec::new(),
                    memory: Vec::new(),
                },
            );
        }

        World {
            seed,
            month: 0,
            params,
            laws,
            humans,
            env,
            deaths: 0,
            dead_ledger: Vec::new(),
            last_quotes: Vec::new(),
            trade_volume: BTreeMap::new(),
            paid_teach_transfers: 0,
            re_acquisitions: 0,
            intimacy: BTreeMap::new(),
            imprinted: Default::default(),
            parentage: BTreeMap::new(),
            births: 0,
            parental_investment: BTreeMap::new(),
        }
    }

    /// 生得 skill の付与（world 生成・シナリオ構築用）
    pub fn grant_skill(&mut self, hid: HumanId, skill_idx: usize, proficiency: Qty) {
        if let Some(h) = self.humans.get_mut(&hid) {
            h.skills.insert(skill_idx, proficiency.min(STAT_MAX));
        }
    }

    /// 初期知人グラフの構築（world 生成・シナリオ構築用）
    pub fn add_acquaintance(&mut self, a: HumanId, b: HumanId) {
        if a == b || !self.humans.contains_key(&a) || !self.humans.contains_key(&b) {
            return;
        }
        self.humans.get_mut(&a).unwrap().acquaintances.insert(b);
        self.humans.get_mut(&b).unwrap().acquaintances.insert(a);
    }

    /// 1 ヶ月進める。brains は human-id → Brain。未登録の human は idle 扱い。
    pub fn step(&mut self, brains: &mut BTreeMap<HumanId, Box<dyn Brain>>) {
        let month = self.month;

        // 1. 自発変換（劣化）: 環境
        for idx in 0..N_RESOURCES {
            let lam = self.laws.specs[idx].decay_permille;
            if lam == 0 || self.env[idx] == 0 {
                continue;
            }
            let into = self.laws.specs[idx].decay_into;
            let h = hash4(self.seed, 0xDECA, month as u64, idx as u64);
            let loss = div_round_stochastic(self.env[idx] as u128 * lam as u128, 1000, h)
                .min(self.env[idx]);
            self.env[idx] -= loss;
            self.env[into] += loss;
        }
        // 1'. 自発変換（劣化）: human 在庫
        let human_ids: Vec<HumanId> = self.humans.keys().copied().collect();
        for &hid in &human_ids {
            let laws = self.laws.clone();
            let human = self.humans.get_mut(&hid).unwrap();
            let idxs: Vec<usize> = human.inventory.keys().copied().collect();
            for idx in idxs {
                let lam = laws.specs[idx].decay_permille;
                if lam == 0 {
                    continue;
                }
                let amt = *human.inventory.get(&idx).unwrap_or(&0);
                if amt == 0 {
                    continue;
                }
                let h = hash4(self.seed ^ hid, 0xDECB, month as u64, idx as u64);
                let loss = div_round_stochastic(amt as u128 * lam as u128, 1000, h).min(amt);
                if loss > 0 {
                    *human.inventory.get_mut(&idx).unwrap() -= loss;
                    let into = laws.specs[idx].decay_into;
                    *human.inventory.entry(into).or_insert(0) += loss;
                }
            }
            human.inventory.retain(|_, v| *v > 0);
        }

        // 2. 環境変換（再生）: Φ を上限に waste i → primary i。
        // 1 パス目は均等割り（独占防止）、2 パス目で残 Φ を index 順に使い切る
        let mut phi_left = self.params.phi_per_month;
        for pass in 0..2 {
            let cap_each = if pass == 0 {
                self.params.phi_per_month / N_PRIMARY as u64
            } else {
                u64::MAX
            };
            for i in 0..N_PRIMARY {
                let w = N_PRIMARY + i;
                if self.env[w] == 0 || phi_left == 0 {
                    continue;
                }
                let gain_per_unit = self.laws.regen_gain_per_unit(i).max(1);
                let budget = phi_left.min(cap_each);
                let conv = self.env[w].min(budget / gain_per_unit);
                if conv == 0 {
                    continue;
                }
                self.env[w] -= conv;
                self.env[i] += conv;
                phi_left -= conv * gain_per_unit;
            }
        }

        // 2'. ε 出会い（公理 6）: 確率 ε で一様ランダムな相手と知人になる
        if human_ids.len() >= 2 {
            for &hid in &human_ids {
                let h = hash4(self.seed, 0xE7A, month as u64, hid);
                if h % 1000 < self.params.epsilon_permille {
                    let pick = (hash4(self.seed, 0xE7B, month as u64, hid)
                        % (human_ids.len() as u64 - 1)) as usize;
                    let mut other = human_ids[pick];
                    if other == hid {
                        other = human_ids[human_ids.len() - 1];
                    }
                    if !self.humans[&hid].acquaintances.contains(&other) {
                        self.add_acquaintance(hid, other);
                        self.push_event(hid, Event::Encountered(other));
                        self.push_event(other, Event::Encountered(hid));
                    }
                }
            }
        }

        // 3. decide（全員同時手番。snapshot は位相 2' 終了時点の状態）
        let space_total: Qty = self.space_used_total();
        let space_free = self.params.total_space.saturating_sub(space_total);
        let mut decisions: BTreeMap<HumanId, Decision> = BTreeMap::new();
        for &hid in &human_ids {
            let human = self.humans.get_mut(&hid).unwrap();
            let events = std::mem::take(&mut human.pending_events);
            let memory = human.memory.clone();
            let human = &self.humans[&hid];
            let snap = Snapshot {
                now: month,
                rand: hash3(self.seed, hid, month as u64),
                id: hid,
                age_months: human.age_months,
                sex: human.sex,
                health: human.stats.health,
                strength: human.stats.strength,
                cognition: human.stats.cognition,
                fertility: human.stats.fertility,
                space_used: human.space_used(&self.laws, &self.params),
                space_free,
                resources: human
                    .inventory
                    .iter()
                    .map(|(&idx, &amt)| (self.laws.id_of_index[idx], amt))
                    .collect(),
                skills: human
                    .skills
                    .iter()
                    .map(|(&idx, &prof)| (self.laws.skill_id_of_index[idx], prof))
                    .collect(),
                acquaintances: human
                    .acquaintances
                    .iter()
                    .map(|&a| crate::brain::AcquaintanceView {
                        id: a,
                        intimacy: self.intimacy_of(hid, a),
                        apparent_age: self
                            .humans
                            .get(&a)
                            .map(|o| self.apparent_age_years(o))
                            .unwrap_or(0),
                        apparent_sex: self
                            .humans
                            .get(&a)
                            .map(|o| self.apparent_sex(hid, o))
                            .unwrap_or(0),
                        alive: self.humans.contains_key(&a),
                    })
                    .collect(),
                events,
                market: self
                    .last_quotes
                    .iter()
                    .map(|&(seller, gi, ga, wi, wa)| crate::brain::BoardQuote {
                        seller,
                        give_resource: self.laws.id_of_index[gi],
                        give_amount: ga,
                        want_resource: self.laws.id_of_index[wi],
                        want_amount: wa,
                    })
                    .collect(),
                memory,
            };
            let decision = match brains.get_mut(&hid) {
                Some(b) => b.decide(&snap),
                None => Decision::default(),
            };
            decisions.insert(hid, decision);
        }

        // 4. resolve: human-id 昇順、各人 commit 順。不正な宣言は個別に無効。
        //    月内解決順序（最終形 → pages/content/docs/architecture.md）:
        //    一方向 act → teach/learn 成立 → conditional-give 判定 → 板マッチング → RE
        let mut fuel_costs: BTreeMap<HumanId, Qty> = BTreeMap::new();
        let mut limit_orders: Vec<(HumanId, crate::brain::StandingOrder)> = Vec::new();
        let mut cond_gives: Vec<(HumanId, HumanId, u64, Qty, crate::brain::GiveCondition)> =
            Vec::new();
        let mut teaches: Vec<(HumanId, HumanId, u64)> = Vec::new(); // (teacher, student, skill)
        let mut learns: Vec<(HumanId, HumanId, u64)> = Vec::new(); // (student, teacher, skill)
        let mut unilateral: Vec<(HumanId, Act)> = Vec::new();
        for &hid in &human_ids {
            let decision = decisions.remove(&hid).unwrap_or_default();
            // 思考コスト: fuel 消費を health 減少に写像（upkeep で適用）
            if decision.fuel_used > 0 {
                let cost = decision.fuel_used / self.params.fuel_per_health.max(1);
                fuel_costs.insert(hid, cost);
            }
            let slots = self.params.act_slots_base as usize;
            for act in decision.acts.into_iter().take(slots) {
                match act {
                    Act::Teach { student, skill } => teaches.push((hid, student, skill)),
                    Act::Learn { teacher, skill } => learns.push((hid, teacher, skill)),
                    other => unilateral.push((hid, other)),
                }
            }
            for order in decision.orders {
                match order {
                    crate::brain::StandingOrder::Limit { .. } => limit_orders.push((hid, order)),
                    crate::brain::StandingOrder::ConditionalGive {
                        to,
                        resource,
                        amount,
                        condition,
                    } => cond_gives.push((hid, to, resource, amount, condition)),
                }
            }
            if let Some(mem) = decision.memory {
                // memory 上限は年齢の関数（M1 仮: 定数 64KiB）
                let limit = 64 * 1024;
                if mem.len() <= limit {
                    if let Some(h) = self.humans.get_mut(&hid) {
                        h.memory = mem;
                    }
                }
            }
        }
        // 4a. 一方向 act（invoke / give / discard）
        for (hid, act) in unilateral {
            self.apply_act(hid, act, month);
        }
        // 4b. teach/learn 成立（同月ペアのみ進捗）
        let taught = self.resolve_teaching(teaches, learns);
        // 4c. conditional-give 判定（if-taught-me はここで月単位アトミックになる）
        self.resolve_conditional_gives(cond_gives, &taught);
        // 4d. 板マッチング（standing orders は毎月全交換）
        self.resolve_board(month, limit_orders);
        // 4e. リバースエンジニアリング（板での販売が skill を確率的に漏らす）
        self.resolve_reverse_engineering(month);
        // 4f. 親密度の月次減衰（公理 10。増加は相互作用時にインライン）
        self.decay_intimacy(month);
        // 4g. Westermarck 刷り込み（fertility 窓が開く前に親密になったペアを除外）
        self.update_imprinting();
        // 4h. conceive の自動発生（相対親密度の相互条件 → pages/content/docs/kinship.md）
        self.resolve_conception(month);
        // 4i. 出産
        self.resolve_births(month);

        // 5. upkeep: health 自然減 + 占有維持費 → strength 回復 → 加齢 → 死
        let mut dead: Vec<HumanId> = Vec::new();
        for &hid in &human_ids {
            let laws = self.laws.clone();
            let params = self.params.clone();
            let human = self.humans.get_mut(&hid).unwrap();
            let upkeep = human
                .storage_volume(&laws)
                .saturating_mul(params.upkeep_per_volume)
                / QTY_SCALE;
            let decay =
                params.health_decay_per_month + upkeep + fuel_costs.get(&hid).copied().unwrap_or(0);
            human.stats.health = human.stats.health.saturating_sub(decay);
            // strength は毎月回復する（harvest 等で消費 → pages/content/docs/human.md の能力曲線）
            let strength_cap = 60 * QTY_SCALE;
            human.stats.strength =
                (human.stats.strength + params.strength_regen_per_month).min(strength_cap);
            human.age_months += 1;
            // fertility の年齢窓（思春期に開き、閉経で閉じる → pages/content/docs/human.md）。
            // 産後不妊の期間中も閉じる（出生間隔）
            human.stats.fertility = if human.age_months >= params.puberty_months
                && human.age_months < params.menopause_months
                && self.month >= human.postpartum_until
            {
                50 * QTY_SCALE
            } else {
                0
            };
            // 能力曲線（M1 仮): 加齢で緩やかに減衰
            if human.age_months > 40 * 12 {
                human.stats.strength = human.stats.strength.saturating_sub(50);
                human.stats.cognition = human.stats.cognition.saturating_sub(20);
            }
            human.stats.health = clamp_stat(human.stats.health);
            if human.stats.health == 0 || human.age_months >= params.max_lifespan_months {
                dead.push(hid);
            }
        }
        // 死亡時還元: 保有 resource を環境へ（相続は生前贈与で → pages/content/docs/world.md）
        for hid in dead {
            if let Some(h) = self.humans.remove(&hid) {
                for (idx, amt) in h.inventory {
                    self.env[idx] += amt;
                }
                self.dead_ledger.push((hid, h.consumed_dg));
                self.deaths += 1;
                // 知人の死のみ通知（公理 8: 観測は行動の痕跡だけ）
                for &other in &h.acquaintances {
                    self.push_event(other, Event::SomeoneDied(hid));
                }
            }
        }

        self.month += 1;
    }

    pub(crate) fn push_event(&mut self, hid: HumanId, ev: Event) {
        if let Some(h) = self.humans.get_mut(&hid) {
            h.pending_events.push(ev);
        }
    }

    fn pair_key(a: HumanId, b: HumanId) -> (HumanId, HumanId) {
        (a.min(b), a.max(b))
    }

    /// 見かけの性別（-10〜+10）。真値に観測者×相手ペア固定の一様ノイズ ±σ を
    /// 加えたもの。月ごとに揺らすと多数決で真値が復元できてしまうため、
    /// ノイズはペアで固定する（「私にはあの人がずっとこう見える」）。
    /// 確定情報は行動（conceive の有無・妊娠）からしか得られない
    ///（→ pages/content/docs/human.md）。
    pub fn apparent_sex(&self, observer: HumanId, target: &crate::state::Human) -> i8 {
        let sigma = self.params.apparent_sex_noise as i64;
        let h = hash3(self.seed ^ 0xA55E, observer, target.id);
        let noise = (h % (2 * sigma + 1) as u64) as i64 - sigma;
        (target.sex as i64 + noise).clamp(-(SEX_MAX as i64), SEX_MAX as i64) as i8
    }

    /// 見かけの年齢（年）。実年齢そのものは他人に見えず、この値だけが観測される。
    /// apparent-age = age × (1 + β(1 − vitality))。vitality は health・strength の
    /// 合成なので、若く見せるには実コストがかかる正直なシグナルになる
    ///（→ pages/content/docs/human.md。年齢標準曲線に対する比は将来拡張）。
    pub fn apparent_age_years(&self, h: &crate::state::Human) -> u32 {
        let vit =
            (h.stats.health.min(STAT_MAX) + h.stats.strength.min(STAT_MAX)) * 1000 / (2 * STAT_MAX);
        let beta = self.params.apparent_age_beta_permille;
        let months = h.age_months as u64 * (1000 + beta * (1000 - vit) / 1000) / 1000;
        (months / self.params.months_per_year.max(1) as u64) as u32
    }

    pub fn intimacy_of(&self, a: HumanId, b: HumanId) -> Qty {
        self.intimacy
            .get(&Self::pair_key(a, b))
            .copied()
            .unwrap_or(0)
    }

    /// 当事者間の action 1 回ぶんの親密度増加（give / teach / 約定 / introduce）
    pub(crate) fn bump_intimacy(&mut self, a: HumanId, b: HumanId) {
        if a == b {
            return;
        }
        let add = self.params.intimacy_per_interaction;
        *self.intimacy.entry(Self::pair_key(a, b)).or_insert(0) += add;
    }

    /// 親密度の月次減衰と死者ペアの掃除
    fn decay_intimacy(&mut self, month: u32) {
        let lam = self.params.intimacy_decay_permille;
        let seed = self.seed;
        let alive = |id: HumanId, w: &BTreeMap<HumanId, Human>| w.contains_key(&id);
        let humans = &self.humans;
        self.intimacy.retain(|&(a, b), v| {
            if !alive(a, humans) || !alive(b, humans) {
                return false;
            }
            let h = hash4(seed, 0x1AC4, month as u64, a ^ b.rotate_left(32));
            let loss = div_round_stochastic(*v as u128 * lam as u128, 1000, h).min(*v);
            *v -= loss;
            *v > 0
        });
    }

    /// fertility 窓が開く前に閾値を超えたペアは刷り込み（conceive 永久対象外）
    fn update_imprinting(&mut self) {
        let threshold = self.params.imprint_threshold;
        let puberty = self.params.puberty_months;
        let mut newly: Vec<(HumanId, HumanId)> = Vec::new();
        for (&(a, b), &v) in &self.intimacy {
            if v < threshold || self.imprinted.contains(&(a, b)) {
                continue;
            }
            let minor = |id: HumanId| {
                self.humans
                    .get(&id)
                    .map(|h| h.age_months < puberty)
                    .unwrap_or(false)
            };
            if minor(a) || minor(b) {
                newly.push((a, b));
            }
        }
        self.imprinted.extend(newly);
    }

    /// 配偶者候補内の相対親密度 = 「妊性窓内・sex の符号が逆・非刷り込みの知人」
    /// への親密度合計に占める相手の割合（‰）。分母を恋愛市場に限定するのが要点:
    /// 子・親・きょうだいへの親密度は分母に入らないので、血縁投資が
    /// そのまま避妊になって夫婦あたり実質 1 子で人口が半減していく構造を防ぐ
    ///（→ pages/content/docs/kinship.md）。
    fn mate_relative_permille(&self, from: HumanId, to: HumanId) -> u64 {
        let Some(h) = self.humans.get(&from) else {
            return 0;
        };
        let sign = h.sex.signum();
        let total: u128 = h
            .acquaintances
            .iter()
            .filter(|&&a| {
                self.humans
                    .get(&a)
                    .map(|ah| {
                        ah.stats.fertility > 0
                            && ah.sex.signum() == -sign
                            && !self.imprinted.contains(&Self::pair_key(from, a))
                    })
                    .unwrap_or(false)
            })
            .map(|&a| self.intimacy_of(from, a) as u128)
            .sum();
        (self.intimacy_of(from, to) as u128 * 1000)
            .checked_div(total)
            .unwrap_or(0) as u64
    }

    /// conceive の自動発生: 配偶者候補内の相対親密度が相互に閾値超 ＋ sex の
    /// 符号が逆（負側が母）＋ 双方 fertility 窓内 ＋ 非刷り込み ＋ 母側が非妊娠。
    /// sex = 0（中性）はどの相手とも成立しない。条件を満たす相手が複数なら
    /// 相互相対親密度の最小値が最大のペア（tie は id）で決定論的に選ぶ。
    fn resolve_conception(&mut self, month: u32) {
        let threshold = self.params.conceive_rel_permille;
        let human_ids: Vec<HumanId> = self.humans.keys().copied().collect();
        for &f in &human_ids {
            let Some(fh) = self.humans.get(&f) else {
                continue;
            };
            if !fh.is_female()
                || fh.pregnant.is_some()
                || fh.stats.fertility == 0
                || fh.stats.health < self.params.conceive_min_health
            {
                continue;
            }
            let candidates: Vec<HumanId> = fh.acquaintances.iter().copied().collect();
            let mut best: Option<(u64, HumanId)> = None;
            for m in candidates {
                let Some(mh) = self.humans.get(&m) else {
                    continue;
                };
                if !mh.is_male() || mh.stats.fertility == 0 {
                    continue;
                }
                if self.imprinted.contains(&Self::pair_key(f, m)) {
                    continue;
                }
                // 絶対親密度の下限: 名ばかりの知人（share だけ高い）とは成立しない
                if self.intimacy_of(f, m) < self.params.conceive_min_intimacy {
                    continue;
                }
                let a = self.mate_relative_permille(f, m);
                let b = self.mate_relative_permille(m, f);
                let mutual = a.min(b);
                if mutual > threshold && best.map(|(s, _)| mutual > s).unwrap_or(true) {
                    best = Some((mutual, m));
                }
            }
            if let Some((_, father)) = best {
                let due = month + self.params.gestation_months;
                self.humans.get_mut(&f).unwrap().pregnant = Some((due, father));
            }
        }
    }

    /// 出産: 母にのみ child-born。父には 0 歳の知人が現れるだけ（通知なし）。
    fn resolve_births(&mut self, month: u32) {
        let due_now: Vec<(HumanId, HumanId)> = self
            .humans
            .iter()
            .filter_map(|(&m, h)| match h.pregnant {
                Some((due, father)) if due <= month => Some((m, father)),
                _ => None,
            })
            .collect();
        for (mother, father) in due_now {
            // 子の id も非連番
            let mut salt = 0u64;
            let child: HumanId = loop {
                let cand = hash4(self.seed, 0xB1B7, month as u64, mother ^ salt);
                if cand != 0
                    && !self.humans.contains_key(&cand)
                    && !self.parentage.contains_key(&cand)
                {
                    break cand;
                }
                salt += 1;
            };
            let sex = draw_sex(hash4(self.seed, 0x5EC5, month as u64, child));
            // 生得付与: 母の食事 skill（#12 仮決定: 食文化は母から）
            let inherited_eats: Vec<(usize, Qty)> = self
                .humans
                .get(&mother)
                .map(|h| {
                    h.skills
                        .iter()
                        .filter(|(&k, _)| matches!(self.laws.skills[k], SkillKind::Eat(_)))
                        .map(|(&k, &p)| (k, p))
                        .collect()
                })
                .unwrap_or_default();
            self.humans.insert(
                child,
                Human {
                    id: child,
                    sex,
                    age_months: 0,
                    stats: Stats {
                        health: 50 * QTY_SCALE,
                        strength: 10 * QTY_SCALE,
                        cognition: 80 * QTY_SCALE,
                        fertility: 0,
                    },
                    pregnant: None,
                    postpartum_until: 0,
                    inventory: BTreeMap::new(),
                    skills: inherited_eats.into_iter().collect(),
                    learning: BTreeMap::new(),
                    acquaintances: Default::default(),
                    consumed_dg: 0,
                    pending_events: Vec::new(),
                    memory: Vec::new(),
                },
            );
            self.parentage.insert(child, (mother, father));
            self.births += 1;
            // 出産コストは母が負う。産後不妊（授乳期）で次の妊娠まで間隔が空く
            let postpartum = month + self.params.postpartum_infertile_months;
            if let Some(mh) = self.humans.get_mut(&mother) {
                mh.pregnant = None;
                mh.postpartum_until = postpartum;
                mh.stats.health = mh
                    .stats
                    .health
                    .saturating_sub(self.params.birth_health_cost);
            }
            // 母子: 高い初期親密度 + child-born。父子: 知人になるだけ（父性不確実性）
            self.add_acquaintance(mother, child);
            self.add_acquaintance(father, child);
            let init = self.params.mother_child_intimacy;
            *self
                .intimacy
                .entry(Self::pair_key(mother, child))
                .or_insert(0) += init;
            // 同じ母に育てられたきょうだいは共在する: 出生時に知人になり共在親密度を
            // 持つ → 刷り込み（Westermarck）が働き、近親婚は行動を待たず忌避される
            let siblings: Vec<HumanId> = self
                .parentage
                .iter()
                .filter(|&(&c, &(m2, _))| c != child && m2 == mother)
                .map(|(&c, _)| c)
                .filter(|c| self.humans.contains_key(c))
                .collect();
            for s in siblings {
                self.add_acquaintance(child, s);
                let e = self.intimacy.entry(Self::pair_key(child, s)).or_insert(0);
                *e = (*e).max(init / 2);
            }
            self.push_event(mother, Event::ChildBorn(child));
        }
    }

    /// teach/learn の解決。同月に (teacher, student, skill) の宣言が対をなしたものだけ
    /// 1 ヶ月分進捗する（pages/content/docs/skills.md）。返り値は今月成立した組。
    fn resolve_teaching(
        &mut self,
        teaches: Vec<(HumanId, HumanId, u64)>,
        learns: Vec<(HumanId, HumanId, u64)>,
    ) -> std::collections::BTreeSet<(HumanId, HumanId, usize)> {
        use std::collections::BTreeSet;
        let learn_set: BTreeSet<(HumanId, HumanId, u64)> = learns
            .into_iter()
            .map(|(student, teacher, skill)| (teacher, student, skill))
            .collect();
        let mut taught: BTreeSet<(HumanId, HumanId, usize)> = BTreeSet::new();

        for (teacher, student, skill_pub) in teaches {
            if !learn_set.contains(&(teacher, student, skill_pub)) {
                self.push_event(teacher, Event::ActionFailed);
                continue;
            }
            let Some(&k) = self.laws.skill_index_of_id.get(&skill_pub) else {
                self.push_event(teacher, Event::ActionFailed);
                continue;
            };
            if taught.contains(&(teacher, student, k)) {
                continue; // 同月の重複宣言は 1 回分
            }
            let teacher_prof = self
                .humans
                .get(&teacher)
                .and_then(|h| h.skills.get(&k).copied())
                .unwrap_or(0);
            // 既習者への再教育は教師の熟練を上限に上積みできる（研鑽）。
            // 教師の水準に達している相手にはもう教えられることがない
            let student_prof = self
                .humans
                .get(&student)
                .map(|h| h.skills.get(&k).copied())
                .unwrap_or(Some(0));
            if teacher_prof == 0 || student_prof.map(|p| p >= teacher_prof).unwrap_or(false) {
                self.push_event(teacher, Event::ActionFailed);
                self.push_event(student, Event::ActionFailed);
                continue;
            }
            // 進捗 = 教師の熟練% × 学習者の cognition% / 100（若いほど速い曲線は cognition 経由）
            let cognition = self
                .humans
                .get(&student)
                .map(|h| h.stats.cognition)
                .unwrap_or(0);
            let add = ((teacher_prof / QTY_SCALE) * (cognition / QTY_SCALE) / 100).max(1);
            let needed = self.params.teach_progress_needed;
            let initial = self.params.learn_initial_prof;
            // done = Some(初取得か)。研鑽の完了は SkillAcquired を出さない
            let done = {
                let s = self.humans.get_mut(&student).unwrap();
                let p = s.learning.entry(k).or_insert(0);
                *p += add;
                if *p >= needed {
                    s.learning.remove(&k);
                    let newly = !s.skills.contains_key(&k);
                    let prof = (s.skills.get(&k).copied().unwrap_or(0) + initial).min(teacher_prof);
                    s.skills.insert(k, prof);
                    Some(newly)
                } else {
                    None
                }
            };
            self.push_event(
                teacher,
                Event::TeachProgressed {
                    partner: student,
                    skill: skill_pub,
                },
            );
            self.push_event(
                student,
                Event::TeachProgressed {
                    partner: teacher,
                    skill: skill_pub,
                },
            );
            if done == Some(true) {
                self.push_event(student, Event::SkillAcquired(skill_pub));
            }
            // 教育も相互作用: 互いを知人にし、親密度を上げる
            self.add_acquaintance(teacher, student);
            self.bump_intimacy(teacher, student);
            // 血縁投資の台帳（メタ層）: 親から子への teach 進捗月数を計上
            if let Some(&(m, f)) = self.parentage.get(&student) {
                if m == teacher || f == teacher {
                    self.parental_investment
                        .entry((teacher, student))
                        .or_insert((0, 0))
                        .1 += 1;
                }
            }
            taught.insert((teacher, student, k));
        }
        taught
    }

    /// conditional-give の判定（pages/content/docs/market.md の give-condition）。
    /// if-received は 2 パス評価: 相互の cond-give 同士でも同月内で成立できる。
    fn resolve_conditional_gives(
        &mut self,
        gives: Vec<(HumanId, HumanId, u64, Qty, crate::brain::GiveCondition)>,
        taught: &std::collections::BTreeSet<(HumanId, HumanId, usize)>,
    ) {
        use crate::brain::GiveCondition;
        let mut executed = vec![false; gives.len()];
        for pass in 0..2 {
            for (idx, (hid, to, res_pub, amount, cond)) in gives.iter().enumerate() {
                if executed[idx] {
                    continue;
                }
                let fire = match cond {
                    GiveCondition::Unconditional => pass == 0,
                    GiveCondition::IfTaughtMe(skill_pub) => {
                        // 「今月 to が自分に教えて進捗した」
                        pass == 0
                            && self
                                .laws
                                .skill_index_of_id
                                .get(skill_pub)
                                .is_some_and(|&k| taught.contains(&(*to, *hid, k)))
                    }
                    GiveCondition::IfReceived { resource, amount } => {
                        self.received_this_month(*hid, *to, *resource) >= *amount
                    }
                };
                if fire {
                    let was_teach_payment = matches!(cond, GiveCondition::IfTaughtMe(_));
                    self.apply_act(
                        *hid,
                        Act::Give {
                            to: *to,
                            resource: *res_pub,
                            amount: *amount,
                        },
                        0,
                    );
                    if was_teach_payment {
                        self.paid_teach_transfers += 1;
                    }
                    executed[idx] = true;
                }
            }
        }
    }

    /// 今月 from から resource を受け取った量（pending events から数える）
    fn received_this_month(&self, hid: HumanId, from: HumanId, resource: u64) -> Qty {
        self.humans
            .get(&hid)
            .map(|h| {
                h.pending_events
                    .iter()
                    .filter_map(|e| match e {
                        Event::ReceivedTransfer {
                            from: f,
                            resource: r,
                            amount,
                        } if *f == from && *r == resource => Some(*amount),
                        _ => None,
                    })
                    .sum()
            })
            .unwrap_or(0)
    }

    /// リバースエンジニアリング（pages/content/docs/skills.md）:
    /// 板に売りを出した resource は、それを作る skill を確率的に漏らす。
    /// primary i の売り → harvest_i、waste i の売り → eat_i（skill 内部 index は一致）。
    fn resolve_reverse_engineering(&mut self, month: u32) {
        use std::collections::BTreeSet;
        let mut exposed: BTreeSet<usize> = BTreeSet::new();
        for &(_, gi, ..) in &self.last_quotes {
            exposed.insert(gi); // resource 内部 index == それを産出する skill の内部 index
        }
        if exposed.is_empty() {
            return;
        }
        let human_ids: Vec<HumanId> = self.humans.keys().copied().collect();
        let prof = self.params.learn_initial_prof / 2;
        for &hid in &human_ids {
            for &k in &exposed {
                let lacks = self
                    .humans
                    .get(&hid)
                    .map(|h| !h.skills.contains_key(&k))
                    .unwrap_or(false);
                if !lacks {
                    continue;
                }
                let h = hash4(self.seed, 0x5EEA, month as u64, hid ^ ((k as u64) << 48));
                if h % 1000 < self.params.re_permille {
                    let skill_pub = self.laws.skill_id_of_index[k];
                    let human = self.humans.get_mut(&hid).unwrap();
                    human.skills.insert(k, prof);
                    human.learning.remove(&k);
                    self.push_event(hid, Event::SkillAcquired(skill_pub));
                    self.re_acquisitions += 1;
                }
            }
        }
    }

    /// act 1 件の適用。不正なら ActionFailed イベントだけ残して落とす（理由は返さない）。
    fn apply_act(&mut self, hid: HumanId, act: Act, month: u32) {
        match act {
            Act::Idle => {}
            Act::Discard { resource, amount } => {
                let Some(&idx) = self.laws.index_of_id.get(&resource) else {
                    self.push_event(hid, Event::ActionFailed);
                    return;
                };
                let Some(human) = self.humans.get_mut(&hid) else {
                    return;
                };
                let have = *human.inventory.get(&idx).unwrap_or(&0);
                let amt = have.min(amount);
                if amt == 0 {
                    self.push_event(hid, Event::ActionFailed);
                    return;
                }
                *human.inventory.get_mut(&idx).unwrap() -= amt;
                human.inventory.retain(|_, v| *v > 0);
                self.env[idx] += amt;
            }
            Act::Give {
                to,
                resource,
                amount,
            } => {
                let Some(&idx) = self.laws.index_of_id.get(&resource) else {
                    self.push_event(hid, Event::ActionFailed);
                    return;
                };
                if !self.humans.contains_key(&to) || to == hid {
                    self.push_event(hid, Event::ActionFailed);
                    return;
                }
                let giver = self.humans.get(&hid).unwrap();
                let have = *giver.inventory.get(&idx).unwrap_or(&0);
                let amt = have.min(amount);
                if amt == 0 {
                    self.push_event(hid, Event::ActionFailed);
                    return;
                }
                let giver = self.humans.get_mut(&hid).unwrap();
                *giver.inventory.get_mut(&idx).unwrap() -= amt;
                giver.inventory.retain(|_, v| *v > 0);
                let receiver = self.humans.get_mut(&to).unwrap();
                *receiver.inventory.entry(idx).or_insert(0) += amt;
                let public = self.laws.id_of_index[idx];
                self.push_event(
                    to,
                    Event::ReceivedTransfer {
                        from: hid,
                        resource: public,
                        amount: amt,
                    },
                );
                // 贈与は互いを知人にし、親密度を上げる（最小の相互作用チャネル）
                self.add_acquaintance(hid, to);
                self.bump_intimacy(hid, to);
                // 血縁投資の台帳（メタ層）: 親から子への一方的贈与を計上
                if let Some(&(m, f)) = self.parentage.get(&to) {
                    if m == hid || f == hid {
                        self.parental_investment
                            .entry((hid, to))
                            .or_insert((0, 0))
                            .0 += amt;
                    }
                }
            }
            Act::Invoke {
                inputs,
                using_skills,
            } => {
                self.apply_invoke(hid, inputs, using_skills, month);
            }
            Act::Introduce { to, subject } => {
                // 自分の知人同士を引き合わせる。双方に introduced が届き、知人になる。
                // 親密度は増やさない（紹介は出会いの提供であって相互作用の当事者ではない）
                let ok = to != subject
                    && self.humans.contains_key(&to)
                    && self.humans.contains_key(&subject)
                    && self
                        .humans
                        .get(&hid)
                        .map(|h| {
                            h.acquaintances.contains(&to) && h.acquaintances.contains(&subject)
                        })
                        .unwrap_or(false);
                if !ok {
                    self.push_event(hid, Event::ActionFailed);
                    return;
                }
                self.add_acquaintance(to, subject);
                self.push_event(to, Event::Introduced { via: hid, subject });
                self.push_event(
                    subject,
                    Event::Introduced {
                        via: hid,
                        subject: to,
                    },
                );
            }
            // teach/learn は resolve_teaching で対にして解決される（ここには来ない）
            Act::Teach { .. } | Act::Learn { .. } => {}
        }
    }

    /// invoke の解決。宣言された skill と inputs が法則グラフに合致すれば発動。
    fn apply_invoke(
        &mut self,
        hid: HumanId,
        inputs: Vec<(u64, Qty)>,
        using_skills: Vec<u64>,
        _month: u32,
    ) {
        // 所持している skill のうち、宣言された最初の一つを使う
        let Some((skill_idx, prof)) = using_skills.iter().find_map(|sid| {
            let &idx = self.laws.skill_index_of_id.get(sid)?;
            let prof = *self.humans.get(&hid)?.skills.get(&idx)?;
            Some((idx, prof))
        }) else {
            self.push_event(hid, Event::ActionFailed);
            return;
        };

        match self.laws.skills[skill_idx] {
            SkillKind::Harvest(p) => {
                let cost = self.params.harvest_strength_cost;
                let human = self.humans.get(&hid).unwrap();
                if human.stats.strength < cost {
                    self.push_event(hid, Event::ActionFailed);
                    return;
                }
                // 獲得量 = 基本量 × 熟練度 × ストック残量係数（枯渇 → 公理 4）
                let stock = self.env[p];
                let base = self.params.harvest_base_yield as u128;
                let by_prof = base * prof as u128 / STAT_MAX as u128;
                let half = self.params.harvest_half_saturation as u128;
                let yielded =
                    (by_prof * stock as u128 / (stock as u128 + half)).min(stock as u128) as Qty;
                if yielded == 0 {
                    self.push_event(hid, Event::ActionFailed);
                    return;
                }
                let human = self.humans.get_mut(&hid).unwrap();
                human.stats.strength -= cost;
                self.env[p] -= yielded;
                let human = self.humans.get_mut(&hid).unwrap();
                *human.inventory.entry(p).or_insert(0) += yielded;
                let skill_pub = self.laws.skill_id_of_index[skill_idx];
                let res_pub = self.laws.id_of_index[p];
                self.push_event(
                    hid,
                    Event::InvokeResult {
                        skill: skill_pub,
                        consumed: vec![],
                        produced: vec![(res_pub, yielded)],
                        health_gain: 0,
                    },
                );
            }
            SkillKind::Eat(p) => {
                // inputs から primary p を探す
                let want: Qty = inputs
                    .iter()
                    .filter_map(|&(rid, a)| {
                        (self.laws.index_of_id.get(&rid) == Some(&p)).then_some(a)
                    })
                    .sum();
                let human = self.humans.get(&hid).unwrap();
                let have = *human.inventory.get(&p).unwrap_or(&0);
                let amt = want.min(have);
                if amt == 0 {
                    self.push_event(hid, Event::ActionFailed);
                    return;
                }
                let waste = self.laws.specs[p].decay_into;
                let gain = amt.saturating_mul(self.params.eat_health_per_unit) / QTY_SCALE;
                let dg = self.laws.eat_delta_g(p);
                let human = self.humans.get_mut(&hid).unwrap();
                *human.inventory.get_mut(&p).unwrap() -= amt;
                human.inventory.retain(|_, v| *v > 0);
                *human.inventory.entry(waste).or_insert(0) += amt;
                human.stats.health = clamp_stat(human.stats.health + gain);
                // 消費 = 食事の Δg（pages/content/docs/scoring.md）。生の積で積算
                human.consumed_dg += amt as u128 * dg as u128;
                let skill_pub = self.laws.skill_id_of_index[skill_idx];
                let res_pub = self.laws.id_of_index[p];
                let waste_pub = self.laws.id_of_index[waste];
                self.push_event(
                    hid,
                    Event::InvokeResult {
                        skill: skill_pub,
                        consumed: vec![(res_pub, amt)],
                        produced: vec![(waste_pub, amt)],
                        health_gain: gain,
                    },
                );
            }
        }
    }

    /// n ヶ月回す。
    pub fn run(&mut self, months: u32, brains: &mut BTreeMap<HumanId, Box<dyn Brain>>) {
        for _ in 0..months {
            self.step(brains);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::brain::IdleBrain;

    fn idle_brains(w: &World) -> BTreeMap<HumanId, Box<dyn Brain>> {
        w.humans
            .keys()
            .map(|&id| (id, Box::new(IdleBrain) as Box<dyn Brain>))
            .collect()
    }

    /// P0 完了条件: 同一シード → バイト単位で同一の歴史（20 human × 100 年）
    #[test]
    fn determinism_same_seed() {
        let mut hashes = Vec::new();
        for _ in 0..2 {
            let mut w = World::new(42, 20, WorldParams::default());
            let mut brains = idle_brains(&w);
            w.run(100 * 12, &mut brains);
            hashes.push(w.state_hash());
        }
        assert_eq!(hashes[0], hashes[1]);
    }

    #[test]
    fn different_seeds_differ() {
        let mut w1 = World::new(1, 20, WorldParams::default());
        let mut w2 = World::new(2, 20, WorldParams::default());
        let mut b1 = idle_brains(&w1);
        let mut b2 = idle_brains(&w2);
        w1.run(120, &mut b1);
        w2.run(120, &mut b2);
        assert_ne!(w1.state_hash(), w2.state_hash());
    }

    /// 公理 4/5: world 全体（human + 環境）の組成は全 tick で厳密に保存される
    #[test]
    fn composition_is_conserved() {
        let mut w = World::new(7, 20, WorldParams::default());
        let mut brains = idle_brains(&w);
        let before = w.composition_totals();
        for _ in 0..240 {
            w.step(&mut brains);
            assert_eq!(before, w.composition_totals(), "month {}", w.month);
        }
    }

    /// 公理 11: 占有合計は総空間 S を超えない
    #[test]
    fn space_never_exceeds_total() {
        let mut w = World::new(11, 20, WorldParams::default());
        let mut brains = idle_brains(&w);
        for _ in 0..240 {
            w.step(&mut brains);
            assert!(w.space_used_total() <= w.params.total_space);
        }
    }
}
