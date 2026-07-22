import { createRouter, type RouteBuilder } from "remix/router";
import { createFileResponse } from "remix/response/file";
import { openLazyFile } from "remix/fs";
import { fromFileUrl, join } from "@std/path";
import { base } from "./base.ts";
import { routeGroup, routes } from "./routes.ts";
import { page } from "./layout.tsx";
import { playPage } from "./play.tsx";
import { getDoc, listDocs, rewriteDocLinks, SECTIONS } from "./content.ts";
import { renderMarkdown } from "./markdown.ts";
import { Link } from "./link.tsx";

/** Directory of static files served under `/static/*` (viewer app, wasm, CSS, …). */
const STATIC_DIR = fromFileUrl(new URL("../static/", import.meta.url));

/**
 * Serves a file from `static/` with `createFileResponse` (over `openLazyFile`) —
 * the same machinery `staticFiles()` uses — which supplies the Content-Type,
 * ETag, Last-Modified, and conditional/range handling. We call it from the route
 * action (rather than the `staticFiles()` middleware) so it sees the base-
 * stripped route param and works under the deploy mount.
 */
async function serveStatic(request: Request, rel: string): Promise<Response> {
  // Guard against path traversal before touching the filesystem.
  if (rel === "" || rel.includes("..")) {
    return new Response("Forbidden", { status: 403 });
  }
  const path = join(STATIC_DIR, rel);
  let info: Deno.FileInfo;
  try {
    info = await Deno.stat(path);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!info.isFile) {
    return new Response("Not found", { status: 404 });
  }
  return await createFileResponse(openLazyFile(path), request, {
    cacheControl: "public, max-age=3600",
  });
}

export const router = createRouter();

// Every route is mounted under the deploy base prefix (see src/base.ts). Handlers
// are mapped to the relative `routeGroup`, so they never repeat the prefix; links
// use the prefixed `routes` from ./routes.ts.
router.mount(base || "/", (app: RouteBuilder) => {
  app.map(routeGroup, {
    actions: {
      home: () =>
        page({
          title: "zeroverse — ゼロ次元メタバースの社会シミュレーション",
          description:
            "brain（意思決定アルゴリズム）を書いて human 社会に投入し、社会の豊かさを競う対戦ゲーム。",
          children: (
            <>
              <section class="hero">
                <h1>ゼロ次元のメタバースで、社会を創発させる</h1>
                <p class="lead">
                  <strong>zeroverse</strong>{" "}
                  は、ゼロ次元のメタバース内で human
                  社会をシミュレートする対戦ゲーム。プレイヤーは human
                  の意思決定アルゴリズム——<strong>brain</strong>——を書いて world
                  に投入し、長期間（例：1000 年）回して社会の豊かさを競う。
                </p>
                <p class="cta">
                  <Link class="button" href={routes.play.href()}>
                    ▶ ブラウザで動かす
                  </Link>
                  <Link
                    class="button secondary"
                    href={routes.docs.index.href()}
                  >
                    📖 ドキュメント
                  </Link>
                </p>
              </section>

              <blockquote class="principle">
                <p>
                  <strong>human 以外の要素を world に用意しない。</strong>
                </p>
                <p>
                  貨幣、家族、契約、評判、制度——すべて brain
                  の戦略として創発させる。設計原則はこの一つだけ。
                </p>
              </blockquote>

              <section class="features-grid">
                <div>
                  <h2>決定論エンジン</h2>
                  <p>
                    tick は 1ヶ月、全 human
                    が同時手番。同一シードは常に同一の歴史を再生する。
                    交易・貨幣・教育・血縁投資の創発（M1〜M4）を検証済み。
                  </p>
                </div>
                <div>
                  <h2>brain は WASM component</h2>
                  <p>
                    brain は WIT で定義された observation → action の関数。Rust
                    でもほかの言語でも、WASM component
                    にコンパイルできれば参戦できる。
                  </p>
                </div>
                <div>
                  <h2>採点は Shapley 値</h2>
                  <p>
                    社会全体の凹効用への限界寄与で採点する。搾取戦略は限界寄与が負になり、
                    ルールを足さずに定義から罰される。
                  </p>
                </div>
              </section>

              <section>
                <h2>いま動くもの</h2>
                <p>
                  <Link href={routes.play.href()}>play ページ</Link>
                  では、参照実装の brain（forager）が M1
                  開拓キャンペーンを生き延びる様子をブラウザ内で観戦できる——engine
                  も brain も WASM でそのまま動く。仕組みは{" "}
                  <Link href={routes.docs.show.href({ slug: "plan" })}>
                    実装計画
                  </Link>
                  を参照。
                </p>
              </section>
            </>
          ),
        }),

      play: () => playPage(),

      static: ({ request, params }) => serveStatic(request, params.path ?? ""),
    },
  });

  // Docs — driven by Markdown files in content/docs/.
  app.map(routeGroup.docs, {
    actions: {
      index: async () => {
        const docs = await listDocs();
        return page({
          title: "ドキュメント — zeroverse",
          description:
            "zeroverse の設計ドキュメント。公理系、world / human の仕様、brain の書き方。",
          children: (
            <>
              <h1>ドキュメント</h1>
              <p class="lead">
                zeroverse の仕様はここが source of truth。まず 「はじめに」の 2
                本を読めば、残りはどこから読んでも辿れる。
              </p>
              {SECTIONS.map((section) => {
                const inSection = docs.filter((d) => d.section === section);
                if (inSection.length === 0) return null;
                return (
                  <section key={section} class="doc-section">
                    <h2>{section}</h2>
                    <ul class="doc-list">
                      {inSection.map((doc) => (
                        <li key={doc.slug}>
                          <Link
                            href={routes.docs.show.href({ slug: doc.slug })}
                          >
                            {doc.title}
                          </Link>
                          <span class="doc-summary">{doc.summary}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </>
          ),
        });
      },

      show: async ({ params }) => {
        const doc = await getDoc(params.slug ?? "");
        if (!doc) {
          return new Response("Not found", { status: 404 });
        }
        const body = await renderMarkdown(
          rewriteDocLinks(
            doc.body,
            (slug) => routes.docs.show.href({ slug }),
          ),
        );
        return page({
          title: `${doc.title} — zeroverse`,
          description: doc.summary,
          children: (
            <article class="doc">
              {body}
              <p>
                <Link href={routes.docs.index.href()}>← ドキュメント一覧</Link>
              </p>
            </article>
          ),
        });
      },
    },
  });
});
