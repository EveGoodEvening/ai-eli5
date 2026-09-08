# Lessons

- Explainers have paired root-level files: `<concept>.en.html` and `<concept>.zh-CN.html` (Simplified Chinese). Keep full content, SVG/accessibility labels, dynamic text, and section IDs aligned across both editions. The unsuffixed `<concept>.html` is a generated compatibility redirect.
- `index.html` discovers concepts through the GitHub contents API and reads localized `<title>` elements. Run `node scripts/prepare-pages.mjs` after adding/editing pairs to refresh shared navigation, legacy redirects, and the generated `guides.json` fallback used for local preview. No manual navigation registry is needed. `npm run check` verifies pair completeness and generated files.
- Self-contained inline SVG diagrams work without external image or font dependencies. Wide diagrams can use local horizontal scrolling on mobile without overflowing the page.
