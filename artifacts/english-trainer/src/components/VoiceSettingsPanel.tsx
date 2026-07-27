import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type VoiceSettings, type AccentPref } from "@/lib/voiceSettings";
import { getVoiceAvailability, getTopVoices, type EnglishVoiceOption } from "@/lib/tts";
import { useApp } from "@/lib/AppContext";
import { t } from "@/i18n/translations";

const RATE_STEPS = [0.6, 0.75, 0.9, 1.05, 1.2, 1.4];

const ACCENT_OPTIONS: { value: AccentPref; label: string; flag: string }[] = [
  { value: "auto",     label: "voiceAccentAuto",     flag: "🌍" },
  { value: "british",  label: "voiceAccentBritish",  flag: "🇬🇧" },
  { value: "american", label: "voiceAccentAmerican", flag: "🇺🇸" },
];

function rateLabel(rate: number): string {
  if (rate <= 0.65) return "voiceRateVerySlow";
  if (rate <= 0.8)  return "voiceRateSlow";
  if (rate <= 1.0)  return "voiceRateNormal";
  if (rate <= 1.15) return "voiceRateFast";
  return "voiceRateVeryFast";
}

/** Strip the long platform suffix from voice names for compact display.
 *  "Microsoft Sonia Online (Natural) - English (United Kingdom)" → "Microsoft Sonia"
 *  "Google UK English Female" stays as-is (already short enough)
 */
