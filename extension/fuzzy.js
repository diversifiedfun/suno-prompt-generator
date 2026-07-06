// fuzzy.js — tiny, dependency-free fuzzy matcher for the autocomplete dropdown.
// Pure functions, no DOM, so it's unit-tested directly. Ranking, high → low:
// exact > prefix > substring > subsequence (handles dropped letters like
// "daft pnk"→"Daft Punk") > small edit distance (handles simple typos).

// Lowercase and strip everything but letters/digits so spacing/punctuation and
// case never block a match ("Beyoncé" ~ "beyonce", "daft pnk" ~ "daftpnk").
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");
}

export function isSubsequence(q, c) {
  let i = 0;
  for (let j = 0; j < c.length && i < q.length; j++) if (c[j] === q[i]) i++;
  return i === q.length;
}

// Levenshtein edit distance (rolling two-row implementation).
export function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[n];
}

// Score one candidate against the query. 0 = no match.
export function scoreMatch(query, candidate) {
  const q = norm(query);
  const c = norm(candidate);
  if (!q || !c) return 0;
  if (c === q) return 100;
  if (c.startsWith(q)) return 80;
  if (c.includes(q)) return 60;
  if (isSubsequence(q, c)) return 40;
  // Typo tolerance: compare against the head of the candidate, allow ~1 error
  // per 4 chars of query. Only worth it for queries of a few chars or more.
  if (q.length >= 3) {
    const d = editDistance(q, c.slice(0, q.length + 1));
    const tol = Math.max(1, Math.floor(q.length / 4));
    if (d <= tol) return 30 - d;
  }
  return 0;
}

// Rank candidates for a query, best first. Ties break toward shorter, then
// alphabetical, so the tightest match surfaces.
export function rankSuggestions(query, candidates, limit = 8) {
  const q = String(query || "").trim();
  if (!q) return [];
  const scored = [];
  for (const cand of candidates) {
    const s = scoreMatch(q, cand);
    if (s > 0) scored.push({ cand, s });
  }
  scored.sort(
    (a, b) =>
      b.s - a.s ||
      a.cand.length - b.cand.length ||
      a.cand.localeCompare(b.cand),
  );
  return scored.slice(0, limit).map((x) => x.cand);
}
