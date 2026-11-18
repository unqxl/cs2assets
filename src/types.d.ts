declare module "vpk" {
    export default class VPK {
        constructor(path: string);
        files: string[];
        tree: Record<string, { archiveIndex: number }>;
        load(): void;
        getFile(path: string): Buffer;
    }
}

declare module "steam-user" {
    export default class SteamUser {
        once(event: "loggedOn", listener: () => void): this;
        once(event: "error", listener: (error: Error) => void): this;
        logOn(details: Record<string, unknown>): void;
        logOff(): void;
        getProductInfo(
            apps: number[],
            packages: number[],
            inactive?: boolean
        ): Promise<{ apps: Record<number, { appinfo: unknown }> }>;
        getManifest(
            appId: number,
            depotId: number,
            manifestId: string,
            branch: string
        ): Promise<{ manifest: unknown }>;
        downloadFile(appId: number, depotId: number, file: unknown, target: string): Promise<void>;
    }
}
