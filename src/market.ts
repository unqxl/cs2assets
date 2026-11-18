import * as path from "node:path";

import { DATA, ECONOMY_CDN_BASE, GENERATOR } from "./config.ts";
import { readJson, sleep, sortKeys, writeJson } from "./fs-utils.ts";
import { IMAGES_FILE, isEconomyUrl, readImages } from "./images.ts";
import { log } from "./log.ts";

const STATE_FILE = path.join(DATA, "market-state.json");
const REQUEST_DELAY_MS = 1500;
const RETRY_DAYS = [1, 3, 7, 14, 30];
const MAX_COOLDOWN_MS = 6 * 60 * 60 * 1000;

interface MarketState {
    cooldownUntil: number;
    failures: number;
    items: Record<string, { tries: number; lastTry: number }>;
}

interface CatalogItem {
    market_hash_name?: string;
    phase?: string;
    original?: { image_inventory?: string };
}

const loadCatalog = () => {
    const raw = readJson<Record<string, CatalogItem> | CatalogItem[]>(
        path.join(GENERATOR, "public", "api", "en", "all.json"),
        {}
    );

    return (Array.isArray(raw) ? raw : Object.values(raw)).filter(
        item => item.original?.image_inventory && item.market_hash_name && !item.phase
    );
};

const isDue = (state: MarketState, key: string, now: number) => {
    const entry = state.items[key];
    if (!entry) return true;

    const days = RETRY_DAYS[Math.min(entry.tries - 1, RETRY_DAYS.length - 1)];
    return now - entry.lastTry >= days * 86_400_000;
};

// Optional, budgeted upgrade of image links to the economy CDN. Never sweeps the market:
// one targeted search per missing item, stops on the first 429 and remembers a cooldown.
export const resolveFromMarket = async (budget: number) => {
    const state = readJson<MarketState>(STATE_FILE, { cooldownUntil: 0, failures: 0, items: {} });
    const now = Date.now();

    if (now < state.cooldownUntil) {
        log(`market cooldown active until ${new Date(state.cooldownUntil).toISOString()}, skipping`);
        return 0;
    }

    const images = readImages();
    const catalog = loadCatalog();
    const nameToKey = new Map(catalog.map(item => [item.market_hash_name!, item.original!.image_inventory!]));
    const pending = new Map<string, string>();

    for (const item of catalog) {
        const key = item.original!.image_inventory!;
        if (!isEconomyUrl(images[key]) && isDue(state, key, now)) pending.set(key, item.market_hash_name!);
    }

    log(`market: ${pending.size} item(s) due, budget ${budget} request(s)`);

    let requests = 0;
    let resolved = 0;

    for (const [key, name] of [...pending]) {
        if (requests >= budget || !pending.has(key)) continue;

        requests++;
        const params = new URLSearchParams({
            appid: "730",
            norender: "1",
            search_descriptions: "0",
            count: "10",
            query: name,
        });
        const res = await fetch(`https://steamcommunity.com/market/search/render/?${params}`, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(20_000),
        }).catch(() => null);

        if (res?.status === 429) {
            state.failures++;
            state.cooldownUntil =
                Date.now() + Math.min(MAX_COOLDOWN_MS, 30 * 60_000 * 2 ** (state.failures - 1));
            log(`rate limited, cooling down until ${new Date(state.cooldownUntil).toISOString()}`);
            break;
        }

        const json = res?.ok ? ((await res.json().catch(() => null)) as any) : null;

        // Search results may contain other tracked items too; apply every exact match.
        for (const result of json?.results ?? []) {
            const matchKey = nameToKey.get(result.hash_name);
            const icon = result.asset_description?.icon_url;

            if (matchKey && icon && pending.has(matchKey)) {
                images[matchKey] = `${ECONOMY_CDN_BASE}/${icon}`;
                pending.delete(matchKey);
                delete state.items[matchKey];
                resolved++;
            }
        }

        if (json) state.failures = 0;

        // Items without listings (new or rare) cannot be found yet: retry later with a growing interval.
        if (pending.has(key)) {
            const tries = (state.items[key]?.tries ?? 0) + 1;
            state.items[key] = { tries, lastTry: Date.now() };
        }

        await sleep(REQUEST_DELAY_MS);
    }

    if (resolved > 0) writeJson(IMAGES_FILE, sortKeys(images));
    writeJson(STATE_FILE, state, 2);
    log(`market: ${requests} request(s), ${resolved} image(s) upgraded`);

    return resolved;
};
