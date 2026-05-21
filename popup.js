const $ = (id) => document.getElementById(id);

const defaults = {
  jfy_theme: "auto",
  jfy_detect: true,
  jfy_plain: true,
  jfy_blocked: [],
};

function renderBlockedList(blocked) {
  const list = $("blocked-list");
  list.innerHTML = "";
  if (!blocked.length) return;
  blocked.forEach((host, i) => {
    const item = document.createElement("div");
    item.className = "blocked-item";
    item.innerHTML = `<span>${host}</span><button class="btn-remove" data-i="${i}">×</button>`;
    list.appendChild(item);
  });
  list.querySelectorAll(".btn-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      chrome.storage.local.get(["jfy_blocked"], (res) => {
        const updated = (res.jfy_blocked || []).filter((_, idx) => idx !== Number(btn.dataset.i));
        chrome.storage.local.set({ jfy_blocked: updated }, () => renderBlockedList(updated));
      });
    });
  });
}

function makeToggle(id, key) {
  const el = $(id);
  el.addEventListener("click", () => {
    chrome.storage.local.get([key], (res) => {
      const next = !(res[key] !== false);
      chrome.storage.local.set({ [key]: next });
      el.classList.toggle("on", next);
    });
  });
}

chrome.storage.local.get(Object.keys(defaults), (res) => {
  const theme = res.jfy_theme || defaults.jfy_theme;
  $("theme-select").value = theme;

  const detect = res.jfy_detect !== false;
  const plain = res.jfy_plain !== false;
  $("toggle-detect").classList.toggle("on", detect);
  $("toggle-plain").classList.toggle("on", plain);

  renderBlockedList(res.jfy_blocked || []);
});

$("theme-select").addEventListener("change", (e) => {
  chrome.storage.local.set({ jfy_theme: e.target.value });
});

makeToggle("toggle-detect", "jfy_detect");
makeToggle("toggle-plain", "jfy_plain");

$("btn-add-blocked").addEventListener("click", () => {
  const val = $("blocked-input").value.trim().toLowerCase();
  if (!val) return;
  chrome.storage.local.get(["jfy_blocked"], (res) => {
    const list = res.jfy_blocked || [];
    if (list.includes(val)) return;
    const updated = [...list, val];
    chrome.storage.local.set({ jfy_blocked: updated }, () => {
      renderBlockedList(updated);
      $("blocked-input").value = "";
    });
  });
});

$("blocked-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("btn-add-blocked").click();
});
