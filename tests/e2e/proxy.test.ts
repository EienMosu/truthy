import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startProxy, type NetProxy } from "@/e2e/proxy";

// The offline specs reach the production server through this proxy (docs/testing.md, "Offline and updates"): it is
// how they cut the network in WebKit, where Playwright's setOffline also stops the service worker from answering,
// and how the update spec serves a new release of sw.js.

const WORKER = 'self.version = "abc-1";\n';

let upstream: Server;
let upstreamUrl: string;
let proxy: NetProxy;

beforeEach(async () => {
  upstream = createServer((request, response) => {
    if (request.url === "/sw.js") {
      response.writeHead(200, { "content-type": "text/javascript", etag: '"w1"', "content-length": String(Buffer.byteLength(WORKER)) });
      response.end(WORKER);
      return;
    }
    response.writeHead(200, { "content-type": "text/plain", "x-path": request.url ?? "" });
    response.end(`page ${request.url}`);
  });
  await new Promise<void>((resolve) => upstream.listen(0, resolve));
  upstreamUrl = `http://localhost:${(upstream.address() as AddressInfo).port}`;
  proxy = await startProxy(upstreamUrl);
});

afterEach(async () => {
  await proxy.close();
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
});

describe("the switchable proxy", () => {
  it("passes requests and answers through while online", async () => {
    const response = await fetch(`${proxy.url}/play?x=1`);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-path")).toBe("/play?x=1");
    expect(await response.text()).toBe("page /play?x=1");
  });

  it("drops every connection while offline, and passes them again once back online", async () => {
    await fetch(`${proxy.url}/`);
    proxy.setOffline(true);
    await expect(fetch(`${proxy.url}/`)).rejects.toThrow();
    proxy.setOffline(false);
    expect(await (await fetch(`${proxy.url}/`)).text()).toBe("page /");
  });

  it("serves sw.js unchanged until a release is made", async () => {
    expect(await (await fetch(`${proxy.url}/sw.js`)).text()).toBe(WORKER);
  });

  it("serves a new release of sw.js: the version replaced, with no stale length or validator", async () => {
    proxy.release("abc-1", "abc-1-next");
    const response = await fetch(`${proxy.url}/sw.js`, { headers: { "if-none-match": '"w1"' } });
    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBeNull();
    expect(await response.text()).toBe('self.version = "abc-1-next";\n');
    expect(await (await fetch(`${proxy.url}/`)).text()).toBe("page /");
  });
});
