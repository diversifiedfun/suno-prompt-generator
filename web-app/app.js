// app.js — Suno prompt generator logic. Classic script (no build, opens via file://).
// Vocabularies/presets come from data.js, loaded as a classic script before this one.

const $ = (sel) => document.querySelector(sel);
const el = (tag, attrs = {}, kids = []) => {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  });
  kids.forEach((c) => node.appendChild(c));
  return node;
};

// --- State (immutable updates: always replace, never mutate in place) ---
const STORE_KEY = "suno-generator-v1";
let state = loadState();

function loadState() {
  const base = {
    genre: "",
    era: "",
    moods: [],
    instruments: [],
    vocals: [],
    negatives: [],
    sandwich: false,
    lyrics: "",
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    return { ...base, ...saved };
  } catch {
    return base;
  }
}
function setState(patch) {
  state = { ...state, ...patch };
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  render();
}
function toggle(arr, val) {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
}

// --- Prompt assembly ---
function descriptors() {
  const parts = [];
  if (state.genre)
    parts.push(
      state.era ? `${state.era} ${state.genre.toLowerCase()}` : state.genre,
    );
  return [...parts, ...state.moods, ...state.instruments, ...state.vocals];
}

function buildStylePrompt() {
  const core = descriptors();
  const neg = state.negatives;
  let line = core.join(", ");
  // Sandwich method (Technique 2): repeat the genre at the end for weighting.
  if (state.sandwich && state.genre && core.length > 1) {
    line += `, ${state.genre.toLowerCase()}`;
  }
  if (neg.length) line += `${line ? ". " : ""}Avoid: ${neg.join(", ")}`;
  return line;
}

// Whole-phrase match so "female vocals" doesn't falsely match "male vocals".
function hasTerm(text, term) {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${esc}\\b`).test(text);
}
function findContradictions() {
  const text = [
    ...state.moods,
    ...state.instruments,
    ...state.vocals,
    state.genre.toLowerCase(),
  ]
    .join(" ")
    .toLowerCase();
  return CONTRADICTIONS.filter(
    ([a, b]) => hasTerm(text, a) && hasTerm(text, b),
  );
}

// --- Renderers ---
function chip(label, on, onClick, extraClass = "") {
  const c = el("span", {
    class: `chip ${extraClass} ${on ? "on" : ""}`,
    text: label,
  });
  c.addEventListener("click", onClick);
  return c;
}

function renderGenre() {
  const sel = $("#genreSel");
  const eraSel = $("#eraSel");
  sel.value = state.genre;
  eraSel.value = state.era;
}

function renderChipGroup(containerId, groups, selected, key, negClass = "") {
  const box = $(containerId);
  box.innerHTML = "";
  Object.entries(groups).forEach(([label, items]) => {
    box.appendChild(el("div", { class: "group-label", text: label }));
    const row = el("div", { class: "chips" });
    items.forEach((item) => {
      row.appendChild(
        chip(
          item,
          selected.includes(item),
          () => setState({ [key]: toggle(state[key], item) }),
          negClass,
        ),
      );
    });
    box.appendChild(row);
  });
}

function renderFlatChips(containerId, items, selected, key, negClass = "") {
  const box = $(containerId);
  box.innerHTML = "";
  const row = el("div", { class: "chips" });
  items.forEach((item) => {
    row.appendChild(
      chip(
        item,
        selected.includes(item),
        () => setState({ [key]: toggle(state[key], item) }),
        negClass,
      ),
    );
  });
  box.appendChild(row);
}

function countClass(n) {
  if (n < DESCRIPTOR_MIN || n > DESCRIPTOR_MAX) return "count-bad";
  return "count-ok";
}
function charClass(n) {
  if (n > STYLE_CHAR_LIMIT) return "count-bad";
  if (n > STYLE_CHAR_LIMIT * 0.85) return "count-warn";
  return "count-ok";
}

function renderOutput() {
  const prompt = buildStylePrompt();
  const box = $("#stylePreview");
  box.textContent =
    prompt || "Pick a genre + a few descriptors to build your style prompt…";
  box.classList.toggle("empty", !prompt);

  const dCount = descriptors().length;
  const chars = prompt.length;
  $("#descCount").className = countClass(dCount);
  $("#descCount").textContent = dCount;
  $("#charCount").className = charClass(chars);
  $("#charCount").textContent = chars;

  // Warnings
  const warnBox = $("#warnings");
  warnBox.innerHTML = "";
  const contradictions = findContradictions();
  if (contradictions.length) {
    contradictions.forEach(([a, b]) => {
      warnBox.appendChild(
        warn(
          "red",
          "✕",
          `Contradictory terms: "${a}" and "${b}". Suno gets confused — pick one or reframe (e.g. "dynamic contrast").`,
        ),
      );
    });
  }
  if (dCount > 0 && dCount < DESCRIPTOR_MIN) {
    warnBox.appendChild(
      warn(
        "amber",
        "!",
        `Only ${dCount} descriptor${dCount === 1 ? "" : "s"} — under the 4–7 sweet spot. Add a couple more for a less generic result.`,
      ),
    );
  }
  if (dCount > DESCRIPTOR_MAX) {
    warnBox.appendChild(
      warn(
        "amber",
        "!",
        `${dCount} descriptors — over the 4–7 sweet spot. Trim a few; too many confuses the model.`,
      ),
    );
  }
  if (chars > STYLE_CHAR_LIMIT) {
    warnBox.appendChild(
      warn(
        "red",
        "✕",
        `${chars} chars — over Suno's ~${STYLE_CHAR_LIMIT}-char style limit. Shorten it.`,
      ),
    );
  }
  if (
    dCount >= DESCRIPTOR_MIN &&
    dCount <= DESCRIPTOR_MAX &&
    chars <= STYLE_CHAR_LIMIT &&
    !contradictions.length
  ) {
    warnBox.appendChild(
      warn(
        "green",
        "✓",
        "Dialed in — 4–7 descriptors, under the char cap, no contradictions.",
      ),
    );
  }
}

