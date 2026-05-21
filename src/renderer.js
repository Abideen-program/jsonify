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
    try { JSON.parse(val); return true; } catch { return false; }
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
    const { searchTerm = "", collapsed = {}, expandedStringified = {} } = opts;
    const term = searchTerm.toLowerCase();

    function markMatch(row) {
      if (!term) return;
      const keyMatch = row.key !== null && String(row.key).toLowerCase().includes(term);
      const valMatch = row.type !== "object" && row.type !== "array" &&
        row.value !== undefined && String(row.value).toLowerCase().includes(term);
      row.matched = keyMatch || valMatch;
      row.keyMatch = keyMatch;
      row.valMatch = valMatch;
    }

    function walk(val, depth, key, path) {
      const t = typeOf(val);
      const id = path.join(".");
      const isCollapsed = collapsed[id] || false;

      if (t === "object" && val !== null) {
        const keys = Object.keys(val);
        const row = { type: "object-open", depth, key, path: id, childCount: keys.length, collapsed: isCollapsed };
        markMatch(row);
        rows.push(row);
        if (!isCollapsed) {
          keys.forEach((k) => walk(val[k], depth + 1, k, [...path, k]));
          rows.push({ type: "object-close", depth, path: id + "_close" });
        }
      } else if (t === "array") {
        const row = { type: "array-open", depth, key, path: id, childCount: val.length, collapsed: isCollapsed };
        markMatch(row);
        rows.push(row);
        if (!isCollapsed) {
          val.forEach((item, i) => walk(item, depth + 1, i, [...path, i]));
          rows.push({ type: "array-close", depth, path: id + "_close" });
        }
      } else {
        const isStrJSON = isStringifiedJSON(val);
        const isExpanded = isStrJSON && expandedStringified[id];
        const row = {
          type: t, depth, key, value: val, path: id,
          isStringifiedJSON: isStrJSON,
          expandedStringified: isExpanded,
        };
        markMatch(row);
        rows.push(row);

        // If expanded, render the parsed child tree inline
        if (isExpanded) {
          try {
            const parsed = JSON.parse(val);
            walk(parsed, depth + 1, null, [...path, "__parsed__"]);
          } catch {}
        }
      }
    }

    walk(data, 0, null, ["root"]);
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
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return escaped.replace(new RegExp(escapeHtml(safe), "gi"),
      (m) => `<mark class="jfy-match-hl">${m}</mark>`);
  }

  function renderRow(row, term) {
    const indent = '<span class="jfy-indent"></span>'.repeat(row.depth);
    const pathAttr = `data-path="${escapeHtml(row.path)}"`;

    // Object or array open
    if (row.type === "object-open" || row.type === "array-open") {
      const bracket = row.type === "object-open" ? "{" : "[";
      const closeBracket = row.type === "object-open" ? "}" : "]";
      const keyHtml = row.key !== null
        ? `<span class="jfy-key">${highlight(String(row.key), row.keyMatch ? term : "")}</span><span class="jfy-colon">: </span>`
        : "";
      const collapsedHtml = row.collapsed
        ? `<span class="jfy-dim">${row.childCount} item${row.childCount !== 1 ? "s" : ""}</span> <span class="jfy-bracket">${closeBracket}</span>`
        : "";

      return `<div class="jfy-row jfy-collapsible${row.matched ? " jfy-matched" : ""}" ${pathAttr}>
        ${indent}
        <button class="jfy-toggle${row.collapsed ? " jfy-collapsed" : ""}" data-toggle="${escapeHtml(row.path)}" aria-label="${row.collapsed ? "Expand" : "Collapse"}"></button>
        ${keyHtml}<span class="jfy-bracket">${bracket}</span>${collapsedHtml}
        <button class="jfy-copy-btn" data-copy-path="${escapeHtml(row.path)}" title="Copy path">path</button>
      </div>`;
    }

    // Closing brackets
    if (row.type === "object-close" || row.type === "array-close") {
      const bracket = row.type === "object-close" ? "}" : "]";
      return `<div class="jfy-row jfy-close" ${pathAttr}>${indent}<span class="jfy-spacer"></span><span class="jfy-bracket">${bracket}</span></div>`;
    }

    // Inline expanded stringified JSON — show a labelled separator
    if (row.type === "string" && row.path.endsWith(".__parsed__")) {
      return ""; // parsed rows render themselves via walk
    }

    // Primitive values
    let valHtml = "";

    if (row.type === "string") {
      if (row.isStringifiedJSON) {
        const preview = escapeHtml(String(row.value).slice(0, 50) + (String(row.value).length > 50 ? "…" : ""));
        const badgeLabel = row.expandedStringified ? "collapse ↙" : "expand ↗";
        valHtml = `<span class="jfy-string">"${preview}"</span>
          <button class="jfy-expand-badge" data-expand-path="${escapeHtml(row.path)}">${badgeLabel}</button>`;
      } else {
        valHtml = `<span class="jfy-string">"${highlight(String(row.value), row.valMatch ? term : "")}"</span>`;
      }
    } else if (row.type === "number") {
      valHtml = `<span class="jfy-number">${highlight(String(row.value), row.valMatch ? term : "")}</span>`;
    } else if (row.type === "boolean") {
      valHtml = `<span class="jfy-boolean">${String(row.value)}</span>`;
    } else if (row.type === "null") {
      valHtml = `<span class="jfy-null">null</span>`;
    }

    const keyHtml = row.key !== null
      ? `<span class="jfy-key">${highlight(String(row.key), row.keyMatch ? term : "")}</span><span class="jfy-colon">: </span>`
      : "";

    const copyVal = row.type === "string" || row.type === "number" || row.type === "boolean"
      ? `<button class="jfy-copy-btn jfy-copy-val" data-copy-val="${escapeHtml(String(row.value))}" title="Copy value">val</button>`
      : "";

    return `<div class="jfy-row${row.matched ? " jfy-matched" : ""}" ${pathAttr}>
      ${indent}
      <span class="jfy-spacer"></span>
      ${keyHtml}${valHtml}
      <button class="jfy-copy-btn" data-copy-path="${escapeHtml(row.path)}" title="Copy path">path</button>
      ${copyVal}
    </div>`;
  }

  function renderTree(container, rows, term) {
    container.innerHTML = "";

    if (rows.length > VIRTUAL_THRESHOLD) {
      const totalHeight = rows.length * VIRTUAL_ROW_HEIGHT;
      const wrapper = document.createElement("div");
      wrapper.className = "jfy-virtual";
      wrapper.style.cssText = `position:relative;height:${totalHeight}px;`;

      const content = document.createElement("div");
      content.className = "jfy-virtual-content";
      content.style.cssText = "position:absolute;top:0;width:100%;";
      content.innerHTML = rows.slice(0, VIRTUAL_BUFFER * 2 + 30).map((r) => renderRow(r, term)).join("");

      wrapper.appendChild(content);
      container.appendChild(wrapper);
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
    renderRowPublic: renderRow,
  };
})();
