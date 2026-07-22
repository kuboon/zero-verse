/**
 * Base-path support for hosting under a sub-path (e.g. GitHub Pages project
 * sites served at `https://<user>.github.io/<repo>/`).
 *
 * The deploy workflow passes the full public URL in `BASE_URL`; locally it is
 * unset and the site is served from the root. We only ever need its *pathname*
 * as a prefix — e.g. `https://kuboon.github.io/remix3-ssg-gh-pages` → `/remix3-ssg-gh-pages`.
 *
 * The router mounts every route under this prefix and `route(base, …)` builds
 * matching prefixed links (see `routes.ts`), so the same code renders correct
 * URLs at the root, under a repo sub-path, or under a per-PR preview sub-path.
 * The build strips this prefix back off when writing files, so the output always
 * lands at the site root.
 */

// Read at build/server time. Guarded so this module is safe to bundle into the
// browser client (where `Deno` is undefined); there the base resolves to "",
// which is fine because the browser uses the base-prefixed URLs the server
// already embedded in the page, not this value.
const BASE_URL = typeof Deno !== "undefined"
  ? Deno.env.get("BASE_URL") ?? ""
  : "";

/** URL path prefix the site is mounted under, without a trailing slash (e.g. `""` or `/repo`). */
export const base: string = BASE_URL
  ? new URL(BASE_URL).pathname.replace(/\/+$/, "")
  : "";
