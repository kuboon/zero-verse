import { extract } from "@std/front-matter/yaml";
import { fromFileUrl, join } from "@std/path";

/** Directory of documentation pages (`content/docs/*.md`). */
const DOCS_DIR = fromFileUrl(new URL("../content/docs/", import.meta.url));

/** Section headings of the docs index, in display order. */
export const SECTIONS = [
  "はじめに",
  "世界の仕様",
  "創発する社会",
  "brain を書く",
  "プロジェクト",
] as const;

/** A documentation page: frontmatter metadata plus the Markdown body. */
export interface Doc {
  slug: string;
  title: string;
  section: string;
  order: number;
  summary: string;
  /** The Markdown body (frontmatter removed). */
  body: string;
}

function parse(slug: string, text: string): Doc {
  const { attrs, body } = extract(text);
  const a = attrs as Record<string, unknown>;
  return {
    slug,
    title: typeof a.title === "string" ? a.title : slug,
    section: typeof a.section === "string" ? a.section : "",
    order: typeof a.order === "number" ? a.order : 0,
    summary: typeof a.summary === "string" ? a.summary : "",
    body,
  };
}

/** Reads one doc by slug, or `undefined` if there is no such file. */
export async function getDoc(slug: string): Promise<Doc | undefined> {
  if (!slug || slug.includes("/") || slug.includes("..")) return undefined;
  try {
    return parse(slug, await Deno.readTextFile(join(DOCS_DIR, `${slug}.md`)));
  } catch {
    return undefined;
  }
}

/** Reads every doc in `content/docs/`, ordered by section then `order`. */
export async function listDocs(): Promise<Doc[]> {
  const docs: Doc[] = [];
  for await (const entry of Deno.readDir(DOCS_DIR)) {
    if (!entry.isFile || !entry.name.endsWith(".md")) continue;
    docs.push(
      parse(
        entry.name.replace(/\.md$/, ""),
        await Deno.readTextFile(join(DOCS_DIR, entry.name)),
      ),
    );
  }
  const rank = (d: Doc) => {
    const i = (SECTIONS as readonly string[]).indexOf(d.section);
    return i === -1 ? SECTIONS.length : i;
  };
  return docs.sort((a, b) => rank(a) - rank(b) || a.order - b.order);
}

/**
 * Rewrites the docs' internal Markdown links (`./<slug>.md`, optionally with a
 * `#fragment`) to site URLs. The content keeps `.md` links so the files stay
 * navigable on GitHub; `hrefFor` maps a slug to its route href.
 */
export function rewriteDocLinks(
  body: string,
  hrefFor: (slug: string) => string,
): string {
  return body.replace(
    /\]\(\.\/([a-z0-9-]+)\.md(#[^)]*)?\)/g,
    (_, slug: string, frag: string | undefined) =>
      `](${hrefFor(slug)}${frag ?? ""})`,
  );
}
