import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider } from "@/lib/AppContext";
import { FREE_ACCESS_ENABLED } from "@/lib/freeAccess";
import { Analytics } from "@vercel/analytics/react";
import { Sentry } from "@/lib/sentry";
import { ViewRouter } from "@/ViewRouter";

const AuditDashboard = lazy(() => import("@/pages/AuditDashboard").then((m) => ({ default: m.AuditDashboard })));
// Clerk (provider, sign-in/up pages, the paid-mode gate) loads only when needed.
const ClerkApp = lazy(() => import("@/ClerkApp"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// In free-access mode the app needs no Clerk session, so Clerk mounts only on
// its own pages; with free access off, it wraps every page as before.
function AppRoot() {
  const [location] = useLocation();
  const onAuthPage = /^\/sign-(in|up)(\/|$)/.test(location);
  if (!FREE_ACCESS_ENABLED || onAuthPage) {
    return (
      <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
        <ClerkApp />
      </Suspense>
    );
  }
  return (
    <AppProvider>
      <ViewRouter />
    </AppProvider>
  );
}

const AUDIT_ENABLED = import.meta.env.DEV;

// Self-contained crash-screen strings for all 12 interface languages. Kept
// independent of the main translations module on purpose: the error boundary
// must render even if that module (or React context) is part of what failed.
const CRASH_MESSAGES: Record<string, { title: string; reload: string }> = {
  English:    { title: "Something went wrong.",        reload: "Reload" },
  French:     { title: "Une erreur est survenue.",     reload: "Recharger" },
  Spanish:    { title: "Algo salió mal.",              reload: "Recargar" },
  German:     { title: "Etwas ist schiefgelaufen.",    reload: "Neu laden" },
  Italian:    { title: "Qualcosa è andato storto.",    reload: "Ricarica" },
  Portuguese: { title: "Algo correu mal.",             reload: "Recarregar" },
  Russian:    { title: "Что-то пошло не так.",          reload: "Обновить" },
  Arabic:     { title: "حدث خطأ ما.",                  reload: "إعادة التحميل" },
  Chinese:    { title: "出了点问题。",                   reload: "重新加载" },
  Japanese:   { title: "問題が発生しました。",            reload: "再読み込み" },
  Polish:     { title: "Coś poszło nie tak.",          reload: "Odśwież" },
  Ukrainian:  { title: "Щось пішло не так.",            reload: "Оновити" },
};

// Read the persisted interface language directly from storage — safe because it
// doesn't depend on the (possibly corrupted) React tree that just crashed.
function crashLanguage(): string {
  try {
    const raw = localStorage.getItem("speakup_learner_profile");
    if (raw) {
      const p = JSON.parse(raw) as { preferredInterfaceLanguage?: unknown };
      if (typeof p.preferredInterfaceLanguage === "string" && CRASH_MESSAGES[p.preferredInterfaceLanguage]) {
        return p.preferredInterfaceLanguage;
      }
    }
  } catch {
    /* storage unavailable or corrupt → fall back to English */
  }
  return "English";
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
    // Report React render crashes (the boundary swallows them, so Sentry's
    // global handlers wouldn't otherwise see them).
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      const lang = crashLanguage();
      const msg = CRASH_MESSAGES[lang];
      const isRtl = lang === "Arabic";
      return (
        <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-ivory text-ink">
          <span className="text-4xl" role="img" aria-label={msg.title}>😕</span>
          <div className="space-y-1">
            <p className="font-semibold text-ink">{msg.title}</p>
            {lang !== "English" && <p className="text-sm text-clay">{CRASH_MESSAGES.English.title}</p>}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 min-h-[44px] rounded-xl bg-coral-dark text-white font-semibold hover:bg-coral-deep transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/60"
          >
            {msg.reload}{lang !== "English" ? " · Reload" : ""}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [showAudit, setShowAudit] = useState(false);

  useEffect(() => {
    if (!AUDIT_ENABLED) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "Q") setShowAudit((v) => !v);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <AppErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <WouterRouter base={basePath}>
            <AppRoot />
          </WouterRouter>
        </QueryClientProvider>
      </AppErrorBoundary>
      <Analytics />

      {AUDIT_ENABLED && !showAudit && (
        <button
          onClick={() => setShowAudit(true)}
          className="fixed bottom-5 right-4 z-[9997] h-9 px-3 rounded-full bg-slate-800/90 text-white/60 text-[11px] font-bold shadow-lg border border-white/10 hover:bg-indigo-600 hover:text-white hover:border-indigo-400/40 transition-all flex items-center gap-1.5"
          title="Open QA Audit (Ctrl+Shift+Q)"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          QA
        </button>
      )}
      {showAudit && (
        <Suspense fallback={null}>
          <AuditDashboard onClose={() => setShowAudit(false)} />
        </Suspense>
      )}
    </>
  );
}

export default App;
