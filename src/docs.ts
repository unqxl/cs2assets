import * as fs from "node:fs";
import * as path from "node:path";

import { DIST, REPOSITORY } from "./config.ts";
import { log } from "./log.ts";

interface Endpoint {
    id: string;
    title: string;
    description: string;
    file: string;
    kind: "array" | "object" | "inventory";
}

const ENDPOINTS: Endpoint[] = [
    {
        id: "all",
        title: "List all",
        description: "Object with all items accessible by their id.",
        file: "all.json",
        kind: "object",
    },
    {
        id: "skins",
        title: "List skins",
        description: "Returns an array of all weapon skins grouped by pattern and wear condition.",
        file: "skins.json",
        kind: "array",
    },
    {
        id: "skins-not-grouped",
        title: "List skins not grouped",
        description: "Returns an array of all weapon skins with each wear condition as a separate item.",
        file: "skins_not_grouped.json",
        kind: "array",
    },
    {
        id: "stickers",
        title: "List stickers",
        description: "Returns an array of all available stickers.",
        file: "stickers.json",
        kind: "array",
    },
    {
        id: "sticker-slabs",
        title: "List sticker slabs",
        description: "Returns an array of sticker slabs (sealed stickers that can be opened).",
        file: "sticker_slabs.json",
        kind: "array",
    },
    {
        id: "keychain",
        title: "List keychains",
        description: "Returns an array of all weapon charms/keychains.",
        file: "keychains.json",
        kind: "array",
    },
    {
        id: "collections",
        title: "List collections",
        description: "Returns an array of all weapon skin collections.",
        file: "collections.json",
        kind: "array",
    },
    {
        id: "crates",
        title: "List crates",
        description:
            "This list includes cases, capsules, graffiti boxes, music kit boxes and souvenir packages.",
        file: "crates.json",
        kind: "array",
    },
    {
        id: "keys",
        title: "List keys",
        description: "Returns an array of all case keys.",
        file: "keys.json",
        kind: "array",
    },
    {
        id: "collectibles",
        title: "List collectibles",
        description: "Returns an array of all collectible items (coins, medals, etc.).",
        file: "collectibles.json",
        kind: "array",
    },
    {
        id: "agents",
        title: "List agents",
        description: "Returns an array of all player agents/characters.",
        file: "agents.json",
        kind: "array",
    },
    {
        id: "patches",
        title: "List patches",
        description: "Returns an array of all agent patches.",
        file: "patches.json",
        kind: "array",
    },
    {
        id: "graffiti",
        title: "List graffiti",
        description: "Returns an array of all graffiti items.",
        file: "graffiti.json",
        kind: "array",
    },
    {
        id: "music-kits",
        title: "List music kits",
        description: "Returns an array of all music kits.",
        file: "music_kits.json",
        kind: "array",
    },
    {
        id: "base-weapons",
        title: "List base weapons",
        description: "Returns an array of all base weapons and default items (gloves, knives, etc.).",
        file: "base_weapons.json",
        kind: "array",
    },
    {
        id: "highlights",
        title: "List highlights",
        description: "Returns an array of tournament highlight charms.",
        file: "highlights.json",
        kind: "array",
    },
    {
        id: "pets",
        title: "List pets",
        description: "Returns an array of pets, one entry per pet and style (breed color).",
        file: "pets.json",
        kind: "array",
    },
    {
        id: "inventory",
        title: "Inventory",
        description:
            "All items grouped by category for easy lookup. Skins use weapon_id and paint_index as keys, while other categories use def_index.",
        file: "inventory.json",
        kind: "inventory",
    },
];

const [OWNER, REPO] = REPOSITORY.split("/");
const SITE_URL = process.env.SITE_URL || `https://${OWNER}.github.io/${REPO}`;
const EXAMPLE_LINES = 60;

const esc = (value: string) =>
    value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const typeOf = (value: unknown) => (value === null ? "null" : Array.isArray(value) ? "array" : typeof value);

interface Field {
    key: string;
    types: string[];
    nullable: boolean;
    optional: boolean;
}

