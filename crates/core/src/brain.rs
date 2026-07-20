//! Brain 抽象。
//!
//! P0 ではネイティブ trait。WASM Component（wit/world.wit）実行系は後続フェーズで
//! この trait の実装として載せる（fuel 計量・部分実行は WASM 側で処理し、
//! エンジンには「commit 済み宣言の列」として渡る — Decision がその列に相当する）。

use crate::{HumanId, Qty, ResourceId};

/// snapshot（P0 最小版）。WIT の observation.snapshot のサブセット。
#[derive(Clone, Debug)]
pub struct Snapshot {
    pub now: u32,
    /// hash(seed, human-id, tick)。brain 唯一の乱数源
    pub rand: u64,
    pub id: HumanId,
    pub age_months: u32,
    pub health: Qty,
    pub space_used: Qty,
    pub space_free: Qty,
    /// 公開 resource-id で表現した保有
    pub resources: Vec<(ResourceId, Qty)>,
}

/// commit 済みの宣言列（WIT の commit.push-act の積み上げ結果に相当）
#[derive(Clone, Debug)]
pub enum Act {
    Invoke {
        inputs: Vec<(ResourceId, Qty)>,
        using_skills: Vec<u64>,
    },
    Give {
        to: HumanId,
        resource: ResourceId,
        amount: Qty,
    },
    Discard {
        resource: ResourceId,
        amount: Qty,
    },
    Idle,
}

#[derive(Clone, Debug, Default)]
pub struct Decision {
    pub acts: Vec<Act>,
    /// None = save-memory を呼ばなかった（先月のまま）
    pub memory: Option<Vec<u8>>,
}

pub trait Brain {
    fn decide(&mut self, snap: &Snapshot) -> Decision;
}

/// P0 のダミー brain。何もしない（PLAN の P0 完了条件用）。
pub struct IdleBrain;

impl Brain for IdleBrain {
    fn decide(&mut self, _snap: &Snapshot) -> Decision {
        Decision::default()
    }
}
