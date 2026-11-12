import "server-only";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";
import type { Readable } from "node:stream";

const UA = "BisibilityAuditBot/1.0 (+site audit; respects robots.txt)";
const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 5;

export type FetchOptions = {
  timeoutMs?: number;
  /** Tests only: allow loopback / private targets. Never set from user input. */
  allowPrivate?: boolean;
};

export type FetchedPage = {
  /** Final URL after redirects */
  url: string;
  status: number;
  contentType: string;
  body: string;
  ms: number;
};

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (net.isIPv6(address)) {
    const lower = address.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return lower === "::" || lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || /^fe[89ab]/.test(lower) || lower.startsWith("ff");
  }
  return true;
}

/** dns.lookup that refuses non-public addresses, so the check applies to the address actually connected to. */
function guardedLookup(allowPrivate: boolean): net.LookupFunction {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err, "", 4);
      const list = addresses as dns.LookupAddress[];
      const blocked = !allowPrivate && list.some((a) => isPrivateAddress(a.address));
      if (blocked || list.length === 0) return callback(new Error("Target resolves to a non-public address"), "", 4);
      if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
      callback(null, list[0].address, list[0].family);
    });
  };
}

function once(url: URL, opts: FetchOptions): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup(Boolean(opts.allowPrivate)),
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8", "accept-encoding": "gzip, deflate, br" },
        timeout: opts.timeoutMs ?? 10_000,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const type = String(res.headers["content-type"] ?? "");
        // Don't download bodies we will not read
        if ((status >= 300 && status < 400) || (type && !/text|xml|json/i.test(type))) {
          res.resume();
          return resolve({ status, headers: res.headers, body: "" });
        }
        let stream: Readable = res;
        const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
        if (enc === "gzip") stream = res.pipe(zlib.createGunzip());
        else if (enc === "deflate") stream = res.pipe(zlib.createInflate());
        else if (enc === "br") stream = res.pipe(zlib.createBrotliDecompress());
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) {
            req.destroy();
            return resolve({ status, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") });
          }
          chunks.push(c);
        });
        stream.on("end", () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
        stream.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    req.on("error", reject);
    req.end();
  });
}

/** GET with manual, re-validated redirects. Throws on network errors. */
export async function fetchPage(startUrl: string, opts: FetchOptions = {}): Promise<FetchedPage> {
  const started = Date.now();
  let url = new URL(startUrl);
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Unsupported protocol");
    if (net.isIP(url.hostname.replace(/^\[|\]$/g, "")) && !opts.allowPrivate && isPrivateAddress(url.hostname.replace(/^\[|\]$/g, ""))) {
      throw new Error("Target is a non-public address");
    }
    const res = await once(url, opts);
    const location = res.headers.location;
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    return { url: url.toString(), status: res.status, contentType: String(res.headers["content-type"] ?? ""), body: res.body, ms: Date.now() - started };
  }
  throw new Error("Too many redirects");
}
