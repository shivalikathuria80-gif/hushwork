// Lets the tests load the app's SERVER code outside Next.js: it understands the "@/" shortcut for this project's folder and replaces the few
// Next.js-only modules with harmless stand-ins (nothing here is used by the real app). Loaded by scripts/test-hooks.mjs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const stand = (code) => ({ url: `data:text/javascript,${encodeURIComponent(code)}`, shortCircuit: true });

const STAND_INS = {
  "server-only": "export {};",
  "next/cache": "export const revalidatePath = () => {}; export const io = async () => {};",
  "next/headers": "export const headers = async () => new Map(); export const cookies = async () => ({ getAll: () => [], set() {} });",
  "next/navigation": "export const redirect = (to) => { throw new Error('redirect:' + to); }; export const notFound = () => { throw new Error('notFound'); }; export const unstable_rethrow = (e) => { throw e; };",
};

export async function resolve(specifier, context, next) {
  if (Object.hasOwn(STAND_INS, specifier)) return stand(STAND_INS[specifier]);
  if (specifier.startsWith("@/")) {
    const base = path.join(root, specifier.slice(2));
    for (const candidate of [base, `${base}.js`, `${base}.mjs`, path.join(base, "index.js")]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }
  }
  return next(specifier, context);
}
