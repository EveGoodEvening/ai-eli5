# ELI5 AI

**AI, explained like you're five — with pictures.**

ELI5 AI is a small collection of visual, plain-language guides to how modern AI systems learn. Each explainer turns a technical idea into an interactive, approachable story with minimal jargon.

Keep explanations visual, focused, and understandable without prior machine-learning knowledge.

每个概念都提供**简体中文和英文**完整图解。首页可以切换语言；从哪个语言的目录进入，就阅读哪个语言的版本。图解顶部也可以切换同一概念的语言或返回目录。

Each concept has a complete **Simplified Chinese and English** edition. Choose a language on the home page, or switch editions from any guide. Your choice is remembered when browser storage is available.

## Page structure / 页面结构

- `<concept>.en.html` — English content, with `lang="en"`.
- `<concept>.zh-CN.html` — 简体中文内容，使用 `lang="zh-CN"`。
- `<concept>.html` — generated compatibility page for old links; opens the preferred edition and preserves section anchors. Without JavaScript, it offers links to both editions.
- `index.html`, `index.js` — bilingual directory. Published pages are discovered through the GitHub contents API and their localized `<title>` elements. Concepts appear once in each language.
- `language.js`, `language.css` — shared language preference and navigation. Guide content, illustrations, and interactions remain in their individual HTML files.
- `guides.json` — generated directory fallback, also used for local preview. No manual navigation registry is needed.

The filename determines a guide's language. On the index and old links, language selection uses `?lang=en` or `?lang=zh-CN`, then the saved preference, then the browser language (Chinese → Simplified Chinese; otherwise English). Explicit edition links always open that edition.

采用两份独立 HTML，方便分别调整中文和英文的篇幅、排版与 SVG 图中文字，内容不依赖运行时翻译。两份文件保留相同的章节 ID，切换语言时可保留当前 URL 中的章节锚点。

## Adding or editing a guide / 新增与维护

1. Add or edit both `<concept>.en.html` and `<concept>.zh-CN.html` at the repository root. Translate prose, titles, diagram labels, accessibility text, and dynamic interaction messages. Keep IDs and interactions aligned.
2. Run `node scripts/prepare-pages.mjs`. It adds or updates shared navigation, alternate-language links, legacy redirects, and `guides.json` automatically. It rejects missing language pairs.
3. Run `npm run check`. Inspect both editions on mobile as well as desktop; wide diagrams can scroll inside their own container.

新增概念时，请同时提供英文和简体中文版本，再运行上述生成命令。无需手动往首页添加卡片。发布仍然是普通静态文件托管，不需要 Node.js 服务或前端构建。

## Preview and verification / 预览与检查

```sh
python3 -m http.server 8000
# Open http://localhost:8000/index.html?lang=zh-CN
```

The individual guide files also open directly from disk. The directory needs an HTTP server for its fetch requests.

Static checks use Node.js built-ins; no install is needed:

```sh
npm run check
```

Browser regression tests use Playwright and serve the actual files through intercepted requests, so they do not need a live deployment or GitHub access:

```sh
npm ci
npx playwright install chromium
npm test
```

The tests cover both language paths, persistence, browser history, old URLs, GitHub failure and retry, rapid switching, mobile overflow, and translated interactive examples. All test dependencies are development-only.
