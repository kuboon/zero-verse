//! tick パイプライン。
//!
//! 月内の固定位相（docs/design/08-architecture.md）:
//!   1. 自発変換（劣化）: 環境 + 全 human 在庫
//!   2. 環境変換（再生）: Φ を上限に廃棄物 → primary
//!   3. decide: 全 human 同時手番（lockstep）
//!   4. resolve: commit 順に act を適用（不正な宣言は個別に落とす）
//!   5. upkeep: health 自然減・占有維持費・加齢・死（死亡時は環境還元）
//!
//! 解決順序 teach/learn → conditional-give → 板マッチングは M2/M3 で 4 の内部に入る。

use crate::brain::{Act, Brain, Decision, Snapshot};
use crate::laws::{LawGraph, N_PRIMARY, N_RESOURCES};
use crate::rng::{div_round_stochastic, hash3, hash4};
use crate::state::{clamp_stat, Human, Sex, Stats, World};
use crate::{HumanId, Qty, WorldParams, QTY_SCALE, STAT_MAX};
use std::collections::BTreeMap;

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
            let sex = if h & 1 == 0 { Sex::Female } else { Sex::Male };
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
                    inventory,
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
        }
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

        // 2. 環境変換（再生）: Φ を上限に waste i → primary i（決定論的に index 順）
        let mut phi_left = self.params.phi_per_month;
        for i in 0..N_PRIMARY {
            let w = N_PRIMARY + i;
            if self.env[w] == 0 || phi_left == 0 {
                continue;
            }
            let gain_per_unit = self.laws.regen_gain_per_unit(i).max(1);
            let max_by_phi = phi_left / gain_per_unit;
            let conv = self.env[w].min(max_by_phi);
            if conv == 0 {
                continue;
            }
            self.env[w] -= conv;
            self.env[i] += conv;
            phi_left -= conv * gain_per_unit;
        }

        // 3. decide（全員同時手番。snapshot は位相 2 終了時点の状態）
        let space_total: Qty = self.space_used_total();
        let space_free = self.params.total_space.saturating_sub(space_total);
        let mut decisions: BTreeMap<HumanId, Decision> = BTreeMap::new();
        for &hid in &human_ids {
            let human = &self.humans[&hid];
            let snap = Snapshot {
                now: month,
                rand: hash3(self.seed, hid, month as u64),
                id: hid,
                age_months: human.age_months,
                health: human.stats.health,
                space_used: human.space_used(&self.laws, &self.params),
                space_free,
                resources: human
                    .inventory
                    .iter()
                    .map(|(&idx, &amt)| (self.laws.id_of_index[idx], amt))
                    .collect(),
            };
            let decision = match brains.get_mut(&hid) {
                Some(b) => b.decide(&snap),
                None => Decision::default(),
            };
            decisions.insert(hid, decision);
        }

        // 4. resolve: human-id 昇順、各人 commit 順。不正な宣言は個別に無効。
        for &hid in &human_ids {
            let decision = decisions.remove(&hid).unwrap_or_default();
            let slots = self.params.act_slots_base as usize;
            for act in decision.acts.into_iter().take(slots) {
                self.apply_act(hid, act);
            }
            if let Some(mem) = decision.memory {
                // memory 上限は年齢の関数（P0 仮: 定数 64KiB）
                let limit = 64 * 1024;
                if mem.len() <= limit {
                    if let Some(h) = self.humans.get_mut(&hid) {
                        h.memory = mem;
                    }
                }
            }
        }

        // 5. upkeep: health 自然減 + 占有維持費 → 加齢 → 死
        let mut dead: Vec<HumanId> = Vec::new();
        for &hid in &human_ids {
            let laws = self.laws.clone();
            let params = self.params.clone();
            let human = self.humans.get_mut(&hid).unwrap();
            let upkeep = human
                .storage_volume(&laws)
                .saturating_mul(params.upkeep_per_volume)
                / QTY_SCALE;
            let decay = params.health_decay_per_month + upkeep;
            human.stats.health = human.stats.health.saturating_sub(decay);
            human.age_months += 1;
            // 能力曲線（P0 仮): 加齢で緩やかに減衰
            if human.age_months > 40 * 12 {
                human.stats.strength = human.stats.strength.saturating_sub(50);
                human.stats.cognition = human.stats.cognition.saturating_sub(20);
            }
            human.stats.health = clamp_stat(human.stats.health);
            if human.stats.health == 0 || human.age_months >= params.max_lifespan_months {
                dead.push(hid);
            }
        }
        // 死亡時還元: 保有 resource を環境へ（相続は生前贈与で → docs/design/world.md）
        for hid in dead {
            if let Some(h) = self.humans.remove(&hid) {
                for (idx, amt) in h.inventory {
                    self.env[idx] += amt;
                }
                self.deaths += 1;
            }
        }

        self.month += 1;
    }

    /// act 1 件の適用。不正なら黙って落とす（理由は返さない。M1 で action-failed
    /// イベントを翌月 events に入れる）。
    fn apply_act(&mut self, hid: HumanId, act: Act) {
        match act {
            Act::Idle => {}
            Act::Discard { resource, amount } => {
                let Some(&idx) = self.laws.index_of_id.get(&resource) else {
                    return;
                };
                let Some(human) = self.humans.get_mut(&hid) else {
                    return;
                };
                let have = *human.inventory.get(&idx).unwrap_or(&0);
                let amt = have.min(amount);
                if amt == 0 {
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
                    return;
                };
                if !self.humans.contains_key(&to) || to == hid {
                    return;
                }
                let Some(giver) = self.humans.get_mut(&hid) else {
                    return;
                };
                let have = *giver.inventory.get(&idx).unwrap_or(&0);
                let amt = have.min(amount);
                if amt == 0 {
                    return;
                }
                // 空間満杯チェック（P0-1 仮決定: 受け取れないなら宣言ごと失敗）
                let vol = amt.saturating_mul(self.laws.specs[idx].volume) / QTY_SCALE;
                let space_total = self.space_used_total();
                if space_total + vol > self.params.total_space {
                    return;
                }
                let giver = self.humans.get_mut(&hid).unwrap();
                *giver.inventory.get_mut(&idx).unwrap() -= amt;
                giver.inventory.retain(|_, v| *v > 0);
                let receiver = self.humans.get_mut(&to).unwrap();
                *receiver.inventory.entry(idx).or_insert(0) += amt;
            }
            Act::Invoke { .. } => {
                // M1 で実装（harvest / 食事 / train / craft）。P0 では常に無効。
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

/// stats 上限の再エクスポート（brain 実装から使う）
pub const _STAT_MAX: Qty = STAT_MAX;

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
