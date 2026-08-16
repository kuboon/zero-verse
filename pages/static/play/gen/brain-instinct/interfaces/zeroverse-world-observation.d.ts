/** @module Interface zeroverse:world/observation@0.1.0 **/
export type Month = import('./zeroverse-world-types.js').Month;
export type HumanId = import('./zeroverse-world-types.js').HumanId;
export type Sex = import('./zeroverse-world-types.js').Sex;
export type Stat = import('./zeroverse-world-types.js').Stat;
export type ResourceStack = import('./zeroverse-world-types.js').ResourceStack;
export type Qty = import('./zeroverse-world-types.js').Qty;
export type SkillId = import('./zeroverse-world-types.js').SkillId;
export interface SkillView {
  skill: SkillId,
  proficiency: Qty,
}
/**
 * # Variants
 * 
 * ## `"invoke"`
 * 
 * ## `"give"`
 * 
 * ## `"discard"`
 * 
 * ## `"teach"`
 * 
 * ## `"learn"`
 * 
 * ## `"introduce"`
 * 
 * ## `"idle"`
 */
export type ActionKind = 'invoke' | 'give' | 'discard' | 'teach' | 'learn' | 'introduce' | 'idle';
export interface SelfView {
  id: HumanId,
  ageMonths: number,
  sex: Sex,
  stats: Array<Stat>,
  resources: Array<ResourceStack>,
  spaceUsed: Qty,
  spaceFree: Qty,
  skills: Array<SkillView>,
  availableActions: Array<ActionKind>,
  fuelBudget: bigint,
  memoryLimit: number,
}
export interface Acquaintance {
  id: HumanId,
  apparentAge: number,
  apparentSex: Sex,
  alive: boolean,
  intimacy: Qty,
  lastInteraction?: Month,
}
export interface TransferInfo {
  from: HumanId,
  stack: ResourceStack,
}
export interface TradeInfo {
  counterparty: HumanId,
  gave: ResourceStack,
  got: ResourceStack,
}
export interface TeachInfo {
  partner: HumanId,
  skill: SkillId,
}
export interface IntroductionInfo {
  via: HumanId,
  subject: HumanId,
}
export interface InvokeResultInfo {
  skill: SkillId,
  consumed: Array<ResourceStack>,
  produced: Array<ResourceStack>,
  healthGain: Qty,
}
export type Event = EventReceivedTransfer | EventTradeExecuted | EventTeachProgressed | EventSkillAcquired | EventIntroduced | EventEncountered | EventChildBorn | EventSomeoneDied | EventInvokeResult | EventActionFailed;
export interface EventReceivedTransfer {
  tag: 'received-transfer',
  val: TransferInfo,
}
export interface EventTradeExecuted {
  tag: 'trade-executed',
  val: TradeInfo,
}
export interface EventTeachProgressed {
  tag: 'teach-progressed',
  val: TeachInfo,
}
export interface EventSkillAcquired {
  tag: 'skill-acquired',
  val: SkillId,
}
export interface EventIntroduced {
  tag: 'introduced',
  val: IntroductionInfo,
}
export interface EventEncountered {
  tag: 'encountered',
  val: HumanId,
}
export interface EventChildBorn {
  tag: 'child-born',
  val: HumanId,
}
export interface EventSomeoneDied {
  tag: 'someone-died',
  val: HumanId,
}
export interface EventInvokeResult {
  tag: 'invoke-result',
  val: InvokeResultInfo,
}
export interface EventActionFailed {
  tag: 'action-failed',
  val: ActionKind,
}
export type ResourceId = import('./zeroverse-world-types.js').ResourceId;
export interface BoardQuote {
  seller: HumanId,
  giveResource: ResourceId,
  giveAmount: Qty,
  wantResource: ResourceId,
  wantAmount: Qty,
}
export interface Snapshot {
  now: Month,
  rand: bigint,
  selfView: SelfView,
  acquaintances: Array<Acquaintance>,
  events: Array<Event>,
  market: Array<BoardQuote>,
}
