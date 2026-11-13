# BaoHim Photo V5.0.0 · Release & Cache Policy

**Production:** `https://kanz510.github.io/BaoHim-Photo/` boots V5 directly on `main`.
**Fallback:** append `?ui=v4` only when troubleshooting the old V4 presentation. This does **not** switch repositories or restore earlier data. All future changes go to `main`, with normal commits and no force-push.

## App version

- `package.json` is the human-facing semver source: **5.0.0**.
- `scripts/build.mjs` injects version and build ID into the HTML and writes `dist/version.json` containing `version`, `build`, and the fingerprinted bundle filename.
- The V5 header displays the semver, while the bundle filename and SW cache revision are content-addressed.
- Bump the minor/patch version in both `package.json` and `package-lock.json` for future user-facing releases. Every deploy gets a new build ID from `GITHUB_SHA` in Actions.

## Cache/update behavior

- Page navigations: **network first**, `cache: 'no-store'`; fall back to the cached app shell when offline.
- Fingerprinted JS and other immutable assets: **cache first** for offline reliability. The bundled JS file changes with its content hash.
- `version.json`: **network first** even when the old SW still controls the app. This is the release-check endpoint.
- Service worker: pre-cache a new `pbs-<revision>` cache during install, but do **not** call `skipWaiting()` during installation. An editing session keeps using the old worker until the user explicitly accepts the update.
- The browser checks for updates on load, on focus/visibility return, upon returning online, and at 10-minute intervals. If a new build exists, a small **Cập nhật / Để sau** bar appears.
- Pressing **Cập nhật** commits pending tool changes and awaits project save before switching SW and reloading with `?rev=<build>` cache-busting query.
- Never clear IndexedDB, user projects, save keys, user-uploaded images, or browser storage as part of release activation.

## Release checks

1. `npm ci --ignore-scripts`
2. `npm run build`
3. `npm run check`
4. `npm test`
5. `npm --prefix scripts/qa ci && npx --prefix scripts/qa playwright install --with-deps webkit && npm run test:webkit`
6. Confirm GitHub Actions Pages deployment **success** on `main`.
7. Visit the root URL (no `?ui=v5`) in Safari; ensure Home shows V5 and its version label. Check `version.json` corresponds to the latest build.

**Offline caveat:** a browser cannot detect a newer release while disconnected. Update will be offered when the connection is back. Browser/PWA reload happens only after a successful save, so working sessions are not interrupted by a release.
