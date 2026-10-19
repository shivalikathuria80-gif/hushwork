// A careful "ask this web address" (a read-only GET). Hushwork's SERVER makes the call, and the person chooses the
// address, so this file is where the danger is: someone could type an address that points back inside the server's own
// network (http://localhost, a cloud "metadata" address, a home router) to read things only the server can reach.
// That attack is called SSRF (server-side request forgery). The defences, all tested in http.test.js:
//   1. checkRequestUrl: https only, a real domain name (no numbers like 10.0.0.1), no password in the address, no odd port.
//   2. the CONNECTION itself is checked: the name is looked up and every answer must be a public address. The check runs
//      at the moment of connecting, so a name that changes its answer later cannot sneak past.
//   3. redirects are never followed (a redirect could point anywhere), 8 seconds at most, 64 KB at most, GET only,
//      no cookies or secrets sent, and only a short text excerpt is kept.
import https from "node:https";
import dns from "node:dns";
import net from "node:net";

export const HTTP_FAILED = {
  blocked: "That address points to a private or internal place, so it was not contacted.",
  network: "Could not reach that address. Check it and try again.",
  slow: "That address took too long to answer, so it was stopped.",
};
export const URL_MAX = 120;
const TIMEOUT_MS = 8000;
const MAX_BYTES = 65536;
const EXCERPT_CHARS = 400;

// ---- 1. is this address text acceptable? Returns { value: "https://..." } or { error: "plain sentence" } ----
export function checkRequestUrl(raw) {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return { error: "Enter a web address." };
  if (text.length > URL_MAX) return { error: `Use ${URL_MAX} characters or fewer.` };
  let url;
  try { url = new URL(text); } catch { return { error: "That does not look like a web address. It should start with https://" }; }
  if (url.protocol !== "https:") return { error: "Only https:// addresses are allowed." };
  if (url.username || url.password) return { error: "Do not put a name or password inside the address." };
  if (url.port) return { error: "Only the normal port is allowed (leave out the :number)." };
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (net.isIP(host) || host.startsWith("[") || !host.includes(".") || /\.(local|localhost|internal|lan|home|corp|intranet)$/.test(host) || host === "localhost") {
    return { error: HTTP_FAILED.blocked };
  }
  return { value: url.href };
}

// ---- 2. is this numeric address a public one? ----
const ipv4Bytes = (address) => address.split(".").map(Number);
function ipv4IsPublic([a, b, c]) {
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false; // this-network, private, loopback, multicast, reserved
  if (a === 100 && b >= 64 && b <= 127) return false; // shared address space (carrier-grade NAT)
  if (a === 169 && b === 254) return false; // link-local, includes the cloud metadata address 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return false; // private
  if (a === 192 && b === 168) return false; // private
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false; // special / documentation
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false; // benchmarking / documentation
  if (a === 203 && b === 0 && c === 113) return false; // documentation
  return true;
}
// Turns "2001:db8::1" or "::ffff:1.2.3.4" into 16 numbers, or null if it cannot be read.
function ipv6Bytes(address) {
  let text = address.toLowerCase().split("%")[0];
  const tail = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    const [a, b, c, d] = ipv4Bytes(tail[1]);
    text = `${text.slice(0, -tail[1].length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...rest];
  const bytes = [];
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    const value = parseInt(group, 16);
    bytes.push(value >> 8, value & 255);
  }
  return bytes.length === 16 ? bytes : null;
}
export function isPublicIp(address) {
  if (typeof address !== "string") return false;
  if (net.isIPv4(address)) return ipv4IsPublic(ipv4Bytes(address));
  if (!net.isIPv6(address)) return false;
  const b = ipv6Bytes(address);
  if (!b) return false;
  const mapped = b.slice(0, 10).every((x) => x === 0) && b[10] === 255 && b[11] === 255; // ::ffff:a.b.c.d is an IPv4 address
  if (mapped) return ipv4IsPublic(b.slice(12));
  if ((b[0] & 0xe0) !== 0x20) return false; // only 2000::/3 (global unicast) can be public
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return false; // documentation 2001:db8::/32
  if (b[0] === 0x20 && b[1] === 0x02) return false; // 6to4: embeds an IPv4 address
  return true;
}

// ---- 3. make the call ----
// `lookup` and `request` can be replaced so tests never touch the network. Returns { ok: true, status, type, excerpt }
// or { ok: false, error }.
export function fetchPublic(href, { lookup = dns.lookup, request = https.request, timeoutMs = TIMEOUT_MS, excerptChars = EXCERPT_CHARS } = {}) {
  const checked = checkRequestUrl(href);
  if (checked.error) return Promise.resolve({ ok: false, error: checked.error });

  // Used by the connection itself: look the name up and refuse anything that is not public.
  const guardedLookup = (hostname, options, callback) => {
    lookup(hostname, { all: true }, (error, addresses) => {
      if (error) return callback(error);
      const list = Array.isArray(addresses) ? addresses : [];
      if (list.length === 0 || !list.every((entry) => isPublicIp(entry.address))) return callback(new Error("blocked"));
      return options?.all ? callback(null, list) : callback(null, list[0].address, list[0].family);
    });
  };

  return new Promise((resolve) => {
    let finished = false;
    let req;
    const timer = setTimeout(() => { done({ ok: false, error: HTTP_FAILED.slow }); req?.destroy(); }, timeoutMs);
    function done(result) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(result);
    }
    try {
      req = request(checked.value, {
        method: "GET", lookup: guardedLookup, agent: false,
        headers: { "user-agent": "Hushwork/1.0 (read-only check)", accept: "text/*, application/json;q=0.9, */*;q=0.1" },
      }, (res) => {
        const chunks = [];
        let size = 0;
        const finish = () => {
          const type = String(res.headers?.["content-type"] ?? "").split(";")[0].trim().slice(0, 60);
          const readable = /^(text\/|application\/(json|xml|[\w.+-]*\+(json|xml)))/.test(type);
          const excerpt = readable ? Buffer.concat(chunks).toString("utf8").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, excerptChars) : "";
          done({ ok: true, status: Number(res.statusCode) || 0, type, excerpt });
        };
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size <= MAX_BYTES) chunks.push(chunk);
          else { res.destroy(); finish(); }
        });
        res.on("end", finish);
        res.on("error", () => done({ ok: false, error: HTTP_FAILED.network }));
      });
      req.on("error", (error) => done({ ok: false, error: error?.message === "blocked" ? HTTP_FAILED.blocked : HTTP_FAILED.network }));
      req.end();
    } catch {
      done({ ok: false, error: HTTP_FAILED.network });
    }
  });
}
