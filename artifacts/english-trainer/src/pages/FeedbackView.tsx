import { motion } from "framer-motion";
import { useApp, type Scenario } from "@/lib/AppContext";
import { t, type Language } from "@/i18n/translations";

type TranslationKey = Parameters<typeof t>[1];

const SCENARIO_LABEL_KEYS: Record<Scenario, TranslationKey> = {
  job_interview: "jobInterview", small_talk: "smallTalk", business_meeting: "businessMeeting",
  travel: "travel", daily_life: "dailyLife", restaurant: "restaurant",
  shopping: "shopping", medical: "medical", academic: "academic",
  phone_call: "phoneCall", airport: "airport", hotel: "hotel",
  banking: "banking", apartment: "apartment", dating: "dating",
  sports: "sports", news_debate: "newsDebate", customer_service: "customerService",
  tech_support: "techSupport", real_estate: "realEstate", legal: "legal",
  emergency: "emergency", cooking: "cooking", entertainment: "entertainment",
  networking: "networking", luxury_boutique: "luxuryBoutique", trade_fair: "tradeFair",
  executive_assistant: "executiveAssistant", medical_secretary: "medicalSecretary",
  journalist_interview: "journalistInterview",
};

const SCENARIO_EMOJIS: Record<Scenario, string> = {
  job_interview: "💼", small_talk: "☕", business_meeting: "📊",
  travel: "✈️", daily_life: "🏙️", restaurant: "🍽️",
  shopping: "🛍️", medical: "🏥", academic: "🎓",
  phone_call: "📞", airport: "🛫", hotel: "🏨",
  banking: "🏦", apartment: "🏠", dating: "💬",
  sports: "🏋️", news_debate: "📰", customer_service: "🎯",
  tech_support: "💻", real_estate: "🏡", legal: "⚖️",
  emergency: "🚨", cooking: "👨‍🍳", entertainment: "🎬",
  networking: "🤝", luxury_boutique: "💎", trade_fair: "🏛️",
  executive_assistant: "🗂️", medical_secretary: "🩺", journalist_interview: "🎙️",
};

const NEXT_CHALLENGE: Record<Scenario, { value: Scenario; desc: string }> = {
  job_interview:        { value: "business_meeting",    desc: "Pitch your ideas and hold your own in a corporate discussion." },
  small_talk:           { value: "networking",          desc: "Build professional connections at an industry event." },
  business_meeting:     { value: "job_interview",       desc: "Put your skills on the line in a formal interview." },
  travel:               { value: "airport",             desc: "Navigate delays, gate changes, and rebooking under pressure." },
  daily_life:           { value: "restaurant",          desc: "Order confidently and handle dietary conversations in English." },
  restaurant:           { value: "customer_service",    desc: "Handle a complaint and push for a resolution calmly." },
  shopping:             { value: "luxury_boutique",     desc: "Engage at the highest level in a luxury retail environment." },
  medical:              { value: "phone_call",          desc: "Book an appointment and communicate clearly on the phone." },
  academic:             { value: "job_interview",       desc: "Transfer your academic confidence to a real job interview." },
  phone_call:           { value: "customer_service",    desc: "Turn a difficult call into a successful resolution." },
  airport:              { value: "hotel",               desc: "Check in, make requests, and handle hotel issues in English." },
  hotel:                { value: "travel",              desc: "Handle delays, lost bags, and navigation challenges." },
  banking:              { value: "real_estate",         desc: "Negotiate a property purchase — all in English." },
  apartment:            { value: "banking",             desc: "Handle financial conversations with confidence." },
  dating:               { value: "small_talk",          desc: "Keep any conversation flowing naturally with new people." },
  sports:               { value: "daily_life",          desc: "Master the English of everyday situations and errands." },
  news_debate:          { value: "journalist_interview", desc: "Face sharp questions from a press-room journalist." },
  customer_service:     { value: "phone_call",          desc: "Handle professional calls clearly and efficiently." },
  tech_support:         { value: "business_meeting",    desc: "Present a technical idea to a non-technical audience." },
  real_estate:          { value: "legal",               desc: "Review contract terms with a lawyer in English." },
  legal:                { value: "business_meeting",    desc: "Bring the precision of legal English into a boardroom." },
  emergency:            { value: "phone_call",          desc: "Practice staying clear and calm on an urgent call." },
  cooking:              { value: "restaurant",          desc: "Discuss menus, recommend dishes, and chat with staff." },
  entertainment:        { value: "small_talk",          desc: "Turn any shared interest into a fluent conversation." },
  networking:           { value: "business_meeting",    desc: "Take your professional English into a formal meeting." },
  luxury_boutique:      { value: "networking",          desc: "Refine your professional English at an elite industry event." },
  trade_fair:           { value: "business_meeting",    desc: "Follow up your trade fair conversations in a formal meeting." },
  executive_assistant:  { value: "phone_call",          desc: "Handle professional calls with precision and poise." },
  medical_secretary:    { value: "medical",             desc: "Practice patient communication from the other side." },
  journalist_interview: { value: "news_debate",         desc: "Hold your own in a live debate on current events." },
};

