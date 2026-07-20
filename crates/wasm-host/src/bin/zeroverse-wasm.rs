//! wasm component ランナー。
//!
//! 使い方:
//!   zeroverse-wasm run --scenario <scenario.wasm> --brain <group>=<brain.wasm> ...
//!                      [--seed N] [--years N]
//!
//! scenario.init(seed) が world の初期条件（skill 賦与・知人・brain 割り当て）を返し、
//! 各 human は割り当てグループの brain component で決定する。
//! ラン終了後 scenario.judge(report) がクリア判定を返す（cleared でなければ exit 1）。

use anyhow::{bail, Context as _, Result};
use std::cell::RefCell;
use std::collections::BTreeMap;
use std::rc::Rc;
use zeroverse_core::brain::{Brain, Decision, Snapshot};
use zeroverse_core::state::World;
use zeroverse_core::{HumanId, WorldParams};
use zeroverse_wasm_host::{make_engine, scn, Scenario, WasmBrain};

/// 1 つの WasmBrain（Module 共有）を複数 human で使い回すための包み。
/// インスタンスは decide ごとに新規化されるので、共有はコードのみ（テレパシー禁止と整合）。
struct SharedBrain(Rc<RefCell<WasmBrain>>);

impl Brain for SharedBrain {
    fn decide(&mut self, snap: &Snapshot) -> Decision {
        self.0.borrow_mut().decide(snap)
    }
}

fn parse_flag(args: &[String], name: &str, default: u64) -> u64 {
    args.iter()
        .position(|a| a == name)
        .and_then(|i| args.get(i + 1))
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) != Some("run") {
        bail!(
            "usage: zeroverse-wasm run --scenario s.wasm --brain 0=b.wasm [--seed N] [--years N]"
        );
    }
    let seed = parse_flag(&args, "--seed", 42);
    let years = parse_flag(&args, "--years", 30) as u32;
    let scenario_path = args
        .iter()
        .position(|a| a == "--scenario")
        .and_then(|i| args.get(i + 1))
        .context("--scenario required")?;
    let mut brain_paths: BTreeMap<u32, String> = BTreeMap::new();
    for (i, a) in args.iter().enumerate() {
        if a == "--brain" {
            let spec = args.get(i + 1).context("--brain needs group=path")?;
            let (g, p) = spec.split_once('=').context("--brain format: group=path")?;
            brain_paths.insert(g.parse()?, p.to_string());
        }
    }
    if brain_paths.is_empty() {
        bail!("at least one --brain group=path required");
    }

    let engine = make_engine()?;
    let scenario = Scenario::load(&engine, scenario_path.as_ref())?;
    let setup = scenario.init(seed)?;
    let n = setup.humans.len();
    println!("scenario   : {scenario_path} ({n} humans)");

    let params = WorldParams::default();
    let mut world = World::new(seed, n, params.clone());
    let ids: Vec<HumanId> = world.humans.keys().copied().collect();

    // setup の適用（index → human-id は id 昇順で対応づける）
    for (i, hs) in setup.humans.iter().enumerate() {
        for g in &hs.skills {
            world.grant_skill(ids[i], g.skill_index as usize, g.proficiency);
        }
        for &a in &hs.acquaintances {
            if (a as usize) < n {
                world.add_acquaintance(ids[i], ids[a as usize]);
            }
        }
    }

    // brain component のロード（グループごとに 1 回コンパイルし、コードを共有）
    let mut group_brains: BTreeMap<u32, Rc<RefCell<WasmBrain>>> = BTreeMap::new();
    for (&g, path) in &brain_paths {
        let brain = WasmBrain::load(&engine, path.as_ref(), &params)?;
        group_brains.insert(g, Rc::new(RefCell::new(brain)));
        println!("brain g{g}  : {path}");
    }
    let mut brains: BTreeMap<HumanId, Box<dyn Brain>> = BTreeMap::new();
    for (i, hs) in setup.humans.iter().enumerate() {
        let shared = group_brains
            .get(&hs.brain_group)
            .with_context(|| format!("no --brain for group {}", hs.brain_group))?;
        brains.insert(ids[i], Box::new(SharedBrain(shared.clone())));
    }

    let trace = args.iter().any(|a| a == "--trace");
    let start = std::time::Instant::now();
    let months = years * world.params.months_per_year;
    for m in 0..months {
        world.step(&mut brains);
        if trace && m % 12 == 0 {
            let env_primary: u64 = world.env.iter().take(5).sum();
            let env_waste: u64 = world.env.iter().skip(5).sum();
            let mean_health: u64 = if world.humans.is_empty() {
                0
            } else {
                world.humans.values().map(|h| h.stats.health).sum::<u64>()
                    / world.humans.len() as u64
            };
            eprintln!(
                "y{:>3} alive {:>2} health~{:>6} env_p {:>9} env_w {:>9}",
                m / 12,
                world.humans.len(),
                mean_health,
                env_primary,
                env_waste
            );
        }
    }
    let elapsed = start.elapsed();

    // グループ別レポート
    let consumption = world.lifetime_consumption();
    let mut groups: BTreeMap<u32, (u32, u32, u128)> = BTreeMap::new();
    for (i, hs) in setup.humans.iter().enumerate() {
        let e = groups.entry(hs.brain_group).or_insert((0, 0, 0));
        e.1 += 1;
        if world.humans.contains_key(&ids[i]) {
            e.0 += 1;
        }
        e.2 += consumption.get(&ids[i]).copied().unwrap_or(0);
    }
    let report = scn::WorldReport {
        month: world.month,
        groups: groups
            .iter()
            .map(|(&group, &(alive, total, sum))| scn::GroupReport {
                group,
                alive,
                total,
                // 生の積（1/1000^2）→ 1/1000 スケールへ丸め
                mean_consumed: (sum / (total as u128).max(1) / 1000).min(u64::MAX as u128) as u64,
            })
            .collect(),
    };

    for g in &report.groups {
        println!(
            "group {}    : alive {}/{}  mean consumed {} (1/1000 g)",
            g.group, g.alive, g.total, g.mean_consumed
        );
    }
    println!("state hash : {:016x}", world.state_hash());
    println!("elapsed    : {:.3}s", elapsed.as_secs_f64());

    let verdict = scenario.judge(&report)?;
    println!(
        "verdict    : cleared={} score={} note={}",
        verdict.cleared, verdict.score, verdict.note
    );
    if !verdict.cleared {
        std::process::exit(1);
    }
    Ok(())
}
