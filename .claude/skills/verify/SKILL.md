---
name: verify
description: Drive the running app (mocked Firebase) with Playwright to verify UI changes end-to-end
---

# Verifying UI changes in this repo

The app runs fully mocked (no Firebase credentials) in screenshot mode; DB
writes no-op and resolve, so full flows (form submits, navigation) work.

## Recipe

1. Start the dev server in the background:
   `NUXT_PUBLIC_SCREENSHOT_MODE=true yarn dev` (port 3005, ~30 s to warm).
2. Write a Playwright script. Gotchas:
   - Yarn PnP: the script **must live inside the repo** (e.g.
     `scripts/_tmp.mjs`, delete after) and run via `yarn node <script>`.
   - Launch with
     `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`
     — the pinned Playwright wants a browser build that isn't installed.
   - Inject fixture data before page scripts run:
     `ctx.addInitScript((d) => { window.__SCREENSHOT_FIXTURE = d }, fixture)`
     with `scripts/fixtures/default.json` (fake user `screenshot-uid-1`).
   - Dismiss the cookie banner before clicking anything near the page
     bottom: `.cookie-consent` → button "Reject" (it intercepts clicks).
   - Wait for mount with a selector wait; mock DB reads resolve ~50 ms after
     mount.
3. Assert via `inputValue()`, URL after navigation (`waitForURL`), element
   counts, and collect `pageerror` events — the mock never rejects, so an
   exception in a save handler is the main failure signal.

For static rendering checks, `yarn screenshot /<route> --mobile` is enough
(see CLAUDE.md → Screenshots).
