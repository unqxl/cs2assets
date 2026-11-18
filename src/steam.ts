import SteamUser from "steam-user";

import { APP_ID, BRANCH, DEPOT_ID } from "./config.ts";
import { log } from "./log.ts";
import { sleep } from "./fs-utils.ts";

export interface Credentials {
    accountName: string;
    password: string;
}

export const credentialsFromEnv = (): Credentials | null => {
    const accountName = process.env.STEAM_USERNAME;
    const password = process.env.STEAM_PASSWORD;

    return accountName && password ? { accountName, password } : null;
};

// Anonymous sessions are enough to read the manifest id; downloads need an account.
export const login = (credentials?: Credentials) =>
    new Promise<SteamUser>((resolve, reject) => {
        const user = new SteamUser();

        user.once("loggedOn", () => resolve(user));
        user.once("error", reject);

        if (credentials) {
            user.logOn({ ...credentials, rememberPassword: true, logonID: 2121 });
        } else {
            user.logOn({ anonymous: true });
        }
    });

export const getLatestManifestId = async (user: SteamUser): Promise<string> => {
    const { apps } = await user.getProductInfo([APP_ID], [], true);
    const appinfo = apps[APP_ID].appinfo as any;

    return String(appinfo.depots[DEPOT_ID].manifests[BRANCH].gid);
};

export const getManifest = async (user: SteamUser, manifestId: string) => {
    const { manifest } = await user.getManifest(APP_ID, DEPOT_ID, manifestId, BRANCH);

    return manifest as { files: { filename: string; sha_content: string }[] };
};

export const downloadFile = async (user: SteamUser, file: unknown, target: string, attempts = 3) => {
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            await user.downloadFile(APP_ID, DEPOT_ID, file as any, target);
            return;
        } catch (error) {
            if (attempt === attempts) throw error;

            const wait = 5000 * 3 ** (attempt - 1);
            log(`download failed (${attempt}/${attempts}), retrying in ${wait / 1000}s: ${error}`);
            await sleep(wait);
        }
    }
};
