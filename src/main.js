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

  function rerender() {
    const tree = document.querySelector(".jfy-tree");
    if (!tree) return;

    const rows = Renderer.flattenTree(state.data, {
      collapsed: state.collapsed,
      expandedStringified: state.expandedStringified,
      searchTerm: state.searchTerm,
    });

    const filterRows = state.searchTerm
      ? rows.filter((r) => {
          if (r.matched) return true;
          if (r.type === "object-open" || r.type === "array-open") {
            return rows.some(
              (child) =>
                child.matched &&
                child.path.startsWith(r.path + ".") || child.path.startsWith(r.path + "[")
            );
          }
          return false;
        })
      : rows;

    const matchCount = rows.filter((r) => r.matched).length;
    Toolbar.updateMatchCount(matchCount, state.searchTerm ? rows.length : 0);

    Renderer.renderTree(tree, filterRows, state.searchTerm);
  }

  function handleTreeClick(e) {
    const toggle = e.target.closest("[data-toggle]");
    if (toggle) {
      const path = toggle.dataset.toggle;
      state.collapsed[path] = !state.collapsed[path];
      rerender();
      return;
    }

    const copyPath = e.target.closest("[data-copy-path]");
    if (copyPath) {
      copyToClipboard(copyPath.dataset.copyPath);
      showCopyFeedback(copyPath);
      Toolbar.updateBreadcrumb(copyPath.dataset.copyPath);
      return;
    }

    const copyVal = e.target.closest("[data-copy-val]");
    if (copyVal) {
      copyToClipboard(copyVal.dataset.copyVal);
      showCopyFeedback(copyVal);
      return;
    }

    const expandBadge = e.target.closest("[data-expand-path]");
    if (expandBadge) {
      const path = expandBadge.dataset.expandPath;
      state.expandedStringified[path] = !state.expandedStringified[path];
      rerender();
      return;
    }

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
    a.download = "download.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function mount(detection) {
    state.data = detection.data;
    state.raw = detection.raw;

    try {
      chrome.storage.local.get(["jfy_theme", "jfy_blocked"], (res) => {
        state.theme = res.jfy_theme || getSystemTheme();
        window.__jsonify.blockedHosts = res.jfy_blocked || [];
        applyTheme(state.theme);
      });
    } catch {
      state.theme = getSystemTheme();
      applyTheme(state.theme);
    }

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

    rerender();

    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (e) => {
      try {
        chrome.storage.local.get(["jfy_theme"], (res) => {
          if (!res.jfy_theme) applyTheme(e.matches ? "light" : "dark");
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
