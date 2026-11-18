import * as fs from "node:fs";
import * as path from "node:path";
import vdf from "@node-steam/vdf";
import type VPK from "vpk";

import { DATA } from "./config.ts";
import { log } from "./log.ts";
import { textTarget } from "./vpk.ts";

const trimBom = (buffer: Buffer) =>
    buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf
        ? buffer.subarray(3)
        : buffer;

// Converts the downloaded VDF text resources (items_game, translations) to JSON in data/.
export const extractText = (dir: VPK, wantedFiles: string[]) => {
    fs.mkdirSync(DATA, { recursive: true });

    for (const wanted of wantedFiles) {
        const name = dir.files.find(file => file.startsWith(wanted))!;
        const text = trimBom(dir.getFile(name)).toString("utf8");
        const parsed = vdf.parse(text);

        fs.writeFileSync(path.join(DATA, textTarget(wanted)), JSON.stringify(parsed, null, 4));
    }

    log(`extracted ${wantedFiles.length} text resources`);
};
