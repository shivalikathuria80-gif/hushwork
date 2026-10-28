import { readFile } from "node:fs/promises";
import path from "node:path";
import { findDocPage } from "./pages.js";
import { parseDoc } from "./markdown.js";

// Reads one docs page (content/docs/<slug>.md) and parses it. The slug is checked against the page list first, so a made-up address can never
// reach the file system. Returns null when the page is not in the list or its file is missing.
const FOLDER = path.join(process.cwd(), "content", "docs");

export async function loadDoc(slug) {
  "use cache"; // the files only change when the site is redeployed, so Next can read them once and keep the result
  const page = findDocPage(slug);
  if (!page) return null;
  try {
    const source = await readFile(path.join(FOLDER, `${page.slug}.md`), "utf8");
    return { ...page, ...parseDoc(source) };
  } catch {
    return null;
  }
}
