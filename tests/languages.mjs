import assert from "node:assert/strict";
import {readFile, readdir} from "node:fs/promises";

const {chromium} = await import(process.env.ELI5_PLAYWRIGHT_MODULE || "playwright");
const root = new URL("../", import.meta.url);
const stems = JSON.parse(await readFile(new URL("guides.json", root), "utf8"));
const filenames = await readdir(root);
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const failures = [];
let apiFails = false;
let catalogFails = false;
let missing = "";
let slowEnglish = false;
let apiRequests = 0;
const context = await browser.newContext({locale: "zh-CN", reducedMotion: "reduce"});

// Serve the actual repository files under a production-like hostname, without
// depending on GitHub, Google Fonts, or already published translations.
const routes = async route => {
  const url = new URL(route.request().url());
  if (url.hostname === "api.github.com") {
    apiRequests++;
    return route.fulfill({status: apiFails ? 503 : 200, contentType: "application/json", body: JSON.stringify(filenames.map(name => ({name, type: "file"})))});
  }
  if (!["eli5.test", "localhost"].includes(url.hostname)) return route.abort();
  const name = url.pathname.slice(1) || "index.html";
  if (!filenames.includes(name) || name === missing || (catalogFails && name === "guides.json")) return route.fulfill({status: 404, body: "Not found"});
  if (slowEnglish && name.endsWith(".en.html")) await new Promise(resolve => setTimeout(resolve, 200));
  const contentType = name.endsWith(".html") ? "text/html; charset=utf-8" : name.endsWith(".js") ? "application/javascript" : name.endsWith(".css") ? "text/css" : "application/json";
  await route.fulfill({contentType, body: await readFile(new URL(name, root))});
};
await context.route("**/*", routes);
const page = await context.newPage();
page.on("pageerror", error => failures.push(error.message));
const home = "http://eli5.test/index.html";
const ready = async (locale, total = stems.length) => {
  await page.waitForFunction(({locale, total}) => document.documentElement.lang === locale && document.querySelector("#pages").getAttribute("aria-busy") === "false" && document.querySelectorAll(".card").length === total, {locale, total});
  const links = await page.locator(".card").evaluateAll(nodes => nodes.map(node => node.getAttribute("href")));
  assert(links.every(href => href.endsWith(`.${locale}.html`)), `Mixed language catalog: ${locale}`);
  assert.equal(new Set(links).size, total, "Duplicate guides");
};
const noOverflow = async name => {
  const dimensions = await page.evaluate(() => ({width: innerWidth, scroll: document.documentElement.scrollWidth}));
  assert(dimensions.scroll <= dimensions.width + 1, `Horizontal page overflow: ${name} (${dimensions.scroll}/${dimensions.width})`);
};

