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
];

const nextConfig = {
  cacheComponents: true,
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
