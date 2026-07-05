# Privacy Policy — Suno Prompt Studio

_Last updated: 2026-07-05_

Suno Prompt Studio is a Chrome extension that helps you write Suno AI music prompts and
design multi-track sets. This policy explains exactly what it does and does not do with
your data. In short: **the extension has no servers of its own, no analytics, and no
tracking.** Everything stays in your browser except the AI requests you explicitly trigger,
which go directly to Anthropic.

## What the extension stores (locally, on your device)
- **Your Anthropic API key** — saved in your browser's local extension storage
  (`chrome.storage.local`) so you don't have to re-enter it. It is never transmitted to the
  developer or any third party other than Anthropic (see below). It is never displayed on
  screen or written to logs.
- **Prompts and sets you create or capture** — saved locally so your Library and saved sets
  persist between sessions.

All of the above lives only in your own Chrome profile on your own device. Uninstalling the
extension removes it.

## What the extension sends, and where
- **To Anthropic (`api.anthropic.com`), only when you use an AI feature** (the Vibe tab or the
  Set builder): your prompt text and your API key, so Claude can generate a response. This is a
  direct request from your browser to Anthropic. Anthropic's handling of that request is governed
  by [Anthropic's Privacy Policy](https://www.anthropic.com/legal/privacy). The developer of this
  extension never receives that data.
- **To Suno (`suno.com`), only when you click "Paste → Suno"**: the extension fills the Style and
  Lyrics fields of your open Suno tab with text you generated. It never submits anything for you
  and never reads your Suno account data.

## What the extension does NOT do
- No analytics, telemetry, or usage tracking of any kind.
- No developer-operated servers — there is no backend that could collect your data.
- No selling, sharing, or transfer of any user data to anyone.
- No collection of browsing history. The optional "Save selection as Suno prompt" feature only
  stores the specific text **you** select and right-click to save.

## Permissions, in plain language
- **storage** — save your key, prompts, and sets locally.
- **contextMenus** — add the right-click "Save selection as Suno prompt" option.
- **sidePanel** — show the tool in Chrome's side panel.
- **tabs** + **scripting** + host access to `suno.com` — find your open Suno tab and fill its
  Style/Lyrics fields when you click "Paste → Suno."
- host access to `api.anthropic.com` — send your AI requests directly to Anthropic.

## Children
The extension is not directed at children and collects no personal information.

## Changes
If this policy changes, the "Last updated" date above will change. Material changes will be noted
in the extension's Web Store listing.

## Contact
Questions: molly@diversifiedfun.com
