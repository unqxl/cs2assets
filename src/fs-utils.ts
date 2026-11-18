import * as fs from "node:fs";
import * as path from "node:path";

export const readJson = <T>(file: string, fallback: T): T => {
    if (!fs.existsSync(file)) return fallback;

    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
};

export const writeJson = (file: string, data: unknown, indent = 4) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, indent));
};

export const walk = (dir: string, predicate: (file: string) => boolean): string[] => {
    if (!fs.existsSync(dir)) return [];

    const result: string[] = [];

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) result.push(...walk(full, predicate));
        else if (predicate(full)) result.push(full);
    }

    return result;
};

export const sortKeys = <T>(record: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

// Runs `task` over `items` with at most `limit` in flight.
export const pool = async <T>(items: T[], limit: number, task: (item: T) => Promise<void>) => {
    let next = 0;

    const worker = async () => {
        while (next < items.length) {
            const item = items[next++];
            await task(item);
        }
    };

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
};

export const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