try {
  await page.goto(home);
  await ready("zh-CN");
  assert(new URL(page.url()).searchParams.get("lang") === "zh-CN");
  assert(apiRequests > 0, "Production discovery was not exercised");
  await page.locator('[data-language="en"]').click();
  await ready("en");
  await page.goBack();
  await ready("zh-CN");
  await page.goForward();
  await ready("en");
  await page.goto(home);
  await ready("en"); // persisted choice beats browser language

  await page.goto(`${home}?lang=zh-CN`);
  await ready("zh-CN"); // explicit choice beats storage
  const chosen = await page.locator(".card").first().getAttribute("href");
  await page.locator(".card").first().click();
  assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
  await page.locator('.eli5-site-nav [data-language="en"]').click();
  assert(page.url().endsWith(chosen.replace(".zh-CN.html", ".en.html")));
  await page.locator(".eli5-nav-home").click();
  await ready("en");

  slowEnglish = true;
  await page.goto(`${home}?lang=zh-CN`);
  await ready("zh-CN");
  await page.locator('[data-language="en"]').click();
  await page.locator('[data-language="zh-CN"]').click();
  await ready("zh-CN");
  await page.waitForTimeout(300);
  await ready("zh-CN"); // late English title requests must not overwrite Chinese
  slowEnglish = false;

  apiFails = true;
  await page.goto(`${home}?lang=en`);
  await ready("en"); // local fallback when GitHub fails
  catalogFails = true;
  await page.goto(`${home}?lang=zh-CN`);
  await page.waitForFunction(() => document.querySelector("#pages").getAttribute("aria-busy") === "false");
  assert.match(await page.locator("#pages").innerText(), /暂时无法加载/);
  catalogFails = false;
  await page.locator("#retry").click();
  await ready("zh-CN");
  apiFails = false;
  missing = `${stems[0]}.zh-CN.html`;
  await page.goto(`${home}?lang=zh-CN`);
  await ready("zh-CN", stems.length - 1);
  assert.match(await page.locator(".status.error").innerText(), /部分图解/);
  missing = "";
  await page.locator("#retry").click();
  await ready("zh-CN");

  // Check every original URL, including explicit override and fragment retention.
  for (const locale of ["en", "zh-CN"]) {
    for (const stem of stems) {
      await page.goto(`http://eli5.test/${stem}.html?lang=${locale}&source=old#example`);
      await page.waitForURL(`**/${stem}.${locale}.html?source=old#example`);
      assert.equal(await page.locator("html").getAttribute("lang"), locale);
    }
  }

  // Inspect all 38 real pages at phone and desktop widths after nav injection.
  for (const width of [360, 1280]) {
    await page.setViewportSize({width, height: 900});
    for (const locale of ["en", "zh-CN"]) {
      await page.goto(`${home}?lang=${locale}`);
      await ready(locale);
      await noOverflow(`index ${locale} at ${width}px`);
      for (const stem of stems) {
        const name = `${stem}.${locale}.html`;
        await page.goto(`http://eli5.test/${name}`);
        await noOverflow(`${name} at ${width}px`);
        assert(await page.locator('.eli5-site-nav a[aria-current="page"]').getAttribute("data-language") === locale);
        assert((await page.locator(".eli5-nav-home").getAttribute("href")).endsWith(`?lang=${locale}`));
        if (locale === "en") {
          const prose = (await page.locator("body").innerText()).replace("简体中文", "");
          assert(!/\p{Script=Han}/u.test(prose), `Untranslated Chinese visible in ${name}`);
        }
      }
    }
  }

  for (const locale of ["en", "zh-CN"]) {
    await page.goto(`http://eli5.test/checkpoint-explained.${locale}.html`);
    await page.locator('[data-mode="none"]').click();
    assert.match(await page.locator("#status").innerText(), locale === "en" ? /No progress was saved/ : /没有保存本次进度/);
    assert.equal(await page.locator("#restart-path").getAttribute("visibility"), "visible");
    await page.locator('[data-mode="weights"]').click();
    assert.match(await page.locator("#status").innerText(), locale === "en" ? /coach/ : /教练/);

    await page.goto(`http://eli5.test/llm-pretraining-explained.${locale}.html`);
    await page.locator("#swap").click();
    assert.match(await page.locator("#q").innerText(), locale === "en" ? /milk/ : /牛奶/);

    await page.goto(`http://eli5.test/quantization.${locale}.html`);
    await page.locator("#range").fill("3");
    assert.match(await page.locator("#verdict").innerText(), locale === "en" ? /Can run/ : /跑得动/);

    await page.goto(`http://eli5.test/vector-map.${locale}.html`);
    await page.locator(".pin-hit").nth(4).dispatchEvent("click");
    assert.match(await page.locator("#cap").innerText(), locale === "en" ? /apple/ : /苹果/);
  }

  await page.goto("http://eli5.test/rlhf-explained.en.html#s3");
  await page.locator('.eli5-site-nav [data-language="zh-CN"]').dispatchEvent("click");
  await page.waitForURL("**/rlhf-explained.zh-CN.html#s3");

  const apiBefore = apiRequests;
  await page.goto("http://localhost/index.html?lang=zh-CN");
  await ready("zh-CN");
  assert.equal(apiRequests, apiBefore, "Local preview should use local discovery");

  const blocked = await browser.newContext({locale: "en-US"});
  await blocked.route("**/*", routes);
  await blocked.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {get() { throw new Error("Storage disabled"); }});
  });
  const blockedPage = await blocked.newPage();
  blockedPage.on("pageerror", error => failures.push(error.message));
  await blockedPage.goto(`${home}?lang=zh-CN`);
  await blockedPage.waitForFunction(total => document.querySelectorAll(".card").length === total, stems.length);
  await blockedPage.locator('[data-language="en"]').click();
  await blockedPage.waitForFunction(() => document.documentElement.lang === "en" && document.querySelector('.card')?.getAttribute("href").endsWith(".en.html"));
  await blocked.close();

  const noJS = await browser.newContext({javaScriptEnabled: false});
  await noJS.route("**/*", routes);
  const staticPage = await noJS.newPage();
  await staticPage.goto("http://eli5.test/checkpoint-explained.zh-CN.html");
  await staticPage.locator('[data-language="en"]').click();
  assert(staticPage.url().endsWith("checkpoint-explained.en.html"));
  await staticPage.goto("http://eli5.test/checkpoint-explained.html");
  assert.equal(await staticPage.locator("a[hreflang]").count(), 2);
  await noJS.close();
  assert.deepEqual(failures, [], "Browser JavaScript errors");
  console.log(`Browser checks passed: ${stems.length * 2} translations, phone/desktop layouts, both navigation paths, history, persistence, old URLs, fallback/retry, and translated interactions.`);
} finally {
  await browser.close();
}
