//! Brain 抽象。
//!
//! P0/M1 ではネイティブ trait。WASM Component（wit/world.wit）実行系は後続フェーズで
//! この trait の実装として載せる（fuel 計量・部分実行は WASM 側で処理し、
//! エンジンには「commit 済み宣言の列」として渡る — Decision がその列に相当する）。

use crate::laws::SkillId;
use crate::state::SexValue;
use crate::{HumanId, Qty, ResourceId};

/// 先月自分に起きたこと（WIT の observation.event に相当。公開 id で表現）
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Event {
    ReceivedTransfer {
        from: HumanId,
        resource: ResourceId,
        amount: Qty,
    },
    /// ε 由来の偶発的出会い
    Encountered(HumanId),
    /// 知人の死のみ通知
    SomeoneDied(HumanId),
    /// 自分の invoke の結果（食事ブートストラップの搬送路。
    /// 6歳継承直後の brain はここから「どの resource × skill が食事か」を学ぶ。
    /// TODO: wit/world.wit の event にはまだ無い。wasm 統合時に同期する）
    InvokeResult {
        skill: SkillId,
        consumed: Vec<(ResourceId, Qty)>,
        produced: Vec<(ResourceId, Qty)>,
        /// health の増分（1/1000）
        health_gain: Qty,
    },
    /// 板での約定（→ pages/content/docs/market.md）
    TradeExecuted {
        counterparty: HumanId,
        gave: (ResourceId, Qty),
        got: (ResourceId, Qty),
    },
    /// 今月 teach/learn のペアが成立して 1 ヶ月分進捗した（残り月数は開示しない）
    TeachProgressed { partner: HumanId, skill: SkillId },
    /// skill を獲得した（教育の完了、またはリバースエンジニアリング）
    SkillAcquired(SkillId),
    /// via に subject を紹介された（introduce の受け手・被紹介者の双方に届く）
    Introduced { via: HumanId, subject: HumanId },
    /// 出産。**母にのみ届く**。父には 0 歳の知人が現れるだけ（pages/content/docs/kinship.md）
    ChildBorn(HumanId),
    /// 失敗理由は返さない
    ActionFailed,
}

/// 知人の観測ビュー（WIT の observation.acquaintance に相当）
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct AcquaintanceView {
    pub id: HumanId,
    /// 親密度（両者から同じ値が見える → pages/content/docs/human.md）
    pub intimacy: Qty,
    /// 見かけの年齢（年）。実年齢 + stats から算出され、実年齢そのものは見えない
    ///（→ pages/content/docs/human.md。健康を損ねた人は老けて見える）
    pub apparent_age: u32,
    /// 見かけの性別（-10〜+10。真値 + 観測者ペア固定ノイズ）。真値は見えない。
    /// |値| が大きいほど確信できる。±2〜3 は実際には逆符号の可能性が残る
    pub apparent_sex: i8,
    pub alive: bool,
}

/// 板の公開気配（記名 → pages/content/docs/market.md）
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BoardQuote {
    pub seller: HumanId,
    pub give_resource: ResourceId,
    pub give_amount: Qty,
    pub want_resource: ResourceId,
    pub want_amount: Qty,
}

/// standing order（WIT の action.standing-order。M2 では limit-order のみ。
/// conditional-give は teach/learn と一緒に M3 で入れる）
#[derive(Clone, Debug)]
pub enum StandingOrder {
    Limit {
        give_resource: ResourceId,
        give_amount: Qty,
        want_resource: ResourceId,
        want_amount: Qty,
        partial: bool,
    },
    ConditionalGive {
        to: HumanId,
        resource: ResourceId,
        amount: Qty,
        condition: GiveCondition,
    },
}

/// snapshot（M1 版）。WIT の observation.snapshot のサブセット。
#[derive(Clone, Debug)]
pub struct Snapshot {
    pub now: u32,
    /// hash(seed, human-id, tick)。brain 唯一の乱数源
    pub rand: u64,
    pub id: HumanId,
    pub age_months: u32,
    /// 自分の sex の真値（-10〜+10。自分の内側は全部見える）
    pub sex: SexValue,
    pub health: Qty,
    pub strength: Qty,
    pub cognition: Qty,
    pub fertility: Qty,
    pub space_used: Qty,
    pub space_free: Qty,
    /// 公開 resource-id で表現した保有
    pub resources: Vec<(ResourceId, Qty)>,
    /// 公開 skill-id と熟練度
    pub skills: Vec<(SkillId, Qty)>,
    /// 知人（親密度・見かけの年齢・生死 → pages/content/docs/human.md）
    pub acquaintances: Vec<AcquaintanceView>,
    pub events: Vec<Event>,
    /// 先月の板の公開気配（記名）
    pub market: Vec<BoardQuote>,
    /// 先月 save-memory した blob（decide の第 2 引数に相当）
    pub memory: Vec<u8>,
}

/// commit 済みの宣言列（WIT の commit.push-act の積み上げ結果に相当）
#[derive(Clone, Debug)]
pub enum Act {
    Invoke {
        inputs: Vec<(ResourceId, Qty)>,
        using_skills: Vec<SkillId>,
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
    /// 同月に相手の Learn と対をなして 1 ヶ月分進捗（→ pages/content/docs/skills.md）
    Teach {
        student: HumanId,
        skill: SkillId,
    },
    Learn {
        teacher: HumanId,
        skill: SkillId,
    },
    /// 自分の知人 to に、自分の知人 subject を紹介して知人にする
    ///（紹介ネットワーク → pages/content/docs/communication.md。見合いの土台）
    Introduce {
        to: HumanId,
        subject: HumanId,
    },
    Idle,
}

/// conditional-give の条件（WIT の action.give-condition）
#[derive(Clone, Debug)]
pub enum GiveCondition {
    /// 相対交換（OTC）: 今月 to から stack を受け取っていたら渡す
    IfReceived { resource: ResourceId, amount: Qty },
    /// 徒弟制の分割払い: 今月 to が自分に skill を教えて進捗したら渡す
    IfTaughtMe(SkillId),
    /// 無条件（予約送金）
    Unconditional,
}

#[derive(Clone, Debug, Default)]
pub struct Decision {
    pub acts: Vec<Act>,
    /// standing orders（毎月全交換 → pages/content/docs/market.md）
    pub orders: Vec<StandingOrder>,
    /// None = save-memory を呼ばなかった（先月のまま）
    pub memory: Option<Vec<u8>>,
    /// この decide が消費した WASM fuel。health の減少に写像される
    /// （pages/content/docs/human.md 思考コスト。ネイティブ brain は 0）
    pub fuel_used: u64,
}

pub trait Brain {
    fn decide(&mut self, snap: &Snapshot) -> Decision;
}

/// P0 のダミー brain。何もしない。
pub struct IdleBrain;

impl Brain for IdleBrain {
    fn decide(&mut self, _snap: &Snapshot) -> Decision {
        Decision::default()
    }
}
