import { motion } from "framer-motion";
import { useApp } from "@/lib/AppContext";
import { t } from "@/i18n/translations";
import { getLearnerProfile } from "@/lib/learnerMemory";

const FEATURE_PILLS = [
  { key: "featureLanguages", fallback: "12 languages" },
  { key: "featureScenarios", fallback: "30 scenarios" },
  { key: "featureModes", fallback: "3 coaching modes" },
  { key: "featureReport", fallback: "AI session report" },
  { key: "featureTracking", fallback: "CEFR level tracking" },
] as const;

// Decorative waveform bars (heights in %)
const WAVE = [30, 68, 45, 92, 58, 80, 36, 66, 50, 88, 40, 72, 30, 60, 46, 78, 34];

export function HomeView() {
  const { setCurrentView, interfaceLanguage } = useApp();
  const profile = getLearnerProfile();
  const hasHistory = profile.totalSessions > 0;
  const tr = (k: Parameters<typeof t>[1]) => t(interfaceLanguage, k);

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-ivory text-ink">
      {/* warm ambient glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-coral/10 blur-[90px]" />
        <div className="absolute bottom-[-15%] left-[-8%] h-[420px] w-[420px] rounded-full bg-forest/10 blur-[90px]" />
      </div>

      {/* Top nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 pt-safe pt-6 sm:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-coral text-cream shadow-sm">
            <svg className="h-5 w-5" viewBox="0 0 48 48" fill="none">
              <path d="M14 18c0-2.2 1.8-4 4-4h12c2.2 0 4 1.8 4 4v8c0 2.2-1.8 4-4 4h-3l-5 5v-5h-4c-2.2 0-4-1.8-4-4v-8z" fill="currentColor" />
            </svg>
          </div>
          <span className="font-serif text-lg font-semibold tracking-tight text-ink">SpeakUp AI</span>
        </div>
        <span className="text-sm text-clay">by Antony Addy</span>
      </header>

      {/* Hero */}
      <main className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-16 lg:pb-24 lg:pt-16">
        {/* Left — copy */}
        <div className="max-w-xl">
          <motion.span
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 rounded-full border border-forest/20 bg-forest-soft px-3.5 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-forest"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-forest" />
            {tr("freeLaunchBadge")}
          </motion.span>

          {hasHistory && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-line bg-cream px-3.5 py-2 text-sm text-ink-soft"
            >
              <span className="font-semibold text-forest">
                {profile.totalSessions} {tr(profile.totalSessions === 1 ? "sessionWord" : "sessionsWord")}
              </span>
              {profile.estimatedLevel && (
                <>
                  <span className="text-clay">·</span>
                  <span className="text-clay">{tr("estimatedLevel")}:</span>
                  <span className="font-mono font-semibold text-ink">{profile.estimatedLevel}</span>
                </>
              )}
            </motion.div>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="mt-5 font-serif text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.015em] text-ink text-balance sm:text-6xl"
          >
            {tr("heroHeadline")}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft"
          >
            {tr("heroSubtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15 }}
            className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center"
          >
            <button
              onClick={() => setCurrentView("setup")}
              className="group inline-flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-2xl bg-coral px-7 text-lg font-semibold text-cream shadow-lg shadow-coral/25 transition-all hover:bg-coral-dark hover:shadow-coral/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory active:scale-[0.98] sm:w-auto"
            >
              {tr("startTrainingFree")}
              <svg className="h-5 w-5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </motion.div>

          {/* Trust row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-soft"
          >
            <span className="inline-flex items-center gap-1.5">
              <svg className="h-4 w-4 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {tr("noCardRequired")}
            </span>
            <span className="text-clay">{tr("freeNote")}</span>
          </motion.div>

          <button
            type="button"
            onClick={() => setCurrentView("privacy")}
            className="mt-4 min-h-[44px] rounded-lg text-left text-xs text-clay underline decoration-line underline-offset-2 transition-colors hover:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40"
          >
            {tr("privacyNote")}
          </button>
        </div>

        {/* Right — live conversation card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative"
        >
          <div className="rounded-3xl border border-line bg-cream p-5 shadow-xl sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-lg">☕</span>
              <span className="text-sm font-semibold text-ink">Small talk · before a meeting</span>
              <span className="ml-auto rounded-lg bg-forest-soft px-2.5 py-1 font-mono text-xs font-bold text-forest">B2</span>
            </div>

            <div className="space-y-2.5">
              <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-sand px-4 py-2.5 text-[15px] leading-relaxed text-ink-soft">
                Perfect timing before a meeting — how has your day been so far?
              </div>
              <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-forest px-4 py-2.5 text-[15px] leading-relaxed text-cream">
                Pretty busy, but good. I'm grabbing a coffee before we start.
              </div>
              <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-sand px-4 py-2.5 text-[15px] leading-relaxed text-ink-soft">
                Nice — a coffee always helps. What's first on your agenda?
              </div>
            </div>

            {/* waveform */}
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-line bg-ivory px-4 py-3">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-coral text-cream">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-14 0m7 7v3m0-3a4 4 0 004-4V6a4 4 0 10-8 0v5a4 4 0 004 4z" />
                </svg>
              </span>
              <div className="flex h-8 flex-1 items-center gap-[3px]" aria-hidden="true">
                {WAVE.map((h, i) => (
                  <span
                    key={i}
                    className="wavebar flex-1 rounded-full bg-gradient-to-b from-coral to-coral/50"
                    style={{ height: `${h}%`, animationDelay: `${i * 0.06}s` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* feature chips under the card */}
          <div className="mt-5 flex flex-wrap gap-2">
            {FEATURE_PILLS.map((pill) => (
              <span
                key={pill.key}
                className="rounded-full border border-line bg-cream px-3 py-1.5 text-xs font-medium text-ink-soft"
              >
                {tr(pill.key)}
              </span>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
