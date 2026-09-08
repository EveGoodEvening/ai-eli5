(() => {
  const language = window.ELI5Language;
  const grid = document.querySelector("#pages");
  const count = document.querySelector("#count");
  const retry = document.querySelector("#retry");
  const api = "https://api.github.com/repos/EveGoodEvening/ai-eli5/contents/";
  const copy = {
    en: {
      title: "ELI5 AI — visual explainers", kicker: "A small atlas of machine learning",
      headlineFirst: "AI, made", headlineLast: "plain.",
      intro: "Visual guides to what happens before, during, and after a language model learns to talk.",
      choose: "Choose an explainer", footer: "One idea at a time. Pictures included.",
      loading: "Building the index…", looking: "Looking for pages…", guide: "Guide",
      open: "Open visual guide", total: n => `${n} visual ${n === 1 ? "guide" : "guides"}`,
      error: "The guide list could not be loaded. Please try again.", unavailable: "Index unavailable",
      partial: "Some guides could not be loaded. Please try again.", retry: "Try again",
      navigation: "Language selection", home: "ELI5 AI home"
    },
    "zh-CN": {
      title: "ELI5 AI — AI 图解小册", kicker: "一本机器学习的图解小册",
      headlineFirst: "用图解，", headlineLast: "读懂 AI。",
      intro: "从学会说话到学会回答，用直观的图解，认识语言模型学习前、中、后的每一步。",
      choose: "选一个概念，开始看图", footer: "一次弄懂一个概念，每篇都有图解。",
      loading: "正在加载图解目录…", looking: "正在查找图解…", guide: "图解",
      open: "打开图解", total: n => `${n} 篇图解`,
      error: "暂时无法加载图解目录，请重试。", unavailable: "目录暂不可用",
      partial: "部分图解暂时无法加载，请重试。", retry: "重试",
      navigation: "选择语言", home: "ELI5 AI 首页"
    }
  };
  let active;
  let generation = 0;
  let directoryPromise;
  const titles = new Map();
  const request = async url => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, {cache: "no-cache", signal: controller.signal});
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      return await response.text();
    } finally { clearTimeout(timer); }
  };
  const localDirectory = async () => {
    const entries = JSON.parse(await request("guides.json"));
    if (!Array.isArray(entries) || !entries.length || entries.some(stem => typeof stem !== "string" || !/^[a-z0-9-]+$/.test(stem))) {
      throw new Error("Invalid guide catalog");
    }
    return [...new Set(entries)];
  };
  const getDirectory = () => directoryPromise ||= (async () => {
    // Preview uses the generated local catalog, including unpublished pages.
    if (["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) || location.protocol === "file:") {
      return localDirectory();
    }
    try {
      const entries = JSON.parse(await request(api));
      const stems = entries.filter(entry => entry.type === "file" && /\.html$/i.test(entry.name) && entry.name !== "index.html")
        .map(entry => entry.name.replace(/(?:\.(?:en|zh-CN))?\.html$/, ""))
        .filter(stem => /^[a-z0-9-]+$/.test(stem));
      if (!stems.length) throw new Error("No guides discovered");
      return [...new Set(stems)];
    } catch {
      // A generated fallback keeps the index usable if GitHub is rate limited.
      return localDirectory();
    }
  })();
  const readTitle = (stem, locale) => {
    const name = `${stem}.${locale}.html`;
    if (!titles.has(name)) {
      titles.set(name, (async () => {
        const html = new DOMParser().parseFromString(await request(name), "text/html");
        if (html.documentElement.lang !== locale || !html.title.trim()) throw new Error(`Invalid guide: ${name}`);
        return {name, title: html.title.trim()};
      })().catch(error => { titles.delete(name); throw error; }));
    }
    return titles.get(name);
  };
  const status = (message, error = false) => {
    const p = document.createElement("p");
    p.className = `status${error ? " error" : ""}`;
    p.textContent = message;
    return p;
  };
  const render = (files, words) => {
    grid.replaceChildren(...files.map((file, index) => {
      const link = document.createElement("a");
      link.className = "card";
      link.href = file.name;
      link.hreflang = active;
      const station = document.createElement("span");
      station.className = "station";
      station.setAttribute("aria-hidden", "true");
      const number = document.createElement("span");
      number.className = "number";
      number.textContent = `${words.guide} ${String(index + 1).padStart(2, "0")}`;
      const heading = document.createElement("h3");
      heading.textContent = file.title;
      const action = document.createElement("span");
      action.className = "action";
      action.textContent = words.open;
      link.append(station, number, heading, action);
      return link;
    }));
    count.textContent = words.total(files.length);
  };
  const select = async locale => {
    active = locale;
    const current = ++generation;
    const words = copy[locale];
    language.remember(locale);
    document.documentElement.lang = locale;
    document.title = words.title;
    document.querySelector('meta[name="description"]').content = words.intro;
    document.querySelectorAll("[data-copy]").forEach(element => { element.textContent = words[element.dataset.copy]; });
    document.querySelector(".eli5-site-nav").setAttribute("aria-label", words.navigation);
    const home = document.querySelector(".eli5-nav-home");
    home.setAttribute("aria-label", words.home);
    home.href = `index.html?lang=${locale}`;
    document.querySelectorAll("[data-language]").forEach(link => {
      if (link.dataset.language === locale) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
    retry.textContent = words.retry;
    retry.hidden = true;
    count.textContent = words.looking;
    grid.setAttribute("aria-busy", "true");
    grid.replaceChildren(status(words.loading));
    try {
      const stems = await getDirectory();
      const results = await Promise.allSettled(stems.map(stem => readTitle(stem, locale)));
      if (current !== generation) return;
      const files = results.filter(result => result.status === "fulfilled").map(result => result.value);
      if (!files.length) throw new Error("No guides could be loaded");
      files.sort((a, b) => a.title.localeCompare(b.title, locale));
      render(files, words);
      if (files.length !== stems.length) {
        grid.append(status(words.partial, true));
        retry.hidden = false;
      }
    } catch {
      if (current !== generation) return;
      directoryPromise = undefined;
      grid.replaceChildren(status(words.error, true));
      count.textContent = words.unavailable;
      retry.hidden = false;
    } finally {
      if (current === generation) grid.setAttribute("aria-busy", "false");
    }
  };
  document.querySelectorAll("[data-language]").forEach(link => link.addEventListener("click", event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const url = new URL(location.href);
    url.searchParams.set("lang", link.dataset.language);
    history.pushState(null, "", url);
    select(link.dataset.language);
  }));
  retry.addEventListener("click", () => { directoryPromise = undefined; select(active); });
  window.addEventListener("popstate", () => select(language.preferred()));
  const initial = language.preferred();
  const initialURL = new URL(location.href);
  initialURL.searchParams.set("lang", initial);
  history.replaceState(null, "", initialURL);
  select(initial);
})();
