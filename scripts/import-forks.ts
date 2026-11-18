// One-time migration: copies data, images and state from the three forks into this repository.
// Usage: node scripts/import-forks.ts
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { DATA, IMAGES, RAW_IMAGES_BASE, WORK } from "../src/config.ts";
import { readJson, sortKeys, writeJson } from "../src/fs-utils.ts";

const OWNER = process.env.FORK_OWNER || "unqxl";
const IMPORT = path.join(WORK, "import");

const clone = (name: string) => {
    const dir = path.join(IMPORT, name);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(IMPORT, { recursive: true });
    execFileSync(
        "git",
        ["clone", "--depth", "1", "--quiet", `https://github.com/${OWNER}/${name}.git`, dir],
        {
            stdio: "inherit",
        }
    );

    return dir;
};

const copyDir = (from: string, to: string) => {
    if (!fs.existsSync(from)) return;

    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.cpSync(from, to, { recursive: true });
};

const files = clone("counter-strike-file-tracker");
const tracker = clone("counter-strike-image-tracker");

fs.mkdirSync(DATA, { recursive: true });

for (const name of fs.readdirSync(path.join(files, "static"))) {
    fs.copyFileSync(path.join(files, "static", name), path.join(DATA, name));
}

for (const name of ["default_generated.json", "fileSha.json"]) {
    fs.copyFileSync(path.join(tracker, "static", name), path.join(DATA, name));
}

// Raw links that pointed at the old tracker now point at this repository.
const oldRaw =
    /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/counter-strike-image-tracker\/(?:refs\/heads\/)?main\/static\/panorama\/images\//;
const images = readJson<Record<string, string | null>>(path.join(tracker, "static", "images.json"), {});

for (const [key, url] of Object.entries(images)) {
    if (url && oldRaw.test(url)) images[key] = url.replace(oldRaw, `${RAW_IMAGES_BASE}/`);
}

writeJson(path.join(DATA, "images.json"), sortKeys(images));

copyDir(path.join(tracker, "static", "panorama", "images"), IMAGES);
copyDir(path.join(tracker, "static", "highlightreels"), path.join(IMAGES, "highlightreels"));
copyDir(path.join(tracker, "static", "pets"), path.join(IMAGES, "pets"));

console.log(`imported ${Object.keys(images).length} image entries into ${DATA}`);
