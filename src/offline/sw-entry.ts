// The service worker script: the only file that touches the worker global. scripts/build-sw.ts bundles it into
// public/sw.js with the release version of src/offline/version.ts filled in. The project's TypeScript setup uses the
// DOM library, whose `self` is a window, so the few worker members used here are typed locally.
import { RELEASE_VERSION } from "./version";
import { createWorker } from "./worker";

interface WaitingEvent {
  waitUntil(promise: Promise<unknown>): void;
}

interface WorkerFetchEvent {
  request: Request;
  respondWith(response: Promise<Response>): void;
}

interface WorkerMessageEvent extends WaitingEvent {
  data: unknown;
}

interface WorkerScope {
  location: { origin: string };
  caches: CacheStorage;
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(type: "install" | "activate", listener: (event: WaitingEvent) => void): void;
  addEventListener(type: "fetch", listener: (event: WorkerFetchEvent) => void): void;
  addEventListener(type: "message", listener: (event: WorkerMessageEvent) => void): void;
}

const scope = self as unknown as WorkerScope;

const worker = createWorker({
  version: RELEASE_VERSION,
  origin: scope.location.origin,
  caches: scope.caches,
  fetch: (input, init) => scope.fetch(input, init),
  skipWaiting: () => scope.skipWaiting(),
  claim: () => scope.clients.claim(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
});

scope.addEventListener("install", (event) => event.waitUntil(worker.install()));
scope.addEventListener("activate", (event) => event.waitUntil(worker.activate()));
scope.addEventListener("fetch", (event) => {
  const response = worker.respond(event.request);
  if (response) event.respondWith(response);
});
scope.addEventListener("message", (event) => event.waitUntil(worker.message(event.data)));
