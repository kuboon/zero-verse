/** @module Interface zeroverse:world/types@0.1.0 **/
export type ResourceId = bigint;
export type Qty = bigint;
export interface ResourceStack {
  resource: ResourceId,
  amount: Qty,
}
export type SkillId = bigint;
export type HumanId = bigint;
export interface WorldConfig {
  monthsPerYear: number,
  maxLifespanMonths: number,
  actSlotsBase: number,
  qtyScale: number,
  totalSpace: Qty,
  upkeepPerVolume: Qty,
  fuelPerHealth: bigint,
  acquaintanceCap: number,
}
export type Month = number;
/**
 * # Variants
 * 
 * ## `"female"`
 * 
 * ## `"male"`
 */
export type Sex = 'female' | 'male';
/**
 * # Variants
 * 
 * ## `"health"`
 * 
 * ## `"strength"`
 * 
 * ## `"cognition"`
 * 
 * ## `"fertility"`
 */
export type StatKind = 'health' | 'strength' | 'cognition' | 'fertility';
export interface Stat {
  kind: StatKind,
  value: Qty,
}
