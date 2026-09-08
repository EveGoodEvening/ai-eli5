import {readdir, readFile, writeFile} from "node:fs/promises";

const root = new URL("../", import.meta.url);
const check = process.argv.includes("--check");
const languages = ["en", "zh-CN"];
const names = await readdir(root);
const stems = [...new Set(names.map(name => name.match(/^([a-z0-9-]+)\.(en|zh-CN)\.html$/)?.[1]).filter(Boolean))].sort();
if (!stems.length) throw new Error("No bilingual guides found");
let changes = 0;
const save = async (name, content) => {
  const path = new URL(name, root);
  const previous = await readFile(path, "utf8").catch(() => null);
  if (previous === content) return;
  changes++;
  if (check) console.error(`Needs regeneration: ${name}`);
  else await writeFile(path, content);
};

for (const stem of stems) {
  const titles = {};
  // Read both translations before replacing the legacy URL.
  const pages = await Promise.all(languages.map(async locale => {
    const name = `${stem}.${locale}.html`;
    const html = await readFile(new URL(name, root), "utf8");
    if (!new RegExp(`<html\\b[^>]*\\blang="${locale}"`).test(html)) throw new Error(`Incorrect language: ${name}`);
    titles[locale] = html.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim();
    if (!titles[locale]) throw new Error(`Missing title: ${name}`);
    return {name, locale, html};
  }));
  for (const {name, locale, html} of pages) {
    const home = locale === "en" ? "← All guides" : "← 图解目录";
    const label = locale === "en" ? "Guide navigation and language" : "图解导航与语言选择";
    const head = `<!-- eli5:head:start -->
<link rel="alternate" hreflang="en" href="${stem}.en.html">
<link rel="alternate" hreflang="zh-CN" href="${stem}.zh-CN.html">
<link rel="stylesheet" href="language.css">
<script src="language.js" defer></script>
<!-- eli5:head:end -->`;
    const nav = `<!-- eli5:nav:start -->
<div class="eli5-site-nav" role="navigation" aria-label="${label}">
  <a class="eli5-nav-home" href="index.html?lang=${locale}">${home}</a>
  <div class="eli5-languages">
    <a href="${stem}.zh-CN.html" data-language="zh-CN" lang="zh-CN" hreflang="zh-CN"${locale === "zh-CN" ? ' aria-current="page"' : ""}>简体中文</a>
    <a href="${stem}.en.html" data-language="en" lang="en" hreflang="en"${locale === "en" ? ' aria-current="page"' : ""}>English</a>
  </div>
</div>
<!-- eli5:nav:end -->`;
    let updated = html.replace(/<!-- eli5:head:start -->[\s\S]*?<!-- eli5:head:end -->\n?/g, "")
      .replace(/<!-- eli5:nav:start -->[\s\S]*?<!-- eli5:nav:end -->\n?/g, "");
    updated = updated.replace(/href="index\.html(?:\?lang=(?:en|zh-CN))?(#[^"]*)?"/g, (_, hash = "") => `href="index.html?lang=${locale}${hash}"`);
    updated = updated.replace(/href="([a-z0-9-]+)\.html(#[^"]*)?"/g, (match, target, hash = "") => stems.includes(target) ? `href="${target}.${locale}.html${hash}"` : match);
    updated = updated.replace("</head>", `${head}\n</head>`).replace(/<body([^>]*)>\n?/, `<body$1>\n${nav}\n`);
    await save(name, updated);
  }
  await save(`${stem}.html`, `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="eli5-concept" content="${stem}">
<title>${titles.en} / ${titles["zh-CN"]}</title>
<link rel="alternate" hreflang="en" href="${stem}.en.html">
<link rel="alternate" hreflang="zh-CN" href="${stem}.zh-CN.html">
<script src="language.js" defer></script>
<style>body{max-width:680px;margin:12vh auto;padding:24px;font:18px/1.7 system-ui,sans-serif;color:#16233a;background:#edf0f5}a{display:block;margin:20px 0;padding:18px;color:#2747d8;background:#fafbfc;border:1px solid #c4ccda;border-radius:8px}a:focus-visible{outline:3px solid #2747d8;outline-offset:4px}</style>
</head>
<body>
<h1><span lang="zh-CN">选择语言</span> / Choose a language</h1>
<a href="${stem}.zh-CN.html" lang="zh-CN" hreflang="zh-CN">简体中文：${titles["zh-CN"]}</a>
<a href="${stem}.en.html" lang="en" hreflang="en">English: ${titles.en}</a>
</body>
</html>
`);
}
await save("guides.json", JSON.stringify(stems, null, 2) + "\n");
if (check && changes) process.exitCode = 1;
else console.log(`${stems.length} concepts · ${stems.length * 2} translations · ${check ? "generated files are current" : `${changes} files updated`}`);
