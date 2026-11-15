## Context

Four improvements to rwuChat, selected from the review follow-ups:
1. A service worker so the hashed-asset cache story works on any static host (not just Apache) and updates deploy atomically.
2. Stop re-parsing the entire markdown on every stream delta (O(n²) jank on long replies).
3. Whole-file-first editing protocol — more reliable than diffs for small files (user confirmed this approach).
4. Chats move to IndexedDB (user confirmed: **no migration** — fresh start, old localStorage chats are abandoned).

## 1. Service worker (new `js/sw.js` template + `build.js`)

- Add `js/sw.js` to the repo containing the SW logic with a `/*__ASSETS__*/` marker where the precache list goes (a placeholder array `['./']` in source).
- `build.js` already computes hashed asset names — extend it to generate `dist/sw.js` from the template with the marker replaced by the full hashed list (`./`, all `css/*.hash.css`, all `js/*.hash.js`) and `copyPlain` it (no hash on sw.js itself; SW files must not be hard-cached — add a `.htaccess` rule for `sw.js` with `no-cache`).
- SW behavior (vanilla, no libs):
  - `install`: `caches.open('rwuchat-v1')` + `cache.addAll(assetList)`; `skipWaiting()`.
  - `activate`: delete old caches, `clients.claim()`.
  - `fetch`: cache-first for hashed assets (`/\.[0-9a-f]{8}\.(js|css)$/` — they're immutable); network-first-with-cache-fallback for `index.html`/navigation requests so deploys go live immediately.
- Register in `js/init.js` at startup: only when `'serviceWorker' in navigator && location.protocol !== 'file:'`.

## 2. Incremental markdown rendering (`js/markdown.js`, `js/chat.js`)

- Add `mdStream(src, cache)` to markdown.js: splits the source at the **last closed fence** into a stable prefix and a live tail, returns the full blocks array but only runs the parser (`text()`/`fence()`) on the tail, reusing `cache.blocks` for the prefix. Fence scanning reuses the existing `/^```(.*)$/` line-matching logic from `md()`.
- Cache object lives on `ch._stream.mdCache = {blocks:[], tailStart:0}` (reset per response). In `respond()`'s stream loop ([js/chat.js:272](C:\Users\cristi\Desktop\rwuChat\js\chat.js#L272)), call `mdStream(out, ch._stream.mdCache)` instead of `md(out)`. The final render on stream completion uses the plain `md(out)` (authoritative full parse).
- `renderBlocks` already skips unchanged blocks via the `_h` comparison, so prefix blocks won't be re-painted — only the parsing cost is eliminated.

## 3. Whole-file-first editing protocol (`js/chat.js`)

- Add `editingProtocolPrompt()` in chat.js, appended to `opts.system` in `respond()` alongside the existing `mcpBuildSystemPrompt()` injection:
  > When editing a file shown earlier in chat: if the updated file is under ~200 lines, output the ENTIRE updated file in one fenced block using ```lang title="filename". Only use ```diff fences for larger files; keep hunks anchored with correct @@ line numbers.
- The renderer needs almost no change: `findOriginalFile` ([js/markdown.js:203](C:\Users\cristi\Desktop\rwuChat\js\markdown.js#L203)) already scans **all** fenced blocks including whole-file ones, so a later diff automatically diffs against the newest whole-file version. Optional small polish: give whole-file blocks that share a filename with an earlier block a subtle "Full file · v2" hint in the header — skip if it adds complexity; core value is the prompt contract.

## 4. IndexedDB persistence (new `js/idb.js`, changes to `js/state.js`, `js/init.js`)

- New `js/idb.js` (~50 lines, vanilla): opens DB `rwuchat` with one `kv` object store; exposes `idbGet(key)`, `idbSet(key, val)` returning Promises.
- `js/state.js`: remove the synchronous localStorage load of `chat.s2`/`chat.c`/`chat.cur`/`chat.mcp` (chats start as `[]` + a fresh `mk()`; defaults kept). Keep the tiny `chat.py` Pyodide flag in localStorage (sync access is convenient there).
- New `loadState()` in state.js: async — reads keys `s`, `chats`, `cur`, `mcp` from IDB, assigns into `S`, `chats`, `curId`, `MCP`; guarantees at least one chat exists.
- `save()` becomes debounced (~300 ms) fire-and-forget writing all four keys to IDB. All existing `save()` call sites stay unchanged. Errors are logged once via `console.warn` (no more silent swallow).
- `js/init.js`: `await loadState()` after `loadConfig()`, before `apply()`/`render()`.
- `index.html`: add `<script src="js/idb.js">` before state.js; bump all `?v=6` → `?v=7`.

## Files touched

- New: `js/sw.js`, `js/idb.js`
- Modified: `build.js` (SW generation + sw.js cache rule), `.htaccess` (sw.js no-cache), `index.html`, `js/init.js`, `js/state.js`, `js/markdown.js`, `js/chat.js`, `README.md` (brief notes on SW + IDB + editing protocol)

## Verification

1. `node build.js` → confirm `dist/sw.js` contains the full hashed asset list and `dist/` builds cleanly.
2. Serve `dist/` locally (`python -m http.server`), load in browser:
   - DevTools → Application → Service Workers: registered, activated; all assets served "from ServiceWorker".
   - Application → IndexedDB → `rwuchat/kv`: chats/cur/s/mcp keys present; create a chat, send a message, hard-reload → chat and settings persist; confirm old localStorage chat keys are no longer written.
3. Markdown streaming: verify long multi-fence responses render with only the last block repainting (check via the `_h` behavior — no flicker on earlier blocks), and unterminated-fence streaming fallback still works.
4. Editing protocol: with a mock backend (or by checking the request payload in DevTools network tab), confirm `system` includes the editing-protocol section; feed a whole-file fence followed by a diff against it and confirm `findOriginalFile` picks the newest version.
5. Sanity-check the SW update path: rebuild after editing a JS file → new hash → reload gets new assets (network-first index.html) and SW installs v1→v1 cache refresh.