function Card({
  delay, className, children,
}: {
  delay: number; className: string; children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={`mb-4 p-5 rounded-2xl ${className}`}
    >
      {children}
    </motion.div>
  );
}

function CardLabel({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${color}`}>
      {children}
    </p>
  );
}

const CEFR_EXPLANATIONS: Record<string, string> = {
  A1: "Basic greetings and simple phrases",
  A2: "Familiar topics and simple exchanges",
  B1: "Most everyday and travel situations",
  B2: "Complex topics and fluent conversation",
  C1: "Fluent, flexible, effective English",
  C2: "Near-native mastery and precision",
};

function getCefrExplanation(level: string): string {
  for (const [key, val] of Object.entries(CEFR_EXPLANATIONS)) {
    if (level.includes(key)) return val;
  }
  return "Keep practising to improve your level";
}

export function FeedbackView() {
  const {
    interfaceLanguage, feedback, scenario,
    resetSession, setCurrentView, setScenario,
  } = useApp();

  const handleNewSession = () => {
    resetSession();
    setCurrentView("setup");
  };

  const handleGoHome = () => {
    setCurrentView("home");
  };

  const handleTryNextChallenge = () => {
    const next = NEXT_CHALLENGE[scenario];
    if (next) setScenario(next.value);
    resetSession();
    setCurrentView("setup");
  };

  if (!feedback) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center px-4">
        <div className="text-white/50 text-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-indigo-400 rounded-full animate-spin mx-auto mb-4" />
          <p>{t(interfaceLanguage, "loading")}</p>
        </div>
      </div>
    );
  }

  const isFallback = feedback.isFallback;

  const nextChallenge = NEXT_CHALLENGE[scenario];
  const emoji = SCENARIO_EMOJIS[scenario];
  const scenarioLabel = t(interfaceLanguage, SCENARIO_LABEL_KEYS[scenario]);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-4 py-8 overflow-y-auto">
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-6"
        >
          {isFallback && (
            <p className="mb-2 inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-300">
              Limited feedback
            </p>
          )}
          <h1 className="text-2xl font-bold text-white mb-1">
            {t(interfaceLanguage, "feedbackTitle")}
          </h1>
          <p className="text-white/40 text-sm">{t(interfaceLanguage, "feedbackSubtitle")}</p>
        </motion.div>

        {/* Session Badge — now uses translated scenario name */}
        <motion.div
          initial={{ opacity: 0, scale: 0.93 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
          className="mb-4 p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-500/30 flex items-center justify-center text-2xl flex-shrink-0">
            {emoji}
          </div>
          <div>
            <p className="text-white/35 text-[10px] font-semibold uppercase tracking-widest mb-0.5">
              {t(interfaceLanguage, "sessionBadge")}
            </p>
            <p className="text-white font-bold text-base leading-tight">{scenarioLabel}</p>
          </div>
        </motion.div>

        {/* ── Card 1: CEFR Level ── */}
        <Card delay={0.1} className="bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30">
          <CardLabel color="text-indigo-300">{t(interfaceLanguage, "estimatedLevel")}</CardLabel>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl font-bold text-white" data-testid="text-estimated-level">
              {feedback.estimatedLevel}
            </span>
            <span className="px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-500/50 text-indigo-200 text-sm font-medium">
              CEFR
            </span>
          </div>
          <p className="text-indigo-200/60 text-xs leading-relaxed">
            {getCefrExplanation(feedback.estimatedLevel)}
          </p>
        </Card>
        {isFallback && (
          <Card delay={0.14} className="bg-amber-500/10 border border-amber-500/20">
            <CardLabel color="text-amber-300">{t(interfaceLanguage, "limitedFeedback")}</CardLabel>
            <p className="text-sm text-white/80 leading-relaxed">
              {feedback.fallbackReason ?? t(interfaceLanguage, "aiUnavailable")}
            </p>
          </Card>
        )}

        {/* ── Card 2: Strengths ── */}
        {feedback.strengths.length > 0 && (
          <Card delay={0.18} className="bg-emerald-500/10 border border-emerald-500/20">
            <CardLabel color="text-emerald-400">{t(interfaceLanguage, "strengths")}</CardLabel>
            <ul className="space-y-3" data-testid="list-strengths">
              {feedback.strengths.slice(0, 2).map((s, i) => (
                <li key={i} className="flex items-start gap-3 text-white/85 text-sm leading-relaxed">
                  <svg className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {s}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* ── Card 2b: Strongest Phrase ── */}
        {feedback.strongestPhrase && (
          <Card delay={0.23} className="bg-yellow-500/10 border border-yellow-500/20">
            <CardLabel color="text-yellow-400">{t(interfaceLanguage, "strongestPhrase")}</CardLabel>
            <div className="flex gap-3 items-start">
              <svg className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              <p className="text-white font-medium text-sm leading-relaxed italic">
                "{feedback.strongestPhrase}"
              </p>
            </div>
          </Card>
        )}

        {/* ── Card 3: Priority Corrections ── */}
        {feedback.improvements.length > 0 && (
          <Card delay={0.26} className="bg-amber-500/10 border border-amber-500/20">
            <CardLabel color="text-amber-400">{t(interfaceLanguage, "improvements")}</CardLabel>
            <ul className="space-y-3" data-testid="list-improvements">
              {feedback.improvements.slice(0, 3).map((imp, i) => (
                <li key={i} className="flex items-start gap-3 text-white/85 text-sm leading-relaxed">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  {imp}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* ── Card 4: Natural Upgrade ── */}
        {feedback.correctedExample && (
          <Card delay={0.34} className="bg-teal-500/10 border border-teal-500/20">
            <CardLabel color="text-teal-400">{t(interfaceLanguage, "correctedExample")}</CardLabel>
            <div className="flex gap-3">
              <svg className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-white/85 text-sm leading-relaxed italic" data-testid="text-corrected-example">
                {feedback.correctedExample}
              </p>
            </div>
          </Card>
        )}

        {/* ── Card 5: Fluency Observation ── */}
        {feedback.fluencyComment && (
          <Card delay={0.42} className="bg-sky-500/10 border border-sky-500/20">
            <CardLabel color="text-sky-400">{t(interfaceLanguage, "fluencyComment")}</CardLabel>
            <div className="flex gap-3">
              <svg className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <p className="text-white/85 text-sm leading-relaxed" data-testid="text-fluency-comment">
                {feedback.fluencyComment}
              </p>
            </div>
          </Card>
        )}

        {/* ── Card 6: Next Step ── */}
        {feedback.nextStep && (
          <Card delay={0.5} className="bg-violet-500/10 border border-violet-500/20">
            <CardLabel color="text-violet-400">{t(interfaceLanguage, "nextStep")}</CardLabel>
            <div className="flex gap-3">
              <svg className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
              <p className="text-white/85 text-sm leading-relaxed" data-testid="text-next-step">
                {feedback.nextStep}
              </p>
            </div>
          </Card>
        )}

        {/* ── Tomorrow's Challenge ── */}
        {nextChallenge && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.58, duration: 0.4 }}
            className="mb-4 p-5 rounded-2xl bg-gradient-to-br from-orange-500/15 to-rose-500/15 border border-orange-500/25"
          >
            <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-orange-300">
              🔥 {t(interfaceLanguage, "tomorrowsChallenge")}
            </p>
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl flex-shrink-0 mt-0.5">{SCENARIO_EMOJIS[nextChallenge.value]}</span>
              <div>
                <p className="text-white font-semibold text-sm leading-tight mb-1">
                  {t(interfaceLanguage, SCENARIO_LABEL_KEYS[nextChallenge.value])}
                </p>
                <p className="text-white/50 text-xs leading-relaxed">{nextChallenge.desc}</p>
              </div>
            </div>
            <button
              onClick={handleTryNextChallenge}
              className="w-full py-3.5 min-h-[44px] rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-200 text-sm font-semibold hover:bg-orange-500/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60"
            >
              {t(interfaceLanguage, "tryThisNext")} →
            </button>
          </motion.div>
        )}

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
          className="space-y-3"
        >
          <motion.button
            data-testid="button-new-session"
            onClick={handleNewSession}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold text-lg shadow-xl shadow-indigo-900/50 hover:from-indigo-400 hover:to-violet-400 transition-all duration-200"
          >
            {t(interfaceLanguage, "newSession")}
          </motion.button>

          <button
            onClick={handleGoHome}
            className="w-full py-3 rounded-2xl border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 text-sm font-medium transition-all"
          >
            {t(interfaceLanguage, "backToHome")}
          </button>
        </motion.div>

        {/* Authority footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-6 text-center"
        >
          <p className="text-white/18 text-xs">Connect with Antony Addy on LinkedIn</p>
        </motion.div>

        <div className="h-6" />
      </div>
    </div>
  );
}
