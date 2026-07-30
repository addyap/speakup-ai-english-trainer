import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp, type Mode, type Scenario, type Level } from "@/lib/AppContext";
import { LANGUAGES, LANGUAGE_NATIVE_NAMES, type Language, t } from "@/i18n/translations";
import { getLearnerProfile } from "@/lib/learnerMemory";
import { trackEvent } from "@/lib/analytics";

// ─── Useful-phrases study panel (dynamic, cached per scenario+level+language) ──
type Phrase = { en: string; gloss: string };
const phraseCache = new Map<string, Phrase[]>();

async function fetchPhrases(scenario: string, level: string, feedbackLanguage: string): Promise<Phrase[]> {
  const res = await fetch("/api/trainer/phrases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario, level, feedbackLanguage }),
  });
  if (!res.ok) throw new Error(`Phrases HTTP ${res.status}`);
  const data = (await res.json()) as { phrases?: Phrase[] };
  return Array.isArray(data.phrases) ? data.phrases : [];
}

// ─── Featured 8 scenarios ─────────────────────────────────────────────────────
const FEATURED: { value: Scenario; emoji: string; labelKey: string; descKey: string }[] = [
  { value: "small_talk",           emoji: "☕", labelKey: "smallTalk",           descKey: "smallTalkDesc" },
  { value: "job_interview",        emoji: "💼", labelKey: "jobInterview",        descKey: "jobInterviewDesc" },
  { value: "travel",               emoji: "✈️", labelKey: "travel",              descKey: "travelDesc" },
  { value: "luxury_boutique",      emoji: "💎", labelKey: "luxuryBoutique",      descKey: "luxuryBoutiqueDesc" },
  { value: "journalist_interview", emoji: "🎙️", labelKey: "journalistInterview", descKey: "journalistInterviewDesc" },
  { value: "networking",           emoji: "🤝", labelKey: "networking",          descKey: "networkingDesc" },
  { value: "executive_assistant",  emoji: "🗂️", labelKey: "executiveAssistant",  descKey: "executiveAssistantDesc" },
  { value: "medical_secretary",    emoji: "🩺", labelKey: "medicalSecretary",    descKey: "medicalSecretaryDesc" },
];

// ─── All remaining scenarios (30 total minus featured 8) ─────────────────────
const MORE_SCENARIOS: { value: Scenario; emoji: string; labelKey: string }[] = [
  { value: "business_meeting",  emoji: "📊", labelKey: "businessMeeting" },
  { value: "phone_call",        emoji: "📞", labelKey: "phoneCall" },
  { value: "trade_fair",        emoji: "🏛️", labelKey: "tradeFair" },
  { value: "legal",             emoji: "⚖️", labelKey: "legal" },
  { value: "banking",           emoji: "🏦", labelKey: "banking" },
  { value: "academic",          emoji: "🎓", labelKey: "academic" },
  { value: "customer_service",  emoji: "🎯", labelKey: "customerService" },
  { value: "tech_support",      emoji: "💻", labelKey: "techSupport" },
  { value: "news_debate",       emoji: "📰", labelKey: "newsDebate" },
  { value: "sports",            emoji: "🏋️", labelKey: "sports" },
  { value: "entertainment",     emoji: "🎬", labelKey: "entertainment" },
  { value: "dating",            emoji: "💬", labelKey: "dating" },
  { value: "airport",           emoji: "🛫", labelKey: "airport" },
  { value: "hotel",             emoji: "🏨", labelKey: "hotel" },
  { value: "real_estate",       emoji: "🏡", labelKey: "realEstate" },
  { value: "apartment",         emoji: "🏠", labelKey: "apartment" },
  { value: "restaurant",        emoji: "🍽️", labelKey: "restaurant" },
  { value: "shopping",          emoji: "🛍️", labelKey: "shopping" },
  { value: "medical",           emoji: "🏥", labelKey: "medical" },
  { value: "daily_life",        emoji: "🏙️", labelKey: "dailyLife" },
  { value: "emergency",         emoji: "🚨", labelKey: "emergency" },
  { value: "cooking",           emoji: "👨‍🍳", labelKey: "cooking" },
  { value: "salary_negotiation", emoji: "💰", labelKey: "salaryNegotiation" },
  { value: "performance_review", emoji: "📈", labelKey: "performanceReview" },
  { value: "presentation",       emoji: "🎤", labelKey: "presentation" },
  { value: "client_pitch",       emoji: "📣", labelKey: "clientPitch" },
  { value: "border_control",     emoji: "🛂", labelKey: "borderControl" },
  { value: "pharmacy",           emoji: "💊", labelKey: "pharmacy" },
  { value: "admin_office",       emoji: "📋", labelKey: "adminOffice" },
  { value: "formal_complaint",   emoji: "🗣️", labelKey: "formalComplaint" },
];

