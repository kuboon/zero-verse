//! 世界状態。決定論のため反復順序が安定なコンテナ（BTreeMap / Vec）だけを使う。

use crate::brain::Event;
use crate::laws::{LawGraph, COMP_DIM, N_RESOURCES};
use crate::rng::Fnv1a;
use crate::{HumanId, Qty, WorldParams, QTY_SCALE, STAT_MAX};
use std::collections::{BTreeMap, BTreeSet};

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
    /// skill 内部 index → 熟練度
    pub skills: BTreeMap<usize, Qty>,
    pub acquaintances: BTreeSet<HumanId>,
    /// 生涯消費（食事の Δg 総和の生の積、1/1000^2 スケール → docs/design/07-scoring.md）
    pub consumed_dg: u128,
    /// 今月発生し、来月の snapshot で届くイベント
    pub pending_events: Vec<Event>,
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
    /// 死亡した human の生涯消費（採点・M1 計測用の台帳。死亡順）
    pub dead_ledger: Vec<(HumanId, u128)>,
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

    /// 生涯消費（生死問わず）。id → Δg 総和（生の積スケール）
    pub fn lifetime_consumption(&self) -> BTreeMap<HumanId, u128> {
        let mut m: BTreeMap<HumanId, u128> =
            self.dead_ledger.iter().map(|&(id, c)| (id, c)).collect();
        for h in self.humans.values() {
            m.insert(h.id, h.consumed_dg);
        }
        m
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
        for &(id, c) in &self.dead_ledger {
            f.write_u64(id);
            f.write_u64((c >> 64) as u64);
            f.write_u64(c as u64);
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
            f.write_u64((h.consumed_dg >> 64) as u64);
            f.write_u64(h.consumed_dg as u64);
            f.write_u64(h.inventory.len() as u64);
            for (&idx, &amt) in &h.inventory {
                f.write_u64(idx as u64);
                f.write_u64(amt);
            }
            f.write_u64(h.skills.len() as u64);
            for (&idx, &prof) in &h.skills {
                f.write_u64(idx as u64);
                f.write_u64(prof);
            }
            f.write_u64(h.acquaintances.len() as u64);
            for &a in &h.acquaintances {
                f.write_u64(a);
            }
            f.write_u64(h.pending_events.len() as u64);
            for ev in &h.pending_events {
                hash_event(&mut f, ev);
            }
            f.write_bytes(&h.memory);
        }
        assert_eq!(self.env.len(), N_RESOURCES);
        f.finish()
    }
}

fn hash_event(f: &mut Fnv1a, ev: &Event) {
    match ev {
        Event::ReceivedTransfer {
            from,
            resource,
            amount,
        } => {
            f.write_u8(1);
            f.write_u64(*from);
            f.write_u64(*resource);
            f.write_u64(*amount);
        }
        Event::Encountered(id) => {
            f.write_u8(2);
            f.write_u64(*id);
        }
        Event::SomeoneDied(id) => {
            f.write_u8(3);
            f.write_u64(*id);
        }
        Event::InvokeResult {
            skill,
            consumed,
            produced,
            health_gain,
        } => {
            f.write_u8(4);
            f.write_u64(*skill);
            f.write_u64(consumed.len() as u64);
            for &(r, a) in consumed {
                f.write_u64(r);
                f.write_u64(a);
            }
            f.write_u64(produced.len() as u64);
            for &(r, a) in produced {
                f.write_u64(r);
                f.write_u64(a);
            }
            f.write_u64(*health_gain);
        }
        Event::ActionFailed => f.write_u8(5),
    }
}

pub fn clamp_stat(v: Qty) -> Qty {
    v.min(STAT_MAX)
}
