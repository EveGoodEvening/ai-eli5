import assert from "node:assert/strict";
import {readdir, readFile} from "node:fs/promises";
import {Script} from "node:vm";

const root = new URL("../", import.meta.url);
const names = await readdir(root);
const stems = JSON.parse(await readFile(new URL("guides.json", root), "utf8"));
const languages = ["en", "zh-CN"];
for (const stem of stems) {
  const ids = {};
  for (const locale of languages) {
    const name = `${stem}.${locale}.html`;
    assert(names.includes(name), `Missing translation: ${name}`);
    const html = await readFile(new URL(name, root), "utf8");
    assert.match(html, new RegExp(`<html[^>]*lang="${locale}"`), `Wrong language: ${name}`);
    assert.match(html, /<title>.+<\/title>/, `Missing title: ${name}`);
    assert.match(html, new RegExp(`href="index.html\\?lang=${locale}"`), `Home link loses language: ${name}`);
    for (const target of languages) {
      assert(html.includes(`href="${stem}.${target}.html" data-language="${target}"`), `Missing language switch: ${name}`);
    }
    for (const [, attributes, source] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (!attributes.includes("src=")) new Script(source, {filename: name});
    }
    for (const [, href] of html.matchAll(/\bhref="([^"#]+)(?:#[^"]*)?"/g)) {
      if (/^(https?:|data:|mailto:)/.test(href)) continue;
      const file = href.split(/[?#]/)[0];
      if (file) assert(names.includes(file), `Broken local link in ${name}: ${href}`);
      if (/\.html$/.test(file) && file !== "index.html") assert(file.endsWith(`.${locale}.html`) || file === `${stem}.${locale === "en" ? "zh-CN" : "en"}.html`, `Cross-concept link loses language: ${name} → ${file}`);
    }
    ids[locale] = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]).sort();
  }
  assert.deepEqual(ids.en, ids["zh-CN"], `Language switch cannot retain every anchor: ${stem}`);
  const legacy = await readFile(new URL(`${stem}.html`, root), "utf8");
  assert(legacy.includes(`name="eli5-concept" content="${stem}"`), `Missing legacy redirect: ${stem}`);
}
for (const name of ["language.js", "index.js"]) new Script(await readFile(new URL(name, root), "utf8"), {filename: name});
assert.equal(names.filter(name => /\.(en|zh-CN)\.html$/.test(name)).length, stems.length * 2, "Catalog omits translations");
console.log(`Checked ${stems.length} bilingual pairs: languages, navigation, local links, matching anchors, and JavaScript syntax.`);
