window.__jsonify = window.__jsonify || {};

(function () {
  const { detect } = window.__jsonify;
  const { Renderer } = window.__jsonify;
  const { Toolbar } = window.__jsonify;

  let state = {
    data: null,
    raw: "",
    collapsed: {},
    expandedStringified: {},
    searchTerm: "",
    isRaw: false,
    theme: "dark",
  };

  function getSystemTheme() {
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute("data-jfy-theme", theme);
    try { chrome.storage.local.set({ jfy_theme: theme }); } catch {}
  }

  function loadFonts() {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=DM+Sans:wght@400;500&display=swap";
    document.head.appendChild(link);
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    });
  }

  function showCopyFeedback(btn) {
    const orig = btn.textContent;
    btn.textContent = "✓";
    btn.classList.add("jfy-copy-ok");
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove("jfy-copy-ok");
    }, 800);
  }

  function getFilteredRows() {
    const rows = Renderer.flattenTree(state.data, {
      collapsed: state.collapsed,
      expandedStringified: state.expandedStringified,
      searchTerm: state.searchTerm,
    });

    if (!state.searchTerm) return { rows, matchCount: 0 };

    // Keep matched rows + their ancestors for context
    const matchedPaths = new Set(
      rows.filter((r) => r.matched).map((r) => r.path)
    );

    function isAncestorOfMatch(rowPath) {
      for (const mp of matchedPaths) {
        if (mp.startsWith(rowPath + ".") || mp.startsWith(rowPath + "[")) return true;
      }
      return false;
    }

    const filtered = rows.filter((r) => {
      if (r.matched) return true;
      if (r.type === "object-open" || r.type === "array-open") {
        return isAncestorOfMatch(r.path);
      }
      // Keep closing brackets if their open was kept
      if (r.type === "object-close" || r.type === "array-close") {
        const openPath = r.path.replace("_close", "");
        return matchedPaths.has(openPath) || isAncestorOfMatch(openPath);
      }
      return false;
    });

    return { rows: filtered, matchCount: matchedPaths.size };
  }

  function rerender() {
    const tree = document.querySelector(".jfy-tree");
    if (!tree) return;

    const { rows, matchCount } = getFilteredRows();

    Toolbar.updateMatchCount(matchCount, state.searchTerm ? matchCount : 0);
    Renderer.renderTree(tree, rows, state.searchTerm);

    // Re-attach virtual scroll listener after render
    attachVirtualScroll(tree);
  }

  function attachVirtualScroll(treeEl) {
    const virtual = treeEl.querySelector(".jfy-virtual");
    const content = treeEl.querySelector(".jfy-virtual-content");
    if (!virtual || !content) return;

    const VIRTUAL_ROW_HEIGHT = 22;
    const VIRTUAL_BUFFER = 15;

    // Get the flat rows for reference
    const allRows = Renderer.flattenTree(state.data, {
      collapsed: state.collapsed,
      expandedStringified: state.expandedStringified,
      searchTerm: state.searchTerm,
    });

    const total = allRows.length;

    treeEl.addEventListener("scroll", function onScroll() {
      const scrollTop = treeEl.scrollTop;
      const visibleStart = Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT);
      const visibleEnd = visibleStart + Math.ceil(treeEl.clientHeight / VIRTUAL_ROW_HEIGHT);

      const start = Math.max(0, visibleStart - VIRTUAL_BUFFER);
      const end = Math.min(total, visibleEnd + VIRTUAL_BUFFER);

      content.style.top = start * VIRTUAL_ROW_HEIGHT + "px";
      content.innerHTML = allRows
        .slice(start, end)
        .map((r) => Renderer.renderRowPublic(r, state.searchTerm))
        .join("");
    }, { passive: true });
  }

  function handleTreeClick(e) {
    // Toggle collapse
    const toggle = e.target.closest("[data-toggle]");
    if (toggle) {
      const path = toggle.dataset.toggle;
      state.collapsed[path] = !state.collapsed[path];
      rerender();
      return;
    }

    // Copy path
    const copyPath = e.target.closest("[data-copy-path]");
    if (copyPath) {
      copyToClipboard(copyPath.dataset.copyPath);
      showCopyFeedback(copyPath);
      Toolbar.updateBreadcrumb(copyPath.dataset.copyPath);
      return;
    }

    // Copy value
    const copyVal = e.target.closest("[data-copy-val]");
    if (copyVal) {
      copyToClipboard(copyVal.dataset.copyVal);
      showCopyFeedback(copyVal);
      return;
    }

    // Expand stringified JSON inline
    const expandBadge = e.target.closest("[data-expand-path]");
    if (expandBadge) {
      const path = expandBadge.dataset.expandPath;
      state.expandedStringified[path] = !state.expandedStringified[path];
      rerender();
      return;
    }

    // Update breadcrumb on any row click
    const row = e.target.closest("[data-path]");
    if (row) {
      Toolbar.updateBreadcrumb(row.dataset.path);
    }
  }

  function downloadJSON() {
    const blob = new Blob([state.raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = location.hostname + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function mount(detection) {
    state.data = detection.data;
    state.raw = detection.raw;

    // Load theme from storage, fall back to system
    try {
      chrome.storage.local.get(["jfy_theme", "jfy_blocked"], (res) => {
        const savedTheme = res.jfy_theme;
        state.theme = (!savedTheme || savedTheme === "auto")
          ? getSystemTheme()
          : savedTheme;
        window.__jsonify.blockedHosts = res.jfy_blocked || [];
        applyTheme(state.theme);
      });
    } catch {
      state.theme = getSystemTheme();
      applyTheme(state.theme);
    }

    // Replace entire page
    document.documentElement.innerHTML = "";
    document.documentElement.className = "jfy-root";

    const head = document.createElement("head");
    head.innerHTML = `
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Jsonify — ${location.hostname}</title>
    `;

    const body = document.createElement("body");
    body.className = "jfy-body";

    const app = document.createElement("div");
    app.className = "jfy-app";

    // Title bar
    const titlebar = document.createElement("div");
    titlebar.className = "jfy-titlebar";
    titlebar.innerHTML = `
      <div class="jfy-logo">
        <span class="jfy-logo-dot"></span>
        <span class="jfy-logo-name">Jsonify</span>
      </div>
      <div class="jfy-url-display">${escapeHtml(location.href)}</div>
    `;

    const stats = Renderer.countStats(detection.data);
    const size = Renderer.formatSize(detection.size);

    // Toolbar
    const toolbar = Toolbar.buildToolbar({
      onSearch(term) {
        state.searchTerm = term;
        rerender();
      },
      onToggleRaw(isRaw) {
        state.isRaw = isRaw;
        Toolbar.setRawActive(isRaw);
        const tree = document.querySelector(".jfy-tree");
        if (!tree) return;
        if (isRaw) {
          tree.innerHTML = `<pre class="jfy-raw-pre">${escapeHtml(state.raw)}</pre>`;
        } else {
          rerender();
        }
      },
      onDownload: downloadJSON,
      onToggleTheme() {
        applyTheme(state.theme === "dark" ? "light" : "dark");
      },
    });

    const statsBar = Toolbar.buildStatsBar({ stats, size });

    // Tree container
    const tree = document.createElement("div");
    tree.className = "jfy-tree";
    tree.addEventListener("click", handleTreeClick);

    const breadcrumb = Toolbar.buildBreadcrumb();

    app.appendChild(titlebar);
    app.appendChild(toolbar);
    app.appendChild(statsBar);
    app.appendChild(tree);
    app.appendChild(breadcrumb);

    body.appendChild(app);
    document.documentElement.appendChild(head);
    document.documentElement.appendChild(body);

    // Load fonts after DOM is ready
    loadFonts();

    // Initial render
    rerender();

    // Listen for OS theme changes
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (e) => {
      try {
        chrome.storage.local.get(["jfy_theme"], (res) => {
          if (!res.jfy_theme || res.jfy_theme === "auto") {
            applyTheme(e.matches ? "light" : "dark");
          }
        });
      } catch {
        applyTheme(e.matches ? "light" : "dark");
      }
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function init() {
    const detection = detect();
    if (!detection) return;

    if (!detection.valid) {
      console.warn("[Jsonify] Invalid JSON detected:", detection.error);
      return;
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => mount(detection));
    } else {
      mount(detection);
    }
  }

  init();
})();
