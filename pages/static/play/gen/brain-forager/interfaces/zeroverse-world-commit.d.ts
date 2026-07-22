/** @module Interface zeroverse:world/commit@0.1.0 **/
export function pushAct(a: Act): void;
export function saveMemory(data: Uint8Array): void;
export type Act = import('./zeroverse-world-action.js').Act;
