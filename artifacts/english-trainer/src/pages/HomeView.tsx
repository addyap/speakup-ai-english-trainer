import { motion } from "framer-motion";
import { useApp } from "@/lib/AppContext";
import { t } from "@/i18n/translations";
import { getLearnerProfile } from "@/lib/learnerMemory";
import authorImage from "@assets/IMG-20260308-WA0008(1)_1777804765325.jpg";
import linkedInQr from "@assets/image_b74e7332-6bc1-4b4d-bb3c-a653520fce8e20260503_124202_1777804981304.jpg";

const FEATURE_PILLS = [
  { icon: "🌍", key: "featureLanguages", fallback: "12 languages" },
  { icon: "🎭", key: "featureScenarios", fallback: "30 scenarios" },
  { icon: "🎯", key: "featureModes", fallback: "3 coaching modes" },
  { icon: "💡", key: "featureReport", fallback: "AI session report" },
  { icon: "📊", key: "featureTracking", fallback: "CEFR level tracking" },
] as const;

export function HomeView() {
  const { setCurrentView, interfaceLanguage } = useApp();
  const profile = getLearnerProfile();
  const hasHistory = profile.totalSessions > 0;

  return (
    <div className="min-h-[100dvh] flex flex-col overflow-x-hidden relative bg-gradient-to-br from-[#0a0c1a] via-[#0e0e2c] to-[#080f1a]">

      {/* Ambient light blobs — non-interactive */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-24 w-[420px] h-[420px] bg-violet-600/15 rounded-full blur-[80px]" />
        <div className="absolute top-1/2 -right-28 w-[340px] h-[340px] bg-indigo-500/15 rounded-full blur-[80px]" />
        <div className="absolute -bottom-16 left-1/4 w-[380px] h-[260px] bg-teal-500/10 rounded-full blur-[80px]" />
      </div>

      {/* Top nav */}
      <header className="relative z-10 flex items-center justify-between px-5 pt-safe pt-5 pb-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/25 border border-indigo-400/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-300" viewBox="0 0 48 48" fill="none">
              <path d="M14 18c0-2.2 1.8-4 4-4h12c2.2 0 4 1.8 4 4v8c0 2.2-1.8 4-4 4h-3l-5 5v-5h-4c-2.2 0-4-1.8-4-4v-8z" fill="currentColor"/>
            </svg>
          </div>
          <span className="text-white/80 font-bold text-[15px] tracking-tight">SpeakUp AI</span>
        </div>
        <span className="text-white/25 text-xs">by Antony Addy</span>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pt-8 pb-4 text-center">
        <div className="w-full max-w-sm mx-auto">

          {/* Free badge */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-400/12 border border-teal-400/30 text-teal-300 text-sm font-semibold mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse flex-shrink-0" />
            {t(interfaceLanguage, "freeLaunchBadge")}
          </motion.div>

          {/* Returning-user progress strip */}
          {hasHistory && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="mb-5 px-4 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-400/20 flex items-center justify-center gap-3 text-sm"
            >
              <span className="text-indigo-300 font-semibold">
                {profile.totalSessions} {t(interfaceLanguage, profile.totalSessions === 1 ? "sessionWord" : "sessionsWord")}
                {profile.estimatedLevel && (
                  <> · {t(interfaceLanguage, "estimatedLevel")}: <span className="text-white/80">{profile.estimatedLevel}</span></>
                )}
              </span>
            </motion.div>
          )}

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-[2.5rem] sm:text-5xl font-extrabold text-white leading-[1.1] tracking-tight mb-5"
          >
            {t(interfaceLanguage, "heroHeadline")}
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-base sm:text-lg text-white/55 leading-relaxed mb-10"
          >
            {t(interfaceLanguage, "heroSubtitle")}
          </motion.p>

          {/* CTA */}
          <motion.button
            onClick={() => setCurrentView("setup")}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="w-full py-4 rounded-2xl bg-white text-indigo-900 font-bold text-lg shadow-2xl shadow-indigo-900/50 hover:bg-white/95 active:scale-[0.97] transition-all duration-150 flex items-center justify-center gap-3 min-h-[58px]"
          >
            {t(interfaceLanguage, "startTrainingFree")}
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </motion.button>

          {/* Trust strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.45 }}
            className="mt-5 space-y-2"
          >
            <div className="flex items-center justify-center gap-2 text-white/70 text-sm">
              <svg className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {t(interfaceLanguage, "noCardRequired")}
            </div>
            <div className="flex items-center justify-center gap-2 text-white/35 text-sm">
              <svg className="w-3.5 h-3.5 text-white/25 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t(interfaceLanguage, "freeNote")}
            </div>
          </motion.div>

          {/* Privacy note */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.38, duration: 0.4 }}
            type="button"
            className="mt-4 min-h-[44px] px-4 py-3 text-white/45 text-[11px] text-center underline underline-offset-2 hover:text-white/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-xl"
            onClick={() => setCurrentView("privacy")}
          >
            {t(interfaceLanguage, "privacyNote")}
          </motion.button>
        </div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.45 }}
          className="mt-8 flex flex-wrap gap-2 justify-center w-full max-w-sm mx-auto"
        >
          {FEATURE_PILLS.map((pill) => (
            <div
              key={pill.key}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/6 border border-white/10 text-white/55 text-xs font-medium"
            >
              <span>{pill.icon}</span>
              {t(interfaceLanguage, pill.key)}
            </div>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
