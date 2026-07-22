import { renderToString } from "remix/ui/server";
import { createHtmlResponse } from "remix/response/html";
import type { Handle, RemixNode } from "remix/ui";
import { routes } from "./routes.ts";
import { Link } from "./link.tsx";

interface DocumentProps {
  title: string;
  description?: string;
  children: RemixNode;
}

/** The full HTML document shell shared by every page (except /play). */
function Document(handle: Handle<DocumentProps>) {
  return () => {
    const { title, description, children } = handle.props;
    return (
      <html lang="ja">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{title}</title>
          {description
            ? <meta name="description" content={description} />
            : null}
          <link rel="icon" href={routes.static.href({ path: "favicon.svg" })} />
          <link
            rel="stylesheet"
            href={routes.static.href({ path: "styles.css" })}
          />
        </head>
        <body>
          <header class="site-header">
            <Link class="brand" href={routes.home.href()}>zeroverse 🌐</Link>
            <nav class="site-nav">
              <Link href={routes.play.href()}>Play</Link>
              <Link href={routes.docs.index.href()}>Docs</Link>
              <a href="https://github.com/kuboon/zero-verse">GitHub</a>
            </nav>
          </header>
          <main class="site-main">{children}</main>
          <footer class="site-footer">
            <p>
              zeroverse — ゼロ次元メタバースの社会シミュレーション対戦ゲーム。
              <a href="https://github.com/kuboon/zero-verse">
                kuboon/zero-verse
              </a>
            </p>
          </footer>
        </body>
      </html>
    );
  };
}

/**
 * Renders a page node inside the {@link Document} shell to a complete HTML
 * `Response`. Route actions call this to return a page.
 */
export async function page(
  props: Omit<DocumentProps, "children"> & { children: RemixNode },
): Promise<Response> {
  const html = "<!DOCTYPE html>" +
    (await renderToString(<Document {...props} />));
  return createHtmlResponse(html);
}
