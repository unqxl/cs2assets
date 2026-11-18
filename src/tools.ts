import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { TOOLS } from "./config.ts";
import { log } from "./log.ts";

const RELEASE_URL =
    "https://github.com/ValveResourceFormat/ValveResourceFormat/releases/latest/download/cli-linux-x64.zip";

// Returns the Source2Viewer-CLI binary: S2V_CLI override, a cached copy, or the latest release.
export const ensureSource2Viewer = async () => {
    if (process.env.S2V_CLI) return process.env.S2V_CLI;

    const binary = path.join(TOOLS, "Source2Viewer-CLI");
    if (fs.existsSync(binary)) return binary;

    log("downloading Source2Viewer-CLI (latest release)");
    fs.mkdirSync(TOOLS, { recursive: true });

    const res = await fetch(RELEASE_URL);
    if (!res.ok) throw new Error(`Source2Viewer-CLI download failed: ${res.status}`);

    const archive = path.join(TOOLS, "cli.zip");
    fs.writeFileSync(archive, Buffer.from(await res.arrayBuffer()));
    execFileSync("unzip", ["-o", "-q", archive, "-d", TOOLS]);
    fs.chmodSync(binary, 0o755);
    fs.rmSync(archive);

    return binary;
};
