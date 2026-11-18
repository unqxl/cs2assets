import * as fs from "node:fs";

const timings: [string, number][] = [];

export const log = (message: string) => console.log(message);

export const timed = async <T>(label: string, action: () => Promise<T>): Promise<T> => {
    const started = Date.now();
    log(`▶ ${label}`);

    try {
        return await action();
    } finally {
        const seconds = (Date.now() - started) / 1000;
        timings.push([label, seconds]);
        log(`◀ ${label} (${seconds.toFixed(1)}s)`);
    }
};

export const writeSummary = (title: string) => {
    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryFile || timings.length === 0) return;

    const rows = timings.map(([label, seconds]) => `| ${label} | ${seconds.toFixed(1)} |`);
    const total = timings.reduce((sum, [, seconds]) => sum + seconds, 0);
    const table = [
        `### ${title}`,
        "",
        "| Stage | Seconds |",
        "| --- | ---: |",
        ...rows,
        `| **Total** | **${total.toFixed(1)}** |`,
    ];

    fs.appendFileSync(summaryFile, table.join("\n") + "\n");
};
