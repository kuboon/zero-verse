//! 世界状態。決定論のため反復順序が安定なコンテナ（BTreeMap / Vec）だけを使う。

use crate::laws::{LawGraph, COMP_DIM, N_RESOURCES};
use crate::rng::Fnv1a;
use crate::{HumanId, Qty, WorldParams, QTY_SCALE, STAT_MAX};
use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Sex {
    Female,
    Male,
}

#[derive(Clone, Debug)]
pub struct Stats {
    pub health: Qty,
    pub strength: Qty,
    pub cognition: Qty,
    pub fertility: Qty,
}

#[derive(Clone, Debug)]
pub struct Human {
    pub id: HumanId,
    pub sex: Sex,
    pub age_months: u32,
    pub stats: Stats,
    /// key は法則グラフの内部 index（公開 id への変換は snapshot 生成時のみ）
    pub inventory: BTreeMap<usize, Qty>,
    pub memory: Vec<u8>,
}

impl Human {
    pub fn storage_volume(&self, laws: &LawGraph) -> Qty {
        self.inventory
            .iter()
            .map(|(&idx, &amt)| amt.saturating_mul(laws.specs[idx].volume) / QTY_SCALE)
            .sum()
    }

    pub fn space_used(&self, laws: &LawGraph, params: &WorldParams) -> Qty {
        params.body_volume + self.storage_volume(laws)
    }
}

#[derive(Clone, Debug)]
pub struct World {
    pub seed: u64,
    pub month: u32,
    pub params: WorldParams,
    pub laws: LawGraph,
    pub humans: BTreeMap<HumanId, Human>,
    /// 環境ストック（内部 index → 量）
    pub env: Vec<Qty>,
    pub deaths: u64,
}

impl World {
    /// world 全体（環境 + 全 human 在庫）の組成総量。保存則アサーションに使う。
    pub fn composition_totals(&self) -> [u128; COMP_DIM] {
        let mut tot = [0u128; COMP_DIM];
        let add = |idx: usize, amt: Qty, tot: &mut [u128; COMP_DIM]| {
            for (t, &c) in tot.iter_mut().zip(self.laws.specs[idx].comp.iter()) {
                *t += (amt as u128) * (c as u128);
            }
        };
        for (idx, &amt) in self.env.iter().enumerate() {
            add(idx, amt, &mut tot);
        }
        for h in self.humans.values() {
            for (&idx, &amt) in &h.inventory {
                add(idx, amt, &mut tot);
            }
        }
        tot
    }

    pub fn space_used_total(&self) -> Qty {
        self.humans
            .values()
            .map(|h| h.space_used(&self.laws, &self.params))
            .sum()
    }

    /// 世界状態の決定論的ハッシュ。同一シード・同一 tick 数なら必ず一致する。
    pub fn state_hash(&self) -> u64 {
        let mut f = Fnv1a::new();
        f.write_u64(self.seed);
        f.write_u32(self.month);
        f.write_u64(self.deaths);
        for &amt in &self.env {
            f.write_u64(amt);
        }
        f.write_u64(self.humans.len() as u64);
        for h in self.humans.values() {
            f.write_u64(h.id);
            f.write_u8(match h.sex {
                Sex::Female => 0,
                Sex::Male => 1,
            });
            f.write_u32(h.age_months);
            f.write_u64(h.stats.health);
            f.write_u64(h.stats.strength);
            f.write_u64(h.stats.cognition);
            f.write_u64(h.stats.fertility);
            f.write_u64(h.inventory.len() as u64);
            for (&idx, &amt) in &h.inventory {
                f.write_u64(idx as u64);
                f.write_u64(amt);
            }
            f.write_bytes(&h.memory);
        }
        assert_eq!(self.env.len(), N_RESOURCES);
        f.finish()
    }
}

pub fn clamp_stat(v: Qty) -> Qty {
    v.min(STAT_MAX)
}
