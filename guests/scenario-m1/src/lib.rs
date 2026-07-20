//! シナリオ component 参照実装: 「forager の生存」。
//!
//! init: 20 human。各人に食事 skill（E_edible 高熟練）と harvest skill
//!       （specialty 高熟練 + edible 低熟練）を賦与する。M1 実験と同じ賦存。
//! judge: 全員が生き延び、平均消費が正ならクリア。
//!        brain は法則を知らずに始まるので、これは「実験から食事を発見できたか」の判定になる。

wit_bindgen::generate!({
    path: "../../wit-scenario",
    world: "scenario",
});

use exports::zeroverse::scenario::scenario_api::{
    GroupReport, Guest, HumanSetup, SkillGrant, Verdict, WorldReport, WorldSetup,
};

const N_PRIMARY: u32 = 5;
const N_HUMANS: u32 = 20;
const HIGH: u64 = 100_000; // 熟練 100%
const LOW: u64 = 30_000; // 熟練 30%

struct M1Scenario;

impl Guest for M1Scenario {
    fn init(_seed: u64) -> WorldSetup {
        let humans = (0..N_HUMANS)
            .map(|i| {
                let edible = i % N_PRIMARY;
                let specialty = (i + 1) % N_PRIMARY;
                HumanSetup {
                    brain_group: 0,
                    skills: vec![
                        SkillGrant {
                            skill_index: N_PRIMARY + edible, // E_edible
                            proficiency: HIGH,
                        },
                        SkillGrant {
                            skill_index: specialty, // H_specialty
                            proficiency: HIGH,
                        },
                        SkillGrant {
                            skill_index: edible, // H_edible（低）
                            proficiency: LOW,
                        },
                    ],
                    acquaintances: vec![],
                }
            })
            .collect();
        WorldSetup { humans }
    }

    fn judge(report: WorldReport) -> Verdict {
        let g: Option<&GroupReport> = report.groups.first();
        let (alive, total, consumed) = g
            .map(|g| (g.alive, g.total, g.mean_consumed))
            .unwrap_or((0, 0, 0));
        let cleared = total > 0 && alive == total && consumed > 1_000;
        Verdict {
            cleared,
            score: consumed,
            note: format!(
                "alive {alive}/{total}, mean consumed {consumed} (threshold 1000) at month {}",
                report.month
            ),
        }
    }
}

export!(M1Scenario);
