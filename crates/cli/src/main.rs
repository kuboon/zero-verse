//! zeroverse ラン実行 CLI（P0）。
//!
//! 使い方:
//!   zeroverse run [--seed N] [--humans N] [--years N]
//!
//! 同一シードなら state hash は必ず一致する（リプレイ = シード）。

use std::collections::BTreeMap;
use zeroverse_core::brain::{Brain, IdleBrain};
use zeroverse_core::state::World;
use zeroverse_core::{HumanId, WorldParams};

fn parse_flag(args: &[String], name: &str, default: u64) -> u64 {
    args.iter()
        .position(|a| a == name)
        .and_then(|i| args.get(i + 1))
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) != Some("run") {
        eprintln!("usage: zeroverse run [--seed N] [--humans N] [--years N]");
        std::process::exit(2);
    }
    let seed = parse_flag(&args, "--seed", 42);
    let humans = parse_flag(&args, "--humans", 20) as usize;
    let years = parse_flag(&args, "--years", 100) as u32;

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
