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

  function extractRawText() {
    // GitHub raw and similar sites wrap content in a <pre> tag
    const pre = document.querySelector("pre");
    if (pre) return pre.innerText || pre.textContent || "";
    return document.body
      ? document.body.innerText || document.body.textContent || ""
      : "";
  }

  function shouldActivate() {
    if (isBlockedHost()) return false;

    const ct = getContentType();

    // Explicit JSON content type — always activate
    if (isJSONContentType(ct)) return true;

    // text/plain, octet-stream, or no content type — sniff the text
    if (
      ct === "text/plain" ||
      ct === "application/octet-stream" ||
      ct === ""
    ) {
      const raw = extractRawText();
      if (looksLikeJSON(raw)) return true;
    }

    // text/html pages that contain ONLY a <pre> with JSON inside
    // e.g. GitHub raw URLs, some API explorers
    if (ct === "text/html") {
      const body = document.body;
      if (!body) return false;

      // Must have very little content outside the pre tag
      const pre = document.querySelector("pre");
      if (!pre) return false;

      // Check the pre content looks like JSON
      const preText = pre.innerText || pre.textContent || "";
      if (!looksLikeJSON(preText)) return false;

      // Make sure the page isn't a real webpage — body should be
      // essentially just the pre tag with minimal other content
      const bodyText = body.innerText || body.textContent || "";
      const preRatio = preText.length / bodyText.length;
      if (preRatio > 0.85) return true;
    }

    return false;
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
