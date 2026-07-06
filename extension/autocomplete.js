// autocomplete.js — attach a fuzzy suggestion dropdown to a text field. Shared by
// the Vibe tab and the Album seed. Framework-free; the caller owns the data pool
// (via getPool) and any side effects on pick (via onChoose).
import { rankSuggestions } from "./fuzzy.js";

// input: the <textarea>/<input>. box: the dropdown container (pre-styled .suggest).
// getPool(): returns the candidate array for the current mode.
// segmentize(): when true, match only the last comma-separated segment (so
//   multi-term vibes autocomplete the word being typed) rather than the whole
//   value. onChoose(value): called with the final input value after a pick.
// Returns { update, hide } so the caller can refresh or close it (e.g. on a mode
// switch).
export function attachAutocomplete({
  input,
  box,
  getPool,
  segmentize,
  onChoose,
}) {
  let items = [];
  let active = -1;

  const seg = () => (typeof segmentize === "function" ? segmentize() : false);

  const query = () => {
    const v = input.value;
    if (!seg()) return v.trim();
    const parts = v.split(",");
    return parts[parts.length - 1].trim();
  };

  const render = () => {
    box.textContent = "";
    if (!items.length) {
      box.classList.add("hidden");
      return;
    }
    items.forEach((item, i) => {
      const row = document.createElement("div");
      row.className = "suggest-item" + (i === active ? " active" : "");
      row.setAttribute("role", "option");
      row.textContent = item;
      row.addEventListener("mousedown", (e) => {
        e.preventDefault(); // keep focus in the field
        choose(item);
      });
      box.appendChild(row);
    });
    box.classList.remove("hidden");
  };

  const update = () => {
    const q = query();
    items = q.length >= 2 ? rankSuggestions(q, getPool(), 8) : [];
    active = -1;
    render();
  };

  const hide = () => {
    items = [];
    active = -1;
    box.textContent = "";
    box.classList.add("hidden");
  };

  const choose = (item) => {
    if (!seg()) {
      input.value = item;
    } else {
      const parts = input.value.split(",");
      parts[parts.length - 1] = ` ${item}`;
      input.value = parts.join(",").replace(/^\s+/, "");
    }
    hide();
    input.focus();
    if (onChoose) onChoose(input.value);
  };

  input.addEventListener("input", update);
  input.addEventListener("keydown", (e) => {
    if (!items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      active = (active + 1) % items.length;
      render();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      active = (active - 1 + items.length) % items.length;
      render();
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === "Escape") {
      hide();
    }
  });
  input.addEventListener("blur", () => setTimeout(hide, 150));

  return { update, hide };
}
