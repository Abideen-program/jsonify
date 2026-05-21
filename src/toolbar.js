window.__jsonify = window.__jsonify || {};

(function () {
  function buildToolbar({ onSearch, onToggleRaw, onDownload, onToggleTheme }) {
    const el = document.createElement("div");
    el.className = "jfy-toolbar";
    el.innerHTML = `
      <div class="jfy-search-wrap">
        <svg class="jfy-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input class="jfy-search-input" id="jfy-search" type="text" placeholder="Search keys or values…" autocomplete="off" spellcheck="false" />
        <span class="jfy-match-count" id="jfy-match-count"></span>
      </div>
      <div class="jfy-toolbar-right">
        <button class="jfy-tb-btn jfy-active" id="jfy-btn-fmt" title="Formatted view">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          Formatted
        </button>
        <button class="jfy-tb-btn" id="jfy-btn-raw" title="Raw JSON">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Raw
        </button>
        <div class="jfy-tb-sep"></div>
        <button class="jfy-tb-btn jfy-icon-btn" id="jfy-btn-download" title="Download JSON">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button class="jfy-tb-btn jfy-icon-btn" id="jfy-btn-theme" title="Toggle theme">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
      </div>
    `;

    let searchTimer = null;
    el.querySelector("#jfy-search").addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => onSearch(e.target.value), 120);
    });

    el.querySelector("#jfy-btn-fmt").addEventListener("click", () => onToggleRaw(false));
    el.querySelector("#jfy-btn-raw").addEventListener("click", () => onToggleRaw(true));
    el.querySelector("#jfy-btn-download").addEventListener("click", onDownload);
    el.querySelector("#jfy-btn-theme").addEventListener("click", onToggleTheme);

    return el;
  }

  function buildStatsBar({ stats, size }) {
    const el = document.createElement("div");
    el.className = "jfy-stats-bar";
    el.innerHTML = `
      <span class="jfy-stat"><span class="jfy-stat-dot jfy-dot-str"></span> <b>${stats.strings}</b> strings</span>
      <span class="jfy-stat"><span class="jfy-stat-dot jfy-dot-num"></span> <b>${stats.numbers}</b> numbers</span>
      <span class="jfy-stat"><span class="jfy-stat-dot jfy-dot-bool"></span> <b>${stats.booleans}</b> booleans</span>
      ${stats.nulls ? `<span class="jfy-stat"><span class="jfy-stat-dot jfy-dot-null"></span> <b>${stats.nulls}</b> nulls</span>` : ""}
      <span class="jfy-stat jfy-stat-right"><b>${stats.objects}</b> objects · <b>${stats.arrays}</b> arrays · ${size}</span>
    `;
    return el;
  }

  function buildBreadcrumb() {
    const el = document.createElement("div");
    el.className = "jfy-breadcrumb";
    el.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;opacity:0.4"><polyline points="9 18 15 12 9 6"/></svg>
      <span class="jfy-breadcrumb-path" id="jfy-breadcrumb-path">root</span>
      <span class="jfy-breadcrumb-hint">click any node to trace path</span>
    `;
    return el;
  }

  function updateMatchCount(matched, total) {
    const el = document.getElementById("jfy-match-count");
    if (!el) return;
    if (total === 0) { el.textContent = ""; return; }
    el.textContent = `${matched} match${matched !== 1 ? "es" : ""}`;
  }

  function updateBreadcrumb(path) {
    const el = document.getElementById("jfy-breadcrumb-path");
    if (!el) return;
    const parts = path.replace(/^root\.?/, "").split(".");
    const segs = ["root", ...parts.filter(Boolean)];
    el.innerHTML = segs
      .map((s, i) =>
        i === segs.length - 1
          ? `<span class="jfy-breadcrumb-active">${s}</span>`
          : `<span class="jfy-breadcrumb-seg">${s}</span><span class="jfy-breadcrumb-sep"> / </span>`
      )
      .join("");
  }

  function setRawActive(isRaw) {
    document.getElementById("jfy-btn-fmt")?.classList.toggle("jfy-active", !isRaw);
    document.getElementById("jfy-btn-raw")?.classList.toggle("jfy-active", isRaw);
  }

  window.__jsonify.Toolbar = {
    buildToolbar,
    buildStatsBar,
    buildBreadcrumb,
    updateMatchCount,
    updateBreadcrumb,
    setRawActive,
  };
})();
