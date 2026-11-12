# PHOTO BEAUTY STUDIO PRO V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement inline, with one fresh whole-branch review. Preserve the user's instruction to continue implementation without a design approval pause; only replacing the stable application needs later approval.

**Goal:** Deliver the requested Figma-led mobile redesign, correct native presentation/state defects, complete manual editing gaps and verify a real preview with Playwright and Chrome DevTools Protocol.

**Architecture:** Keep miniPaint, its native layers/action history and PBS v1. Build on PremiumFacade/PremiumUI. Introduce focused helpers for presentation state, pure pixel operations/worker dispatch, font readiness and optional durable checkpoints; none becomes a second editing engine or undo stack.

**Tech Stack:** Existing JavaScript modules + Webpack 5, Canvas 2D, glfx/ImageFilters, IndexedDB, Figma Plugin API. Existing Playwright 1.62.1 and Chromium for QA; no React/Vue/Fabric/Vite migration. No runtime library is added merely for styling.

**Spec:** `docs/superpowers/specs/2026-11-12-pro-v2-request.md`

## Global Constraints

- Work only in `/workspace/sites/photo-beauty-mobile-preview`, new branch `preview/pro-v2-completion` from `d01e6d0`; preserve all stable production files and history.
- Only publish existing preview Site `appgprj_6af4bf0fd63081919725ed5e77578ef4`, never the stable Site before approval. No force push.
- No AI, paid image API, video or proprietary assets. All manual tools must alter real persisted recipes/native layers.
- Figma palette: Pearl #F9F6F7, Mist #EAD9E4, Rose #DF75A3, Berry #AF5B86, Charcoal #242229. Dark image area; short single-line dock labels; draggable compact sheets.
- Keep existing preset IDs, pixel equations at neutral values, source Blobs, native history and PBS v1 compatibility. New metadata is optional and validated before import.
- Browser evidence must name Chromium emulation at 440 × 956; never call it real Safari/iPhone evidence.

## Review Focus

- A slow open/import/font/worker job finishes after switching documents: must not overwrite the new document.
- High-resolution/DPR 3 images and viewport/sheet changes: canonical zoom and touch/world mapping must agree without allocating original-resolution screen canvases.
- Quota/failure during checkpoint writes: current project must remain saved and usable; no orphan sources or damaged old PBS files.
- Makeup/warp/clip/typography/collage combinations: export matches preview, source remains immutable and native undo is reliable.
- Missing/offline fonts/worker support and quick tool changes: real fallback or explicit error; no empty thumbnail src, silent missing text, or stale loading status.

---

### Task 1: Audit and actual baseline

**Files:** `docs/pro-v2/audit.md`, `docs/pro-v2/source-refresh.json`, `scripts/qa/` and ignored `work/pro-v2/` evidence.
**Interfaces:** Existing production build, `window.Studio`, Figma file `mcOqBkZMYZF8d7eqW7mTk5` and session `85bbb5a6-a2d0-4146-8702-397a9279f608`.

- [x] Read current boot/native GUI and 9 pinned source checkouts; query GitHub current metadata/heads, README/package/license and relevant execution paths. Preserve reference repositories read-only.
- [x] Record actual tools called: Figma, Context7, GitHub; plugin search found no Playwright/DevTools MCP; use installed Playwright/Chromium and CDP as explicitly requested fallback.
- [x] Run `npm test` baseline, Playwright 440×956 screenshots of home/editor/filter/beauty/text/sticker/reshape/makeup, console/network/heap/DOM counters.
- [x] Create audit assertions for loader, empty thumbnails, absence of desktop menu DOM, coherent zoom and fit. Run them against baseline; record genuine failures and non-reproduced reports.
- [x] Commit audit/spec/plan and QA harness.

### Task 2: Figma foundations and screen standard

**Files:** `docs/pro-v2/figma-reference.json`, `src/css/pro-tokens.css`, Figma state ledger in ignored work directory and `/tmp/design-system-state-pro-v2.json`.
**Interfaces:** Palette above; existing Manrope/Lora/Playfair/Dancing Script and original SVG icons/assets.

- [x] Inspect fonts, libraries, Code Connect and candidate component APIs. Build original product components where existing library tokens/API or licensing do not fit; do not use Apple assets.
- [x] Create primitive/semantic color, space/radius/type variables with explicit scopes and WEB syntax; create text styles.
- [x] Create reusable button, icon button, dock item, tool item, slider, chip, thumbnail, sheet/header, layer row and text style components with states and token bindings.
- [ ] Eight editable screens created and IDs saved; licensed media placement/visual inspection blocked by proxy403/quota.
- [ ] Figma high-fidelity context/visual match: blocked by Starter MCP quota; exact authored tokens/IDs committed.

### Task 3: Native presentation, document state and retina viewport

**Files:** `src/js/studio/native-mobile.mjs`, `document-session.mjs`, existing main/GUI adapters, MobileViewport/viewport/UI/index, index.html; `tests/app.test.mjs`, mobile layout and browser assertions.
**Interfaces:** `installNativeMobile(gui, app)` keeps native tools/renderers; `DocumentSession` emits opening/ready/error with document epoch; MobileViewport remains sole logical zoom authority.

