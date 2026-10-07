// The release version the service worker carries (spec sections 5 and 6): "<commit>-<ISO build time>". It exists
// only at build time: scripts/build-sw.ts bundles the worker with esbuild, which replaces __TRUTHY_VERSION__ with
// that string. src/offline/sw-entry.ts is the only importer, inside that bundle; the app never imports this file.
declare const __TRUTHY_VERSION__: string;

export const RELEASE_VERSION: string = __TRUTHY_VERSION__;
