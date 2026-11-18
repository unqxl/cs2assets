import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { API_LANGUAGES, DIST, GENERATOR } from "./config.ts";
import { buildDocs } from "./docs.ts";
import { log } from "./log.ts";

const run = (script: string, languages: string) =>
    execFileSync("node", [script, "--force", "--languages", languages], { cwd: GENERATOR, stdio: "inherit" });

// Runs the vendored CSGO-API generator against data/ and assembles the GitHub Pages site (API + generated docs page) in dist/.
export const generateApi = (languages = API_LANGUAGES) => {
    fs.rmSync(path.join(GENERATOR, "public", "api"), { recursive: true, force: true });

    run("update.js", languages);
    run("group.js", languages);

    fs.rmSync(DIST, { recursive: true, force: true });
    fs.mkdirSync(DIST, { recursive: true });
    fs.cpSync(path.join(GENERATOR, "public", "api"), path.join(DIST, "api"), { recursive: true });
    buildDocs();

    log(`site assembled in ${DIST}`);
};
