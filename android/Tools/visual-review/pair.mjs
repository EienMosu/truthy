#!/usr/bin/env node
// Pairs each Android capture with the web capture of the same screen and theme (spec 7.4): checks the element
// frames and the colours, writes a side-by-side image per pair and a report. Run after capture-android.sh and web-capture.mjs.
//   node android/Tools/visual-review/pair.mjs           writes out/pairs/*.png, out/report.md and out/report.json
//   node android/Tools/visual-review/pair.mjs --check   also exits 1 while a finding is not approved in approvals.json
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { colourFindings, expectedColour, frameFindings, samplePoint, unapproved, withApprovals } from "./compare.mjs";
import { SCREENS, THEMES } from "./screens.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "out");
const tokens = JSON.parse(readFileSync(join(here, "..", "..", "..", "native-data", "tokens", "resolved.json"), "utf8"));
const approvals = JSON.parse(readFileSync(join(here, "approvals.json"), "utf8"));
const check = process.argv.includes("--check");
const WIDTH = 412;

function readCapture(folder, name) {
  const json = join(out, folder, `${name}.json`);
  const png = join(out, folder, `${name}.png`);
  return existsSync(json) && existsSync(png) ? { ...JSON.parse(readFileSync(json, "utf8")), png } : null;
}

const dataUrl = (png) => `data:image/png;base64,${readFileSync(png).toString("base64")}`;
const escapeHtml = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The colours of a capture at points in dp, read without colour conversion; null where a point is null. */
async function pixels(page, capture, points) {
  return page.evaluate(
    async ({ url, widthDp, points }) => {
      const blob = await (await fetch(url)).blob();
      const bitmap = await createImageBitmap(blob, { colorSpaceConversion: "none" });
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d");
      context.drawImage(bitmap, 0, 0);
      const scale = bitmap.width / widthDp;
      return points.map((point) => {
        if (point === null) return null;
        const x = Math.min(bitmap.width - 1, Math.max(0, Math.round(point.x * scale)));
        const y = Math.min(bitmap.height - 1, Math.max(0, Math.round(point.y * scale)));
        const [r, g, b] = context.getImageData(x, y, 1, 1).data;
        return { r, g, b, a: 1 };
      });
    },
    { url: dataUrl(capture.png), widthDp: capture.widthDp, points },
  );
}

async function sampled(page, capture, screen, theme) {
  const actual = await pixels(page, capture, screen.samples.map((sample) => samplePoint(sample, capture.frames)));
  return screen.samples.map((sample, i) => ({ name: sample.name, expected: expectedColour(tokens, theme, sample, capture.heightDp), actual: actual[i] }));
}

function side(title, capture, colour) {
  const scale = WIDTH / capture.widthDp;
  const boxes = Object.entries(capture.frames)
    .map(
      ([name, [x, y, w, h]]) =>
        `<div class="frame" style="left:${x * scale}px;top:${y * scale}px;width:${w * scale}px;height:${h * scale}px;border-color:${colour}">` +
        `<span style="background:${colour}">${escapeHtml(name)}</span></div>`,
    )
    .join("");
  return (
    `<figure><figcaption>${escapeHtml(title)}</figcaption>` +
    `<div class="shot" style="width:${WIDTH}px;height:${capture.heightDp * scale}px"><img src="${dataUrl(capture.png)}" width="${WIDTH}">${boxes}</div></figure>`
  );
}

function pairPage(theme, screen, android, web, findings) {
  const list =
    findings.length === 0
      ? "<li>no findings</li>"
      : findings
          .map((f) => `<li class="${f.approved ? "ok" : "open"}">${escapeHtml(`${f.kind} ${f.name}: ${f.detail}${f.approved ? ` (approved: ${f.reason})` : ""}`)}</li>`)
          .join("");
  return (
    `<!doctype html><meta charset="utf-8"><style>` +
    `body{margin:16px;font:14px system-ui;background:#fff;color:#111}.row{display:flex;gap:24px}figure{margin:0}` +
    `figcaption{font-weight:600;margin-bottom:6px}.shot{position:relative;overflow:hidden;outline:1px solid #ccc}.shot img{display:block}` +
    `.frame{position:absolute;border:2px solid;box-sizing:border-box}.frame span{position:absolute;top:-1px;left:-1px;color:#fff;font:11px system-ui;padding:0 3px}` +
    `li.open{color:#b3321c}li.ok{color:#0d7250}</style>` +
    `<h1>${escapeHtml(`${screen.id}, ${theme}`)}</h1><div class="row">${side("Android (red frames)", android, "#d0021b")}${side("Web (blue frames)", web, "#1d5cc0")}</div>` +
    `<ul>${list}</ul>`
  );
}

mkdirSync(join(out, "pairs"), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2 * WIDTH + 80, height: 900 } });
const all = [];
try {
  for (const theme of THEMES) {
    for (const screen of SCREENS) {
      const android = readCapture("android", `font100-${theme}-${screen.id}`);
      const web = readCapture("web", `${theme}-${screen.id}`);
      if (android === null || web === null) {
        const missing = { theme, screen: screen.id, kind: "missing-capture", name: android === null ? "android" : "web", detail: "run capture-android.sh and web-capture.mjs first" };
        all.push(...withApprovals([missing], approvals));
        continue;
      }
      const findings = withApprovals(
        [
          ...frameFindings(screen.id, theme, android, web, screen.elements),
          ...colourFindings(screen.id, theme, "android", await sampled(page, android, screen, theme)),
          ...colourFindings(screen.id, theme, "web", await sampled(page, web, screen, theme)),
        ],
        approvals,
      );
      all.push(...findings);
      await page.setContent(pairPage(theme, screen, android, web, findings));
      await page.screenshot({ path: join(out, "pairs", `${theme}-${screen.id}.png`), fullPage: true });
    }
  }
} finally {
  await browser.close();
}

const open = unapproved(all);
const androidFolder = join(out, "android");
const large = existsSync(androidFolder) ? readdirSync(androidFolder).filter((n) => n.startsWith("font200-") && n.endsWith(".png")) : [];
const pairs = SCREENS.length * THEMES.length;
const report = [
  "# Visual review",
  "",
  `${pairs} pairs, ${all.length} findings, ${open.length} not approved. Pairs: out/pairs/<theme>-<screen>.png.`,
  "",
  "| Theme | Screen | Kind | Name | Detail | Approved |",
  "|---|---|---|---|---|---|",
  ...all.map((f) => `| ${f.theme} | ${f.screen} | ${f.kind} | ${f.name} | ${f.detail} | ${f.approved ? f.reason : "no"} |`),
  "",
  `Large text (N9), Android only: ${large.length} captures, out/android/font200-*.png.`,
  "",
];
writeFileSync(join(out, "report.md"), report.join("\n"));
writeFileSync(join(out, "report.json"), `${JSON.stringify(all, null, 2)}\n`);
console.log(`${pairs} pairs, ${all.length} findings, ${open.length} not approved`);
for (const f of open) console.log(`open: ${f.key}: ${f.detail}`);
process.exitCode = check && open.length > 0 ? 1 : 0;
