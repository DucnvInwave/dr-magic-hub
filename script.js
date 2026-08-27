import fallbackCatalogUrl from "./datas/DR-Documents-Personal.csv?url&no-inline";

(function () {
  "use strict";

  const APPS_SCRIPT_PUBLIC_URL = "https://script.google.com/macros/s/AKfycbxvX0HRBZU4cEUmRbzBudCXrphisefKXTn58VTJbFlmeUYRTadwclH7yq63XGZg_UN9_w/exec";
  const CATALOG_SOURCES = [
    {
      label: "Apps Script công khai",
      url: APPS_SCRIPT_PUBLIC_URL,
      credentials: "omit",
      cacheBust: true
    },
    {
      label: "CSV local",
      url: fallbackCatalogUrl,
      credentials: "same-origin"
    }
  ];
  const CATEGORY_DEFINITIONS = [
    { name: "Vận hành", slug: "van-hanh", code: "OPS", accent: "sun", description: "Nhịp vận hành, brainstorm và những đầu việc giúp team chạy trơn tru." },
    { name: "Công việc", slug: "cong-viec", code: "WORK", accent: "cyan", description: "Bảng công việc, GDD và dữ liệu kết quả để giữ mọi dự án đúng hướng." },
    { name: "Developer", slug: "developer", code: "DEV", accent: "mint", description: "Ghi chú kỹ thuật, workflow và mã nguồn dành cho đội ngũ phát triển." },
    { name: "Game Designer", slug: "game-designer", code: "GD", accent: "coral", description: "Template và tài liệu nền tảng để biến ý tưởng thành trải nghiệm chơi." },
    { name: "Artist", slug: "artist", code: "ART", accent: "pink", description: "Quy trình 3D, animation và tài nguyên sáng tạo cho đội ngũ nghệ thuật." },
    { name: "QC", slug: "qc", code: "QC", accent: "blue", description: "Theo dõi SDK, event và không gian phối hợp để bảo đảm chất lượng." }
  ];

  const dom = {};
  let sectionObserver;
  let revealObserver;
  let navigationLockTimer;
  let backToTopFrame;
  let catalogCategories = [];
  let catalogView = "grid";

  function parseCsv(text) {
    if (typeof text !== "string") {
      throw new TypeError("CSV input must be a string.");
    }

    const source = text.replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];

      if (inQuotes) {
        if (character === '"') {
          if (source[index + 1] === '"') {
            field += '"';
            index += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += character;
        }
        continue;
      }

      if (character === '"' && field.length === 0) {
        inQuotes = true;
      } else if (character === ",") {
        row.push(field);
        field = "";
      } else if (character === "\n" || character === "\r") {
        if (character === "\r" && source[index + 1] === "\n") {
          index += 1;
        }
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += character;
      }
    }

    if (inQuotes) {
      throw new Error("CSV contains an unterminated quoted field.");
    }

    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  }

  function normalizeCatalog(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return CATEGORY_DEFINITIONS.map((definition) => ({ ...definition, resources: [] }));
    }

    const headers = rows[0].map((header) => header.trim());
    const groupIndex = headers.indexOf("Group");
    const groupCodeIndex = headers.indexOf("GroupCode");
    const groupDescriptionIndex = headers.indexOf("GroupDescription");
    const nameIndex = headers.indexOf("Tên");
    const linkIndex = headers.indexOf("Link");
    const activeIndex = headers.indexOf("Active");
    const documentOrderIndex = headers.indexOf("DocumentOrder");

    if (groupIndex === -1 || nameIndex === -1 || linkIndex === -1) {
      throw new Error("CSV must contain Group, Tên, and Link columns.");
    }

    const catalog = new Map(CATEGORY_DEFINITIONS.map((definition) => [
      definition.name,
      { ...definition, resources: [] }
    ]));
    const extraCategories = [];
    let currentGroup = "";

    rows.slice(1).forEach((cells, rowIndex) => {
      const declaredGroup = (cells[groupIndex] || "").trim();
      const groupCode = groupCodeIndex === -1 ? "" : (cells[groupCodeIndex] || "").trim();
      const groupDescription = groupDescriptionIndex === -1 ? "" : (cells[groupDescriptionIndex] || "").trim();
      const name = (cells[nameIndex] || "").trim();
      const url = (cells[linkIndex] || "").trim();

      if (declaredGroup) {
        currentGroup = declaredGroup;
      }

      if (!name && !url) {
        return;
      }

      if (activeIndex !== -1 && !isActive(cells[activeIndex])) {
        return;
      }

      const groupName = currentGroup || "Khác";
      if (!catalog.has(groupName)) {
        const definition = {
          name: groupName,
          slug: slugify(groupName),
          code: groupCode || "NEW",
          accent: "cyan",
          description: groupDescription || "Tài nguyên bổ sung mới được đồng bộ từ danh mục của team.",
          resources: []
        };
        catalog.set(groupName, definition);
        extraCategories.push(groupName);
      }

      const category = catalog.get(groupName);
      if (extraCategories.includes(groupName)) {
        if (groupCode && category.code === "NEW") {
          category.code = groupCode;
        }
        if (groupDescription && category.description.startsWith("Tài nguyên bổ sung")) {
          category.description = groupDescription;
        }
      }
      category.resources.push({
        name: name || "Tài liệu chưa đặt tên",
        url,
        validUrl: isSafeExternalUrl(url),
        order: documentOrderIndex === -1 ? rowIndex : getOrder(cells[documentOrderIndex]),
        rowIndex
      });
    });

    catalog.forEach((category) => {
      category.resources.sort((first, second) => (
        first.order - second.order || first.rowIndex - second.rowIndex
      ));
    });

    return [
      ...CATEGORY_DEFINITIONS.map((definition) => catalog.get(definition.name)),
      ...extraCategories.map((name) => catalog.get(name))
    ];
  }

  function slugify(value) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "khac";
  }

  function isSafeExternalUrl(value) {
    if (!value) {
      return false;
    }

    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_error) {
      return false;
    }
  }

  function isActive(value) {
    const normalized = String(value || "").trim().toUpperCase();
    return !["FALSE", "0", "NO", "OFF"].includes(normalized);
  }

  function getOrder(value) {
    const order = Number.parseFloat(value);
    return Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
  }

  function createSvgIcon(pathData) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    svg.append(path);
    return svg;
  }

  function createCategoryNav(category) {
    const link = document.createElement("a");
    link.className = "orbit-nav__link";
    link.href = `#${category.slug}`;
    link.dataset.category = category.slug;
    link.style.setProperty("--nav-accent", `var(--${category.accent})`);

    const code = document.createElement("span");
    code.className = "orbit-nav__code";
    code.textContent = category.code;

    const label = document.createElement("span");
    label.className = "orbit-nav__label";
    label.textContent = category.name;

    link.append(code, label);
    return link;
  }

  function createResourceCard(resource, category, index) {
    const card = document.createElement(resource.validUrl ? "a" : "article");
    card.className = `resource-card${resource.validUrl ? "" : " resource-card--unavailable"}`;
    card.style.setProperty("--card-index", index);
    card.dataset.tilt = "";
    card.dataset.searchText = normalizeSearchText(`${resource.name} ${resource.url} ${category.name} ${category.code}`);

    if (resource.validUrl) {
      card.href = resource.url;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
      card.setAttribute("aria-label", `${resource.name} - mở trong tab mới`);
    }

    const meta = document.createElement("div");
    meta.className = "resource-card__meta";

    const badge = document.createElement("span");
    badge.className = "resource-card__badge";
    badge.textContent = String(index + 1).padStart(2, "0");

    const host = document.createElement("span");
    host.className = "resource-card__host";
    host.textContent = resource.validUrl ? new URL(resource.url).hostname.replace(/^www\./, "") : "Chưa có liên kết";
    meta.append(badge, host);

    const title = document.createElement("h3");
    title.textContent = resource.name;

    const launch = document.createElement("span");
    launch.className = "resource-card__launch";
    launch.textContent = resource.validUrl ? "Mở tài liệu" : "Chưa khả dụng";
    if (resource.validUrl) {
      launch.append(createSvgIcon("M5 12h14M13 6l6 6-6 6"));
    }

    const edge = document.createElement("span");
    edge.className = "resource-card__edge";
    edge.setAttribute("aria-hidden", "true");

    card.style.setProperty("--card-accent", `var(--${category.accent})`);
    card.append(meta, title, launch, edge);
    return card;
  }

  function createCategorySection(category, categoryIndex) {
    const section = document.createElement("section");
    section.className = "category-section";
    section.id = category.slug;
    section.dataset.section = category.slug;
    section.dataset.reveal = "";
    section.style.setProperty("--section-accent", `var(--${category.accent})`);
    section.style.setProperty("--section-index", categoryIndex);
    section.setAttribute("aria-labelledby", `${category.slug}-title`);

    const header = document.createElement("header");
    header.className = "category-section__header";

    const identity = document.createElement("div");
    identity.className = "category-section__identity";

    const code = document.createElement("span");
    code.className = "category-section__code";
    code.textContent = category.code;
    code.setAttribute("aria-hidden", "true");

    const headingGroup = document.createElement("div");
    const kicker = document.createElement("p");
    kicker.className = "category-section__kicker";
    kicker.textContent = `Trạm ${String(categoryIndex + 1).padStart(2, "0")}`;

    const title = document.createElement("h2");
    title.id = `${category.slug}-title`;
    title.textContent = category.name;
    headingGroup.append(kicker, title);
    identity.append(code, headingGroup);

    const summary = document.createElement("div");
    summary.className = "category-section__summary";
    const description = document.createElement("p");
    description.textContent = category.description;
    const count = document.createElement("span");
    count.className = "category-section__count";
    count.textContent = `${category.resources.length} tài nguyên`;
    summary.append(description, count);
    header.append(identity, summary);

    const grid = document.createElement("div");
    grid.className = "resource-grid";

    if (category.resources.length === 0) {
      const empty = document.createElement("div");
      empty.className = "resource-grid__empty";
      empty.textContent = "Trạm này đang chờ tài nguyên mới được đồng bộ.";
      grid.append(empty);
    } else {
      category.resources.forEach((resource, index) => {
        grid.append(createResourceCard(resource, category, index));
      });
    }

    section.append(header, grid);
    return section;
  }

  function renderCatalog(categories) {
    catalogCategories = categories;
    dom.nav.replaceChildren();
    dom.sections.replaceChildren();
    const navFragment = document.createDocumentFragment();
    const sectionFragment = document.createDocumentFragment();

    categories.forEach((category, index) => {
      navFragment.append(createCategoryNav(category));
      sectionFragment.append(createCategorySection(category, index));
    });
    dom.nav.append(navFragment);
    dom.sections.append(sectionFragment);

    const resourceCount = categories.reduce((total, category) => total + category.resources.length, 0);
    document.querySelectorAll("[data-resource-count]").forEach((element) => {
      element.textContent = String(resourceCount);
    });

    dom.sections.setAttribute("aria-busy", "false");
    dom.status.hidden = true;
    dom.error.hidden = true;
    applyCatalogView(catalogView, false);
    applyCatalogSearch();
    setupCategoryNavigation();
    setupRevealAnimations();
    setupTiltEffects();
  }

  function showError(error) {
    console.error("DR Magic Hub catalog error:", error);
    dom.status.hidden = true;
    dom.error.hidden = false;
    dom.sections.setAttribute("aria-busy", "false");
  }

  async function fetchCatalog(source) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    try {
      const requestUrl = source.cacheBust
        ? `${source.url}${source.url.includes("?") ? "&" : "?"}_=${Date.now()}`
        : source.url;
      const response = await fetch(requestUrl, {
        cache: "no-store",
        credentials: source.credentials,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Catalog request failed with status ${response.status}.`);
      }

      const csv = await response.text();
      return normalizeCatalog(parseCsv(csv));
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function loadCatalog() {
    dom.status.hidden = false;
    dom.error.hidden = true;
    dom.sections.setAttribute("aria-busy", "true");

    let lastError;

    for (const source of CATALOG_SOURCES) {
      try {
        const categories = await fetchCatalog(source);
        document.documentElement.dataset.catalogSource = source.label;
        renderCatalog(categories);
        return;
      } catch (error) {
        lastError = error;
        console.warn(`Không thể tải danh mục từ ${source.label}.`, error);
      }
    }

    showError(lastError || new Error("Không có nguồn dữ liệu khả dụng."));
  }

  function setupCategoryNavigation() {
    if (sectionObserver) {
      sectionObserver.disconnect();
    }

    const links = Array.from(dom.nav.querySelectorAll(".orbit-nav__link"));
    const sections = Array.from(dom.sections.querySelectorAll(".category-section"));
    const linkBySlug = new Map(links.map((link) => [link.dataset.category, link]));

    function setActive(slug) {
      links.forEach((link) => {
        const active = link.dataset.category === slug;
        link.classList.toggle("is-active", active);
        if (active) {
          link.setAttribute("aria-current", "location");
          const centeredLeft = link.offsetLeft - ((dom.nav.clientWidth - link.offsetWidth) / 2);
          dom.nav.scrollTo({
            left: Math.max(0, centeredLeft),
            behavior: prefersReducedMotion() ? "auto" : "smooth"
          });
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }

    links.forEach((link) => {
      link.addEventListener("click", () => {
        clearTimeout(navigationLockTimer);
        document.documentElement.dataset.navigationLocked = "true";
        setActive(link.dataset.category);
        navigationLockTimer = window.setTimeout(() => {
          delete document.documentElement.dataset.navigationLocked;
        }, prefersReducedMotion() ? 100 : 1200);
      });
    });

    if ("IntersectionObserver" in window) {
      sectionObserver = new IntersectionObserver((entries) => {
        if (document.documentElement.dataset.navigationLocked === "true") {
          return;
        }
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible && linkBySlug.has(visible.target.dataset.section)) {
          setActive(visible.target.dataset.section);
        }
      }, { rootMargin: "-18% 0px -62% 0px", threshold: [0, 0.15, 0.35] });
      sections.forEach((section) => sectionObserver.observe(section));
    }

    if (links[0]) {
      setActive(links[0].dataset.category);
    }
  }

  function setupRevealAnimations() {
    if (revealObserver) {
      revealObserver.disconnect();
    }

    const revealItems = Array.from(document.querySelectorAll("[data-reveal]:not(.is-revealed)"));
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      revealItems.forEach((item) => item.classList.add("is-revealed"));
      return;
    }

    document.documentElement.classList.add("motion-ready");
    const pendingItems = revealItems.filter((item) => {
      const bounds = item.getBoundingClientRect();
      const visibleOnSetup = bounds.top < window.innerHeight * 0.96 && bounds.bottom > 0;
      if (visibleOnSetup) {
        item.classList.add("is-revealed");
      }
      return !visibleOnSetup;
    });
    revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -8%" });
    pendingItems.forEach((item) => revealObserver.observe(item));
  }

  function setupTiltEffects() {
    if (prefersReducedMotion() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return;
    }

    document.querySelectorAll("[data-tilt]:not([data-tilt-ready])").forEach((element) => {
      element.dataset.tiltReady = "true";
      let frame;

      element.addEventListener("pointermove", (event) => {
        const rect = element.getBoundingClientRect();
        const normalizedX = (event.clientX - rect.left) / rect.width - 0.5;
        const normalizedY = (event.clientY - rect.top) / rect.height - 0.5;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          element.style.setProperty("--tilt-x", `${(-normalizedY * 5).toFixed(2)}deg`);
          element.style.setProperty("--tilt-y", `${(normalizedX * 7).toFixed(2)}deg`);
          element.style.setProperty("--pointer-x", `${((normalizedX + 0.5) * 100).toFixed(1)}%`);
          element.style.setProperty("--pointer-y", `${((normalizedY + 0.5) * 100).toFixed(1)}%`);
        });
      });

      element.addEventListener("pointerleave", () => {
        cancelAnimationFrame(frame);
        element.style.setProperty("--tilt-x", "0deg");
        element.style.setProperty("--tilt-y", "0deg");
        element.style.setProperty("--pointer-x", "50%");
        element.style.setProperty("--pointer-y", "50%");
      });
    });
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function applyCatalogSearch() {
    const query = normalizeSearchText(dom.search?.value);
    const sections = Array.from(dom.sections.querySelectorAll(".category-section"));
    let visibleResources = 0;
    let visibleCategories = 0;

    sections.forEach((section) => {
      const cards = Array.from(section.querySelectorAll(".resource-card"));
      let sectionResourceCount = 0;

      cards.forEach((card) => {
        const matches = !query || card.dataset.searchText.includes(query);
        card.hidden = !matches;
        if (matches) {
          sectionResourceCount += 1;
          visibleResources += 1;
        }
      });

      const sectionVisible = !query || sectionResourceCount > 0;
      section.hidden = !sectionVisible;
      if (sectionVisible) {
        visibleCategories += 1;
      }

      const category = catalogCategories.find((item) => item.slug === section.dataset.section);
      const totalResources = category?.resources.length || cards.length;
      const count = section.querySelector(".category-section__count");
      if (count) {
        count.textContent = query
          ? `${sectionResourceCount} / ${totalResources} tài nguyên`
          : `${totalResources} tài nguyên`;
      }

      const navLink = dom.nav.querySelector(`[data-category="${section.dataset.section}"]`);
      if (navLink) {
        navLink.hidden = !sectionVisible;
      }
    });

    const totalResources = catalogCategories.reduce((total, category) => total + category.resources.length, 0);
    dom.searchResult.textContent = query
      ? `${visibleResources} kết quả trong ${visibleCategories} nhóm`
      : `${totalResources} tài liệu trong ${catalogCategories.length} nhóm`;
    dom.noResults.hidden = !query || visibleResources > 0;

    const visibleLinks = Array.from(dom.nav.querySelectorAll(".orbit-nav__link:not([hidden])"));
    const activeVisible = visibleLinks.some((link) => link.classList.contains("is-active"));
    if (!activeVisible && visibleLinks[0]) {
      dom.nav.querySelectorAll(".orbit-nav__link").forEach((link) => {
        const active = link === visibleLinks[0];
        link.classList.toggle("is-active", active);
        if (active) {
          link.setAttribute("aria-current", "location");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }
  }

  function applyCatalogView(view, persist = true) {
    catalogView = view === "list" ? "list" : "grid";
    dom.sections.classList.toggle("is-list-view", catalogView === "list");
    dom.viewButtons.forEach((button) => {
      const active = button.dataset.catalogView === catalogView;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    if (persist) {
      try {
        localStorage.setItem("dr-magic-hub-catalog-view", catalogView);
      } catch (_error) {
        // The view still changes when storage is unavailable.
      }
    }
  }

  function setupCatalogControls() {
    try {
      catalogView = localStorage.getItem("dr-magic-hub-catalog-view") === "list" ? "list" : "grid";
    } catch (_error) {
      catalogView = "grid";
    }

    dom.viewButtons.forEach((button) => {
      button.addEventListener("click", () => applyCatalogView(button.dataset.catalogView));
    });
    dom.search.addEventListener("input", applyCatalogSearch);
    dom.clearSearch.addEventListener("click", () => {
      dom.search.value = "";
      applyCatalogSearch();
      dom.search.focus();
    });
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
      if (event.key === "/" && !isTyping && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        dom.search.focus();
      }
      if (event.key === "Escape" && target === dom.search && dom.search.value) {
        dom.search.value = "";
        applyCatalogSearch();
      }
    });

    applyCatalogView(catalogView, false);
  }

  function applyTheme(theme, persist = true) {
    const normalizedTheme = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = normalizedTheme;
    dom.themeToggle.setAttribute("aria-pressed", String(normalizedTheme === "light"));
    dom.themeToggle.setAttribute("aria-label", normalizedTheme === "light" ? "Chuyển sang giao diện tối" : "Chuyển sang giao diện sáng");
    dom.themeLabel.textContent = normalizedTheme === "light" ? "Sáng" : "Tối";
    document.querySelector('meta[name="theme-color"]').content = normalizedTheme === "light" ? "#edf4f0" : "#071426";

    if (persist) {
      try {
        localStorage.setItem("dr-magic-hub-theme", normalizedTheme);
      } catch (_error) {
        // Theme still works when storage is unavailable.
      }
    }
  }

  function setupThemeToggle() {
    const currentTheme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    applyTheme(currentTheme, false);
    dom.themeToggle.addEventListener("click", () => {
      applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
    });
  }

  function setupBackToTop() {
    function updateVisibility() {
      backToTopFrame = undefined;
      const visible = window.scrollY > Math.max(520, window.innerHeight * 0.72);
      dom.backToTop.classList.toggle("is-visible", visible);
      dom.backToTop.setAttribute("aria-hidden", String(!visible));
      dom.backToTop.tabIndex = visible ? 0 : -1;
    }

    window.addEventListener("scroll", () => {
      if (!backToTopFrame) {
        backToTopFrame = requestAnimationFrame(updateVisibility);
      }
    }, { passive: true });

    dom.backToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    });
    updateVisibility();
  }

  function initialize() {
    dom.nav = document.getElementById("category-nav");
    dom.sections = document.getElementById("catalog-sections");
    dom.status = document.getElementById("catalog-status");
    dom.error = document.getElementById("catalog-error");
    dom.retry = document.getElementById("retry-button");
    dom.themeToggle = document.getElementById("theme-toggle");
    dom.themeLabel = document.querySelector("[data-theme-label]");
    dom.backToTop = document.getElementById("back-to-top");
    dom.search = document.getElementById("resource-search");
    dom.searchResult = document.getElementById("catalog-search-result");
    dom.noResults = document.getElementById("catalog-no-results");
    dom.clearSearch = document.getElementById("clear-search-button");
    dom.viewButtons = Array.from(document.querySelectorAll("[data-catalog-view]"));

    document.querySelectorAll("[data-current-year]").forEach((element) => {
      element.textContent = String(new Date().getFullYear());
    });

    dom.retry.addEventListener("click", loadCatalog);
    setupThemeToggle();
    setupCatalogControls();
    setupBackToTop();
    setupRevealAnimations();
    setupTiltEffects();
    loadCatalog();
  }

  window.DRMagicHub = Object.freeze({
    parseCsv,
    normalizeCatalog,
    isSafeExternalUrl
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
}());
