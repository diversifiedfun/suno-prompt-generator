// build-preview.mjs — regenerate dev/preview.html from ../sidepanel.html so the
// dev harness never drifts from the real UI. Run from the extension/ dir:
//   node dev/build-preview.mjs
// The preview is the real body wrapped with: a dev banner, a 400px frame, the
// chrome shim (classic, loads before the module), and dev-relative asset paths.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = await readFile(join(here, "..", "sidepanel.html"), "utf8");

const bodyMatch = src.match(/<body>([\s\S]*)<\/body>/);
if (!bodyMatch) throw new Error("sidepanel.html: no <body> found");

// Strip the production module script; the dev version re-adds shim + module.
const body = bodyMatch[1]
  .replace(/\s*<script type="module" src="sidepanel\.js"><\/script>\s*/g, "\n")
  .trim();

const DEV_BANNER =
  '<div class="dev-banner">DEV PREVIEW — chrome.* shimmed, storage = localStorage. Capture (right-click) is extension-only.</div>';

const out = `<!DOCTYPE html>
<!-- DEV ONLY preview: runs the real sidepanel UI in a normal tab via the chrome shim.
     GENERATED from ../sidepanel.html by dev/build-preview.mjs — do NOT hand-edit;
     edit sidepanel.html and re-run \`node dev/build-preview.mjs\`.
     Not part of the shipped extension. Serve over http (ES modules need it):
       python3 -m http.server 8765   # from the extension/ dir
       open http://localhost:8765/dev/preview.html -->
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Suno Prompt Studio — DEV preview</title>
  <link rel="stylesheet" href="../sidepanel.css" />
  <style>
    /* Frame the panel at its real ~380px width so the dev view matches reality. */
    body { max-width: 400px; margin: 0 auto; border-left: 1px solid #262438; border-right: 1px solid #262438; min-height: 100vh; }
    .dev-banner { background: #2a1430; color: #ff8fc4; font: 11px/1.4 ui-monospace, monospace; padding: 6px 12px; text-align: center; }
  </style>
</head>
<body>
  ${DEV_BANNER}

  ${body}

  <!-- shim MUST load (classic, synchronous) before the deferred module -->
  <script src="chrome-shim.js"></script>
  <script type="module" src="../sidepanel.js"></script>
</body>
</html>
`;

await writeFile(join(here, "preview.html"), out, "utf8");
console.log("preview.html regenerated from sidepanel.html");
