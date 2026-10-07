// A proxy in front of the production server that the offline specs can switch: offline it drops every connection,
// as a phone without a network does, and after a release it serves sw.js with a new version string. Playwright's
// context.setOffline cannot stand in for it: in Playwright 1.63's WebKit an offline context fails every page
// request before the service worker sees it, and a changed sw.js cannot come from page.route or context.route,
// since neither engine routes the worker's update check through them (docs/testing.md, "Offline and updates").
import { createServer, request as forward, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo, Socket } from "node:net";

/** The network between the browser and the production server, as one test owns it. */
export interface NetProxy {
  /** The proxy's own address, http://localhost:<port>: the specs' baseURL. */
  readonly url: string;
  /** Offline drops every open connection and every new one; online passes them again. */
  setOffline(offline: boolean): void;
  /** From now on sw.js is served with every `from` replaced by `to`: the browser sees a new release. */
  release(from: string, to: string): void;
  close(): Promise<void>;
}

// Headers that would describe the original bytes of sw.js, or let the server answer 304 for them.
const STALE = new Set(["content-length", "etag", "last-modified", "content-encoding", "transfer-encoding"]);

function freshHeaders(headers: IncomingHttpHeaders): IncomingHttpHeaders {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !STALE.has(name)));
}

/** Starts a proxy to `upstream` (for example http://localhost:3100) on a free port. */
export async function startProxy(upstream: string): Promise<NetProxy> {
  const target = new URL(upstream);
  const sockets = new Set<Socket>();
  let offline = false;
  let swRelease: { from: string; to: string } | null = null;

  const server = createServer((request, response) => {
    if (offline) {
      request.socket.destroy();
      return;
    }
    const path = request.url ?? "/";
    const rewrite = swRelease !== null && new URL(path, target).pathname === "/sw.js" ? swRelease : null;
    const headers: IncomingHttpHeaders = { ...request.headers, host: target.host };
    if (rewrite) {
      delete headers["accept-encoding"];
      delete headers["if-none-match"];
      delete headers["if-modified-since"];
    }
    const outgoing = forward({ hostname: target.hostname, port: target.port, method: request.method, path, headers }, (answer) => {
      if (!rewrite) {
        response.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(response);
        return;
      }
      const chunks: Buffer[] = [];
      answer.on("data", (chunk: Buffer) => chunks.push(chunk));
      answer.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8").split(rewrite.from).join(rewrite.to);
        response.writeHead(answer.statusCode ?? 502, { ...freshHeaders(answer.headers), "content-length": String(Buffer.byteLength(body)) });
        response.end(body);
      });
    });
    outgoing.on("error", () => response.destroy());
    request.pipe(outgoing);
  });

  server.on("connection", (socket: Socket) => {
    if (offline) {
      socket.destroy();
      return;
    }
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://localhost:${port}`,
    setOffline(value) {
      offline = value;
      if (value) for (const socket of sockets) socket.destroy();
    },
    release(from, to) {
      swRelease = { from, to };
    },
    close() {
      for (const socket of sockets) socket.destroy();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
