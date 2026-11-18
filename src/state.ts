import * as fs from "node:fs";
import * as path from "node:path";

import { DATA } from "./config.ts";
import { readJson, writeJson } from "./fs-utils.ts";

const MANIFEST_FILE = path.join(DATA, "manifestId.txt");
const SHA_FILE = path.join(DATA, "fileSha.json");

export interface State {
    manifestId: string;
    fileSha: Record<string, string>;
}

export const readState = (): State => ({
    manifestId: fs.existsSync(MANIFEST_FILE) ? fs.readFileSync(MANIFEST_FILE, "utf8").trim() : "",
    fileSha: readJson<Record<string, string>>(SHA_FILE, {}),
});

export const writeState = (state: State) => {
    fs.mkdirSync(DATA, { recursive: true });
    fs.writeFileSync(MANIFEST_FILE, state.manifestId);
    writeJson(SHA_FILE, state.fileSha, 2);
};
