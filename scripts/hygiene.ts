// The repository is public. Nothing tracked may reveal a local machine, a work identity or a secret.
// The rules live here so that more than the tracked-files test (tests/repo-hygiene.test.ts) can use them.

export const ALLOWED_EMAIL = "EienMosu@users.noreply.github.com";

export const RULES: readonly { name: string; pattern: RegExp }[] = [
  // A slash-led home or temp path, but not the same words inside a web URL ("example.com/home/x").
  { name: "absolute local path", pattern: /(?<![\w.-])(?:\/Users|\/home|\/private\/tmp|\/private\/var|\/var\/folders)\/[\w.-]+/ },
  { name: "Windows user path", pattern: /\b[A-Za-z]:\\Users\\[\w.-]+/ },
  // Tools encode a home folder into a folder name, for example a transcript folder per project.
  { name: "encoded local path", pattern: /-Users-[A-Za-z0-9.]+-/ },
  { name: "AWS access key id", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: "GitHub token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})/ },
  { name: "API key", pattern: /\b(?:sk-[A-Za-z0-9_-]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35})/ },
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
