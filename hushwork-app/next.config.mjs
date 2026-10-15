import path from "node:path";
import { fileURLToPath } from "node:url";

// This folder is the project root. Saying so explicitly stops Next.js from guessing based on the
// older package.json that sits two folders up.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
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
