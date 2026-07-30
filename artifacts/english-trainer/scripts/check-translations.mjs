#!/usr/bin/env node
// Pure-Node i18n completeness check — no esbuild/vite, so it runs anywhere
// (locally on macOS and in CI). The TypeScript `TranslationKeys` type already
// forces every language chunk to declare every key at build time; this adds the
// two guarantees types can't express: key PARITY across all 12 languages and
// that no value was left EMPTY (a "" would type-check but ship a blank string).
import { readFile } from "node:fs/promises";

const LOCALES = new URL("../src/i18n/locales/", import.meta.url);
const LANGS = [
  "English", "French", "Spanish", "German", "Italian", "Portuguese",
  "Russian", "Arabic", "Chinese", "Japanese", "Polish", "Ukrainian",
];

const keysByLang = {};
const emptyByLang = {};

for (const lang of LANGS) {
  let src;
  try {
    src = await readFile(new URL(`${lang}.ts`, LOCALES), "utf8");
  } catch {
    console.error(`✗ missing locale file: ${lang}.ts`);
    process.exit(1);
  }
  const keys = new Set();
  const empties = [];
  for (const line of src.split("\n")) {
    const m = line.match(/^ {4}(\w+):\s*"(.*)",?\s*$/);
    if (!m) continue;
    keys.add(m[1]);
    if (m[2].trim() === "") empties.push(m[1]);
  }
  keysByLang[lang] = keys;
  emptyByLang[lang] = empties;
}

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