function warn(kind, ic, text) {
  return el("div", { class: `warn ${kind}` }, [
    el("span", { class: "ic", text: ic }),
    el("span", { text }),
  ]);
}

function render() {
  renderGenre();
  renderChipGroup("#moodChips", MOODS, state.moods, "moods");
  renderChipGroup("#instChips", INSTRUMENTS, state.instruments, "instruments");
  renderChipGroup("#vocalChips", VOCALS, state.vocals, "vocals");
  renderFlatChips("#negChips", NEGATIVES, state.negatives, "negatives", "neg");
  $("#sandwichToggle").checked = state.sandwich;
  $("#lyrics").value = state.lyrics;
  renderOutput();
}

// --- Lyrics tag insertion (at cursor) ---
function insertAtCursor(textarea, snippet) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;
  const next = val.slice(0, start) + snippet + val.slice(end);
  setState({ lyrics: next });
  // restore cursor after re-render
  requestAnimationFrame(() => {
    const ta = $("#lyrics");
    ta.focus();
    const pos = start + snippet.length;
    ta.setSelectionRange(pos, pos);
  });
}

function renderTagButtons(containerId, tags, wrap) {
  const box = $(containerId);
  box.innerHTML = "";
  const row = el("div", { class: "chips" });
  tags.forEach((t) => {
    const c = el("span", { class: "chip tag-chip", text: `[${t}]` });
    c.addEventListener("click", () => insertAtCursor($("#lyrics"), wrap(t)));
    row.appendChild(c);
  });
  box.appendChild(row);
}

// --- Preset library ---
function renderPresetFilter() {
  const sel = $("#presetGenre");
  sel.appendChild(el("option", { value: "", text: "All families" }));
  Object.keys(PRESETS).forEach((g) =>
    sel.appendChild(el("option", { value: g, text: g })),
  );
}

function renderPresets() {
  const fam = $("#presetGenre").value;
  const q = $("#presetSearch").value.trim().toLowerCase();
  const list = $("#presetList");
  list.innerHTML = "";
  const families = fam ? [fam] : Object.keys(PRESETS);
  let shown = 0;
  families.forEach((f) => {
    PRESETS[f].forEach((preset) => {
      const hay = `${preset.p} ${preset.d}`.toLowerCase();
      if (q && !hay.includes(q)) return;
      shown += 1;
      const card = el("div", { class: "preset" }, [
        el("div", { class: "pp", text: preset.p }),
        el("div", { class: "pd", text: `→ ${preset.d}` }),
      ]);
      card.addEventListener("click", () => loadPreset(preset.p));
      list.appendChild(card);
    });
  });
  $("#presetCount").textContent = shown;
}

