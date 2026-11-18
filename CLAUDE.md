# cs2assets

Single home for Counter-Strike 2 data: extracted game text, item images and the generated item API. It replaces the
CSGO-API, counter-strike-file-tracker and counter-strike-image-tracker forks.

## Layout

- `src/` — TypeScript pipeline run with Node 24 type stripping (no build step). Commands: `check`, `update`, `market`, `generate`.
- `generator/` — vendored CSGO-API generator (ES modules, MIT, ByMykel). Reads `data/`, writes `generator/public/api`. Keep edits minimal so upstream changes stay easy to merge.
- `data/` — extracted JSON, `images.json`, state (`manifestId.txt`, `fileSha.json`, `market-state.json`). These are generator inputs and pipeline state.
- `images/` — self-hosted images (only keys without a CDN link), `pets/`, `highlightreels/`.
- `dist/` — GitHub Pages site (API + docs), never committed.

## Rules

- `README.md` is English (main); `README.ru.md` is the Russian version. Keep both in sync.
- `generator/update.js` deliberately processes languages sequentially (module-global translation state); keep that when syncing from upstream.
- Image link waterfall: static CDN (sha1 + HEAD) → self-hosted copy → market upgrade (budgeted, optional). Never sweep the Steam market; stop on the first 429 and persist the cooldown.
- Use `npm run typecheck` and `npm run format`. Do not compile or bundle anything.
- Commits: `type(scope): message`, English, no co-authorship lines.
- Steam downloads are anonymous by default (the old trackers did the same); secrets `USERNAME`, `PASSWORD` (mapped to `STEAM_USERNAME`/`STEAM_PASSWORD`) are only a fallback. Repository variable `LANGUAGES` (default `en,ru,uk,zh-CN`).
