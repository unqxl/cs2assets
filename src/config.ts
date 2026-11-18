import * as path from "node:path";

export const APP_ID = 730;
export const DEPOT_ID = 2347770;
export const BRANCH = "public";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const DATA = path.join(ROOT, "data");
export const IMAGES = path.join(ROOT, "images");
export const GENERATOR = path.join(ROOT, "generator");
export const DIST = path.join(ROOT, "dist");
export const WORK = path.join(ROOT, "work");
export const TEMP = path.join(WORK, "temp");
export const EXTRACT = path.join(WORK, "extract");
export const TOOLS = path.join(WORK, "tools");

export const REPOSITORY = process.env.GITHUB_REPOSITORY || "unqxl/cs2assets";
export const RAW_IMAGES_BASE = `https://raw.githubusercontent.com/${REPOSITORY}/main/images`;
export const STATIC_CDN_BASE = "https://cdn.steamstatic.com/apps/730/icons";
export const ECONOMY_CDN_BASE = "https://community.akamai.steamstatic.com/economy/image";

// Languages published in the API (same set as the previous CSGO-API deployment); "all" is supported too.
export const API_LANGUAGES = process.env.LANGUAGES || "en,ru,uk,zh-CN";

// Archive index used by files stored inside pak01_dir.vpk itself.
export const EMBEDDED_ARCHIVE = 0x7fff;

// Text resources extracted from pak01_dir.vpk (same list as counter-strike-file-tracker).
export const TEXT_FILES = [
    "brazilian",
    "bulgarian",
    "czech",
    "danish",
    "dutch",
    "english",
    "finnish",
    "french",
    "german",
    "greek",
    "hungarian",
    "italian",
    "japanese",
    "koreana",
    "latam",
    "norwegian",
    "polish",
    "portuguese",
    "romanian",
    "russian",
    "schinese",
    "schinese_pw",
    "spanish",
    "swedish",
    "tchinese",
    "thai",
    "turkish",
    "ukrainian",
    "vietnamese",
]
    .map(language => `resource/csgo_${language}.txt`)
    .concat("scripts/items/items_game.txt");

// Image folders extracted from pak01_dir.vpk (same list as counter-strike-image-tracker).
export const IMAGE_FOLDERS = [
    "characters",
    "default_generated",
    "music_kits",
    "patches",
    "pets",
    "season_icons",
    "set_icons",
    "status_icons",
    "stickers",
    "tools",
    "weapons",
    "weapon_cases",
    "tournaments",
    "premier_seasons",
].map(folder => `panorama/images/econ/${folder}`);

export interface Options {
    force: boolean; // ignore "manifest unchanged"
    full: boolean; // download every archive instead of only changed/unresolved ones
    skipImages: boolean;
    budget: number;
}

export const parseOptions = (argv: string[]): Options => {
    const budgetArg = argv.find(arg => arg.startsWith("--budget="));

    return {
        force: argv.includes("--force") || argv.includes("--full"),
        full: argv.includes("--full"),
        skipImages: argv.includes("--skip-images"),
        budget: budgetArg ? Number(budgetArg.split("=")[1]) : 40,
    };
};

export const pad = (index: number | string) => String(index).padStart(3, "0");
