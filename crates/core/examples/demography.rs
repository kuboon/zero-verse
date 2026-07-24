//! 人口衰退の診断プローブ: exp-m4 を大規模・長期間回し、
//! 「なぜ人口が再生産を維持できないか」を年次で計測する。
//!
//! 使い方: cargo run --release --example demography -- [seed] [scale] [years]

use std::collections::BTreeMap;
use zeroverse_core::scenarios::ExperimentSession;
use zeroverse_core::HumanId;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let seed: u64 = args.get(1).and_then(|s| s.parse().ok()).unwrap_or(42);
    let scale: u32 = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(10);
    let years: u32 = args.get(3).and_then(|s| s.parse().ok()).unwrap_or(300);

    let mut s = ExperimentSession::new("m4", seed, scale).unwrap();
    // 第 4 引数で conceive 閾値（‰）を上書きして比較実験できる
    if let Some(t) = args.get(4).and_then(|s| s.parse().ok()) {
        s.world.params.conceive_rel_permille = t;
    }
    let params = s.world.params.clone();
    println!(
        "seed={} scale={} 初期人口={} (寿命{}y 思春期{}y 閉経{}y conceive閾値{}‰)",
        seed,
        scale,
        s.world.humans.len(),
        params.max_lifespan_months / 12,
        params.puberty_months / 12,
        params.menopause_months / 12,
        params.conceive_rel_permille,
    );
    println!(
        "{:>4} {:>5} {:>6} {:>6} | {:>18} | {:>5} {:>5} {:>5} {:>6} | {:>6} {:>6}",
        "年",
        "人口",
        "累出生",
        "累死亡",
        "世代構成 g0/g1/g2/g3+",
        "妊性F",
        "妊娠",
        "対有",
        "縁0",
        "適齢",
        "縁故0"
    );

    let mut gen_memo: BTreeMap<HumanId, u32> = BTreeMap::new();

    for y in 1..=years {
        for _ in 0..12 {
            s.step_month();
        }
        let w = &s.world;
        if w.humans.is_empty() {
            println!("--- {} 年で全滅 ---", y);
            break;
        }
        // 世代: 血縁台帳を遡る（founder=0）
        fn gen_of(
            id: HumanId,
            parentage: &BTreeMap<HumanId, (HumanId, HumanId)>,
            memo: &mut BTreeMap<HumanId, u32>,
        ) -> u32 {
            if let Some(&g) = memo.get(&id) {
                return g;
            }
            let g = match parentage.get(&id) {
                None => 0,
                Some(&(m, f)) => 1 + gen_of(m, parentage, memo).max(gen_of(f, parentage, memo)),
            };
            memo.insert(id, g);
            g
        }

        // 相対親密度（engine の private fn を再計算）
        let rel = |from: HumanId, to: HumanId| -> u64 {
            let h = &w.humans[&from];
            let total: u128 = h
                .acquaintances
                .iter()
                .map(|&a| w.intimacy_of(from, a) as u128)
                .sum();
            if total == 0 {
                0
            } else {
                (w.intimacy_of(from, to) as u128 * 1000 / total) as u64
            }
        };

        let mut gens = [0usize; 4];
        let mut fertile_f = 0; // 妊性窓内の女性
        let mut pregnant = 0;
        let mut paired = 0; // 相互相対親密度 > 閾値の相手（≒事実婚）を持つ妊性女性
        let mut isolated_f = 0; // 妊性窓内で「妊性のある男性の知人」が 1 人もいない女性
        let mut adults_1845 = 0; // 適齢成人（両性 15-45）
        let mut no_eligible = 0; // 適齢成人のうち、求愛候補（異符号・非近親の知人）ゼロ
        for (&id, h) in &w.humans {
            let g = gen_of(id, &w.parentage, &mut gen_memo) as usize;
            gens[g.min(3)] += 1;

            let age_y = h.age_months / 12;
            if h.is_female() && h.stats.fertility > 0 {
                fertile_f += 1;
                if h.pregnant.is_some() {
                    pregnant += 1;
                }
                let mut has_partner = false;
                let mut has_male = false;
                for &m in &h.acquaintances {
                    let Some(mh) = w.humans.get(&m) else { continue };
                    if !mh.is_male() || mh.stats.fertility == 0 {
                        continue;
                    }
                    has_male = true;
                    if rel(id, m) > params.conceive_rel_permille
                        && rel(m, id) > params.conceive_rel_permille
                    {
                        has_partner = true;
                    }
                }
                if has_partner {
                    paired += 1;
                }
                if !has_male {
                    isolated_f += 1;
                }
            }

            // CourtingBrain の eligible 近似: 生存・異符号(見かけ)・15-50歳(見かけ)・
            // 非近親（親・きょうだい・刷り込み）
            if h.sex != 0 && (15..=45).contains(&age_y) {
                adults_1845 += 1;
                let my_sign = h.sex.signum();
                let parents = w.parentage.get(&id).copied();
                let mut eligible = 0;
                for &v in &h.acquaintances {
                    let Some(vh) = w.humans.get(&v) else { continue };
                    if w.apparent_sex(id, vh).signum() != -my_sign {
                        continue;
                    }
                    let va = w.apparent_age_years(vh);
                    if !(15..=50).contains(&va) {
                        continue;
                    }
                    // 近親除外の近似
                    if let Some((m, f)) = parents {
                        if v == m || v == f {
                            continue;
                        }
                        if w.parentage.get(&v).map(|&(vm, vf)| vm == m || vf == f) == Some(true) {
                            continue;
                        }
                    }
                    if w.imprinted.contains(&(id.min(v), id.max(v))) {
                        continue;
                    }
                    eligible += 1;
                }
                if eligible == 0 {
                    no_eligible += 1;
                }
            }
        }

        if y % 5 == 0 || w.humans.len() < 10 {
            println!(
                "{:>4} {:>5} {:>6} {:>6} | {:>4}/{:>4}/{:>4}/{:>4} | {:>5} {:>5} {:>5} {:>6} | {:>6} {:>6}",
                y,
                w.humans.len(),
                w.births,
                w.deaths,
                gens[0],
                gens[1],
                gens[2],
                gens[3],
                fertile_f,
                pregnant,
                paired,
                isolated_f,
                adults_1845,
                no_eligible,
            );
        }
    }
}
