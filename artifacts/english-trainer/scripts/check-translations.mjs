#!/usr/bin/env node
// Pure-Node i18n completeness check — no esbuild/vite, so it runs anywhere
// (locally on macOS and in CI). The TypeScript `TranslationKeys` type already
// forces every language to declare every key at build time; this adds the two
// guarantees types can't express: key PARITY across all 12 languages and that
// no value was left EMPTY (a "" would type-check but ship a blank string).
import { readFile } from "node:fs/promises";

const FILE = new URL("../src/i18n/translations.ts", import.meta.url);
const LANGS = [
  "English", "French", "Spanish", "German", "Italian", "Portuguese",
  "Russian", "Arabic", "Chinese", "Japanese", "Polish", "Ukrainian",
];

const src = await readFile(FILE, "utf8");
const lines = src.split("\n");

// Locate each language block opener: `  <Language>: {`
const openers = {};
lines.forEach((line, i) => {
  const m = line.match(/^ {2}([A-Z][a-zA-Z]+): \{$/);
  if (m && LANGS.includes(m[1])) openers[m[1]] = i;
});

const missingBlocks = LANGS.filter((l) => openers[l] === undefined);
if (missingBlocks.length) {
  console.error(`✗ missing language block(s): ${missingBlocks.join(", ")}`);
  process.exit(1);
}

// Collect key→isEmpty for each block (from its opener to the next block / end).
const sorted = LANGS.slice().sort((a, b) => openers[a] - openers[b]);
const keysByLang = {};
const emptyByLang = {};
sorted.forEach((lang, idx) => {
  const start = openers[lang] + 1;
  const end = idx + 1 < sorted.length ? openers[sorted[idx + 1]] : lines.length;
  const keys = new Set();
  const empties = [];
  for (let i = start; i < end; i++) {
    const km = lines[i].match(/^ {4}(\w+):\s*"(.*)",?\s*$/);
    if (!km) continue;
    keys.add(km[1]);
    if (km[2].trim() === "") empties.push(km[1]);
  }
  keysByLang[lang] = keys;
  emptyByLang[lang] = empties;
});

// English is the reference key set.
const ref = keysByLang.English;
let failed = false;

for (const lang of LANGS) {
  const keys = keysByLang[lang];
  const missing = [...ref].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !ref.has(k));
  if (missing.length) { console.error(`✗ ${lang}: missing ${missing.length} key(s): ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}`); failed = true; }
  if (extra.length) { console.error(`✗ ${lang}: ${extra.length} extra key(s) not in English: ${extra.slice(0, 8).join(", ")}`); failed = true; }
  if (emptyByLang[lang].length) { console.error(`✗ ${lang}: ${emptyByLang[lang].length} empty value(s): ${emptyByLang[lang].slice(0, 8).join(", ")}`); failed = true; }
}

if (failed) {
  console.error("\ni18n check FAILED.");
  process.exit(1);
}
console.log(`✓ i18n OK — ${LANGS.length} languages, ${ref.size} keys each, no empty values.`);
