// Reads what a source file imports, for the tests that pin module boundaries (tests/purity.test.ts and the
// service worker's tests). The patterns read the code, not what a comment says about it.

/** The code without its comments: a comment may name what the code must not use. */
export function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Every import source in the code: static, type-only, re-exported, dynamic and bare imports, in order. */
export function importSources(code: string): string[] {
  return [...code.matchAll(/\b(?:import|export)\b[^;'"]*?\bfrom\s*["']([^"']+)["']|\bimport\s*\(?\s*["']([^"']+)["']/g)].map(
    (match) => match[1] ?? match[2] ?? "",
  );
}
