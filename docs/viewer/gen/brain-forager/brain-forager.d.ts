// world root:component/root
import type * as ZeroverseWorldAction from './interfaces/zeroverse-world-action.js'; // zeroverse:world/action@0.1.0
import type * as ZeroverseWorldCommit from './interfaces/zeroverse-world-commit.js'; // zeroverse:world/commit@0.1.0
import type * as ZeroverseWorldObservation from './interfaces/zeroverse-world-observation.js'; // zeroverse:world/observation@0.1.0
import type * as ZeroverseWorldTypes from './interfaces/zeroverse-world-types.js'; // zeroverse:world/types@0.1.0
import type * as ZeroverseWorldBrainApi from './interfaces/zeroverse-world-brain-api.js'; // zeroverse:world/brain-api@0.1.0
export interface ImportObject {
  'zeroverse:world/action@0.1.0': typeof ZeroverseWorldAction,
  'zeroverse:world/commit@0.1.0': typeof ZeroverseWorldCommit,
  'zeroverse:world/observation@0.1.0': typeof ZeroverseWorldObservation,
  'zeroverse:world/types@0.1.0': typeof ZeroverseWorldTypes,
}
export interface Root {
  'zeroverse:world/brain-api@0.1.0': typeof ZeroverseWorldBrainApi,
  brainApi: typeof ZeroverseWorldBrainApi,
}

/**
* Instantiates this component with the provided imports and
* returns a map of all the exports of the component.
*
* This function is intended to be similar to the
* `WebAssembly.Instantiate` constructor. The second `imports`
* argument is the "import object" for wasm, except here it
* uses component-model-layer types instead of core wasm
* integers/numbers/etc.
*
* The first argument to this function, `getCoreModule`, is
* used to compile core wasm modules within the component.
* Components are composed of core wasm modules and this callback
* will be invoked per core wasm module. The caller of this
* function is responsible for reading the core wasm module
* identified by `path` and returning its compiled
* `WebAssembly.Module` object. This would use the
* `WebAssembly.Module` constructor on the web, for example.
*/
export function instantiate(
getCoreModule: (path: string) => WebAssembly.Module,
imports: ImportObject,
instantiateCore?: (module: WebAssembly.Module, imports: Record<string, any>) => WebAssembly.Instance
): Root;

