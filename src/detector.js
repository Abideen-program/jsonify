window.__jsonify = window.__jsonify || {};

(function () {
  const BLOCKED_HOSTS = [];

  function isBlockedHost() {
    const blocked = window.__jsonify.blockedHosts || BLOCKED_HOSTS;
    return blocked.some((h) => location.hostname.includes(h));
  }

  function getContentType() {
    const ct = document.contentType || "";
    return ct.toLowerCase();
  }

  function looksLikeJSON(text) {
    const t = text.trimStart();
    return (t.startsWith("{") || t.startsWith("[")) && t.length > 0;
  }

  function isJSONContentType(ct) {
    return (
      ct.includes("application/json") ||
      ct.includes("text/json") ||
      ct.includes("+json")
    );
  }

  function shouldActivate() {
    if (isBlockedHost()) return false;

    const ct = getContentType();

    if (isJSONContentType(ct)) return true;

    if (
      ct === "text/plain" ||
      ct === "application/octet-stream" ||
      ct === ""
    ) {
      const raw = document.body ? document.body.innerText || "" : "";
      if (looksLikeJSON(raw)) return true;
    }

    return false;
  }

  function extractRawText() {
    const pre = document.querySelector("pre");
    if (pre) return pre.innerText || pre.textContent || "";
    return document.body ? document.body.innerText || document.body.textContent || "" : "";
  }

  function tryParseJSON(raw) {
    try {
      return { ok: true, data: JSON.parse(raw), raw };
    } catch (e) {
      return { ok: false, error: e.message, raw };
    }
  }

  window.__jsonify.detect = function () {
    if (!shouldActivate()) return null;

    const raw = extractRawText();
    if (!raw.trim()) return null;

    const result = tryParseJSON(raw);
    if (!result.ok) {
      return { valid: false, error: result.error, raw };
    }

    return {
      valid: true,
      data: result.data,
      raw: result.raw,
      size: new Blob([result.raw]).size,
    };
  };
})();