- [x] Write failing tests for no desktop menu/attribute DOM, a completed load having no loading message, cancellation/stale load, canonical zoom and DPR 3 mapping/backing store.
- [x] Preserve required constructor/tool initialization, then unmount legacy presentation and suppress only presentation callbacks; keep native actions and canvas handlers.
- [x] Unify loading/status/caption/disabled states; use safe thumbnail placeholders and cancellation tokens, never empty src.
- [x] Add bounded DPR backing canvas without changing logical image transforms or export resolution. Keep pinch/pan/fit anchored after sheet and orientation changes.
- [x] Run native regressions plus Playwright state/touch/fit/sheet tests and capture this phase after screenshots. Commit.

### Task 4: Manual color, retouch and filter gaps

**Files:** Focused pixel helper(s), raster/math/schema, catalog/UI; pure pixel and native round-trip tests.
**Interfaces:** Optional `studio.hsl` (8 color bands), `adjustments.blur`, brush types `heal`/`tone`; default zeros retain old outputs.

- [x] RED tests for neutral HSL identity/alpha, selective hue/saturation/lightness, blur, destination-matched heal detail and local skin tone; save/import validation.
- [x] Reuse existing ImageFilters/brush masks; implement only missing HSL/healing math. Keep manual source choice for heal/clone, no detection.
- [x] Extend original preset recipes with Vintage/Korean/Chinese/Japanese/Y2K groups while retaining all old IDs. Generate real current-image thumbnails and save actual recipes.
- [x] Add explicit manually placed face/eye/nose/lip/chin and waist/leg/shoulder/height presets using existing inverse warp/body handles; no automatic landmarks.
- [x] Test pixels/native undo/source immutability plus touch sliders and brush gestures in Chromium; commit.

### Task 5: Makeup, typography and composition

**Files:** premium facade/UI/schema/typography, font registry/assets/manifests, original sticker generator and composition helpers; pixel/native/browser tests.
**Interfaces:** Optional makeup role `brows`; typography `glow`, `depth`, `bubble`; font readiness before preview/export; existing native layers/actions only.

- [x] RED tests for brows and linked layers; glow/depth/bubble visible output, zero identity, Vietnamese/CJK glyphs and round-trip safety.
- [x] Add original/OFL fonts for VI/CN/KR/JP with honest download/cache behavior; reuse originals and verify actual font readiness/coverage.
- [x] Add real text styles, curved text, gradient/stroke/shadow/glow/extrusion/bubble controls and text editing from canvas selection.
- [x] Expand original themed stickers and add long-photo/magazine/poster layouts using native image/text/frame layers. Guard destructive composition changes and preserve linked makeup.
- [x] Test every added control through persisted changes, undo/export and browser downloads; commit.

### Task 6: Worker pipeline and durable project checkpoints

**Files:** `pixel-pipeline.mjs`, `pixel-worker.mjs`, worker client, raster integration, `history-repository.mjs`, facade/UI/schema; build scripts and native/browser tests.
**Interfaces:** `processPixels({pixels,width,height,studio,scale})` shared by worker and fallback; checkpoints store recipes + content-addressed immutable source Blobs, not full RGBA copies or serialized native command objects.

- [x] RED exact pixel tests for shared pipeline vs current math, worker/fallback parity, cancellation/stale epochs and failed-worker fallback.
- [x] Move heavy pixel grade/warp work off the UI thread with transferables and a bounded queue. Keep GPU/CPU fallbacks and release scratch canvases. Validate public worker URLs in built/deployed app.
- [x] RED tests for durable checkpoint reopen/restore, asset dedup/pruning, quota failure and old project compatibility. Store separately from PBS v1/current project DB.
- [x] Offer current-session native timeline and saved project checkpoints with distinct labels. Preserve current project even if optional checkpoint save fails.
- [x] Benchmark real photo editing, high-resolution opening/export, responsiveness and memory with CDP; compare same fixture before/after; commit.

### Task 7: Real mobile regression, review and preview publication

**Files:** `scripts/qa/mobile.mjs`, browser fixtures/evidence report pages, `docs/pro-v2/results.md`, hosting build.

- [x] Run full node and Playwright regression: open/fit, dock scroll, sheet detents, pinch/pan, filter/undo/redo/hold compare, VI/CJK text, makeup/Liquify, sticker/collage, save/reopen/download JPG/PNG, offline and viewport rotation.
- [x] Capture before/after for each implementation phase; inspect visual results, console, failed network, long tasks, heap and DOM counters. Repair actual failures and rerun affected checks.
- [x] Fresh whole-branch read-only review; fix critical/important findings with reproducing tests; record remaining physical Safari/device limits honestly.
- [ ] Final commit, source push without force and exact-archive deployment to existing preview only (build/hash/hosting/diff checks passed).
- [x] Return live preview + Figma links, actual plugin/CLI usage, 9-source comparison, feature/test matrix, before/after gallery and unresolved limitations. Do not replace stable app before approval.

## Outcome / explicit partial items

Task2 is partial: Figma native foundations/components/eight editable screens exist, but public media upload was blocked by network403 and design_context hit Starter quota. Automatic review denied full live-page capture; no retry/bypass. Media/visual verification remains pending, and implementation used original token geometry and licensed local assets. Task3 ruling: post-init unmount replaces skipping constructor DOM, because native core constructors require temporary IDs. Task7 physical Safari/safe-area/keyboard/HEIC/P3/device memory remains unverified; preview only.
