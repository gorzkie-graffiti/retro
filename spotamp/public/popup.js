const KEY = "spotamp.enabled";
const SCALE_KEY = "spotamp.scale";
const MIN_SCALE_PERCENT = 50;
const MAX_SCALE_PERCENT = 200;

const checkbox = document.getElementById("enabled");
const statusText = document.getElementById("statusText");
const scaleInput = document.getElementById("scale");
const scaleValue = document.getElementById("scaleValue");

function render(enabled) {
  checkbox.checked = enabled;
  statusText.textContent = enabled
    ? "interface active · open Spotify to play"
    : "interface bypassed · Spotify unchanged";
}

function clampPercent(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 100;
  return Math.min(MAX_SCALE_PERCENT, Math.max(MIN_SCALE_PERCENT, Math.round(parsed / 5) * 5));
}

function renderScale(percent) {
  const value = clampPercent(percent);
  scaleInput.value = String(value);
  scaleValue.textContent = `${value}%`;
  scaleInput.setAttribute("aria-valuetext", `${value}%`);
  return value;
}

function storage() {
  return typeof chrome !== "undefined" && chrome.storage ? chrome.storage.sync : null;
}

const store = storage();
if (store) {
  store.get({ [KEY]: true, [SCALE_KEY]: 100 }, (values) => {
    render(values[KEY] !== false);
    renderScale(values[SCALE_KEY]);
  });
} else {
  render(true);
  renderScale(100);
}

checkbox.addEventListener("change", () => {
  const enabled = checkbox.checked;
  render(enabled);
  store?.set({ [KEY]: enabled });
});

let scaleTimer = null;

function persistScale() {
  if (scaleTimer != null) clearTimeout(scaleTimer);
  scaleTimer = null;
  const percent = renderScale(scaleInput.value);
  store?.set({ [SCALE_KEY]: percent / 100 });
}

scaleInput.addEventListener("input", () => {
  renderScale(scaleInput.value);
  if (scaleTimer != null) clearTimeout(scaleTimer);
  // Debounce so dragging the slider produces one or two sync writes instead
  // of exceeding Chrome's storage write quota.
  scaleTimer = setTimeout(persistScale, 160);
});

scaleInput.addEventListener("change", persistScale);

if (store) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes[KEY]) render(changes[KEY].newValue !== false);
    if (changes[SCALE_KEY] && document.activeElement !== scaleInput) {
      renderScale(Number(changes[SCALE_KEY].newValue) * 100);
    }
  });
}
