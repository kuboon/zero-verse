//! zeroverse ラン実行 CLI。
//!
//! 使い方:
//!   zeroverse run [--seed N] [--humans N] [--years N]   idle brain の決定論ラン
//!   zeroverse m1  [--seeds N] [--pairs N] [--years N]   M1 実験（交易 vs 自給自足）
//!
//! 同一シードなら state hash は必ず一致する（リプレイ = シード）。

use std::collections::BTreeMap;
use zeroverse_core::brain::{Brain, IdleBrain};
use zeroverse_core::scenarios::run_m1;
use zeroverse_core::state::World;
use zeroverse_core::{HumanId, WorldParams};

fn parse_flag(args: &[String], name: &str, default: u64) -> u64 {
    args.iter()
        .position(|a| a == name)
        .and_then(|i| args.get(i + 1))
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn cmd_run(args: &[String]) {
    let seed = parse_flag(args, "--seed", 42);
    let humans = parse_flag(args, "--humans", 20) as usize;
    let years = parse_flag(args, "--years", 100) as u32;

    let mut world = World::new(seed, humans, WorldParams::default());
    let mut brains: BTreeMap<HumanId, Box<dyn Brain>> = world
        .humans
        .keys()
        .map(|&id| (id, Box::new(IdleBrain) as Box<dyn Brain>))
        .collect();

    let start = std::time::Instant::now();
    let months = years * world.params.months_per_year;
    world.run(months, &mut brains);
    let elapsed = start.elapsed();

    println!("seed       : {seed}");
    println!("months     : {months}");
    println!("alive      : {}", world.humans.len());
    println!("deaths     : {}", world.deaths);
    println!("state hash : {:016x}", world.state_hash());
    println!("elapsed    : {:.3}s", elapsed.as_secs_f64());
}

fn cmd_m1(args: &[String]) {
    let seeds = parse_flag(args, "--seeds", 5);
    let pairs = parse_flag(args, "--pairs", 5) as usize;
    let years = parse_flag(args, "--years", 60) as u32;

    println!("M1: 交易 brain vs 自給自足 brain（{pairs} ペア × 4 人、{years} 年）");
    println!(
        "{:>6} {:>14} {:>14} {:>8}",
        "seed", "trader", "autarky", "ratio"
    );
    let mut ok = 0;
    for seed in 1..=seeds {
        let r = run_m1(seed, pairs, years, WorldParams::default());
        println!(
            "{:>6} {:>14.0} {:>14.0} {:>8.3}",
            seed, r.trader_mean, r.autarky_mean, r.ratio
        );
        if r.ratio > 1.0 {
            ok += 1;
        }
    }
    println!("ratio > 1.0: {ok}/{seeds} seeds（M1 合格基準: 全シードで > 1.0）");
    if ok < seeds {
        std::process::exit(1);
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("run") => cmd_run(&args),
        Some("m1") => cmd_m1(&args),
        _ => {
            eprintln!("usage: zeroverse run [--seed N] [--humans N] [--years N]");
            eprintln!("       zeroverse m1  [--seeds N] [--pairs N] [--years N]");
            std::process::exit(2);
        }
    }
}
