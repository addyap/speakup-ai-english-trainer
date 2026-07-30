import type { Language, TranslationKeys } from "./types";
import English from "./locales/English";

export type { Language, TranslationKeys } from "./types";

export const LANGUAGES: Language[] = [
  "English",
  "French",
  "Spanish",
  "German",
  "Italian",
  "Portuguese",
  "Russian",
  "Arabic",
  "Chinese",
  "Japanese",
  "Polish",
  "Ukrainian",
];

export const LANGUAGE_NATIVE_NAMES: Record<Language, string> = {
  English: "English",
  French: "Français",
  Spanish: "Español",
  German: "Deutsch",
  Italian: "Italiano",
  Portuguese: "Português",
  Russian: "Русский",
  Arabic: "العربية",
  Chinese: "中文",
  Japanese: "日本語",
  Polish: "Polski",
  Ukrainian: "Українська",
};

export const LANGUAGE_CODES: Record<Language, string> = {
  English: "en-US",
  French: "fr-FR",
  Spanish: "es-ES",
  German: "de-DE",
  Italian: "it-IT",
  Portuguese: "pt-PT",
  Russian: "ru-RU",
  Arabic: "ar-SA",
  Chinese: "zh-CN",
  Japanese: "ja-JP",
  Polish: "pl-PL",
  Ukrainian: "uk-UA",
};

// ─── Lazy-loaded translations ────────────────────────────────────────────────
// Only English ships in the main bundle; every other language is a separate
// chunk fetched on demand (ensureLanguage). Until a chunk resolves, t() falls
// back to English — so the UI is never blank and never throws, it just shows
// English for the ~1 network round-trip before the localized strings arrive.
const loaders: Record<Language, () => Promise<{ default: TranslationKeys }>> = {
  English: () => Promise.resolve({ default: English }),
  French: () => import("./locales/French"),
  Spanish: () => import("./locales/Spanish"),
  German: () => import("./locales/German"),
  Italian: () => import("./locales/Italian"),
  Portuguese: () => import("./locales/Portuguese"),
  Russian: () => import("./locales/Russian"),
  Arabic: () => import("./locales/Arabic"),
  Chinese: () => import("./locales/Chinese"),
  Japanese: () => import("./locales/Japanese"),
  Polish: () => import("./locales/Polish"),
  Ukrainian: () => import("./locales/Ukrainian"),
};

const cache: Partial<Record<Language, TranslationKeys>> = { English };

let version = 0;
const listeners = new Set<() => void>();

/** Subscribe to "a language finished loading" (for useSyncExternalStore). */
export function subscribeI18n(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
export function getI18nVersion(): number {
  return version;
}

/** Load a language's chunk if not already cached; resolves when ready. */
export function ensureLanguage(language: Language): Promise<void> {
  if (cache[language] || !loaders[language]) return Promise.resolve();
  return loaders[language]()
    .then((mod) => {
      cache[language] = mod.default;
      version++;
      listeners.forEach((l) => l());
    })
    .catch(() => {
      /* keep English fallback — better a English label than a crash */
    });
}

export function getTranslations(language: Language): TranslationKeys {
  return cache[language] ?? English;
}

export function t(language: Language, key: keyof TranslationKeys): string {
  return (cache[language] ?? English)[key] ?? key;
}
