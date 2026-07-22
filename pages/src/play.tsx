import { renderToString } from "remix/ui/server";
import { createHtmlResponse } from "remix/response/html";
import { routes } from "./routes.ts";

/**
 * The `/play` page: the zeroverse viewer, which runs the engine and the wasm
 * component brains in the browser.
 *
 * This is a standalone full-screen app document, not the shared `page()` shell —
 * the viewer brings its own header/controls and dark styling (`static/play/`),
 * and its stylesheet targets bare `header`/`main`/`footer` elements. The DOM ids
 * here are the contract with `static/play/app.js`; the script resolves its
 * worker and wasm assets relative to its own URL, so serving it from
 * `static/play/` needs no path configuration.
 */
function Play() {
  return () => (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>zeroverse play</title>
        <link rel="icon" href={routes.static.href({ path: "favicon.svg" })} />
        <link
          rel="stylesheet"
          href={routes.static.href({ path: "play/style.css" })}
        />
      </head>
      <body>
        <header>
          <h1>
            <a href={routes.home.href()}>zeroverse</a>{" "}
            <span class="sub">play</span>
          </h1>
          <div class="controls">
            <label>
              シナリオ
              <select id="campaign">
                <optgroup label="キャンペーン（wasm component + 選択 brain）">
                  <option value="campaign-m1">M1 開拓（scenario-m1）</option>
                </optgroup>
                <optgroup label="実験再現（brain 内蔵・CLI と同一歴史）">
                  <option value="exp-m1">M1: 交易 vs 自給自足</option>
                  <option value="exp-m2">M2: 貨幣の創発</option>
                  <option value="exp-m3-open">
                    M3: 教育の市場（公開教師）
                  </option>
                  <option value="exp-m3-secret">
                    M3: 教育の市場（秘匿教師）
                  </option>
                  <option value="exp-m4">M4: 家族と血縁投資</option>
                  <option value="exp-m4-clans-endo">
                    M4: 同族内婚（2 氏族）
                  </option>
                  <option value="exp-m4-clans-exo">M4: 族外婚（2 氏族）</option>
                  <option value="exp-m4-marriage">
                    M4: 婚姻契約（貞節 vs 浮気）
                  </option>
                </optgroup>
              </select>
            </label>
            <label>
              brain
              <select id="brain">
                <option value="forager">forager（wasm component）</option>
                <option value="idle">idle（何もしない）</option>
              </select>
            </label>
            <label>
              seed <input id="seed" type="number" value="42" min="0" step="1" />
            </label>
            <button type="button" id="reset">⟳ 生成</button>
            <button type="button" id="play" disabled>▶ 実行</button>
            <button type="button" id="step1" disabled>+1月</button>
            <button type="button" id="step12" disabled>+1年</button>
            <label class="speed">
              速度 <input id="speed" type="range" min="0" max="6" value="3" />
              <span id="speedLabel">12 月/秒</span>
            </label>
            <button type="button" id="judge" disabled>⚖ 判定</button>
            <span id="clock">—</span>
          </div>
        </header>

        <div id="banner" class="hidden"></div>

        <main>
          <section class="world">
            <canvas id="world" width="640" height="640"></canvas>
            <div class="legend">
              ○ = 女性（sex&lt;0）　□ = 男性（sex&gt;0）　◇ = 中性　色 =
              health　大きさ = 年齢　桃輪 = 妊娠<br />
              桃線 = 親密度　灰破線 = 母子（全知ビュー。brain には見えない）
            </div>
            <div class="legend" id="roleLegend"></div>
          </section>
          <aside id="inspector">
            <p class="dim">
              human をクリックすると詳細を表示（一時停止中も可）
            </p>
          </aside>
        </main>

        <footer>
          <section class="panel">
            <h2>推移</h2>
            <canvas id="chart" width="560" height="150"></canvas>
            <div class="legend" id="chartLegend"></div>
          </section>
          <section class="panel">
            <h2>
              環境ストック <span class="dim">(全知ビュー)</span>
            </h2>
            <div id="env"></div>
          </section>
          <section class="panel">
            <h2>板（先月の気配）</h2>
            <div id="market" class="dim">—</div>
          </section>
        </footer>

        <script
          type="module"
          src={routes.static.href({ path: "play/app.js" })}
        >
        </script>
      </body>
    </html>
  );
}

/** Renders the viewer document to a complete HTML `Response`. */
export async function playPage(): Promise<Response> {
  const html = "<!DOCTYPE html>" + (await renderToString(<Play />));
  return createHtmlResponse(html);
}
