import { execFileSync, spawnSync } from "node:child_process";
import { inflateSync } from "node:zlib";

// The repository is public. Nothing tracked may reveal a local machine, a work identity or a secret.
// These rules are shared by the tracked-files test (tests/repo-hygiene.test.ts) and the pre-push hook
// (.githooks/pre-push), which applies them to every commit about to be pushed.

export const ALLOWED_EMAIL = "EienMosu@users.noreply.github.com";

export const RULES: readonly { name: string; pattern: RegExp }[] = [
  // A slash-led home, temp, WSL or mounted volume path, but not the same words inside a web URL ("example.com/home/x").
  {
    name: "absolute local path",
    pattern: /(?<![\w.-])(?:\/Users|\/home|\/root|\/Volumes|\/mnt\/[a-z]\/Users|\/private\/tmp|\/private\/var|\/var\/folders)\/[\w.-]+/,
  },
  // A home-relative path names no user, but these folders show how the machine is laid out.
  { name: "home folder layout", pattern: /~\/(?:Desktop|Documents|Downloads)\// },
  // A tool's temp folder per user, named with the numeric user id.
  { name: "per-user temp folder", pattern: /\bclaude-\d{3,}\b/ },
  // One or two backslashes: the second form is the same path escaped inside JSON.
  { name: "Windows user path", pattern: /\b[A-Za-z]:\\{1,2}Users\\{1,2}[\w.-]+/ },
  // Tools encode a home folder into a folder name, for example a transcript folder per project.
  { name: "encoded local path", pattern: /-Users-[A-Za-z0-9.]+-/ },
  { name: "AWS access key id", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: "AWS secret access key", pattern: /aws_secret_access_key\s*[=:]\s*["']?[A-Za-z0-9/+=]{40}\b/i },
  { name: "GitHub token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})/ },
  // OpenAI style, Slack, Google API, GitLab, npm, Stripe live and Google OAuth client secrets.
  {
    name: "API key",
    pattern:
      /\b(?:sk-[A-Za-z0-9_-]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|glpat-[\w-]{20,}|npm_[A-Za-z0-9]{36}\b|[sr]k_live_[A-Za-z0-9]{20,}|GOCSPX-[\w-]{20,})/,
  },
  { name: "Slack webhook", pattern: /hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/\w+/ },
  { name: "JSON web token", pattern: /\beyJ[\w-]{8,}\.eyJ[\w-]{8,}\.[\w-]{10,}/ },
  { name: "private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];
export const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

// Every finding in a text, one entry per rule hit: "<line>: <rule>: <match>".
export function findingsIn(text: string): string[] {
  const found: string[] = [];
  text.split("\n").forEach((line, index) => {
    for (const rule of RULES) {
      const match = rule.pattern.exec(line);
      if (match) found.push(`${index + 1}: ${rule.name}: ${match[0]}`);
    }
    for (const match of line.matchAll(EMAIL)) {
      if (match[0] !== ALLOWED_EMAIL) found.push(`${index + 1}: e-mail address: ${match[0]}`);
    }
  });
  return found;
}

// Every finding in a file's bytes. Text is scanned as it is. A binary file has no lines, so its findings carry
// no line number: a PNG is scanned in its text and EXIF chunks (not its compressed pixels, which can hold any
// bytes), any other binary file, or a PNG that does not parse, in its runs of readable characters.
export function findingsInBytes(bytes: Uint8Array): string[] {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (!buffer.includes(0)) return findingsIn(buffer.toString("utf8"));
  const text = pngText(buffer) ?? readableRuns(buffer);
  return findingsIn(text).map((finding) => finding.replace(/^\d+: /, ""));
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// The text a PNG carries besides its pixels, or null when the bytes are not a well-formed PNG.
function pngText(bytes: Buffer): string | null {
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  const texts: string[] = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("latin1", offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > bytes.length) return null;
    try {
      const text = chunkText(type, bytes.subarray(offset + 8, offset + 8 + length));
      if (text !== null) texts.push(text);
    } catch {
      return null; // a compressed chunk that does not inflate
    }
    offset = end;
    if (type === "IEND") {
      // Bytes after the end of the image are not part of it; whatever they hold is read as text.
      texts.push(readableRuns(bytes.subarray(offset)));
      return texts.join("\n");
    }
  }
  return null;
}

function chunkText(type: string, data: Buffer): string | null {
  const keywordEnd = data.indexOf(0);
  switch (type) {
    case "tEXt":
      return data.toString("latin1").replaceAll("\0", " ");
    case "zTXt":
      // keyword, 0, compression method, compressed text
      return `${data.toString("latin1", 0, keywordEnd)} ${inflateSync(data.subarray(keywordEnd + 2)).toString("latin1")}`;
    case "iTXt": {
      // keyword, 0, compressed flag, compression method, language tag, 0, translated keyword, 0, text
      const compressed = data[keywordEnd + 1] === 1;
      const languageEnd = data.indexOf(0, keywordEnd + 3);
      const translatedEnd = data.indexOf(0, languageEnd + 1);
      const body = data.subarray(translatedEnd + 1);
      const head = data.subarray(0, translatedEnd).toString("utf8").replaceAll("\0", " ");
      return `${head} ${(compressed ? inflateSync(body) : body).toString("utf8")}`;
    }
    case "eXIf":
      return readableRuns(data);
    default:
      return null;
  }
}

// Runs of four or more printable ASCII characters, one per line.
function readableRuns(bytes: Buffer): string {
  return (bytes.toString("latin1").match(/[\x20-\x7e\t]{4,}/g) ?? []).join("\n");
}

// A co-author trailer or a tool's "Generated with ..." footer: commits carry the owner's name only.
const ATTRIBUTION = /^\s*(?:co-authored-by:|\W{0,3}\s*generated (?:with|by)\b).*$/i;

function git(cwd: string, args: readonly string[]): Buffer {
  return execFileSync("git", args, { cwd, maxBuffer: 1 << 30 });
}

// Every finding in the commits that `git rev-list <revisions>` lists, newest first: their author and committer
// e-mail addresses, their messages, the names of the files they add, and every line they add (lines they only
// delete are not new). A merge counts only the lines it adds itself, outside what its parents bring.
export function scanCommits(cwd: string, revisions: readonly string[]): string[] {
  const commits = git(cwd, ["rev-list", ...revisions, "--"]).toString("utf8").split("\n").filter(Boolean);
  return commits.flatMap((sha) => scanCommit(cwd, sha));
}

function scanCommit(cwd: string, sha: string): string[] {
  const short = sha.slice(0, 7);
  const found: string[] = [];
  const report = (where: string, findings: readonly string[]) => {
    for (const finding of findings) found.push(`${short} ${where}: ${finding.replace(/^\d+: /, "")}`);
  };

  const [author = "", committer = "", message = ""] = git(cwd, ["show", "-s", "--format=%ae%x00%ce%x00%B", sha])
    .toString("utf8")
    .split("\0");
  if (author !== ALLOWED_EMAIL) report("author", [`e-mail address: ${author}`]);
  if (committer !== ALLOWED_EMAIL) report("committer", [`e-mail address: ${committer}`]);
  report("message", findingsIn(message.trimEnd()));
  for (const line of message.split("\n")) {
    if (ATTRIBUTION.test(line)) report("message", [`attribution line: ${line.trim()}`]);
  }

  // The files the commit adds or changes; "-" counts mark a binary file. A merge lists none here.
  const changes = git(cwd, ["diff-tree", "-r", "--root", "--no-commit-id", "--no-renames", "--numstat", "-z", sha])
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const [added = "", , ...rest] = entry.split("\t");
      return { binary: added === "-", path: rest.join("\t") };
    });
  const present = (path: string) => spawnSync("git", ["cat-file", "-e", `${sha}:${path}`], { cwd }).status === 0;
  for (const { path } of changes) {
    if (present(path)) report(path, findingsIn(path).map((finding) => `file name: ${finding.replace(/^\d+: /, "")}`));
  }

  for (const [path, lines] of addedLines(git(cwd, ["show", "--format=", "--unified=0", "--no-color", "--no-ext-diff", "--no-textconv", "--no-renames", sha]).toString("utf8"))) {
    report(path, lines.flatMap((line) => findingsIn(line)));
  }
  for (const { path, binary } of changes) {
    if (binary && present(path)) report(path, findingsInBytes(git(cwd, ["cat-file", "blob", `${sha}:${path}`])));
  }
  return found;
}

// The lines a patch adds, per file. A combined (merge) diff has one marker column per parent; a line counts
// when it is new to at least one parent and removed from none.
function addedLines(patch: string): [path: string, lines: string[]][] {
  const files: [string, string[]][] = [];
  let current: string[] | null = null;
  let columns = 1;
  let path = "";
  for (const line of patch.split("\n")) {
    if (line.startsWith("diff ")) {
      current = null;
      continue;
    }
    if (current === null && line.startsWith("+++ ")) {
      path = line.slice(4).replace(/^b\//, "");
      continue;
    }
    const hunk = /^(@{2,}) /.exec(line);
    if (hunk) {
      columns = (hunk[1] ?? "@@").length - 1;
      if (current === null) {
        current = [];
        files.push([path, current]);
      }
      continue;
    }
    if (current === null) continue;
    const markers = line.slice(0, columns);
    if (markers.includes("+") && !markers.includes("-")) current.push(line.slice(columns));
  }
  return files;
}

// The revisions to scan for each line git passes a pre-push hook on its standard input:
// "<local ref> <local sha> <remote ref> <remote sha>". A deletion pushes no commits. For a branch the remote
// already has, the commits after the remote's one; for a new branch, or when the remote's commit is not known
// here (a forced push over commits this clone never fetched), every commit not on a remote.
export function pushRanges(cwd: string, stdin: string): string[][] {
  const ranges: string[][] = [];
  for (const line of stdin.split("\n")) {
    const [, local, , remote] = line.trim().split(/\s+/);
    if (!local || !remote || /^0+$/.test(local)) continue;
    const known = !/^0+$/.test(remote) && spawnSync("git", ["cat-file", "-e", `${remote}^{commit}`], { cwd }).status === 0;
    ranges.push(known ? [`${remote}..${local}`] : [local, "--not", "--remotes"]);
  }
  return ranges;
}
