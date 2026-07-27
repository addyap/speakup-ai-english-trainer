import { motion } from "framer-motion";
import { useApp } from "@/lib/AppContext";
import { t, LANGUAGES, LANGUAGE_NATIVE_NAMES, type Language } from "@/i18n/translations";

export function LanguageSelectionView() {
  const {
    interfaceLanguage,
    feedbackLanguage,
    setInterfaceLanguage,
    setFeedbackLanguage,
    setCurrentView,
  } = useApp();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-4 py-8 flex flex-col">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto w-full flex-1 flex flex-col"
      >
        <button
          data-testid="button-back"
          onClick={() => setCurrentView("home")}
          className="text-white/50 hover:text-white/80 text-sm flex items-center gap-2 mb-8 transition-colors min-h-[44px] px-2 -ml-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t(interfaceLanguage, "back")}
        </button>

        <h1 className="text-3xl font-bold text-white mb-2">
          {t(interfaceLanguage, "chooseLanguage")}
        </h1>
        <p className="text-white/50 mb-8 text-sm">
          {t(interfaceLanguage, "selectLanguage")}
        </p>

        <div className="mb-8">
          <h2 className="text-white/70 text-sm font-semibold uppercase tracking-widest mb-4">
            {t(interfaceLanguage, "interfaceLanguage")}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {LANGUAGES.map((lang) => (
              <motion.button
                key={lang}
                data-testid={`button-interface-lang-${lang.toLowerCase()}`}
                onClick={() => setInterfaceLanguage(lang)}
                whileTap={{ scale: 0.96 }}
                className={`px-4 py-3 rounded-xl text-left text-sm font-medium transition-all duration-200 border ${
                  interfaceLanguage === lang
                    ? "bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/30"
                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20"
                }`}
              >
                <span className="block font-semibold text-base">
                  {LANGUAGE_NATIVE_NAMES[lang]}
                </span>
                <span className={`text-xs ${interfaceLanguage === lang ? "text-indigo-200" : "text-white/40"}`}>
                  {lang}
                </span>
              </motion.button>
            ))}
          </div>
        </div>

        <div className="mb-10">
          <h2 className="text-white/70 text-sm font-semibold uppercase tracking-widest mb-1">
            {t(interfaceLanguage, "feedbackLanguage")}
          </h2>
          <p className="text-white/40 text-xs mb-4">
            {t(interfaceLanguage, "feedbackLangNote")}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {LANGUAGES.map((lang) => (
              <motion.button
                key={lang}
                data-testid={`button-feedback-lang-${lang.toLowerCase()}`}
                onClick={() => setFeedbackLanguage(lang as Language)}
                whileTap={{ scale: 0.96 }}
                className={`px-4 py-3 rounded-xl text-left text-sm font-medium transition-all duration-200 border ${
                  feedbackLanguage === lang
                    ? "bg-teal-500 border-teal-400 text-white shadow-lg shadow-teal-500/30"
                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20"
                }`}
              >
                <span className="block font-semibold text-base">
                  {LANGUAGE_NATIVE_NAMES[lang]}
                </span>
                <span className={`text-xs ${feedbackLanguage === lang ? "text-teal-200" : "text-white/40"}`}>
                  {lang}
                </span>
              </motion.button>
            ))}
          </div>
        </div>

        <motion.button
          data-testid="button-continue"
          onClick={() => setCurrentView("setup")}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold text-lg shadow-xl shadow-indigo-900/50 hover:from-indigo-400 hover:to-violet-400 transition-all duration-200"
        >
          {t(interfaceLanguage, "continueButton")}
        </motion.button>
      </motion.div>
    </div>
  );
}
