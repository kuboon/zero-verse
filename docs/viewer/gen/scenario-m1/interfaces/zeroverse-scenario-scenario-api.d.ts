/** @module Interface zeroverse:scenario/scenario-api@0.1.0 **/
export function init(seed: bigint): WorldSetup;
export function judge(report: WorldReport): Verdict;
export interface SkillGrant {
  skillIndex: number,
  proficiency: bigint,
}
export interface HumanSetup {
  brainGroup: number,
  skills: Array<SkillGrant>,
  acquaintances: Uint32Array,
}
export interface WorldSetup {
  humans: Array<HumanSetup>,
}
export interface GroupReport {
  group: number,
  alive: number,
  total: number,
  meanConsumed: bigint,
}
export interface WorldReport {
  month: number,
  groups: Array<GroupReport>,
}
export interface Verdict {
  cleared: boolean,
  score: bigint,
  note: string,
}
