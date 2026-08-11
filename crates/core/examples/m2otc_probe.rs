//! M2′（板なし OTC）の観察プローブ。
//! 使い方: cargo run --release --example m2otc_probe -- [seed] [years]

use zeroverse_core::scenarios::{run_m2, run_m2_otc};
use zeroverse_core::WorldParams;

fn main() {
    let seed: u64 = std::env::args()
        .nth(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(1);
    let years: u32 = std::env::args()
        .nth(2)
        .and_then(|s| s.parse().ok())
        .unwrap_or(20);

    println!("=== M2（板あり）seed {seed} {years}年 ===");
    let r = run_m2(seed, years, WorldParams::default());
    println!(
        "top=#{} share={}‰ λrank={} involvement={:?}",
        r.top, r.top_share, r.top_lambda_rank, r.involvement
    );

    println!("=== M2′（板なし OTC）seed {seed} {years}年 ===");
    let r = run_m2_otc(seed, years, WorldParams::default());
    println!(
        "top=#{} share={}‰ λrank={} involvement={:?}",
        r.top, r.top_share, r.top_lambda_rank, r.involvement
    );

    // 期間別の限界シェア（支払いのみ）: 収束の進行を累計でなく増分で見る
    use zeroverse_core::scenarios::build_m2_otc;
    let mut setup = build_m2_otc(seed, 20, WorldParams::default());
    let pay = |w: &zeroverse_core::state::World, i: usize| -> u64 {
        w.give_volume.get(&i).copied().unwrap_or(0)
            - w.cond_give_volume.get(&i).copied().unwrap_or(0)
    };
    let mut prev = [0u64; 10];
    for period in 0..4 {
        for _ in 0..(5 * 12) {
            setup.world.step(&mut setup.brains);
        }
        let cur: Vec<u64> = (0..10).map(|i| pay(&setup.world, i)).collect();
        let delta: Vec<u64> = (0..10).map(|i| cur[i] - prev[i]).collect();
        let total: u64 = delta.iter().sum();
        let (top, &top_v) = delta.iter().enumerate().max_by_key(|&(_, v)| v).unwrap();
        println!(
            "  {}〜{}年: 支払い {} 件, top=#{} {}‰, alive={}",
            period * 5,
            (period + 1) * 5,
            total,
            top,
            (top_v * 1000).checked_div(total).unwrap_or(0),
            setup.world.humans.len(),
        );
        prev.copy_from_slice(&cur);
    }
}
