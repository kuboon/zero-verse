//! 世界状態。決定論のため反復順序が安定なコンテナ（BTreeMap / Vec）だけを使う。

use crate::brain::Event;
use crate::laws::{LawGraph, COMP_DIM, N_RESOURCES};
use crate::rng::Fnv1a;
use crate::{HumanId, Qty, WorldParams, QTY_SCALE, STAT_MAX};
use std::collections::{BTreeMap, BTreeSet};

/// sex の真値: -10〜+10 の整数（負 = 女性、正 = 男性、0 = 中性）。
/// 符号は出生時 1/2。conceive は符号が逆のペアでのみ成立し（負側が母）、
/// |sex| は繁殖力に影響せず**見かけの判りやすさ**にだけ効く
///（apparent-sex = 真値 + 観測者ペア固定ノイズ → pages/content/docs/human.md）。
pub type SexValue = i8;

/// sex 値の範囲（±SEX_MAX）
pub const SEX_MAX: i8 = 10;

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
    pub sex: SexValue,
    pub age_months: u32,
    pub stats: Stats,
    /// 妊娠中なら (出産予定月, 父)。女性のみ
    pub pregnant: Option<(u32, HumanId)>,
    /// key は法則グラフの内部 index（公開 id への変換は snapshot 生成時のみ）
    pub inventory: BTreeMap<usize, Qty>,
    /// skill 内部 index → 熟練度
    pub skills: BTreeMap<usize, Qty>,
    /// 学習中の skill → 進捗ポイント（完了で skills へ → pages/content/docs/skills.md）
    pub learning: BTreeMap<usize, u64>,
    pub acquaintances: BTreeSet<HumanId>,
    /// 生涯消費（食事の Δg 総和の生の積、1/1000^2 スケール → pages/content/docs/scoring.md）
    pub consumed_dg: u128,
    /// 今月発生し、来月の snapshot で届くイベント
    pub pending_events: Vec<Event>,
    pub memory: Vec<u8>,
}

impl Human {
    pub fn is_female(&self) -> bool {
        self.sex < 0
    }

    pub fn is_male(&self) -> bool {
        self.sex > 0
    }

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
    /// 先月の板の公開気配（(seller, give_idx, give_amt, want_idx, want_amt)。記名）
    pub last_quotes: Vec<(HumanId, usize, Qty, usize, Qty)>,
    /// 約定回数の累計（内部 index → 回数。M2 の取引集中の計測用）
    pub trade_volume: BTreeMap<usize, u64>,
    /// if-taught-me 条件で実行された支払いの累計回数（M3 の計測用）
    pub paid_teach_transfers: u64,
    /// リバースエンジニアリングによる skill 獲得の累計回数（M3 の計測用）
    pub re_acquisitions: u64,
    /// 親密度（公理 10）。key は (min, max) の順序付きペア。当事者だけに可視
    pub intimacy: BTreeMap<(HumanId, HumanId), Qty>,
    /// Westermarck 刷り込みペア（conceive 対象外。→ pages/content/docs/kinship.md）
    pub imprinted: std::collections::BTreeSet<(HumanId, HumanId)>,
    /// 血縁台帳: child → (mother, father)。world 内部とメタ層（採点・継承）専用。
    /// brain には一切露出しない（公理 8: 血縁は観測できない）
    pub parentage: BTreeMap<HumanId, (HumanId, HumanId)>,
    pub births: u64,
    /// 血縁投資の台帳（メタ層・M4 計測用）: (親, 子) → (一方的贈与の総量 qty, teach 進捗月数)。
    /// conditional-give / 板経由は計上しない（無償の投資だけを測る）
    pub parental_investment: BTreeMap<(HumanId, HumanId), (Qty, u64)>,
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
        for &(hid, gi, ga, wi, wa) in &self.last_quotes {
            f.write_u64(hid);
            f.write_u64(gi as u64);
            f.write_u64(ga);
            f.write_u64(wi as u64);
            f.write_u64(wa);
        }
        for (&idx, &n) in &self.trade_volume {
            f.write_u64(idx as u64);
            f.write_u64(n);
        }
        f.write_u64(self.paid_teach_transfers);
        f.write_u64(self.re_acquisitions);
        f.write_u64(self.births);
        for (&(a, b), &v) in &self.intimacy {
            f.write_u64(a);
            f.write_u64(b);
            f.write_u64(v);
        }
        for &(a, b) in &self.imprinted {
            f.write_u64(a);
            f.write_u64(b);
        }
        for (&c, &(m, fa)) in &self.parentage {
            f.write_u64(c);
            f.write_u64(m);
            f.write_u64(fa);
        }
        for (&(p, c), &(g, t)) in &self.parental_investment {
            f.write_u64(p);
            f.write_u64(c);
            f.write_u64(g);
            f.write_u64(t);
        }
        f.write_u64(self.humans.len() as u64);
        for h in self.humans.values() {
            f.write_u64(h.id);
            f.write_u8(h.sex as u8);
            f.write_u32(h.age_months);
            match h.pregnant {
                None => f.write_u8(0),
                Some((due, father)) => {
                    f.write_u8(1);
                    f.write_u32(due);
                    f.write_u64(father);
                }
            }
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
            f.write_u64(h.learning.len() as u64);
            for (&idx, &p) in &h.learning {
                f.write_u64(idx as u64);
                f.write_u64(p);
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
        Event::TradeExecuted {
            counterparty,
            gave,
            got,
        } => {
            f.write_u8(6);
            f.write_u64(*counterparty);
            f.write_u64(gave.0);
            f.write_u64(gave.1);
            f.write_u64(got.0);
            f.write_u64(got.1);
        }
        Event::TeachProgressed { partner, skill } => {
            f.write_u8(7);
            f.write_u64(*partner);
            f.write_u64(*skill);
        }
        Event::SkillAcquired(s) => {
            f.write_u8(8);
            f.write_u64(*s);
        }
        Event::ChildBorn(c) => {
            f.write_u8(9);
            f.write_u64(*c);
        }
        Event::Introduced { via, subject } => {
            f.write_u8(10);
            f.write_u64(*via);
            f.write_u64(*subject);
        }
        Event::ActionFailed => f.write_u8(5),
    }
}

pub fn clamp_stat(v: Qty) -> Qty {
    v.min(STAT_MAX)
}
