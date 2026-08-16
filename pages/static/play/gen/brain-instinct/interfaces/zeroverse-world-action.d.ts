/** @module Interface zeroverse:world/action@0.1.0 **/
export type ResourceStack = import('./zeroverse-world-types.js').ResourceStack;
export type SkillId = import('./zeroverse-world-types.js').SkillId;
export interface InvokeArgs {
  inputs: Array<ResourceStack>,
  usingSkills: BigUint64Array,
}
export type HumanId = import('./zeroverse-world-types.js').HumanId;
export interface GiveArgs {
  to: HumanId,
  stack: ResourceStack,
}
export interface TeachArgs {
  student: HumanId,
  skill: SkillId,
}
export interface LearnArgs {
  teacher: HumanId,
  skill: SkillId,
}
export interface IntroduceArgs {
  to: HumanId,
  subject: HumanId,
}
export type Act = ActInvoke | ActGive | ActDiscard | ActTeach | ActLearn | ActIntroduce | ActIdle;
export interface ActInvoke {
  tag: 'invoke',
  val: InvokeArgs,
}
export interface ActGive {
  tag: 'give',
  val: GiveArgs,
}
export interface ActDiscard {
  tag: 'discard',
  val: ResourceStack,
}
export interface ActTeach {
  tag: 'teach',
  val: TeachArgs,
}
export interface ActLearn {
  tag: 'learn',
  val: LearnArgs,
}
export interface ActIntroduce {
  tag: 'introduce',
  val: IntroduceArgs,
}
export interface ActIdle {
  tag: 'idle',
}
