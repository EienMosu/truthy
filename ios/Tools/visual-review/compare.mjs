// The pure part of the visual review (spec 7.4): frame differences against the web, colour probes against the
// resolved tokens, the status bar check of N12, the launch frame check of N10 and the side-by-side pairs.
import { pixelAt } from "./png.mjs";

/** @typedef {[number, number, number, number]} Frame  x, y, width, height in points */
/** @typedef {Record<string, Frame>} Frames */
/** @typedef {[number, number, number]} Rgb */

/** Element frames may differ from the web's by this much, in points (criterion 2). */
export const FRAME_TOLERANCE = 2;
/** A screenshot colour may differ from its token by this much per channel. */
export const SCREENSHOT_TOLERANCE = 3;
/** A video frame colour may differ by this much per channel (H.264 changes colours a little). */
export const VIDEO_TOLERANCE = 12;

/**
 * The capture order of the review: one Classic round (start steps 1 to 6, question, answered, leave sheet, result),
 * then the screens it does not reach (testCaptureTheOtherClassesAndStartStates and the end of captureWeb).
 */
export const STATES = [
  "s1", "s2", "s3", "s4", "s5", "s6", "p2", "p3", "p4", "r1",
  "streak-p2", "streak-r1", "lives-p2", "lives-r1", "lives-r1-why", "timed-p2", "timed-up", "timed-r1",
  "s1-returning", "s3-recent",
];

/** The pills the review measures, by visible title, and the colour role of their fill. */
export const PILLS = {
  True: "true",
  False: "false",
  "Next card": "ink",
  "See results": "ink",
  "Start round": "ink",
  "Play again": "ink",
  "Keep playing": "ink",
};

/**
 * A colour role of a theme ("day" or "night") in native-data/tokens/resolved.json, references followed.
 * @param {any} tokens @param {"day" | "night"} theme @param {string} role
 * @returns {string} "#rrggbb"
 */
export function tokenHex(tokens, theme, role) {
  let value = tokens?.color?.[theme]?.[role]?.$value;
  for (let hops = 0; typeof value === "string" && hops < 8; hops += 1) {
    const match = /^\{color\.([a-z]+)\.([a-z0-9-]+)\}$/.exec(value);
    value = match === null ? undefined : tokens.color[match[1] ?? ""]?.[match[2] ?? ""]?.$value;
  }
  if (value === undefined || typeof value !== "object" || typeof value.hex !== "string") {
    throw new Error(`color.${theme}.${role} does not resolve`);
  }
  return value.hex.toLowerCase();
}

/** @param {string} hex @returns {Rgb} */
export function hexToRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/** The largest per-channel difference. @param {Rgb} a @param {Rgb} b */
export function channelDistance(a, b) {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}

/** The largest difference of x, y, width and height. @param {Frame} a @param {Frame} b */
export function frameDiff(a, b) {
  return Math.max(...a.map((value, i) => Math.abs(value - (b[i] ?? 0))));
}

/**
 * Compares the frames present on both sides; a name on one side only is reported as missing on the other.
 * `approved` is the set of "<device>-<theme>-<state>:<name>" keys the owner approved (approved.json).
 * @param {Frames} web @param {Frames} ios @param {string} key @param {Record<string, string>} approved
 */
export function compareFrames(web, ios, key, approved = {}) {
  const names = [...new Set([...Object.keys(web), ...Object.keys(ios)])].sort();
  return names.map((name) => {
    const w = web[name];
    const n = ios[name];
    const approval = approved[`${key}:${name}`];
    if (w === undefined || n === undefined) {
      return { name, web: w ?? null, ios: n ?? null, diff: null, ok: approval !== undefined, missing: w === undefined ? "web" : "ios", approval: approval ?? null };
    }
    const diff = Math.round(frameDiff(w, n) * 100) / 100;
    return { name, web: w, ios: n, diff, ok: diff <= FRAME_TOLERANCE || approval !== undefined, missing: null, approval: approval ?? null };
  });
}

/**
 * Where to sample which colour role on a screen, in points (the points plan C probes). The sky column at x 4 and
 * y 120, 300, 560 and 860 (those inside the screen), each expected as the sky gradient at that height, with the scrim
 * over it on the leave sheet (p4); the ticket's band 4 points below its top at its centre; its paper 6 points in from
 * the left and 50 down, just under the band; the sheet card 10 points in from its left edge (inside its 20 padding)
 * at half its height; a pill 14 points in at half its height. On p4 only the sky column, the sheet and its pill.
 * @param {string} state @param {Frames} frames @param {{ width: number, height: number }} screen
 * @returns {{ name: string, x: number, y: number, role: string, fraction?: number, scrim?: boolean }[]}
 */
