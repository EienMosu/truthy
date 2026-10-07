import { describe, expect, it } from "vitest";
import { SHELL_CACHE_PREFIX, isOldShellCache, shellCacheName } from "@/src/offline/cache-names";

describe("shellCacheName", () => {
  it("names the cache of a release after its version", () => {
    expect(SHELL_CACHE_PREFIX).toBe("truthy-shell-");
    expect(shellCacheName("5db53f3-20261007T120000Z")).toBe("truthy-shell-5db53f3-20261007T120000Z");
    expect(shellCacheName("local")).toBe("truthy-shell-local");
  });
});

describe("isOldShellCache", () => {
  const version = "b2c3d4e-20261008T090000Z";

  it("is true for the shell cache of another release", () => {
    expect(isOldShellCache("truthy-shell-5db53f3-20261007T120000Z", version)).toBe(true);
    expect(isOldShellCache("truthy-shell-local", version)).toBe(true);
  });

  it("is false for this release's own cache", () => {
    expect(isOldShellCache(shellCacheName(version), version)).toBe(false);
  });

  it("leaves caches with other names alone", () => {
    expect(isOldShellCache("other-cache", version)).toBe(false);
    expect(isOldShellCache("truthy-decks", version)).toBe(false);
    expect(isOldShellCache("my-truthy-shell-old", version)).toBe(false);
  });
});
