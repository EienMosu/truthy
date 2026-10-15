// Pure checks of the visual review (spec 7.4): token colours, the sky, element frames and approvals. No I/O.
export const FRAME_LIMIT_DP = 2;
// Per channel, for a screenshot. (A colour read from a video frame would allow 12; this review reads screenshots only.)
export const COLOUR_TOLERANCE = 3;

/** The sky's gradient stops: plan A's native group of resolved.json (Tokens.Native.skyStops on Android). */
export function skyStops(tokens) {
  const stops = tokens?.native?.["sky-stops"];
  if (!Array.isArray(stops) || stops.length !== 4) throw new Error("no native.sky-stops in the tokens");
  return stops;
}

function lookup(tokens, path) {
  let node = tokens;
  for (const key of path.split(".")) {
    if (node === null || typeof node !== "object" || !(key in node)) throw new Error(`no token ${path}`);
    node = node[key];
  }
  return node;
}

/** A colour token of the DTCG file, references followed: { r, g, b } in 0 to 255 and the alpha. */
export function tokenColour(tokens, path) {
  let token = lookup(tokens, path);
  for (let hops = 0; hops < 10; hops += 1) {
    const value = token?.$value;
    if (typeof value === "string") {
      const reference = /^\{([^}]+)\}$/.exec(value);
      if (reference === null) throw new Error(`${path} is not a colour: ${value}`);
      token = lookup(tokens, reference[1]);
    } else if (value !== null && typeof value === "object" && typeof value.hex === "string") {
      const h = value.hex;
      return { r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16), a: value.alpha ?? 1 };
    } else {
      throw new Error(`${path} is not a colour`);
    }
  }
  throw new Error(`${path}: the reference chain is too long`);
}

const role = (tokens, theme, name) => tokenColour(tokens, `color.${theme}.${name}`);

/** A colour with alpha laid over an opaque one, per channel, rounded. */
export function over(top, bottom) {
  const a = top.a ?? 1;
  const mix = (front, back) => Math.round(front * a + back * (1 - a));
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

/** The sky at a fraction of the window height, mixed per channel in sRGB. */
export function skyColour(tokens, theme, fraction) {
  const SKY_STOPS = skyStops(tokens);
  const at = Math.min(1, Math.max(0, fraction));
  const stops = [1, 2, 3, 4].map((n) => role(tokens, theme, `sky-${n}`));
  let i = 0;
  while (i < SKY_STOPS.length - 2 && at > SKY_STOPS[i + 1]) i += 1;
  const t = (at - SKY_STOPS[i]) / (SKY_STOPS[i + 1] - SKY_STOPS[i]);
  const from = stops[i];
  const to = stops[i + 1];
  const mix = (a, b) => Math.round(a + (b - a) * t);
  return { r: mix(from.r, to.r), g: mix(from.g, to.g), b: mix(from.b, to.b), a: 1 };
}

/**
 * Where a sample is read, in dp: fixed on the screen ({ x, y }), or inside an element's frame [x, y, w, h]:
 * across by a fraction of the width (fx) or by dp (dx), down by dp from the top (dy), by a fraction of the height (fy)
 * or up from the bottom (dyBottom). Null when the element was not captured.
 */
export function samplePoint(sample, frames) {
  if (sample.element === undefined) return { x: sample.x, y: sample.y };
  const frame = frames[sample.element];
  if (frame === undefined) return null;
  const [fx, fy, fw, fh] = frame;
  const x = sample.fx !== undefined ? fx + fw * sample.fx : fx + sample.dx;
  const y = sample.dy !== undefined ? fy + sample.dy : sample.fy !== undefined ? fy + fh * sample.fy : fy + fh - sample.dyBottom;
  return { x, y };
}

/** What a sample should read: a colour role of the theme, or the sky at its height, under the scrim if it says so. */
export function expectedColour(tokens, theme, sample, heightDp) {
  if (sample.role !== undefined) return role(tokens, theme, sample.role);
  const sky = skyColour(tokens, theme, sample.y / heightDp);
  return sample.scrim ? over(role(tokens, theme, "scrim"), sky) : sky;
}

export function close(a, b, tolerance = COLOUR_TOLERANCE) {
  return Math.abs(a.r - b.r) <= tolerance && Math.abs(a.g - b.g) <= tolerance && Math.abs(a.b - b.b) <= tolerance;
}

export function hex(c) {
  return `#${[c.r, c.g, c.b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

const written = (frame) => frame.map((value) => Number(value.toFixed(1))).join(", ");

/** Frames of the same element on both platforms, [x, y, w, h] in dp: more than 2 dp apart, or missing, is a finding. */
export function frameFindings(screen, theme, android, web, elements) {
  const findings = [];
  for (const name of elements) {
    const a = android.frames[name];
    const w = web.frames[name];
    if (a === undefined) {
      findings.push({ theme, screen, kind: "missing-android", name, detail: "not found on android" });
    } else if (w === undefined) {
      findings.push({ theme, screen, kind: "missing-web", name, detail: "not found on the web" });
    } else {
      const off = Math.max(...a.map((value, i) => Math.abs(value - w[i])));
      if (off > FRAME_LIMIT_DP) findings.push({ theme, screen, kind: "frame", name, detail: `android ${written(a)}; web ${written(w)}; off by ${off.toFixed(1)} dp` });
    }
  }
  return findings;
}

/** Sampled colours of one platform against what the tokens say. A null reading (element missing) is left out. */
export function colourFindings(screen, theme, platform, sampled) {
  return sampled
    .filter((s) => s.actual !== null && !close(s.actual, s.expected))
    .map((s) => ({ theme, screen, kind: `colour-${platform}`, name: s.name, detail: `expected ${hex(s.expected)}, was ${hex(s.actual)}` }));
}

export const findingKey = (f) => `${f.theme}/${f.screen}/${f.kind}/${f.name}`;

/** Marks each finding approved when approvals.json has its key, with the owner's reason. */
export function withApprovals(findings, approvals) {
  return findings.map((f) => {
    const key = findingKey(f);
    const approval = approvals.find((entry) => entry.key === key);
    return { ...f, key, approved: approval !== undefined, reason: approval?.reason ?? "" };
  });
}

export const unapproved = (findings) => findings.filter((f) => !f.approved);
