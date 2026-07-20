//! 法則グラフ（M1 版）。
//!
//! resource は primary 5 種 + それぞれの劣化先（廃棄物）5 種の計 10 種。
//! - 劣化（g 減衰）は自発変換: primary i → waste i（組成同一・g 低下・1:1）
//! - 環境変換（光合成）: waste i → primary i（g 増分の合計 ≤ Φ/月）
//!
//! skill は primary ごとに 2 種（計 10 種）:
//! - harvest_i: strength を消費して環境から primary i を採取（獲得量はストック残量依存）
//! - eat_i:     primary i を health + waste i に変換（食文化 → docs/design/03-skills.md）
//!
//! 組成が同一ペア間の 1:1 変換なので、組成保存は構造的に厳密。
//! M2+ でここを本物の手続き的化学（craft 連鎖・深い skill）に拡張する。

use crate::rng::{hash2, hash3};
use crate::{Qty, ResourceId, QTY_SCALE};
use std::collections::BTreeMap;

pub const COMP_DIM: usize = 3;
pub const N_PRIMARY: usize = 5;
pub const N_RESOURCES: usize = N_PRIMARY * 2;
pub const N_SKILLS: usize = N_PRIMARY * 2;

pub type SkillId = u64;

#[derive(Clone, Debug)]
pub struct ResourceSpec {
    /// 1.000 単位あたりの組成ベクトル（隠し属性）
    pub comp: [u64; COMP_DIM],
    /// 1.000 単位あたりの自由エネルギー g（隠し属性）
    pub g: Qty,
    /// 1.000 単位あたりの体積 v（隠し属性）
    pub volume: Qty,
    /// 劣化率 λ（千分率/月）。0 なら劣化しない（廃棄物は終端）
    pub decay_permille: u64,
    /// 劣化先の spec index
    pub decay_into: usize,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SkillKind {
    /// 環境から primary i を採取する
    Harvest(usize),
    /// primary i を食べて health に変換する（waste i を産出）
    Eat(usize),
}

#[derive(Clone, Debug)]
pub struct LawGraph {
    /// 内部 index（0..N_PRIMARY が primary、N_PRIMARY.. が対応する廃棄物）
    pub specs: Vec<ResourceSpec>,
    /// 内部 index → 公開 resource-id（シャッフル済み・非連番）
    pub id_of_index: Vec<ResourceId>,
    /// 公開 resource-id → 内部 index
    pub index_of_id: BTreeMap<ResourceId, usize>,
    /// skill（内部 index: 0..N_PRIMARY が harvest_i、N_PRIMARY.. が eat_i）
    pub skills: Vec<SkillKind>,
    pub skill_id_of_index: Vec<SkillId>,
    pub skill_index_of_id: BTreeMap<SkillId, usize>,
}

impl LawGraph {
    pub fn generate(seed: u64) -> LawGraph {
        let mut specs = Vec::with_capacity(N_RESOURCES);
        // primary
        for i in 0..N_PRIMARY {
            let h = hash3(seed, 0xC0DE, i as u64);
            let mut comp = [0u64; COMP_DIM];
            for (d, c) in comp.iter_mut().enumerate() {
                *c = 1 + hash3(h, 0x11, d as u64) % 4;
            }
            let g = (5 + h % 11) * QTY_SCALE; // 5.000〜15.000
            let volume = QTY_SCALE / 2 + hash2(h, 0x22) % (QTY_SCALE * 3 / 2); // 0.5〜2.0
            let decay_permille = 5 + hash2(h, 0x33) % 96; // 5〜100 ‰/月
            specs.push(ResourceSpec {
                comp,
                g,
                volume,
                decay_permille,
                decay_into: N_PRIMARY + i,
            });
        }
        // 廃棄物（primary と同組成・低 g・終端）
        for i in 0..N_PRIMARY {
            let p = specs[i].clone();
            specs.push(ResourceSpec {
                comp: p.comp,
                g: p.g / 4,
                volume: p.volume,
                decay_permille: 0,
                decay_into: N_PRIMARY + i,
            });
        }

        let (id_of_index, index_of_id) = shuffle_ids(seed, 0x1D5, N_RESOURCES);

        // skill: harvest_i (0..N_PRIMARY), eat_i (N_PRIMARY..)
        let mut skills = Vec::with_capacity(N_SKILLS);
        for i in 0..N_PRIMARY {
            skills.push(SkillKind::Harvest(i));
        }
        for i in 0..N_PRIMARY {
            skills.push(SkillKind::Eat(i));
        }
        let (skill_id_of_index, skill_index_of_id) = shuffle_ids(seed, 0x51C1, N_SKILLS);

        LawGraph {
            specs,
            id_of_index,
            index_of_id,
            skills,
            skill_id_of_index,
            skill_index_of_id,
        }
    }

    /// waste i → primary i の 1 単位（1/1000）あたりの g 増分
    pub fn regen_gain_per_unit(&self, i: usize) -> Qty {
        let p = &self.specs[i];
        let w = &self.specs[p.decay_into];
        (p.g - w.g) / QTY_SCALE.max(1)
    }

    /// 食事 1.000 単位あたりの自由エネルギー差 Δg（消費計測 → docs/design/07-scoring.md）
    pub fn eat_delta_g(&self, primary: usize) -> Qty {
        let p = &self.specs[primary];
        let w = &self.specs[p.decay_into];
        p.g - w.g
    }
}

/// ハッシュ由来の非連番 id を n 個生成する（衝突時はリハッシュ）
fn shuffle_ids(seed: u64, tag: u64, n: usize) -> (Vec<u64>, BTreeMap<u64, usize>) {
    let mut id_of_index = Vec::with_capacity(n);
    let mut index_of_id = BTreeMap::new();
    for i in 0..n {
        let mut salt = 0u64;
        let id = loop {
            let cand = hash3(seed, tag, (i as u64) << 8 | salt);
            if cand != 0 && !index_of_id.contains_key(&cand) {
                break cand;
            }
            salt += 1;
        };
        id_of_index.push(id);
        index_of_id.insert(id, i);
    }
    (id_of_index, index_of_id)
}
