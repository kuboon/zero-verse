import { get, route } from "remix/routes";
import { base } from "./base.ts";

/**
 * Relative route definitions. `get(...)` declares each as a `GET` route.
 *
 * Add a page by adding a route here and mapping an action in `router.tsx`.
 */
const defs = {
  home: get("/"),
  play: get("/play"),
  docs: {
    index: get("/docs"),
    show: get("/docs/:slug"),
  },
  // Static assets (viewer app + wasm, stylesheets, favicon, …) live in `static/`.
  static: get("/static/*path"),
};

/**
 * The route *group* with relative patterns. The router maps handlers to this
 * under the base-path mount (see `router.tsx`), so handlers never repeat the
 * deploy prefix.
 */
export const routeGroup = route(defs);

/**
 * The app routes, carrying the deploy {@link base} prefix (e.g. `/zero-verse`).
 * Use these for links, `href()`s, static-asset URLs, and the crawl seed so every
 * URL is correct under a sub-path deployment. Locally `base` is `""` and these
 * match {@link routeGroup}.
 */
export const routes = base ? route(base, defs) : route(defs);
