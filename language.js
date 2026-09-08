/* The filename is authoritative on guides; the index and old links use preferences. */
(() => {
  const supported = ["zh-CN", "en"];
  const normalize = value => supported.includes(value) ? value : null;
  const remember = language => {
    try { localStorage.setItem("eli5-language", language); } catch { /* Storage is optional. */ }
  };
  const preferred = () => {
    const explicit = normalize(new URLSearchParams(location.search).get("lang"));
    if (explicit) return explicit;
    try {
      const saved = normalize(localStorage.getItem("eli5-language"));
      if (saved) return saved;
    } catch { /* Private browsing and file URLs can block storage. */ }
    return /^zh\b/i.test(navigator.language || "") ? "zh-CN" : "en";
  };
  window.ELI5Language = {supported, normalize, preferred, remember};

  const legacy = document.querySelector('meta[name="eli5-concept"]');
  if (legacy) {
    const language = preferred();
    const destination = new URL(`${legacy.content}.${language}.html`, location.href);
    destination.search = location.search;
    destination.searchParams.delete("lang");
    destination.hash = location.hash;
    location.replace(destination.href);
    return;
  }

  const match = location.pathname.match(/\.(zh-CN|en)\.html$/);
  if (!match) return;
  remember(match[1]);
  // Keep the reader at the corresponding illustration when changing language.
  document.addEventListener("click", event => {
    const link = event.target.closest?.("a[data-language]");
    if (!link) return;
    const destination = new URL(link.href);
    destination.hash = location.hash;
    link.href = destination.href;
  });
})();
