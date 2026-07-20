//! zeroverse engine core (P0)
//!
//! 決定論 lockstep シミュレーション。同一シード → バイト単位で同一の歴史。
//! 設計は docs/design/ を source of truth とする。
//!
//! P0 スコープ:
//! - tick パイプライン（自発変換 → 環境変換 → decide → resolve → upkeep）
//! - 環境循環（公理 4）: harvest/discard/死亡還元だけが境界を越える
//! - 空間（公理 11）: 身体 + 保有体積の占有と維持費 κ
//! - world 全体の組成保存アサーション
//! - Brain trait（ネイティブ実装。WASM 実行系は後続フェーズで同じ trait に載せる）

pub mod brain;
pub mod engine;
pub mod laws;
pub mod market;
pub mod rng;
pub mod scenarios;
pub mod state;

pub type Qty = u64;
pub type HumanId = u64;
pub type ResourceId = u64;

/// qty は 1/1000 固定小数点（docs/design/02-resources.md）
pub const QTY_SCALE: u64 = 1000;

/// stats の上限 100.000
pub const STAT_MAX: Qty = 100 * QTY_SCALE;

/// world パラメータ。brain に公開してよいものは WIT の world-config に写す。
#[derive(Clone, Debug)]
pub struct WorldParams {
    pub months_per_year: u32,
    pub max_lifespan_months: u32,
    pub act_slots_base: u32,
    /// 総空間 S（公理 11）
    pub total_space: Qty,
    /// 占有維持費 κ: 保管体積 1.000 あたりの health 減少 / 月
    pub upkeep_per_volume: Qty,
    /// 何もしなくても毎月減る health（食事で回復する）
    pub health_decay_per_month: Qty,
    /// 環境変換が 1 ヶ月に増やせる自由エネルギーの上限 Φ
    pub phi_per_month: Qty,
    /// 身体の占有体積（P0 仮: 年齢によらず定数）
    pub body_volume: Qty,
    /// 生成時の環境ストック（primary 1 種あたり）
    pub initial_env_stock: Qty,
    /// 生成時の human 保有（primary 1 種あたり）
    pub initial_human_stock: Qty,
    /// harvest の基本獲得量（熟練度 100% ・ストック十分のとき）
    pub harvest_base_yield: Qty,
    /// harvest 1 回あたりの strength 消費
    pub harvest_strength_cost: Qty,
    /// harvest のストック残量係数の半飽和点（stock/(stock+half) → 枯渇で細る）
    pub harvest_half_saturation: Qty,
    /// strength の毎月回復量（能力曲線の基準値まで）
    pub strength_regen_per_month: Qty,
    /// 食事 1.000 単位あたりの health 回復
    pub eat_health_per_unit: Qty,
    /// ε: 偶発的出会いの確率（千分率/月。公理 6）
    pub epsilon_permille: u64,
    /// 思考コスト換算: health 0.001 あたりの fuel（docs/design/human.md）
    pub fuel_per_health: u64,
    /// 教育完了に必要な進捗ポイント（毎月 教師熟練% × 学習者cognition% が貯まる）
    pub teach_progress_needed: u64,
    /// 教育で獲得した skill の初期熟練度
    pub learn_initial_prof: Qty,
    /// リバースエンジニアリング確率（‰/月。産出 resource が板で売られている skill が対象）
    pub re_permille: u64,
}

impl Default for WorldParams {
    fn default() -> Self {
        WorldParams {
            months_per_year: 12,
            max_lifespan_months: 80 * 12,
            act_slots_base: 4,
            total_space: 10_000 * QTY_SCALE,
            upkeep_per_volume: 20,       // 0.020 health / 体積 1.000 / 月
            health_decay_per_month: 500, // 0.500 / 月
            phi_per_month: 500 * QTY_SCALE,
            body_volume: QTY_SCALE, // 1.000
            initial_env_stock: 1_000 * QTY_SCALE,
            initial_human_stock: 10 * QTY_SCALE,
            harvest_base_yield: 3 * QTY_SCALE,
            harvest_strength_cost: 5 * QTY_SCALE,
            harvest_half_saturation: 200 * QTY_SCALE,
            strength_regen_per_month: 10 * QTY_SCALE,
            eat_health_per_unit: 2 * QTY_SCALE,
            epsilon_permille: 10,
            fuel_per_health: 1_000_000, // health 0.001 = 100 万 fuel（M1 仮）
            teach_progress_needed: 360, // 教師 100%・cognition 60% で 6 ヶ月
            learn_initial_prof: 50 * QTY_SCALE,
            re_permille: 2,
        }
    }
}
