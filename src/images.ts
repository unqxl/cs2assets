import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { DATA, EXTRACT, IMAGES, RAW_IMAGES_BASE, STATIC_CDN_BASE, TEMP } from "./config.ts";
import { pool, readJson, sortKeys, walk, writeJson } from "./fs-utils.ts";
import { log } from "./log.ts";
import { ensureSource2Viewer } from "./tools.ts";

export type ImageMap = Record<string, string | null>;

export const IMAGES_FILE = path.join(DATA, "images.json");
const ECON_DIR = path.join(EXTRACT, "panorama", "images", "econ");
const IMAGES_ROOT = path.join(EXTRACT, "panorama", "images");

export const readImages = () => readJson<ImageMap>(IMAGES_FILE, {});

export const isCdnUrl = (url: string | null | undefined): url is string =>
    !!url && !url.includes("raw.githubusercontent.com");

export const isEconomyUrl = (url: string | null | undefined) => !!url && url.includes("/economy/image/");

// Decompiles the downloaded econ textures/SVGs with Source2Viewer-CLI.
export const decompileImages = async () => {
    const cli = await ensureSource2Viewer();
    fs.rmSync(EXTRACT, { recursive: true, force: true });
    fs.mkdirSync(EXTRACT, { recursive: true });

    try {
        // Archives that were not downloaded are skipped by the tool, so a non-zero exit is expected.
        execFileSync(
            cli,
            [
                "-i",
                path.join(TEMP, "pak01_dir.vpk"),
                "-o",
                EXTRACT,
                "-e",
                "vtex_c,vsvg_c",
                "-d",
                "-f",
                "panorama/images/econ",
            ],
            {
                stdio: ["ignore", "ignore", "ignore"],
            }
        );
    } catch {
        log("Source2Viewer-CLI finished with warnings");
    }

    fs.rmSync(path.join(process.cwd(), "exceptions.txt"), { force: true });
};

const keyOf = (file: string) => {
    const relative = path.relative(IMAGES_ROOT, file).replaceAll(path.sep, "/");

    return relative.replace(/_png\.png$/, "").replace(/\.svg$/, "");
};

const checkExists = async (url: string) => {
    try {
        const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
        return res.status === 200;
    } catch {
        return false;
    }
};

const selfHost = (key: string, file: string) => {
    const target = path.join(IMAGES, file.endsWith(".svg") ? `${key}.svg` : `${key}_png.png`);

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(file, target);

    return `${RAW_IMAGES_BASE}/${path.relative(IMAGES, target).replaceAll(path.sep, "/")}`;
};

const dropSelfHosted = (key: string) => {
    fs.rmSync(path.join(IMAGES, `${key}_png.png`), { force: true });
};

// Registers extracted images. Waterfall per image without a CDN link: static CDN (sha1 + HEAD) → self-hosted copy.
export const registerImages = async () => {
    const images = readImages();
    const files = walk(ECON_DIR, file => file.endsWith("_png.png") || file.endsWith(".svg"));
    const pending = files
        .map(file => ({ file, key: keyOf(file) }))
        .filter(({ key }) => !isCdnUrl(images[key]));
    const stats = { staticCdn: 0, selfHosted: 0 };

    await pool(pending, 8, async ({ file, key }) => {
        if (file.endsWith("_png.png")) {
            const sha1 = createHash("sha1").update(fs.readFileSync(file)).digest("hex");
            const url = `${STATIC_CDN_BASE}/${key}.${sha1}.png`;

            if (await checkExists(url)) {
                images[key] = url;
                dropSelfHosted(key);
                stats.staticCdn++;
                return;
            }
        }

        images[key] = selfHost(key, file);
        stats.selfHosted++;
    });

    writeJson(IMAGES_FILE, sortKeys(images));
    log(
        `images: ${files.length} extracted, ${stats.staticCdn} → static CDN, ${stats.selfHosted} self-hosted`
    );

    const unresolved = Object.entries(images)
        .filter(([, url]) => !url)
        .map(([key]) => key);
    if (unresolved.length > 0)
        log(`unresolved images (${unresolved.length}): ${unresolved.slice(0, 20).join(", ")}`);
};

// Keeps the list of generated weapon icons used by the API generator (merged, sorted, deduplicated).
export const listDefaultGenerated = () => {
    const file = path.join(DATA, "default_generated.json");
    const existing = readJson<string[]>(file, []);
    const dir = path.join(ECON_DIR, "default_generated");
    const added = fs.existsSync(dir) ? fs.readdirSync(dir) : [];

    writeJson(file, [...new Set([...existing, ...added])].sort(), 2);
};
