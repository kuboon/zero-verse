/**
 * Static build: crawl the router from the home page and write every response
 * to `dist/`.
 *
 * We use the runtime-agnostic `crawl` + `toOutput` from @kuboon/remix-ssg (rather
 * than the batteries-included `prerender`) for one reason: when the site is
 * hosted under a base path, routes and links carry that prefix, but the files
 * must still land at the site root. So we strip the base prefix from each output
 * path before writing. See src/base.ts.
 *
 * The crawl only discovers assets referenced from HTML. The play viewer loads
 * its worker and wasm assets at runtime (relative to `import.meta.url`), so
 * after the crawl we copy the whole `static/` tree into `dist/static/` to make
 * sure every runtime-loaded file ships too.
 */
import { dirname, join, relative } from "@std/path";
import { crawl, toOutput } from "@kuboon/remix-ssg";
import { router } from "../src/router.tsx";
import { routes } from "../src/routes.ts";
import { base } from "../src/base.ts";

const OUT_DIR = new URL("../dist/", import.meta.url);
const STATIC_DIR = new URL("../static/", import.meta.url);

function stripBase(outputPath: string): string {
  let path = outputPath.replace(/^\/+/, "");
  if (base) {
    const prefix = base.replace(/^\//, "") + "/";
    if (path.startsWith(prefix)) path = path.slice(prefix.length);
  }
  return path;
}

async function copyStaticTree(): Promise<number> {
  let copied = 0;
  const srcRoot = new URL(STATIC_DIR).pathname;
  const walk = async (dir: string) => {
    for await (const entry of Deno.readDir(dir)) {
      const src = join(dir, entry.name);
      if (entry.isDirectory) {
        await walk(src);
        continue;
      }
      if (!entry.isFile) continue;
      const rel = relative(srcRoot, src);
      const dest = join(new URL(OUT_DIR).pathname, "static", rel);
      await Deno.mkdir(dirname(dest), { recursive: true });
      await Deno.copyFile(src, dest);
      copied++;
    }
  };
  await walk(srcRoot);
  return copied;
}

async function main() {
  await Deno.remove(OUT_DIR, { recursive: true }).catch(() => {});

  let pages = 0;

  // Seed from the (base-aware) home path; every other page is reached by crawling.
  for await (const result of crawl(router, { paths: [routes.home.href()] })) {
    const output = await toOutput(result);
    if (output == null) continue; // 204 No Content

    const relPath = stripBase(output.path);
    // static/ is copied wholesale below; skip the crawled duplicates.
    if (relPath.startsWith("static/")) continue;
    const destPath = join(new URL(OUT_DIR).pathname, relPath);
    await Deno.mkdir(dirname(destPath), { recursive: true });
    const bytes = typeof output.content === "string"
      ? new TextEncoder().encode(output.content)
      : output.content;
    await Deno.writeFile(destPath, bytes);

    pages++;
    console.log(`  ${relPath}`);
  }

  const assets = await copyStaticTree();

  console.log(
    `\n✓ Wrote ${pages} page(s) and ${assets} static asset(s) to dist/${
      base ? ` (base: ${base})` : ""
    }`,
  );
}

await main();
