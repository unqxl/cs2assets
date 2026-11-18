import * as fs from "fs";

const isRemote = source => /^https?:\/\//.test(source);

// Accepts an http(s) URL or a local file path (used when CS2_INPUT_DIR is set).
export const getJson = async source => {
    if (!isRemote(source)) {
        return JSON.parse(fs.readFileSync(source, "utf-8"));
    }

    const res = await fetch(source);
    if (!res.ok) throw new Error(`Request failed with status ${res.status}: ${source}`);
    return res.json();
};
