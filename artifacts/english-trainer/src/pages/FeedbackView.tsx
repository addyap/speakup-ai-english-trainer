import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useApp, type Scenario } from "@/lib/AppContext";
import { t, type Language } from "@/i18n/translations";
import { trackEvent } from "@/lib/analytics";
import { takeVoiceClip } from "@/lib/voiceClip";
import { blobToWavBase64 } from "@/lib/audio";
import { SCENARIO_META } from "@/lib/scenarios";

type TranslationKey = Parameters<typeof t>[1];

const NEXT_CHALLENGE: Record<Scenario, { value: Scenario; descKey: TranslationKey }> = {
  job_interview:        { value: "business_meeting",     descKey: "ncJobInterview" },
  small_talk:           { value: "networking",           descKey: "ncSmallTalk" },
  business_meeting:     { value: "job_interview",        descKey: "ncBusinessMeeting" },
  travel:               { value: "airport",              descKey: "ncTravel" },
  daily_life:           { value: "restaurant",           descKey: "ncDailyLife" },
  restaurant:           { value: "customer_service",     descKey: "ncRestaurant" },
  shopping:             { value: "luxury_boutique",      descKey: "ncShopping" },
  medical:              { value: "phone_call",           descKey: "ncMedical" },
  academic:             { value: "job_interview",        descKey: "ncAcademic" },
  phone_call:           { value: "customer_service",     descKey: "ncPhoneCall" },
  airport:              { value: "hotel",                descKey: "ncAirport" },
  hotel:                { value: "travel",               descKey: "ncHotel" },
  banking:              { value: "real_estate",          descKey: "ncBanking" },
  apartment:            { value: "banking",              descKey: "ncApartment" },
  dating:               { value: "small_talk",           descKey: "ncDating" },
  sports:               { value: "daily_life",           descKey: "ncSports" },
  news_debate:          { value: "journalist_interview", descKey: "ncNewsDebate" },
  customer_service:     { value: "phone_call",           descKey: "ncCustomerService" },
  tech_support:         { value: "business_meeting",     descKey: "ncTechSupport" },
  real_estate:          { value: "legal",                descKey: "ncRealEstate" },
  legal:                { value: "business_meeting",     descKey: "ncLegal" },
  emergency:            { value: "phone_call",           descKey: "ncEmergency" },
  cooking:              { value: "restaurant",           descKey: "ncCooking" },
  entertainment:        { value: "small_talk",           descKey: "ncEntertainment" },
  networking:           { value: "business_meeting",     descKey: "ncNetworking" },
  luxury_boutique:      { value: "networking",           descKey: "ncLuxuryBoutique" },
  trade_fair:           { value: "business_meeting",     descKey: "ncTradeFair" },
  executive_assistant:  { value: "phone_call",           descKey: "ncExecutiveAssistant" },
  medical_secretary:    { value: "medical",              descKey: "ncMedicalSecretary" },
  journalist_interview: { value: "news_debate",          descKey: "ncJournalistInterview" },
  salary_negotiation:   { value: "performance_review",   descKey: "ncSalaryNegotiation" },
  performance_review:   { value: "client_pitch",         descKey: "ncPerformanceReview" },
  presentation:         { value: "client_pitch",         descKey: "ncPresentation" },
  client_pitch:         { value: "business_meeting",     descKey: "ncClientPitch" },
  border_control:       { value: "airport",              descKey: "ncBorderControl" },
  pharmacy:             { value: "medical",              descKey: "ncPharmacy" },
  admin_office:         { value: "banking",              descKey: "ncAdminOffice" },
  formal_complaint:     { value: "customer_service",     descKey: "ncFormalComplaint" },
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

const CEFR_EXPLANATION_KEYS: Record<string, TranslationKey> = {
  A1: "cefrA1",
  A2: "cefrA2",
  B1: "cefrB1",
  B2: "cefrB2",
  C1: "cefrC1",
  C2: "cefrC2",
};

function getCefrExplanationKey(level: string): TranslationKey {
  for (const [key, val] of Object.entries(CEFR_EXPLANATION_KEYS)) {
    if (level.includes(key)) return val;
  }
  return "cefrDefault";
}

export function FeedbackView() {
  const {
    interfaceLanguage, feedbackLanguage, feedback, scenario, mode,
    resetSession, setCurrentView, setScenario,
  } = useApp();

  useEffect(() => {
    if (feedback) trackEvent("session_complete", { level: feedback.estimatedLevel, scenario, mode });
  }, [feedback, scenario, mode]);

  // Pronunciation feedback from the learner's best spoken clip this session.
  const [pron, setPron] = useState<{ loading: boolean; data?: { overall: string; tips: string[]; strength: string }; error?: boolean } | null>(null);
  const pronDoneRef = useRef(false);
  useEffect(() => {
    if (!feedback || pronDoneRef.current) return;
    const clip = takeVoiceClip();
    if (!clip) return;
    pronDoneRef.current = true;
    setPron({ loading: true });
    (async () => {
      try {
        const wav = await blobToWavBase64(clip);
        const res = await fetch("/api/stt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task: "pronounce", audio: wav, format: "wav", feedbackLanguage }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const d = (await res.json()) as { overall?: string; tips?: unknown; strength?: string };
        setPron({ loading: false, data: { overall: d.overall ?? "", tips: Array.isArray(d.tips) ? (d.tips as string[]) : [], strength: d.strength ?? "" } });
      } catch {
        setPron(null); // audio-input model not available on the account → hide silently
      }
    })();
  }, [feedback, feedbackLanguage]);

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
      <div className="min-h-[100dvh] bg-ivory flex items-center justify-center px-4">
        <div className="text-clay text-center">
          <div className="w-8 h-8 border-2 border-line border-t-coral rounded-full animate-spin mx-auto mb-4" />
          <p>{t(interfaceLanguage, "loading")}</p>
        </div>
      </div>
    );
  }

  const isFallback = feedback.isFallback;

  const nextChallenge = NEXT_CHALLENGE[scenario];
  const emoji = SCENARIO_META[scenario].emoji;
  const scenarioLabel = t(interfaceLanguage, SCENARIO_META[scenario].labelKey);

  return (
    <div className="min-h-[100dvh] bg-ivory px-4 py-8 overflow-y-auto">
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-6"
        >
          {isFallback && (
            <p className="mb-2 inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-700">
              {t(interfaceLanguage, "limitedFeedback")}
            </p>
          )}
          <h1 className="text-2xl font-bold text-ink mb-1">
            {t(interfaceLanguage, "feedbackTitle")}
          </h1>
          <p className="text-clay text-sm">{t(interfaceLanguage, "feedbackSubtitle")}</p>
        </motion.div>

        {/* Session Badge — now uses translated scenario name */}
        <motion.div
          initial={{ opacity: 0, scale: 0.93 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
          className="mb-4 p-4 rounded-2xl bg-sand border border-line flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-coral/30 to-coral/30 border border-coral/30 flex items-center justify-center text-2xl flex-shrink-0">
            {emoji}
          </div>
          <div>
            <p className="text-clay text-[10px] font-semibold uppercase tracking-widest mb-0.5">
              {t(interfaceLanguage, "sessionBadge")}
            </p>
            <p className="text-ink font-bold text-base leading-tight">{scenarioLabel}</p>
          </div>
        </motion.div>

        {/* ── Card 1: CEFR Level ── */}
        <Card delay={0.1} className="bg-gradient-to-br from-coral/20 to-coral/20 border border-coral/30">
          <CardLabel color="text-coral">{t(interfaceLanguage, "estimatedLevel")}</CardLabel>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl font-bold text-ink" data-testid="text-estimated-level">
              {feedback.estimatedLevel}
            </span>
            <span className="px-3 py-1 rounded-full bg-coral/30 border border-coral/50 text-coral text-sm font-medium">
              CEFR
            </span>
          </div>
          <p className="text-coral/60 text-xs leading-relaxed">
            {t(interfaceLanguage, getCefrExplanationKey(feedback.estimatedLevel))}
          </p>
        </Card>
        {isFallback && (
          <Card delay={0.14} className="bg-amber-500/10 border border-amber-500/20">
            <CardLabel color="text-amber-700">{t(interfaceLanguage, "limitedFeedback")}</CardLabel>
            <p className="text-sm text-ink leading-relaxed">
              {feedback.fallbackReason ?? t(interfaceLanguage, "aiUnavailable")}
            </p>
          </Card>
        )}

        {/* ── Card 2: Strengths ── */}
        {feedback.strengths.length > 0 && (
          <Card delay={0.18} className="bg-forest/10 border border-forest/20">
            <CardLabel color="text-forest">{t(interfaceLanguage, "strengths")}</CardLabel>
            <ul className="space-y-3" data-testid="list-strengths">
              {feedback.strengths.slice(0, 2).map((s, i) => (
                <li key={i} className="flex items-start gap-3 text-ink text-sm leading-relaxed">
                  <svg className="w-4 h-4 text-forest mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
          <Card delay={0.23} className="bg-amber-500/10 border border-amber-500/20">
            <CardLabel color="text-amber-600">{t(interfaceLanguage, "strongestPhrase")}</CardLabel>
            <div className="flex gap-3 items-start">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              <p className="text-ink font-medium text-sm leading-relaxed italic">
                "{feedback.strongestPhrase}"
              </p>
            </div>
          </Card>
        )}

        {/* ── Card 3: Priority Corrections ── */}
        {feedback.improvements.length > 0 && (
          <Card delay={0.26} className="bg-amber-500/10 border border-amber-500/20">
            <CardLabel color="text-amber-600">{t(interfaceLanguage, "improvements")}</CardLabel>
            <ul className="space-y-3" data-testid="list-improvements">
              {feedback.improvements.slice(0, 3).map((imp, i) => (
                <li key={i} className="flex items-start gap-3 text-ink text-sm leading-relaxed">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/25 border border-amber-500/40 text-amber-700 text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  {imp}
                </li>
              ))}
            </ul>
            <button
              onClick={() => setCurrentView("grammar")}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
            >
              📘 {t(interfaceLanguage, "homeGrammarBtn")} →
            </button>
          </Card>
        )}

        {/* ── Card 4: Natural Upgrade ── */}
        {feedback.correctedExample && (
          <Card delay={0.34} className="bg-forest/10 border border-forest/20">
            <CardLabel color="text-forest">{t(interfaceLanguage, "correctedExample")}</CardLabel>
            <div className="flex gap-3">
              <svg className="w-4 h-4 text-forest flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-ink text-sm leading-relaxed italic" data-testid="text-corrected-example">
                {feedback.correctedExample}
              </p>
            </div>
          </Card>
        )}

        {/* ── Card 5: Fluency Observation ── */}
        {feedback.fluencyComment && (
          <Card delay={0.42} className="bg-forest/10 border border-forest/20">
            <CardLabel color="text-forest">{t(interfaceLanguage, "fluencyComment")}</CardLabel>
            <div className="flex gap-3">
              <svg className="w-4 h-4 text-forest flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <p className="text-ink text-sm leading-relaxed" data-testid="text-fluency-comment">
                {feedback.fluencyComment}
              </p>
            </div>
          </Card>
        )}

        {pron && (
          <Card delay={0.46} className="bg-coral/10 border border-coral/25">
            <CardLabel color="text-coral">{t(interfaceLanguage, "pronunciationTitle")}</CardLabel>
            {pron.loading ? (
              <div className="flex items-center gap-2 text-clay text-sm">
                <span className="w-3.5 h-3.5 border-2 border-line border-t-coral rounded-full animate-spin flex-shrink-0" />
                {t(interfaceLanguage, "pronunciationListening")}
              </div>
            ) : pron.error || !pron.data ? (
              <p className="text-clay text-sm">{t(interfaceLanguage, "pronunciationUnavailable")}</p>
            ) : (
              <div className="space-y-2.5 text-sm">
                {pron.data.overall && <p className="text-ink leading-relaxed">{pron.data.overall}</p>}
                {pron.data.strength && <p className="text-forest leading-relaxed">✓ {pron.data.strength}</p>}
                {pron.data.tips.length > 0 && (
                  <ul className="space-y-1.5 text-ink-soft">
                    {pron.data.tips.map((tip, i) => (
                      <li key={i} className="flex gap-2"><span className="text-coral flex-shrink-0">•</span><span>{tip}</span></li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Card>
        )}

        {/* ── Card 6: Next Step ── */}
        {feedback.nextStep && (
          <Card delay={0.5} className="bg-coral/10 border border-coral/20">
            <CardLabel color="text-coral">{t(interfaceLanguage, "nextStep")}</CardLabel>
            <div className="flex gap-3">
              <svg className="w-4 h-4 text-coral flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
              <p className="text-ink text-sm leading-relaxed" data-testid="text-next-step">
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
            className="mb-4 p-5 rounded-2xl bg-gradient-to-br from-coral/15 to-red-200/15 border border-coral/25"
          >
            <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-coral">
              🔥 {t(interfaceLanguage, "tomorrowsChallenge")}
            </p>
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl flex-shrink-0 mt-0.5">{SCENARIO_META[nextChallenge.value].emoji}</span>
              <div>
                <p className="text-ink font-semibold text-sm leading-tight mb-1">
                  {t(interfaceLanguage, SCENARIO_META[nextChallenge.value].labelKey)}
                </p>
                <p className="text-clay text-xs leading-relaxed">{t(interfaceLanguage, nextChallenge.descKey)}</p>
              </div>
            </div>
            <button
              onClick={handleTryNextChallenge}
              className="w-full py-3.5 min-h-[44px] rounded-xl bg-coral/20 border border-coral/30 text-coral text-sm font-semibold hover:bg-coral/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/60"
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
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-coral to-coral text-ink font-semibold text-lg shadow-xl shadow-coral/50 hover:from-coral hover:to-coral transition-all duration-200"
          >
            {t(interfaceLanguage, "newSession")}
          </motion.button>

          <button
            onClick={handleGoHome}
            className="w-full py-3 rounded-2xl border border-line text-clay hover:text-ink hover:border-line text-sm font-medium transition-all"
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
          <p className="text-ink/18 text-xs">Connect with Antony Addy on LinkedIn</p>
        </motion.div>

        <div className="h-6" />
      </div>
    </div>
  );
}