// Loading a preset drops its raw text straight into the preview as a starting point.
function loadPreset(text) {
  setState({
    genre: "",
    era: "",
    moods: [],
    instruments: [],
    vocals: [],
    negatives: [],
    sandwich: false,
  });
  const box = $("#stylePreview");
  box.textContent = text;
  box.classList.remove("empty");
  $("#descCount").textContent = text.split(",").length;
  $("#descCount").className = countClass(text.split(",").length);
  $("#charCount").textContent = text.length;
  $("#charCount").className = charClass(text.length);
  $("#warnings").innerHTML = "";
  $("#warnings").appendChild(
    warn(
      "green",
      "✓",
      "Preset loaded into the preview. Copy it, or tweak the chips above to make it yours.",
    ),
  );
  box.scrollIntoView({ behavior: "smooth", block: "center" });
}

// --- Surprise me (random, but respects the 4–7 sweet spot) ---
function pickN(arr, n) {
  const pool = [...arr];
  const out = [];
  for (let i = 0; i < n && pool.length; i += 1) {
    const idx = randInt(pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}
function randInt(max) {
  // Vary by time so it changes each click without Math.random reliance issues.
  return Math.floor((performance.now() * 997 + Math.random() * 1e6) % max);
}
function flatten(groups) {
  return Object.values(groups).flat();
}

function surprise() {
  const genre = pickN(GENRES, 1)[0];
  const era = randInt(2) === 0 ? "" : pickN(ERAS, 1)[0];
  setState({
    genre,
    era,
    moods: pickN(flatten(MOODS), 1 + randInt(2)),
    instruments: pickN(flatten(INSTRUMENTS), 1 + randInt(2)),
    vocals: pickN(flatten(VOCALS), 1),
    negatives: [],
    sandwich: false,
  });
}

// --- Copy ---
async function copyText(text, btn) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.textContent;
    btn.textContent = "✓ Copied";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove("copied");
    }, 1400);
  } catch {
    btn.textContent = "Copy failed — select manually";
  }
}

// --- Wire up ---
function init() {
  // Genre + era selects
  const gSel = $("#genreSel");
  gSel.appendChild(el("option", { value: "", text: "— choose genre —" }));
  GENRES.forEach((g) => gSel.appendChild(el("option", { value: g, text: g })));
  gSel.addEventListener("change", (e) => setState({ genre: e.target.value }));

  const eSel = $("#eraSel");
  eSel.appendChild(el("option", { value: "", text: "no era" }));
  ERAS.forEach((x) => eSel.appendChild(el("option", { value: x, text: x })));
  eSel.addEventListener("change", (e) => setState({ era: e.target.value }));

  $("#sandwichToggle").addEventListener("change", (e) =>
    setState({ sandwich: e.target.checked }),
  );
  $("#lyrics").addEventListener("input", (e) => {
    state = { ...state, lyrics: e.target.value };
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  });

  renderTagButtons("#structureTags", STRUCTURE_TAGS, (t) => `\n[${t}]\n`);
  renderTagButtons("#voiceTags", VOICE_TAGS, (t) => `[${t}]`);
  renderTagButtons("#dynamicsTags", DYNAMICS_TAGS, (t) => `[${t}]`);

  renderPresetFilter();
  $("#presetGenre").addEventListener("change", renderPresets);
  $("#presetSearch").addEventListener("input", renderPresets);

  $("#copyStyle").addEventListener("click", (e) =>
    copyText($("#stylePreview").textContent, e.target),
  );
  $("#copyLyrics").addEventListener("click", (e) =>
    copyText($("#lyrics").value, e.target),
  );
  $("#surprise").addEventListener("click", surprise);
  $("#clearAll").addEventListener("click", () =>
    setState({
      genre: "",
      era: "",
      moods: [],
      instruments: [],
      vocals: [],
      negatives: [],
      sandwich: false,
    }),
  );

  render();
  renderPresets();
}

init();
