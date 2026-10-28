import path from "node:path";
import { fileURLToPath } from "node:url";

// This folder is the project root. Saying so explicitly stops Next.js from guessing based on the
// older package.json that sits two folders up.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
// Browser safety headers sent with every page. They only switch OFF things the app never uses (being shown inside another site's frame,
// guessing file types, camera and microphone) and shorten what is told to other sites when a link is followed.
const SAFETY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Always use https (browsers ignore this on http://localhost). No includeSubDomains or preload: those cannot be taken back easily.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  // A safe slice of a content policy: no framing by other sites, no plugins, no changing the page's base address. A full script policy is not
  // set because Next.js needs inline scripts; adding one safely needs per-request nonces (see docs/deploy.md).
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
];

// docs.hushwork.in is this same app: a request whose host starts with "docs." is rewritten to the /docs pages (the address in the browser stays the same).
// Files the pages need (/_next/..., the icon, the link-preview images, /api) and /docs itself are left alone. The pages also work at /docs on any host.
const DOCS_HOST = [{ type: "host", value: "docs\\..*" }];

const nextConfig = {
  cacheComponents: true,
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", has: DOCS_HOST, destination: "/docs" },
        { source: "/:path((?!_next|docs|api|icon\\.svg|opengraph-image|twitter-image).+)", has: DOCS_HOST, destination: "/docs/:path" },
      ],
    };
  },
  async headers() {
    return [{ source: "/:path*", headers: SAFETY_HEADERS }];
  },
  partialPrefetching: true,
  turbopack: {
    root: projectRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