export function probesFor(state, frames, screen) {
  const probes = [];
  for (const y of SKY_PROBE_YS) {
    if (y >= screen.height) continue;
    probes.push({ name: `sky-${y}`, x: 4, y, role: "sky", fraction: y / screen.height, scrim: state === "p4" });
  }
  if (state !== "p4") {
    const ticket = frames.ticket;
    if (ticket !== undefined) {
      probes.push({ name: "ticket band", x: ticket[0] + ticket[2] / 2, y: ticket[1] + 4, role: "accent" });
      probes.push({ name: "ticket paper", x: ticket[0] + 6, y: ticket[1] + 50, role: "surface-raised" });
    }
  }
  const sheet = frames.sheet;
  if (sheet !== undefined) probes.push({ name: "sheet", x: sheet[0] + 10, y: sheet[1] + sheet[3] / 2, role: "surface-raised" });
  for (const [title, role] of Object.entries(PILLS)) {
    const pill = frames[`pill:${title}`];
    if (pill === undefined) continue;
    if (state === "p4" && title !== "Keep playing") continue;
    probes.push({ name: `pill:${title}`, x: pill[0] + 14, y: pill[1] + pill[3] / 2, role });
  }
  return probes;
}

/** The heights of the sky column, in points. */
export const SKY_PROBE_YS = [120, 300, 560, 860];

/**
 * A colour role with its alpha, references followed: { hex, alpha }.
 * @param {any} tokens @param {"day" | "night"} theme @param {string} role
 */
export function tokenColor(tokens, theme, role) {
  let value = tokens?.color?.[theme]?.[role]?.$value;
  for (let hops = 0; typeof value === "string" && hops < 8; hops += 1) {
    const match = /^\{color\.([a-z]+)\.([a-z0-9-]+)\}$/.exec(value);
    value = match === null ? undefined : tokens.color[match[1] ?? ""]?.[match[2] ?? ""]?.$value;
  }
  if (value === undefined || typeof value !== "object" || typeof value.hex !== "string") {
    throw new Error(`color.${theme}.${role} does not resolve`);
  }
  return { hex: value.hex.toLowerCase(), alpha: typeof value.alpha === "number" ? value.alpha : 1 };
}

/**
 * The sky at a fraction of the screen height: the four sky colours mixed per channel in sRGB at the stops of
 * native.sky-stops, as the gradient draws them; with `scrim`, the theme's scrim laid over it.
 * @param {any} tokens @param {"day" | "night"} theme @param {number} fraction @param {boolean} scrim
 * @returns {string} "#rrggbb"
 */
export function skyHex(tokens, theme, fraction, scrim = false) {
  const stops = tokens?.native?.["sky-stops"];
  if (!Array.isArray(stops) || stops.length !== 4) throw new Error("no native.sky-stops in the tokens");
  const sky = ["sky-1", "sky-2", "sky-3", "sky-4"].map((role) => hexToRgb(tokenHex(tokens, theme, role)));
  const f = Math.min(1, Math.max(0, fraction));
  let i = 0;
  while (i < 2 && f > stops[i + 1]) i += 1;
  const span = stops[i + 1] - stops[i];
  const t = span === 0 ? 0 : (f - stops[i]) / span;
  /** @type {Rgb} */
  let rgb = [0, 1, 2].map((c) => Math.round(sky[i][c] + (sky[i + 1][c] - sky[i][c]) * t));
  if (scrim) {
    const over = tokenColor(tokens, theme, "scrim");
    const top = hexToRgb(over.hex);
    rgb = [0, 1, 2].map((c) => Math.round(rgb[c] * (1 - over.alpha) + top[c] * over.alpha));
  }
  return rgbToHex(rgb);
}

/**
 * Samples each probe in a screenshot of the given scale and compares it with the token (the sky with its gradient).
 * @param {import("./png.mjs").Image} image @param {number} scale
 * @param {ReturnType<typeof probesFor>} probes @param {any} tokens @param {"day" | "night"} theme
 */
export function checkColors(image, scale, probes, tokens, theme, tolerance = SCREENSHOT_TOLERANCE) {
  return probes.map((probe) => {
    const expected = probe.role === "sky" ? skyHex(tokens, theme, probe.fraction ?? 0, probe.scrim === true) : tokenHex(tokens, theme, probe.role);
    const actual = pixelAt(image, probe.x * scale, probe.y * scale);
    const distance = channelDistance(actual, hexToRgb(expected));
    return { ...probe, expected, actual: rgbToHex(actual), distance, ok: distance <= tolerance };
  });
}