// Walks every item so fields that are null or missing on the first item still get the right type.
const collectFields = (items: Record<string, unknown>[]): Field[] => {
    const keys: string[] = [];
    const info = new Map<string, { types: Set<string>; nullable: boolean; count: number }>();

    for (const item of items) {
        let previous: string | null = null;

        for (const [key, value] of Object.entries(item)) {
            if (!info.has(key)) {
                keys.splice(previous === null ? 0 : keys.indexOf(previous) + 1, 0, key);
                info.set(key, { types: new Set(), nullable: false, count: 0 });
            }

            const entry = info.get(key)!;
            entry.count++;
            if (value === null) entry.nullable = true;
            else entry.types.add(typeOf(value));

            previous = key;
        }
    }

    return keys.map(key => {
        const entry = info.get(key)!;
        return {
            key,
            types: [...entry.types],
            nullable: entry.nullable,
            optional: entry.count < items.length,
        };
    });
};

const highlight = (json: string) =>
    esc(json).replace(
        /(&quot;(?:\\.|[^&\\]|&(?!quot;))*&quot;)(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g,
        (_match, string, colon, literal, number) => {
            if (string)
                return colon
                    ? `<span class="k">${string}</span>${colon}`
                    : `<span class="s">${string}</span>`;
            if (literal) return `<span class="l">${literal}</span>`;
            return `<span class="n">${number}</span>`;
        }
    );

const truncate = (text: string) => {
    const lines = text.split("\n");
    return lines.length > EXAMPLE_LINES ? [...lines.slice(0, EXAMPLE_LINES), "  …"].join("\n") : text;
};

const formatSize = (bytes: number) =>
    bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;

const section = (endpoint: Endpoint, apiDir: string) => {
    const file = path.join(apiDir, "en", endpoint.file);
    if (!fs.existsSync(file)) return "";

    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const size = formatSize(fs.statSync(file).size);
    let count: number;
    let sample: unknown;
    let fields: Field[] = [];

    if (endpoint.kind === "array") {
        count = data.length;
        sample = [data[0]];
        fields = collectFields(data);
    } else if (endpoint.kind === "object") {
        const values = Object.values(data) as Record<string, unknown>[];
        const [firstKey] = Object.keys(data);
        count = values.length;
        sample = { [firstKey]: data[firstKey] };
        fields = collectFields(values);
    } else {
        count = Object.keys(data).length;
        const [category] = Object.keys(data);
        sample = { [category]: Object.fromEntries(Object.entries(data[category]).slice(0, 1)) };
    }

    const rows = fields
        .map(({ key, types, nullable, optional }) => {
            const type = [...types, ...(nullable ? ["null"] : [])].join(" | ");
            return `<tr><td><code>${esc(key)}</code>${optional ? '<span class="tag">optional</span>' : ""}</td><td>${esc(type)}</td></tr>`;
        })
        .join("");

    const unit = endpoint.kind === "inventory" ? "categories" : "items";
    const example = highlight(truncate(JSON.stringify(sample, null, 2)));

    return `
<section class="card" id="${endpoint.id}" data-search="${esc((endpoint.title + " " + endpoint.file + " " + endpoint.description).toLowerCase())}">
    <h2>${esc(endpoint.title)} <span class="meta">${count.toLocaleString("en-US")} ${unit} · ${size}</span></h2>
    <p>${esc(endpoint.description)}</p>
    <div class="url"><span class="verb">GET</span><code data-path="${endpoint.file}"></code><button class="copy" data-copy-path="${endpoint.file}">Copy</button></div>
    ${rows ? `<h3>Fields</h3><table><thead><tr><th>Field</th><th>Type</th></tr></thead><tbody>${rows}</tbody></table>` : ""}
    <h3>Example</h3>
    <pre><code>${example}</code></pre>
</section>`;
};

const STYLE = `
:root{--bg:#fff;--panel:#f6f7f9;--text:#3b4352;--strong:#111827;--muted:#6b7280;--border:#e5e7eb;--accent:#d97706;--accent-soft:#fef3c7;--code:#f3f4f6;--k:#0b6bcb;--s:#0f7b5f;--n:#b45309;--l:#7c3aed}
:root[data-theme=dark]{--bg:#0e1116;--panel:#151a22;--text:#aeb6c4;--strong:#f3f4f6;--muted:#7b8494;--border:#232b36;--accent:#f59e0b;--accent-soft:#2a2112;--code:#1a212b;--k:#6cb6ff;--s:#56d4a8;--n:#f0b45c;--l:#b794f6}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:72px}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
code,pre{font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
header{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:12px;padding:12px 24px;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--border)}
.brand{font-weight:700;color:var(--strong);font-size:17px}.brand b{color:var(--accent)}.spacer{flex:1}
select,button,input{font:inherit;color:var(--strong);background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:6px 10px}
button{cursor:pointer}button:hover,select:hover{border-color:var(--accent)}
.layout{display:grid;grid-template-columns:260px minmax(0,1fr);max-width:1240px;margin:0 auto}
aside{position:sticky;top:57px;align-self:start;height:calc(100vh - 57px);overflow:auto;padding:20px 16px 24px 24px;border-right:1px solid var(--border)}
aside input{width:100%;margin-bottom:12px}
aside a{display:block;padding:5px 10px;border-radius:6px;color:var(--text)}aside a:hover{background:var(--panel);text-decoration:none}
aside a.active{background:var(--accent-soft);color:var(--accent);font-weight:600}
main{padding:32px 32px 80px;min-width:0}
.hero h1{margin:0 0 8px;font-size:34px;line-height:1.2;color:var(--strong)}.hero p{max-width:720px;color:var(--muted);font-size:16px}
.base{display:flex;align-items:center;gap:10px;margin:20px 0;padding:12px 14px;background:var(--panel);border:1px solid var(--border);border-radius:10px;overflow:auto}
.base span{color:var(--muted);white-space:nowrap}.base code{color:var(--strong);flex:1;white-space:nowrap}
.card{margin:28px 0;padding:24px;border:1px solid var(--border);border-radius:14px;background:var(--bg)}
.card h2{margin:0 0 6px;font-size:21px;color:var(--strong);display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.card h3{margin:22px 0 8px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.meta{font-size:12px;font-weight:500;color:var(--muted)}
.url{display:flex;align-items:center;gap:10px;margin-top:14px;padding:8px 10px;background:var(--code);border-radius:8px;overflow:auto}
.url code{flex:1;white-space:nowrap;color:var(--strong)}.verb{font-size:11px;font-weight:700;color:#fff;background:var(--accent);padding:2px 7px;border-radius:5px}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)}th{color:var(--muted);font-weight:600}
td code{background:var(--code);padding:1px 6px;border-radius:4px;color:var(--strong)}.tag{margin-left:8px;font-size:11px;color:var(--muted);border:1px solid var(--border);border-radius:10px;padding:0 6px}
pre{margin:0;padding:14px 16px;background:var(--code);border-radius:10px;overflow:auto;max-height:420px}
.k{color:var(--k)}.s{color:var(--s)}.n{color:var(--n)}.l{color:var(--l)}
.hidden{display:none}footer{padding:24px;text-align:center;color:var(--muted);border-top:1px solid var(--border);font-size:13px}
@media(max-width:860px){.layout{grid-template-columns:1fr}aside{display:none}main{padding:24px 16px 64px}header{padding:10px 16px}}`;

const SCRIPT = `
const DEFAULT_BASE = "${SITE_URL}/api/";
const local = ["localhost", "127.0.0.1"].includes(location.hostname) || location.protocol === "file:";
const base = local ? DEFAULT_BASE : new URL("api/", location.href.replace(/[^/]*$/, "")).href;
const root = document.documentElement;
const stored = localStorage.getItem("lang");
const langSelect = document.getElementById("lang");
if (stored && [...langSelect.options].some(o => o.value === stored)) langSelect.value = stored;

const urlFor = path => base + langSelect.value + "/" + path;
const render = () => {
    document.querySelectorAll("[data-path]").forEach(el => (el.textContent = urlFor(el.dataset.path)));
    document.getElementById("base-url").textContent = base + langSelect.value + "/";
    document.querySelectorAll("[data-lang]").forEach(el => (el.textContent = langSelect.value));
};
langSelect.addEventListener("change", () => { localStorage.setItem("lang", langSelect.value); render(); });
render();

const copy = async (button, text) => {
    await navigator.clipboard.writeText(text);
    const label = button.textContent;
    button.textContent = "Copied";
    setTimeout(() => (button.textContent = label), 1200);
};
document.addEventListener("click", event => {
    const button = event.target.closest("button[data-copy-path], button[data-copy-base]");
    if (!button) return;
    copy(button, button.dataset.copyPath ? urlFor(button.dataset.copyPath) : base + langSelect.value + "/");
});

const theme = localStorage.getItem("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
root.dataset.theme = theme;
document.getElementById("theme").addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("theme", root.dataset.theme);
});

const cards = [...document.querySelectorAll(".card")];
const links = [...document.querySelectorAll("aside nav a")];
document.getElementById("search").addEventListener("input", event => {
    const query = event.target.value.trim().toLowerCase();
    cards.forEach(card => card.classList.toggle("hidden", query !== "" && !card.dataset.search.includes(query)));
    links.forEach(link => link.classList.toggle("hidden", query !== "" && !document.getElementById(link.hash.slice(1)).dataset.search.includes(query)));
});
const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        links.forEach(link => link.classList.toggle("active", link.hash === "#" + entry.target.id));
    });
}, { rootMargin: "-20% 0px -70% 0px" });
cards.forEach(card => observer.observe(card));`;

// Builds the documentation site (dist/index.html) from the generated API files.
export const buildDocs = () => {
    const apiDir = path.join(DIST, "api");
    const languages = fs
        .readdirSync(apiDir)
        .filter(name => fs.statSync(path.join(apiDir, name)).isDirectory());
    const sections = ENDPOINTS.map(endpoint => section(endpoint, apiDir)).filter(Boolean);
    const nav = ENDPOINTS.filter(endpoint => fs.existsSync(path.join(apiDir, "en", endpoint.file)))
        .map(endpoint => `<a href="#${endpoint.id}">${esc(endpoint.title)}</a>`)
        .join("");
    const options = languages
        .map(language => `<option value="${esc(language)}">${esc(language)}</option>`)
        .join("");
    const description =
        "Unofficial JSON API for Counter-Strike 2: skins, cases, stickers, charms, collections, agents, graffiti, music kits and more, in several languages.";

    const html = `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>cs2assets API</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE_URL}/">
<meta property="og:type" content="website">
<meta property="og:title" content="cs2assets API">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE_URL}/">
<meta name="twitter:card" content="summary">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23d97706'/%3E%3Ctext x='16' y='22' font-size='16' font-family='sans-serif' font-weight='700' text-anchor='middle' fill='white'%3Ecs%3C/text%3E%3C/svg%3E">
<style>${STYLE}</style>
</head>
<body>
<header>
    <span class="brand">cs2<b>assets</b> API</span>
    <span class="spacer"></span>
    <select id="lang" aria-label="Language">${options}</select>
    <button id="theme" aria-label="Toggle theme">Theme</button>
    <a href="https://github.com/${REPOSITORY}">GitHub</a>
</header>
<div class="layout">
<aside>
    <input id="search" type="search" placeholder="Search endpoints…" aria-label="Search endpoints">
    <nav>${nav}</nav>
</aside>
<main>
    <div class="hero">
        <h1>Counter-Strike 2 JSON API</h1>
        <p>${esc(description)} Static files, no keys, no rate limits. Updated automatically after every game update.</p>
    </div>
    <div class="base"><span>Base URL</span><code id="base-url"></code><button data-copy-base="1">Copy</button></div>
    <section class="card">
        <h2>Quick start</h2>
        <pre><code>fetch(<span class="s">"<span data-path="skins.json"></span>"</span>)
  .then(res =&gt; res.json())
  .then(skins =&gt; console.log(skins[0]))</code></pre>
        <p>Replace <code data-lang></code> in the URL with any available language: ${languages.map(l => `<code>${esc(l)}</code>`).join(", ")}.</p>
    </section>
    ${sections.join("\n")}
</main>
</div>
<footer>Built on <a href="https://github.com/ByMykel/CSGO-API">CSGO-API</a> by ByMykel (MIT). Counter-Strike 2 is a trademark of Valve Corporation. <a href="https://github.com/${REPOSITORY}">Source</a></footer>
<script>${SCRIPT}</script>
</body>
</html>
`;

    fs.writeFileSync(path.join(DIST, "index.html"), html);
    log(`docs built: ${sections.length} endpoints, ${languages.length} languages`);
};