// ─── Unified, categorised scenario catalogue ─────────────────────────────────
const ALL_SCENARIOS: { value: Scenario; emoji: string; labelKey: string }[] = [
  ...FEATURED.map(({ value, emoji, labelKey }) => ({ value, emoji, labelKey })),
  ...MORE_SCENARIOS,
];

const POPULAR: Scenario[] = FEATURED.map((s) => s.value);

type Category = "work" | "travel" | "everyday" | "services" | "academic";
const CATEGORY_OF: Record<Scenario, Category> = {
  job_interview: "work", business_meeting: "work", networking: "work", salary_negotiation: "work",
  performance_review: "work", presentation: "work", client_pitch: "work", trade_fair: "work",
  executive_assistant: "work", phone_call: "work",
  travel: "travel", airport: "travel", hotel: "travel", border_control: "travel",
  small_talk: "everyday", daily_life: "everyday", restaurant: "everyday", shopping: "everyday",
  cooking: "everyday", dating: "everyday", sports: "everyday", entertainment: "everyday", luxury_boutique: "everyday",
  banking: "services", legal: "services", medical: "services", medical_secretary: "services",
  pharmacy: "services", admin_office: "services", customer_service: "services", tech_support: "services",
  real_estate: "services", apartment: "services", formal_complaint: "services", emergency: "services",
  academic: "academic", news_debate: "academic", journalist_interview: "academic",
};

const CATEGORIES: { key: string; labelKey: string }[] = [
  { key: "popular",  labelKey: "catPopular" },
  { key: "work",     labelKey: "catWork" },
  { key: "travel",   labelKey: "catTravel" },
  { key: "everyday", labelKey: "catEveryday" },
  { key: "services", labelKey: "catServices" },
  { key: "academic", labelKey: "catAcademic" },
];

// ─── Coaches ──────────────────────────────────────────────────────────────────
const COACHES: { value: Mode; emoji: string; labelKey: string; descKey: string; activeClass: string }[] = [
  { value: "practice",  emoji: "🌱", labelKey: "friendlyLabel",  descKey: "practiceDesc",  activeClass: "border-forest/45 bg-forest-soft text-forest" },
  { value: "challenge", emoji: "🔥", labelKey: "demandingLabel", descKey: "challengeDesc", activeClass: "border-coral/45 bg-coral-soft text-coral-dark" },
  { value: "exam",      emoji: "🎓", labelKey: "examinerLabel",  descKey: "examDesc",      activeClass: "border-[#b98a2e]/45 bg-[#f6edda] text-[#8a6416]" },
  { value: "debate",    emoji: "🥊", labelKey: "debateLabel",    descKey: "debateDesc",    activeClass: "border-[#9a3b4d]/45 bg-[#f6e5e8] text-[#8a3346]" },
  { value: "storytelling", emoji: "📖", labelKey: "storyLabel",  descKey: "storyDesc",     activeClass: "border-[#5b5aa6]/45 bg-[#eae9f4] text-[#4a4a86]" },
];

