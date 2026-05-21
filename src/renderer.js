window.__jsonify = window.__jsonify || {};

(function () {
  const VIRTUAL_THRESHOLD = 300;
  const VIRTUAL_ROW_HEIGHT = 22;
  const VIRTUAL_BUFFER = 15;

  function typeOf(val) {
    if (val === null) return "null";
    if (Array.isArray(val)) return "array";
    return typeof val;
  }

  function isStringifiedJSON(val) {
    if (typeof val !== "string") return false;
    const t = val.trimStart();
    if (!t.startsWith("{") && !t.startsWith("[")) return false;
    if (t.length < 6) return false;
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function countStats(data) {
    let strings = 0, numbers = 0, booleans = 0, nulls = 0, arrays = 0, objects = 0;
    function walk(v) {
      const t = typeOf(v);
      if (t === "string") strings++;
      else if (t === "number") numbers++;
      else if (t === "boolean") booleans++;
      else if (t === "null") nulls++;
      else if (t === "array") { arrays++; v.forEach(walk); }
      else if (t === "object") { objects++; Object.values(v).forEach(walk); }
    }
    walk(data);
    return { strings, numbers, booleans, nulls, arrays, objects };
  }

  function flattenTree(data, opts = {}) {
    const rows = [];
    const { searchTerm = "" } = opts;
    const term = searchTerm.toLowerCase();

    function push(row) {
      if (term) {
        const keyMatch = row.key !== null && String(row.key).toLowerCase().includes(term);
        const valMatch = row.type !== "object" && row.type !== "array" &&
          String(row.value).toLowerCase().includes(term);
        row.matched = keyMatch || valMatch;
        row.keyMatch = keyMatch;
        row.valMatch = valMatch;
      }
      rows.push(row);
    }

    function walk(val, depth, key, path, parentCollapsed) {
      const t = typeOf(val);
      const id = path.join(".");
      const collapsed = opts.collapsed?.[id] || false;

      if (t === "object" && val !== null) {
        const keys = Object.keys(val);
        push({ type: "object-open", depth, key, path: id, childCount: keys.length, collapsed });
        if (!collapsed) {
          keys.forEach((k) => walk(val[k], depth + 1, k, [...path, k], false));
          push({ type: "object-close", depth, path: id + "_close" });
        }
      } else if (t === "array") {
        push({ type: "array-open", depth, key, path: id, childCount: val.length, collapsed });
        if (!collapsed) {
          val.forEach((item, i) => walk(item, depth + 1, i, [...path, i], false));
          push({ type: "array-close", depth, path: id + "_close" });
        }
      } else {
        const isStrJSON = isStringifiedJSON(val);
        push({ type: t, depth, key, value: val, path: id, isStringifiedJSON: isStrJSON,
          expandedStringified: opts.expandedStringified?.[id] || false });
      }
    }

    walk(data, 0, null, ["root"], false);
    return rows;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function highlight(text, term) {
    if (!term) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const termEsc = escapeHtml(term);
    return escaped.replace(
      new RegExp(termEsc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
      (m) => `<mark class="jfy-match-hl">${m}</mark>`
    );
  }

  function renderRow(row, term) {
    const indent = '<span class="jfy-indent"></span>'.repeat(row.depth);
    const pathAttr = `data-path="${escapeHtml(row.path)}"`;

    if (row.type === "object-open" || row.type === "array-open") {
      const bracket = row.type === "object-open" ? "{" : "[";
      const keyHtml = row.key !== null
        ? `<span class="jfy-key">${highlight(String(row.key), row.keyMatch ? term : "")}</span><span class="jfy-colon">: </span>`
        : "";
      const countHtml = row.collapsed
        ? `<span class="jfy-dim"> ${row.childCount} item${row.childCount !== 1 ? "s" : ""}</span>`
        : "";
      const closeBracket = row.collapsed ? (row.type === "object-open" ? " }" : " ]") : "";
      return `<div class="jfy-row jfy-collapsible${row.matched ? " jfy-matched" : ""}" ${pathAttr} data-collapsed="${row.collapsed}">
        ${indent}
        <button class="jfy-toggle${row.collapsed ? " jfy-collapsed" : ""}" aria-label="${row.collapsed ? "Expand" : "Collapse"}" data-toggle="${escapeHtml(row.path)}"></button>
        ${keyHtml}<span class="jfy-bracket">${bracket}</span>${countHtml}<span class="jfy-bracket">${closeBracket}</span>
        <button class="jfy-copy-btn" data-copy-path="${escapeHtml(row.path)}" title="Copy path">path</button>
      </div>`;
    }

    if (row.type === "object-close" || row.type === "array-close") {
      const bracket = row.type === "object-close" ? "}" : "]";
      return `<div class="jfy-row jfy-close" ${pathAttr}>${indent}<span class="jfy-bracket">${bracket}</span></div>`;
    }

    let valHtml = "";
    const valStr = String(row.value);

    if (row.type === "string") {
      const displayVal = row.isStringifiedJSON
        ? escapeHtml(valStr.length > 40 ? valStr.slice(0, 40) + "…" : valStr)
        : highlight(escapeHtml(`"${valStr}"`), row.valMatch ? term : "");
      valHtml = `<span class="jfy-string">${displayVal}</span>`;
      if (row.isStringifiedJSON) {
        const badgeLabel = row.expandedStringified ? "collapse" : "expand ↗";
        valHtml += ` <button class="jfy-expand-badge" data-expand-path="${escapeHtml(row.path)}">${badgeLabel}</button>`;
      }
    } else if (row.type === "number") {
      valHtml = `<span class="jfy-number">${highlight(valStr, row.valMatch ? term : "")}</span>`;
    } else if (row.type === "boolean") {
      valHtml = `<span class="jfy-boolean">${valStr}</span>`;
    } else if (row.type === "null") {
      valHtml = `<span class="jfy-null">null</span>`;
    }

    const keyHtml = row.key !== null
      ? `<span class="jfy-key">${highlight(String(row.key), row.keyMatch ? term : "")}</span><span class="jfy-colon">: </span>`
      : "";

    return `<div class="jfy-row${row.matched ? " jfy-matched" : ""}" ${pathAttr}>
      ${indent}
      <span class="jfy-spacer"></span>
      ${keyHtml}${valHtml}
      <button class="jfy-copy-btn" data-copy-path="${escapeHtml(row.path)}" title="Copy path">path</button>
      ${row.type === "string" ? `<button class="jfy-copy-btn jfy-copy-val" data-copy-val="${escapeHtml(valStr)}" title="Copy value">val</button>` : ""}
    </div>`;
  }

  function buildVirtualContainer(rows, term) {
    const total = rows.length;
    const totalHeight = total * VIRTUAL_ROW_HEIGHT;

    const wrapper = document.createElement("div");
    wrapper.className = "jfy-virtual";
    wrapper.style.position = "relative";
    wrapper.style.height = totalHeight + "px";

    const viewport = wrapper.closest?.(".jfy-tree") || null;

    let visibleStart = 0;
    let visibleEnd = Math.min(VIRTUAL_BUFFER * 2 + 30, total);
    const content = document.createElement("div");
    content.className = "jfy-virtual-content";
    content.style.position = "absolute";
    content.style.top = "0";
    content.style.width = "100%";

    function renderVisible() {
      const start = Math.max(0, visibleStart - VIRTUAL_BUFFER);
      const end = Math.min(total, visibleEnd + VIRTUAL_BUFFER);
      content.style.top = start * VIRTUAL_ROW_HEIGHT + "px";
      content.innerHTML = rows.slice(start, end).map((r) => renderRow(r, term)).join("");
    }

    renderVisible();
    wrapper.appendChild(content);

    const treeEl = document.querySelector(".jfy-tree");
    if (treeEl) {
      treeEl.addEventListener("scroll", () => {
        const scrollTop = treeEl.scrollTop;
        visibleStart = Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT);
        visibleEnd = visibleStart + Math.ceil(treeEl.clientHeight / VIRTUAL_ROW_HEIGHT);
        renderVisible();
      }, { passive: true });
    }

    return wrapper;
  }

  function renderTree(container, rows, term) {
    container.innerHTML = "";
    if (rows.length > VIRTUAL_THRESHOLD) {
      container.appendChild(buildVirtualContainer(rows, term));
    } else {
      container.innerHTML = rows.map((r) => renderRow(r, term)).join("");
    }
  }

  window.__jsonify.Renderer = {
    flattenTree,
    renderTree,
    countStats,
    formatSize,
    typeOf,
    isStringifiedJSON,
  };
})();