function displayVoiceName(name: string): string {
  return name
    .replace(/\s*-\s*English\s*\([^)]*\)$/i, "")
    .replace(/\s*Online\s*\([^)]*\)/i, "")
    .replace(/\s*\(Natural\)/i, "")
    .trim();
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex-shrink-0 flex items-center justify-center min-h-[44px] min-w-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2 focus-visible:ring-offset-cream rounded-full"
      role="switch"
      aria-checked={value}
    >
      <span
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${
          value ? "bg-coral" : "bg-sand"
        }`}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 600, damping: 40 }}
          className={`absolute h-5 w-5 rounded-full bg-white shadow-md ${value ? "left-[26px]" : "left-1"}`}
        />
      </span>
    </button>
  );
}

interface Props {
  settings: VoiceSettings;
  onUpdate: (patch: Partial<VoiceSettings>) => void;
  onClose: () => void;
}

export function VoiceSettingsPanel({ settings, onUpdate, onClose }: Props) {
  const { interfaceLanguage } = useApp();
  const availability = getVoiceAvailability(settings.accentPreference);

  const [topVoices, setTopVoices] = useState<EnglishVoiceOption[]>(() =>
    getTopVoices(settings.accentPreference, 5),
  );

  // Reload voice list when accent changes or voices finish loading (Chrome async)
  useEffect(() => {
    const reload = () => setTopVoices(getTopVoices(settings.accentPreference, 5));
    reload();
    window.speechSynthesis?.addEventListener("voiceschanged", reload);
    const tid = setTimeout(reload, 800);
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", reload);
      clearTimeout(tid);
    };
  }, [settings.accentPreference]);

  const currentStepIdx = (() => {
    let best = 0;
    let bestDist = Math.abs(RATE_STEPS[0] - settings.speakRate);
    for (let i = 1; i < RATE_STEPS.length; i++) {
      const d = Math.abs(RATE_STEPS[i] - settings.speakRate);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  })();

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel — bottom sheet */}
      <motion.div
        key="panel"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 40 }}
        className="fixed bottom-0 inset-x-0 z-50 max-w-lg mx-auto rounded-t-3xl bg-cream border border-line border-b-0 shadow-2xl pb-safe overflow-y-auto max-h-[85dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 sticky top-0 bg-cream z-10">
          <div className="w-10 h-1 rounded-full bg-sand" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔊</span>
            <h2 className="text-base font-semibold text-ink">{t(interfaceLanguage, "voiceSettingsTitle")}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close voice settings"
            className="w-11 h-11 flex items-center justify-center rounded-full text-clay hover:text-ink hover:bg-line transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line"
          >
            ✕
          </button>
        </div>

        <div className="px-5 pb-6 space-y-5">

          {/* Voice availability notice */}
          {availability === "unavailable" && (
            <div className="px-4 py-3 rounded-2xl bg-amber-500/15 border border-amber-500/25 text-amber-800 text-sm">
              {t(interfaceLanguage, "voiceUnavailableMsg")}
            </div>
          )}
          {availability === "limited" && (
            <div className="px-4 py-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-200/80 text-sm">
              {t(interfaceLanguage, "voiceLimitedMsg")}
            </div>
          )}

          {/* Auto-speak */}
          <div className="flex items-center justify-between py-2 min-h-[44px]">
            <div>
              <p className="text-ink font-medium">{t(interfaceLanguage, "autoSpeakLabel")}</p>
              <p className="text-clay text-xs mt-0.5">{t(interfaceLanguage, "autoSpeakDesc")}</p>
            </div>
            <Toggle value={settings.autoSpeak} onChange={(v) => onUpdate({ autoSpeak: v })} />
          </div>

          <div className="border-t border-line" />

          {/* Accent preference */}
          <div>
            <p className="text-ink font-medium mb-3">{t(interfaceLanguage, "accentLabel")}</p>
            <div className="grid grid-cols-3 gap-2">
              {ACCENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onUpdate({ accentPreference: opt.value })}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 min-h-[64px] rounded-2xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral ${
                    settings.accentPreference === opt.value
                      ? "bg-coral/25 border-coral/60 text-ink"
                      : "bg-sand border-line text-clay hover:bg-line hover:text-ink-soft"
                  }`}
                >
                  <span className="text-xl">{opt.flag}</span>
                  <span className="text-xs font-medium leading-tight text-center">{t(interfaceLanguage, opt.label as Parameters<typeof t>[1])}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-line" />

          {/* Speaking speed */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-ink font-medium">{t(interfaceLanguage, "speakingSpeedLabel")}</p>
              <span className="text-sm text-coral font-medium">{t(interfaceLanguage, rateLabel(settings.speakRate) as Parameters<typeof t>[1])}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-clay text-xs w-8 text-right">🐢</span>
              <div className="flex-1 flex items-center gap-1">
                {RATE_STEPS.map((step, i) => (
                  <button
                    key={step}
                    onClick={() => onUpdate({ speakRate: step })}
                    className={`flex-1 h-11 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral ${
                      i === currentStepIdx
                        ? "bg-coral shadow-coral/40 shadow-md scale-110"
                        : i < currentStepIdx
                        ? "bg-coral/40"
                        : "bg-sand hover:bg-sand"
                    }`}
                  />
                ))}
              </div>
              <span className="text-clay text-xs w-8">🐇</span>
            </div>
          </div>

          {/* Voice picker — shown when 2+ voices are available */}
          {availability !== "unavailable" && topVoices.length > 0 && (
            <>
              <div className="border-t border-line" />
              <div>
                <p className="text-ink font-medium mb-3">{t(interfaceLanguage, "selectedVoiceLabel")}</p>
                <div className="space-y-2">
                  {topVoices.map((v) => {
                    const isSelected = settings.voiceURI === v.voiceURI;
                    return (
                      <button
                        key={v.voiceURI}
                        onClick={() => onUpdate({ voiceURI: v.voiceURI })}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 min-h-[52px] rounded-2xl border transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral ${
                          isSelected
                            ? "bg-coral/20 border-coral/50"
                            : "bg-sand border-line hover:bg-line"
                        }`}
                      >
                        {/* Radio indicator */}
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                            isSelected ? "border-coral" : "border-line"
                          }`}
                        >
                          {isSelected && <div className="w-2 h-2 rounded-full bg-coral" />}
                        </div>

                        {/* Voice info */}
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium leading-tight truncate ${isSelected ? "text-ink" : "text-ink-soft"}`}>
                            {displayVoiceName(v.name)}
                          </p>
                          <p className="text-[11px] text-clay mt-0.5">
                            {v.lang}{!v.localService ? " · cloud" : " · device"}
                          </p>
                        </div>

                        {/* Best badge */}
                        {topVoices[0]?.voiceURI === v.voiceURI && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-coral/20 text-coral border border-coral/25 flex-shrink-0">
                            Best
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-clay text-xs mt-2.5">
                  {t(interfaceLanguage, "selectedVoiceDesc")}
                </p>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