// ─── Levels ───────────────────────────────────────────────────────────────────
const LEVELS: { value: Level; icon: string; labelKey: string; subKey: string }[] = [
  { value: "auto",         icon: "⚡", labelKey: "auto",         subKey: "autoAdjusts" },
  { value: "beginner",     icon: "A2", labelKey: "beginner",     subKey: "beginnerSub" },
  { value: "intermediate", icon: "B1", labelKey: "intermediate", subKey: "dailyLife" },
  { value: "advanced",     icon: "C1", labelKey: "advanced",     subKey: "advancedSub" },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function SessionSetupView() {
  const {
    interfaceLanguage, feedbackLanguage,
    setInterfaceLanguage, setFeedbackLanguage,
    mode, setMode,
    scenario, setScenario,
    level, setLevel,
    setCurrentView,
    messages, resetSession,
  } = useApp();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("popular");

  // Useful-phrases study panel
  const [phrasesOpen, setPhrasesOpen] = useState(false);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [phrasesLoading, setPhrasesLoading] = useState(false);
  const [phrasesError, setPhrasesError] = useState(false);

  useEffect(() => {
    if (!phrasesOpen) return;
    const key = `${scenario}|${level}|${feedbackLanguage}`;
    const cached = phraseCache.get(key);
    if (cached) {
      setPhrases(cached);
      setPhrasesError(false);
      setPhrasesLoading(false);
      return;
    }
    let cancelled = false;
    setPhrasesLoading(true);
    setPhrasesError(false);
    fetchPhrases(scenario, level, feedbackLanguage)
      .then((p) => { if (cancelled) return; phraseCache.set(key, p); setPhrases(p); })
      .catch(() => { if (!cancelled) setPhrasesError(true); })
      .finally(() => { if (!cancelled) setPhrasesLoading(false); });
    return () => { cancelled = true; };
  }, [phrasesOpen, scenario, level, feedbackLanguage]);

  const handleBegin = () => {
    trackEvent("session_start", { scenario, mode, level, from: "setup" });
    if (messages.length > 0) resetSession();
    setCurrentView("conversation");
  };

  const handleQuickStart = () => {
    trackEvent("session_start", { scenario: "small_talk", mode: "practice", level: "auto", from: "quick" });
    setMode("practice");
    setLevel("auto");
    setScenario("small_talk");
    if (messages.length > 0) resetSession();
    setCurrentView("conversation");
  };

  const hasHistory = getLearnerProfile().totalSessions > 0;
  const tr = (key: string) => t(interfaceLanguage, key as Parameters<typeof t>[1]);

  const q = query.trim().toLowerCase();
  const visibleScenarios = q
    ? ALL_SCENARIOS.filter((s) => tr(s.labelKey).toLowerCase().includes(q) || s.value.replace(/_/g, " ").includes(q))
    : ALL_SCENARIOS.filter((s) => (category === "popular" ? POPULAR.includes(s.value) : CATEGORY_OF[s.value] === category));

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-x-hidden bg-ivory text-ink">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-4xl items-center gap-3 px-5 pt-safe pt-8 pb-5 sm:px-8">
        <button
          onClick={() => setCurrentView("home")}
          aria-label={tr("back")}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-line bg-cream text-ink-soft transition-all hover:text-ink hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="font-serif text-2xl font-semibold leading-tight text-ink">{tr("newSessionTitle")}</h1>
          <p className="mt-0.5 text-sm text-clay">{tr("sessionSetupSub")}</p>
        </div>
        <span className="ml-auto inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-forest/20 bg-forest-soft px-3 py-1 font-mono text-[11px] font-semibold text-forest">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-forest" />
          {tr("freeLaunchBadge")}
        </span>
      </header>

      {/* Body */}
      <div className="mx-auto w-full max-w-4xl flex-1 px-5 pb-40 sm:px-8">
        {!hasHistory && (
          <section className="mb-7">
            <div className="rounded-2xl border border-forest/20 bg-forest-soft p-4">
              <p className="mb-1 text-sm font-semibold text-forest">{tr("freeLaunchBadge")}</p>
              <p className="text-xs leading-relaxed text-ink-soft">{tr("freeLaunchNote")}</p>
              <button type="button" onClick={() => setCurrentView("privacy")} className="mt-2 flex min-h-[36px] items-center text-left text-[11px] leading-relaxed text-clay underline decoration-line underline-offset-2 transition-colors hover:text-ink-soft">
                {tr("privacyNote")}
              </button>
            </div>
          </section>
        )}

        {/* Quick start */}
        <button
          onClick={handleQuickStart}
          className="mb-8 flex w-full items-center gap-3 rounded-2xl border border-coral/30 bg-coral-soft px-4 py-3.5 text-left transition-all hover:border-coral/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40"
        >
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-coral text-lg text-cream">⚡</span>
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold text-coral-dark">{tr("quickStartTitle")}</span>
            <span className="block text-[12px] leading-snug text-ink-soft">{tr("quickStartDesc")}</span>
          </span>
          <svg className="ml-auto h-4 w-4 flex-shrink-0 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
        </button>

        {/* Language */}
        <section className="mb-8 grid gap-4 md:grid-cols-2">
          <div>
            <SectionLabel>{tr("yourLanguage")}</SectionLabel>
            <LangSelect value={interfaceLanguage} onChange={setInterfaceLanguage} label={tr("yourLanguage")} />
          </div>
          <div>
            <SectionLabel>{tr("feedbackTranslationLang")}</SectionLabel>
            <LangSelect value={feedbackLanguage} onChange={setFeedbackLanguage} label={tr("feedbackTranslationLang")} />
          </div>
        </section>

        {/* Coach */}
        <section className="mb-8">
          <SectionLabel>{tr("coachPersona")}</SectionLabel>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
            {COACHES.map(({ value, emoji, labelKey, descKey, activeClass }) => {
              const isActive = mode === value;
              return (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  className={`flex min-h-[84px] flex-col items-center rounded-2xl border px-2 py-3.5 text-center transition-all duration-200 ${
                    isActive ? activeClass : "border-line bg-cream text-ink-soft hover:border-line-strong hover:shadow-sm"
                  }`}
                >
                  <span className="mb-1.5 text-2xl leading-none">{emoji}</span>
                  <p className="text-[13px] font-semibold leading-tight">{tr(labelKey)}</p>
                  <p className="mt-0.5 text-[11px] leading-tight opacity-70">{tr(descKey)}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Scenario picker: search + categories + grid */}
        <section className="mb-8">
          <SectionLabel>{tr("selectScenario")}</SectionLabel>

          {/* Search */}
          <div className="relative mb-3">
            <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-clay" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr("searchScenarios")}
              className="w-full rounded-2xl border border-line bg-cream py-3 pl-10 pr-4 text-sm text-ink placeholder:text-clay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40"
            />
          </div>

          {/* Category chips */}
          {!q && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => {
                const active = category === c.key;
                return (
                  <button
                    key={c.key}
                    onClick={() => setCategory(c.key)}
                    className={`min-h-[36px] rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                      active ? "border-coral/45 bg-coral-soft text-coral-dark" : "border-line bg-cream text-ink-soft hover:border-line-strong hover:text-ink"
                    }`}
                  >
                    {tr(c.labelKey)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Grid */}
          {visibleScenarios.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-clay">{tr("noScenariosFound")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {visibleScenarios.map(({ value, emoji, labelKey }) => {
                const isActive = scenario === value;
                return (
                  <motion.button
                    key={value}
                    onClick={() => setScenario(value)}
                    whileTap={{ scale: 0.97 }}
                    className={`flex min-h-[68px] items-center gap-2.5 rounded-2xl border px-3.5 py-3 text-left transition-all duration-200 ${
                      isActive ? "border-coral/50 bg-coral-soft shadow-sm" : "border-line bg-cream hover:border-line-strong hover:shadow-sm"
                    }`}
                  >
                    <span className="flex-shrink-0 text-xl leading-none">{emoji}</span>
                    <span className={`text-[13px] font-semibold leading-tight ${isActive ? "text-coral-dark" : "text-ink"}`}>{tr(labelKey)}</span>
                    {isActive && <span className="ml-auto h-1.5 w-1.5 flex-shrink-0 rounded-full bg-coral" />}
                  </motion.button>
                );
              })}
            </div>
          )}
        </section>

        {/* Level */}
        <section className="mb-4">
          <SectionLabel>{tr("proficiencyLevel")}</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {LEVELS.map(({ value, icon, labelKey, subKey }) => {
              const isActive = level === value;
              return (
                <button
                  key={value}
                  onClick={() => setLevel(value)}
                  className={`flex min-h-[62px] items-center gap-3 rounded-2xl border p-4 text-left transition-all duration-200 ${
                    isActive ? "border-coral/50 bg-coral-soft" : "border-line bg-cream hover:border-line-strong hover:shadow-sm"
                  }`}
                >
                  <span className={`w-6 flex-shrink-0 text-center font-mono text-xs font-bold ${isActive ? "text-coral" : "text-clay"}`}>{icon}</span>
                  <div>
                    <p className={`text-[13px] font-semibold leading-tight ${isActive ? "text-coral-dark" : "text-ink"}`}>{tr(labelKey)}</p>
                    <p className="mt-0.5 text-[11px] leading-tight text-clay">{tr(subKey)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Useful phrases (study before you start) */}
        <section className="mb-4">
          <button
            onClick={() => setPhrasesOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl border border-line bg-cream px-4 py-3.5 text-left transition-colors hover:border-line-strong"
            aria-expanded={phrasesOpen}
          >
            <span className="flex items-center gap-2.5">
              <span className="text-lg leading-none">💬</span>
              <span className="text-[13px] font-semibold text-ink">{tr("usefulPhrasesTitle")}</span>
            </span>
            <svg className={`h-4 w-4 flex-shrink-0 text-clay transition-transform ${phrasesOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <AnimatePresence>
            {phrasesOpen && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                <div className="pt-2">
                  {phrasesLoading && (
                    <div className="flex items-center gap-2 px-1 py-3 text-[12px] text-clay">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line-strong border-t-coral" />
                      {tr("phrasesLoading")}
                    </div>
                  )}
                  {phrasesError && !phrasesLoading && (
                    <button onClick={() => { setPhrasesOpen(false); setTimeout(() => setPhrasesOpen(true), 0); }} className="px-1 py-3 text-left text-[12px] text-coral underline decoration-line underline-offset-2">
                      {tr("phrasesError")}
                    </button>
                  )}
                  {!phrasesLoading && !phrasesError && (
                    <ul className="flex flex-col gap-1.5">
                      {phrases.map((p, i) => (
                        <li key={i} className="rounded-xl border border-line bg-cream px-3.5 py-2.5">
                          <p className="text-[13px] font-medium leading-snug text-ink">{p.en}</p>
                          {p.gloss && <p className="mt-0.5 text-[11px] leading-snug text-clay">{p.gloss}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!phrasesLoading && !phrasesError && phrases.length > 0 && (
                    <p className="mt-2 px-1 text-[11px] leading-relaxed text-clay">{tr("phrasesHint")}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      {/* Sticky CTA */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-ivory via-ivory/95 to-transparent px-5 pb-safe pb-6 pt-10 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <motion.button
            onClick={handleBegin}
            whileTap={{ scale: 0.98 }}
            className="pointer-events-auto flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-2xl bg-coral text-base font-semibold text-cream shadow-lg shadow-coral/25 transition-all hover:bg-coral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory"
          >
            <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            {tr("startSpeaking")}
          </motion.button>
          <p className="mt-2 text-center text-[11px] text-clay">{tr("settingsNote")}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-clay">{children}</h2>;
}

function LangSelect({ value, onChange, label }: {
  value: Language; onChange: (l: Language) => void; label: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Language)}
        aria-label={label}
        className="min-h-[44px] w-full appearance-none rounded-2xl border border-line bg-cream py-3 pl-4 pr-10 text-sm font-medium text-ink transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang} value={lang}>{LANGUAGE_NATIVE_NAMES[lang as Language]}</option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-clay" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
