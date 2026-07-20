/** @module Interface zeroverse:world/brain-api@0.1.0 **/
export function init(config: WorldConfig): void;
export function decide(snap: Snapshot, memory: Uint8Array): void;
export type WorldConfig = import('./zeroverse-world-types.js').WorldConfig;
export type Snapshot = import('./zeroverse-world-observation.js').Snapshot;
