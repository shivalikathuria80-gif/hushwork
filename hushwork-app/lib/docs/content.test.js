import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DOC_PAGES, DOC_GROUPS, findDocPage, neighbours } from "./pages.js";
import { parseDoc } from "./markdown.js";
import nextConfig from "../../next.config.mjs";

const FOLDER = path.join(process.cwd(), "content", "docs");
const read = (slug) => readFileSync(path.join(FOLDER, `${slug}.md`), "utf8");

test("docs: the page list has no repeated slugs and findDocPage only knows the list", () => {
  const slugs = DOC_PAGES.map((page) => page.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.ok(DOC_GROUPS.every((group) => group.pages.length > 0));
  assert.equal(findDocPage("welcome").title, "What is Hushwork?");
  for (const bad of ["__proto__", "constructor", "../README", "", null, undefined, 5]) assert.equal(findDocPage(bad), null, String(bad));
  assert.equal(neighbours(slugs[0]).previous, null);
  assert.equal(neighbours(slugs.at(-1)).next, null);
  assert.equal(neighbours(slugs[1]).previous.slug, slugs[0]);
});

test("docs: every page in the list has a file, and every file is in the list", () => {
  const files = readdirSync(FOLDER).filter((name) => name.endsWith(".md")).map((name) => name.slice(0, -3)).sort();
  assert.deepEqual(files, DOC_PAGES.map((page) => page.slug).sort());
});

test("docs: each file starts with its own title, has a short plain summary, and a real body", () => {
  for (const page of DOC_PAGES) {
    const doc = parseDoc(read(page.slug));
    assert.equal(doc.title, page.title, `${page.slug}: the "# " title must match lib/docs/pages.js`);
    assert.ok(doc.summary.length >= 20 && doc.summary.length <= 200, `${page.slug}: summary is ${doc.summary.length} characters`);
    assert.ok(doc.blocks.length >= 4, `${page.slug}: too short`);
  }
});

test("docs: every link to another docs page points at a page that exists, and an anchor points at a real heading", () => {
  const known = new Map(DOC_PAGES.map((page) => [page.slug, new Set(parseDoc(read(page.slug)).blocks.filter((b) => b.type === "heading").map((b) => b.id))]));
  for (const page of DOC_PAGES) {
    for (const match of read(page.slug).matchAll(/\]\((\/docs\/([a-z0-9-]+)(?:#([a-z0-9-]+))?)\)/g)) {
      assert.ok(known.has(match[2]), `${page.slug}: link ${match[1]} goes nowhere`);
      if (match[3]) assert.ok(known.get(match[2]).has(match[3]), `${page.slug}: link ${match[1]} has no such heading`);
    }
    for (const match of read(page.slug).matchAll(/\]\(([^)]*)\)/g)) {
      assert.ok(/^(\/docs\/|https:\/\/|#)/.test(match[1]), `${page.slug}: odd link ${match[1]}`);
    }
  }
});

test("docs: no raw HTML, no images, and nothing that looks like a key or password", () => {
  for (const page of DOC_PAGES) {
    const text = read(page.slug);
    const prose = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");
    assert.ok(!/<\/?[a-zA-Z][^>]*>/.test(prose), `${page.slug}: raw HTML found`);
    assert.ok(!/!\[[^\]]*\]\(/.test(text), `${page.slug}: images are not supported`);
    assert.ok(!/(gsk_|sk_live_|sk_test_|ak_)[A-Za-z0-9]{12,}|eyJ[A-Za-z0-9_-]{20,}|-----BEGIN|service_role\s*[:=]/.test(text), `${page.slug}: looks like a secret`);
  }
});

test("docs: the docs. host is rewritten to /docs, and files the pages need are left alone", async () => {
  const { beforeFiles } = await nextConfig.rewrites();
  assert.equal(beforeFiles.length, 2);
  for (const rule of beforeFiles) assert.deepEqual(rule.has, [{ type: "host", value: "docs\\..*" }]);
  const hostRegex = new RegExp(`^${beforeFiles[0].has[0].value}$`);
  assert.ok(hostRegex.test("docs.hushwork.in") && hostRegex.test("docs.localhost"));
  assert.ok(!hostRegex.test("hushwork.in") && !hostRegex.test("www.hushwork.in") && !hostRegex.test("mydocs.hushwork.in"));
  assert.deepEqual([beforeFiles[0].source, beforeFiles[0].destination], ["/", "/docs"]);
  const inner = /^\/:path\((.*)\)$/.exec(beforeFiles[1].source)[1];
  const pathRegex = new RegExp(`^${inner}$`);
  for (const yes of ["welcome", "quick-start", "privacy"]) assert.ok(pathRegex.test(yes), yes);
  for (const no of ["_next/static/chunk.js", "docs", "docs/welcome", "api/health", "icon.svg", "opengraph-image", "twitter-image"]) assert.ok(!pathRegex.test(no), no);
  assert.equal(beforeFiles[1].destination, "/docs/:path");
});
