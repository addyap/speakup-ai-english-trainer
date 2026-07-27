import { useApp } from "@/lib/AppContext";
import { t } from "@/i18n/translations";

export function PrivacyView() {
  const { setCurrentView, interfaceLanguage } = useApp();
  const localizedBack = t(interfaceLanguage, "back");

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-[#0a0c1a] via-[#0e0e2c] to-[#080f1a] px-5 pt-safe pt-6 pb-8 text-white">
      <button
        onClick={() => setCurrentView("home")}
        className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/6 border border-white/10 px-4 py-2 text-sm text-white/80"
      >
        ← {localizedBack}
      </button>
      <h1 className="text-2xl font-bold mb-4">{t(interfaceLanguage, "privacyTitle")}</h1>
      <div className="space-y-3 text-sm leading-relaxed text-white/70">
        <p>{t(interfaceLanguage, "privacyIntro")}</p>
        <p>{t(interfaceLanguage, "privacyDetail")}</p>
        <p>{t(interfaceLanguage, "privacyAuthNote")}</p>
      </div>
    </div>
  );
}