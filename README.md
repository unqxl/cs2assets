# cs2assets

[English](README.md) | [Русский](README.ru.md)

A single repository for Counter-Strike 2 data: game text and translations, item images and a ready-made JSON API.
It replaces three separate repositories (CSGO-API, counter-strike-file-tracker, counter-strike-image-tracker) with one fast pipeline.

## How it works

1. **check** (every 5 minutes) — anonymous Steam login, compares the depot manifest id with `data/manifestId.txt`. If nothing changed, it finishes in seconds.
2. **update** — one Steam login; only changed `pak01_NNN.vpk` archives are downloaded (compared through `data/fileSha.json`), three in parallel.
3. Text (`items_game`, `csgo_*`) is converted to `data/*.json`; images are decompiled with Source2Viewer-CLI.
4. Each new image goes through a waterfall: Steam static CDN (SHA1 + HEAD request) → a copy in `images/` (linked to this repository).
5. The generator in `generator/` builds the API and docs; the result is published to GitHub Pages (not committed to git).
6. **market** (daily, optional) — upgrades links to the Steam market CDN with targeted, budgeted requests that pause on HTTP 429.

## Steam rate limits

New images used to be looked up on the Steam market, where new items have no listings yet. The lookup could not find them, and the retries burned the rate limit.
Now an image is taken from the game files right away, and the market is only an optional upgrade: requests are limited by a budget, items that fail are retried with a growing interval (1/3/7/14/30 days), requests stop at the first 429, and the cooldown is persisted in `data/market-state.json`.

## Layout

| Path | Purpose |
| --- | --- |
| `src/` | pipeline in TypeScript (Node 24, no build step) |
| `generator/` | API generator (vendored copy of CSGO-API) |
| `data/` | extracted game JSON, `images.json`, pipeline state |
| `images/` | images missing from the CDN, pets, highlight thumbnails |
| `scripts/import-forks.ts` | one-time import from the old repositories |

## Usage

```bash
npm ci
node scripts/import-forks.ts        # once: migrate data from the forks
node src/index.ts update --force    # full run (needs STEAM_USERNAME and STEAM_PASSWORD)
node src/index.ts generate          # rebuild the API only
node src/index.ts market --budget=40
npm run typecheck
```

Repository secrets: `USERNAME`, `PASSWORD` (Steam account; exposed to the pipeline as `STEAM_USERNAME` / `STEAM_PASSWORD`). Repository variable `LANGUAGES` (default `en,ru,uk,zh-CN`, or `all`).

## Credits and licenses

This project builds on the work of others; see [NOTICE](NOTICE):

- [ByMykel](https://github.com/ByMykel) — [CSGO-API](https://github.com/ByMykel/CSGO-API), [counter-strike-file-tracker](https://github.com/ByMykel/counter-strike-file-tracker), [counter-strike-image-tracker](https://github.com/ByMykel/counter-strike-image-tracker) (MIT). `generator/` is a copy of CSGO-API.
- [csfloat/cs-files](https://github.com/csfloat/cs-files) — the approach for downloading files from Steam.
- [SteamTracking/GameTracking-CS2](https://github.com/SteamTracking/GameTracking-CS2) — reference data.
- [ValveResourceFormat](https://github.com/ValveResourceFormat/ValveResourceFormat) — Source2Viewer-CLI.
- [node-steam-user](https://github.com/DoctorMcKay/node-steam-user).

Counter-Strike 2 and its game assets are the property of Valve Corporation.