/** @param {Rgb} rgb */
export function rgbToHex(rgb) {
  return `#${rgb.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/** Relative luminance from 0 to 1. @param {Rgb} rgb */
export function luminance(rgb) {
  const [r, g, b] = rgb.map((n) => {
    const c = n / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

/**
 * N12: in the status bar band the sky is the app theme's sky-1 and the glyphs contrast with it the way the app
 * theme asks: dark glyphs on the day sky, light glyphs on the night sky.
 * @param {import("./png.mjs").Image} image
 * @param {{ scale: number, statusBarPoints: number, theme: "day" | "night", tokens: any }} options
 */
export function statusBarCheck(image, { scale, statusBarPoints, theme, tokens }) {
  const sky = hexToRgb(tokenHex(tokens, theme, "sky-1"));
  const top = pixelAt(image, image.width * 0.3, scale);
  const rows = Math.min(image.height, Math.round(statusBarPoints * scale));
  let count = 0;
  let sum = 0;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const rgb = pixelAt(image, x, y);
      if (channelDistance(rgb, sky) > 60) {
        count += 1;
        sum += luminance(rgb);
      }
    }
  }
  const glyphs = count === 0 ? null : sum / count;
  const background = luminance(sky);
  const skyOk = channelDistance(top, sky) <= SCREENSHOT_TOLERANCE;
  const glyphsOk = glyphs !== null && count >= 30 && (theme === "day" ? glyphs < background - 0.2 : glyphs > background + 0.2);
  return { ok: skyOk && glyphsOk, sky: rgbToHex(top), expectedSky: tokenHex(tokens, theme, "sky-1"), glyphPixels: count, glyphLuminance: glyphs, skyLuminance: background };
}

/**
 * N10: the colour of one point in every frame of a recording. Frames before the first launch or app colour (the
 * home screen, the icon zooming open) and after the last app colour (the app closing at the end of a test) are
 * left out. In between, a frame must be the launch colour or a blend from it to the app colour until the app
 * colour first shows, and the app colour from then on. Anything else is a white or mismatched frame.
 * @param {Rgb[]} colors @param {Rgb} launch @param {Rgb} app
 */
export function classifyFrames(colors, launch, app, tolerance = VIDEO_TOLERANCE) {
  const isLaunch = (/** @type {Rgb} */ c) => channelDistance(c, launch) <= tolerance;
  const isApp = (/** @type {Rgb} */ c) => channelDistance(c, app) <= tolerance;
  const first = colors.findIndex((c) => isLaunch(c) || isApp(c));
  let last = -1;
  colors.forEach((c, i) => {
    if (isApp(c)) last = i;
  });
  const firstApp = colors.findIndex(isApp);
  const problems = [];
  if (first === -1 || firstApp === -1) return { ok: false, firstApp, problems: [{ frame: -1, color: "no launch or app colour" }] };
  for (let i = first; i <= last; i += 1) {
    const c = colors[i] ?? [0, 0, 0];
    const fine = i < firstApp ? isLaunch(c) || onBlend(c, launch, app, tolerance) : isApp(c);
    if (!fine) problems.push({ frame: i, color: rgbToHex(c) });
  }
  return { ok: problems.length === 0, firstApp, problems };
}

/** Whether c lies on the straight blend from a to b, within the tolerance. @param {Rgb} c @param {Rgb} a @param {Rgb} b */
function onBlend(c, a, b, tolerance) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const length = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  if (length === 0) return false;
  const t = Math.min(1, Math.max(0, ((c[0] - a[0]) * d[0] + (c[1] - a[1]) * d[1] + (c[2] - a[2]) * d[2]) / length));
  /** @type {Rgb} */
  const point = [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t];
  return channelDistance(c, point) <= tolerance;
}

/**
 * The web screenshot on the left and the iOS one on the right, 16 pixels apart, each with its element frames
 * outlined: green within the tolerance, red outside it.
 * @param {import("./png.mjs").Image} web @param {import("./png.mjs").Image} ios
 * @param {ReturnType<typeof compareFrames>} frames @param {number} scale
 */
export function sideBySide(web, ios, frames, scale) {
  const gap = 16;
  const width = web.width + gap + ios.width;
  const height = Math.max(web.height, ios.height);
  const data = new Uint8Array(width * height * 4).fill(255);
  blit(data, width, web, 0);
  blit(data, width, ios, web.width + gap);
  for (const result of frames) {
    /** @type {Rgb} */
    const color = result.ok ? [0, 170, 80] : [220, 30, 30];
    if (result.web !== null) outline(data, width, height, result.web, scale, 0, color);
    if (result.ios !== null) outline(data, width, height, result.ios, scale, web.width + gap, color);
  }
  return { width, height, data };
}

/** @param {Uint8Array} data @param {number} width @param {import("./png.mjs").Image} image @param {number} left */
function blit(data, width, image, left) {
  for (let y = 0; y < image.height; y += 1) {
    data.set(image.data.subarray(y * image.width * 4, (y + 1) * image.width * 4), (y * width + left) * 4);
  }
}

/** @param {Uint8Array} data @param {number} width @param {number} height @param {Frame} frame @param {number} scale @param {number} left @param {Rgb} color */
function outline(data, width, height, frame, scale, left, color) {
  const x0 = Math.round(frame[0] * scale) + left;
  const y0 = Math.round(frame[1] * scale);
  const x1 = Math.round((frame[0] + frame[2]) * scale) + left;
  const y1 = Math.round((frame[1] + frame[3]) * scale);
  const paint = (/** @type {number} */ x, /** @type {number} */ y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    data.set([...color, 255], (y * width + x) * 4);
  };
  for (let t = 0; t < 2; t += 1) {
    for (let x = x0; x <= x1; x += 1) {
      paint(x, y0 + t);
      paint(x, y1 - t);
    }
    for (let y = y0; y <= y1; y += 1) {
      paint(x0 + t, y);
      paint(x1 - t, y);
    }
  }
}
