// The names of the service worker's caches (spec section 6). Each release keeps its app shell in a cache of its
// own, "truthy-shell-<version>", so a page and the assets it loads always come from the same release; the
// worker deletes the caches of other releases when it activates.

export const SHELL_CACHE_PREFIX = "truthy-shell-";

/** The cache that holds the app shell of this release. */
export function shellCacheName(version: string): string {
  return `${SHELL_CACHE_PREFIX}${version}`;
}

/** A shell cache of another release: the worker of `version` deletes it. Caches with other names are left alone. */
export function isOldShellCache(name: string, version: string): boolean {
  return name.startsWith(SHELL_CACHE_PREFIX) && name !== shellCacheName(version);
}
