import * as fs from "node:fs";

import { DATA, parseOptions } from "./config.ts";
import { generateApi } from "./generate.ts";
import { decompileImages, listDefaultGenerated, readImages, registerImages } from "./images.ts";
import { log, timed, writeSummary } from "./log.ts";
import { resolveFromMarket } from "./market.ts";
import { credentialsFromEnv, getLatestManifestId, getManifest, login } from "./steam.ts";
import { readState, writeState, type State } from "./state.ts";
import { extractText } from "./text.ts";
import { archiveShas, downloadArchives, downloadDirectory, planDownloads } from "./vpk.ts";

const [command = "update", ...flags] = process.argv.slice(2);
const options = parseOptions(flags);

const setOutput = (name: string, value: string) => {
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
};

// Cheap check: anonymous session, compares the depot manifest id with data/manifestId.txt.
const check = async () => {
    const user = await login();
    const latest = await getLatestManifestId(user);
    const changed = options.force || latest !== readState().manifestId;

    log(`manifest ${latest} — ${changed ? "changed" : "up to date"}`);
    setOutput("changed", String(changed));
    setOutput("manifest", latest);
    user.logOff();
};

// Downloads the changed archives. Anonymous sessions can read the public CS2 depot, so no account is required.
const download = async (user: Awaited<ReturnType<typeof login>>, manifestId: string, previous: State) => {
    const manifest = await getManifest(user, manifestId);
    const shas = archiveShas(manifest);
    const dir = await timed("download pak01_dir.vpk", () => downloadDirectory(user, manifest));
    const plan = planDownloads(dir, previous, shas, readImages(), options.force, options.skipImages);

    log(`archives to download: ${plan.archives.length} (${plan.archives.join(", ")})`);
    await timed("download archives", () => downloadArchives(user, manifest, plan.archives));

    return { dir, plan, shas };
};

const update = async () => {
    const previous = readState();
    let user = await timed("steam login (anonymous)", () => login());
    const manifestId = await getLatestManifestId(user);

    if (manifestId === previous.manifestId && !options.force) {
        log("manifest unchanged, nothing to do");
        setOutput("changed", "false");
        user.logOff();
        return;
    }

    let result;

    try {
        result = await download(user, manifestId, previous);
    } catch (error) {
        const credentials = credentialsFromEnv();
        if (!credentials) throw error;

        log(`anonymous download failed (${error}), retrying with the Steam account`);
        user.logOff();
        user = await timed("steam login (account)", () => login(credentials));
        result = await download(user, manifestId, previous);
    }

    user.logOff();

    const { dir, plan, shas } = result;

    await timed("extract text", async () => extractText(dir, plan.text));

    if (!options.skipImages) {
        await timed("decompile images", decompileImages);
        await timed("register images", registerImages);
        listDefaultGenerated();
    }

    writeState({ manifestId, fileSha: { ...previous.fileSha, ...shas } });

    await timed("generate API", async () => generateApi());
    setOutput("changed", "true");
    setOutput("manifest", manifestId);
};

const market = async () => {
    await timed("generate API (catalog)", async () => generateApi());

    const upgraded = await timed("market lookups", () => resolveFromMarket(options.budget));

    if (upgraded > 0) await timed("generate API", async () => generateApi());

    setOutput("changed", String(upgraded > 0));
};

const commands: Record<string, () => Promise<void>> = {
    check,
    update,
    market,
    generate: async () => generateApi(),
};

if (!commands[command]) {
    console.error(`Unknown command "${command}". Use: ${Object.keys(commands).join(" | ")}`);
    process.exit(1);
}

try {
    await commands[command]();
    writeSummary(`cs2assets ${command}`);
    process.exit(0);
} catch (error) {
    console.error(error);
    process.exit(1);
}
