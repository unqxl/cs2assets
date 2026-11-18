import * as fs from "node:fs";
import * as path from "node:path";
import type SteamUser from "steam-user";
import VPK from "vpk";

import { DATA, EMBEDDED_ARCHIVE, IMAGE_FOLDERS, TEMP, TEXT_FILES, pad } from "./config.ts";
import { pool } from "./fs-utils.ts";
import { log } from "./log.ts";
import { downloadFile } from "./steam.ts";
import type { State } from "./state.ts";

type Manifest = { files: { filename: string; sha_content: string }[] };

// sha_content of every pak01_NNN.vpk archive, keyed by the zero-padded index.
export const archiveShas = (manifest: Manifest) => {
    const shas: Record<string, string> = {};

    for (const file of manifest.files) {
        const match = file.filename.match(/^game\\csgo\\pak01_(\d+)\.vpk$/);
        if (match) shas[match[1]] = file.sha_content;
    }

    return shas;
};

export const downloadDirectory = async (user: SteamUser, manifest: Manifest) => {
    const file = manifest.files.find(f => f.filename.endsWith("csgo\\pak01_dir.vpk"));
    if (!file) throw new Error("pak01_dir.vpk not found in the manifest");

    fs.mkdirSync(TEMP, { recursive: true });
    await downloadFile(user, file, path.join(TEMP, "pak01_dir.vpk"));

    const dir = new VPK(path.join(TEMP, "pak01_dir.vpk"));
    dir.load();

    return dir;
};

export interface Plan {
    archives: number[];
    // Text resources whose archive is downloaded in this run.
    text: string[];
}

export const imageKeyFromVpk = (file: string) =>
    file
        .replace(/^panorama\/images\//, "")
        .replace(/_png\.vtex_c$/, "")
        .replace(/\.vsvg_c$/, "");

// Decides which archives are worth downloading: only those whose SHA changed (or all with --force).
export const planDownloads = (
    dir: VPK,
    previous: State,
    shas: Record<string, string>,
    images: Record<string, string | null>,
    force: boolean,
    skipImages: boolean
): Plan => {
    const changed = (index: number) => force || previous.fileSha[pad(index)] !== shas[pad(index)];
    const archives = new Set<number>();
    const text: string[] = [];

    for (const wanted of TEXT_FILES) {
        const name = dir.files.find(file => file.startsWith(wanted));
        if (!name) throw new Error(`could not find ${wanted} in pak01_dir.vpk`);

        const { archiveIndex } = dir.tree[name];
        const baselineMissing = !fs.existsSync(path.join(DATA, textTarget(wanted)));

        if (archiveIndex === EMBEDDED_ARCHIVE || !(changed(archiveIndex) || baselineMissing)) continue;

        archives.add(archiveIndex);
        text.push(wanted);
    }

    if (!skipImages) {
        for (const file of dir.files) {
            if (!IMAGE_FOLDERS.some(folder => file.startsWith(folder))) continue;

            const { archiveIndex } = dir.tree[file];
            if (archiveIndex === EMBEDDED_ARCHIVE) continue;

            // Archives are also fetched for images that have no link yet, so unresolved items heal on the next run.
            const unresolved = !images[imageKeyFromVpk(file)];
            if (changed(archiveIndex) || unresolved) archives.add(archiveIndex);
        }
    }

    return { archives: [...archives].sort((a, b) => a - b), text };
};

export const textTarget = (wanted: string) => path.basename(wanted).replace(/\.txt$/, ".json");

export const downloadArchives = async (user: SteamUser, manifest: Manifest, indices: number[]) => {
    let done = 0;

    await pool(indices, 3, async index => {
        const name = `pak01_${pad(index)}.vpk`;
        const file = manifest.files.find(f => f.filename.endsWith(name));
        if (!file) throw new Error(`${name} not found in the manifest`);

        await downloadFile(user, file, path.join(TEMP, name));
        log(`[${++done}/${indices.length}] ${name}`);
    });
};
