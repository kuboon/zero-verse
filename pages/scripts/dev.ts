/**
 * Local dev server. Serves the same router the static build renders from, so
 * what you see locally is what gets generated.
 *
 *   deno task dev
 *
 * Runs at the site root by default (BASE_URL unset). To preview a sub-path
 * deployment locally, set BASE_URL, e.g.
 *
 *   BASE_URL=http://localhost:8000/remix3-ssg-gh-pages deno task dev
 */
import { router } from "../src/router.tsx";
import { routes } from "../src/routes.ts";

const port = Number(Deno.env.get("PORT") ?? 8000);

Deno.serve({ port }, (request) => router.fetch(request));

console.log(`Dev server: http://localhost:${port}${routes.home.href()}`);
