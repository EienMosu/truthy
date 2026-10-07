import { describe, expect, it } from "vitest";
import { PAGE_TIMEOUT_MS, type RequestFacts, strategyFor } from "@/src/offline/strategy";

const ORIGIN = "https://truthy.example";

function request(path: string, init: { method?: string; mode?: string; headers?: Record<string, string> } = {}): RequestFacts {
  return {
    url: path.startsWith("http") ? path : `${ORIGIN}${path}`,
    method: init.method ?? "GET",
    mode: init.mode ?? "no-cors",
    headers: new Headers(init.headers),
  };
}

const navigate = (path: string) => request(path, { mode: "navigate" });

describe("strategyFor: pages", () => {
  it("serves the start page and the play page network first, with the cached copy", () => {
    expect(strategyFor(navigate("/"), ORIGIN)).toBe("page");
    expect(strategyFor(navigate("/play"), ORIGIN)).toBe("page");
  });

  it("keeps a page a page whatever its query or fragment", () => {
    expect(strategyFor(navigate("/?utm_source=homescreen"), ORIGIN)).toBe("page");
    expect(strategyFor(navigate("/play#card"), ORIGIN)).toBe("page");
  });

  it("serves any other same-origin page network first, with the 404 page offline", () => {
    expect(strategyFor(navigate("/missing"), ORIGIN)).toBe("unknown-page");
    expect(strategyFor(navigate("/play/"), ORIGIN)).toBe("unknown-page");
    expect(strategyFor(navigate("/play/extra"), ORIGIN)).toBe("unknown-page");
    expect(strategyFor(navigate("/__offline-not-found"), ORIGIN)).toBe("unknown-page");
  });

  it("waits 3 s for the network before it serves a cached page", () => {
    expect(PAGE_TIMEOUT_MS).toBe(3000);
  });
});

describe("strategyFor: static files", () => {
  it("serves hashed /_next/static files cache first", () => {
    expect(strategyFor(request("/_next/static/chunks/2nmwala9epd-b.js"), ORIGIN)).toBe("static");
    expect(strategyFor(request("/_next/static/chunks/1c8ovh-3ao8z6.css", { mode: "cors" }), ORIGIN)).toBe("static");
    expect(strategyFor(request("/_next/static/media/overpass_600-s.p.2bbaok-qso76f.woff2", { mode: "cors" }), ORIGIN)).toBe("static");
  });

  it("serves the icons and the manifest cache first, also with the hash query the HTML gives them", () => {
    for (const path of [
      "/icon.svg",
      "/icon.svg?icon.31fns5a0b7277.svg",
      "/apple-icon.png?apple-icon.1rqb135id39sj.png",
      "/icon-192.png",
      "/icon-512.png",
      "/manifest.webmanifest",
    ]) {
      expect(strategyFor(request(path), ORIGIN), path).toBe("static");
    }
  });
});

describe("strategyFor: left to the network", () => {
  it("passes deck data, also when it is opened as a page", () => {
    expect(strategyFor(request("/decks/index.json", { mode: "cors" }), ORIGIN)).toBe("pass");
    expect(strategyFor(request("/decks/aws-clf-c02.json?v=63acac4acc4a6213", { mode: "cors" }), ORIGIN)).toBe("pass");
    expect(strategyFor(navigate("/decks/index.json"), ORIGIN)).toBe("pass");
  });

  it("passes the worker's own script", () => {
    expect(strategyFor(request("/sw.js"), ORIGIN)).toBe("pass");
    expect(strategyFor(navigate("/sw.js"), ORIGIN)).toBe("pass");
  });

  it("passes a React Server Components request, by its _rsc query or its RSC header", () => {
    expect(strategyFor(request("/play?_rsc=QLBdCDjfpGkLRHBX", { mode: "cors" }), ORIGIN)).toBe("pass");
    expect(strategyFor(request("/?_rsc=QcbQXlok0Dzyyx9o", { mode: "cors" }), ORIGIN)).toBe("pass");
    expect(strategyFor(request("/play", { mode: "cors", headers: { RSC: "1" } }), ORIGIN)).toBe("pass");
    expect(strategyFor(request("/", { mode: "cors", headers: { rsc: "1", "next-router-prefetch": "1" } }), ORIGIN)).toBe("pass");
    expect(strategyFor(request("/play?_rsc=abc", { mode: "navigate" }), ORIGIN)).toBe("pass");
  });

  it("passes other origins, also for their pages and their static files", () => {
    expect(strategyFor(navigate("https://other.example/"), ORIGIN)).toBe("pass");
    expect(strategyFor(request("https://cdn.example/_next/static/chunks/a.js"), ORIGIN)).toBe("pass");
    expect(strategyFor(request("http://truthy.example/_next/static/chunks/a.js"), ORIGIN)).toBe("pass");
    expect(strategyFor(request("https://truthy.example:8443/icon.svg"), ORIGIN)).toBe("pass");
  });

  it("passes every method but GET", () => {
    for (const method of ["POST", "HEAD", "PUT", "DELETE", "OPTIONS"]) {
      expect(strategyFor(request("/_next/static/chunks/a.js", { method }), ORIGIN), method).toBe("pass");
      expect(strategyFor(request("/", { method, mode: "navigate" }), ORIGIN), method).toBe("pass");
    }
  });

  it("passes any other same-origin request that is not a page", () => {
    expect(strategyFor(request("/", { mode: "cors" }), ORIGIN)).toBe("pass");
    expect(strategyFor(request("/play", { mode: "same-origin" }), ORIGIN)).toBe("pass");
    expect(strategyFor(request("/favicon.ico"), ORIGIN)).toBe("pass");
    expect(strategyFor(request("/_next/image?url=x"), ORIGIN)).toBe("pass");
    expect(strategyFor(request("/icon-1024.png"), ORIGIN)).toBe("pass");
  });

  it("passes a request whose URL cannot be read", () => {
    expect(strategyFor({ url: "not a url", method: "GET", mode: "navigate", headers: new Headers() }, ORIGIN)).toBe("pass");
  });
});
