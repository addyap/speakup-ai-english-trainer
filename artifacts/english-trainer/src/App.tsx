import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { dark } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { AppProvider, useApp } from "@/lib/AppContext";
import { HomeView } from "@/pages/HomeView";
import { LanguageSelectionView } from "@/pages/LanguageSelectionView";
import { SessionSetupView } from "@/pages/SessionSetupView";
import { ConversationView } from "@/pages/ConversationView";
import { FeedbackView } from "@/pages/FeedbackView";
import { PrivacyView } from "@/pages/PrivacyView";
import { GrammarView } from "@/pages/GrammarView";
import { FREE_ACCESS_ENABLED } from "@/lib/freeAccess";
import { AuditDashboard } from "@/pages/AuditDashboard";
import { Analytics } from "@vercel/analytics/react";
import { trackEvent } from "@/lib/analytics";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  baseTheme: dark,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#6366f1",
    colorForeground: "#f8fafc",
    colorMutedForeground: "#94a3b8",
    colorDanger: "#ef4444",
    colorBackground: "#0d1021",
    colorInput: "#1a1f3d",
    colorInputForeground: "#f8fafc",
    colorNeutral: "#2d3561",
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#0d1021] border border-[#2d3561] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-white font-bold",
    headerSubtitle: "text-slate-400",
    socialButtonsBlockButtonText: "text-white",
    formFieldLabel: "text-slate-300",
    footerActionLink: "text-indigo-400 hover:text-indigo-300",
    footerActionText: "text-slate-400",
    dividerText: "text-slate-500",
    identityPreviewEditButton: "text-indigo-400",
    formFieldSuccessText: "text-teal-400",
    alertText: "text-slate-200",
    logoBox: "flex justify-center",
    logoImage: "w-10 h-10",
    socialButtonsBlockButton: "border-[#2d3561] hover:border-indigo-500 bg-[#1a1f3d] text-white",
    formButtonPrimary: "bg-indigo-600 hover:bg-indigo-500 text-white font-semibold",
    formFieldInput: "bg-[#1a1f3d] border-[#2d3561] text-white",
    footerAction: "border-t border-[#2d3561]",
    dividerLine: "bg-[#2d3561]",
    alert: "border-[#2d3561] bg-[#1a1f3d]",
    otpCodeFieldInput: "bg-[#1a1f3d] border-[#2d3561] text-white",
    formFieldRow: "",
    main: "",
  },
};

function ViewRouter() {
  const { currentView } = useApp();
  useEffect(() => { trackEvent("view", { view: currentView }); }, [currentView]);
  switch (currentView) {
    case "home": return <HomeView />;
    case "language": return <LanguageSelectionView />;
    case "setup": return <SessionSetupView />;
    case "conversation": return <ConversationView />;
    case "feedback": return <FeedbackView />;
    case "privacy": return <PrivacyView />;
    case "grammar": return <GrammarView />;
    default: return <HomeView />;
  }
}

function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "linear-gradient(135deg, #0a0c1a 0%, #1a0d2e 50%, #0a1a1a 100%)" }}>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "linear-gradient(135deg, #0a0c1a 0%, #1a0d2e 50%, #0a1a1a 100%)" }}>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function AppRoutes() {
  // FREE_ACCESS_ENABLED: bypass auth gate — all users go directly to the app
  if (FREE_ACCESS_ENABLED) {
    return (
      <AppProvider>
        <ViewRouter />
      </AppProvider>
    );
  }

  // Normal monetized flow: auth required
  return (
    <AppProvider>
      <Show when="signed-in">
        <ViewRouter />
      </Show>
      <Show when="signed-out">
        <Switch>
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route component={HomeView} />
        </Switch>
      </Show>
    </AppProvider>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      afterSignOutUrl={basePath || "/"}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to SpeakUp AI",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Start practising English with AI",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route component={AppRoutes} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
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
            className="px-5 py-2.5 min-h-[44px] rounded-xl bg-coral text-white font-semibold hover:bg-coral-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/60"
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
        <WouterRouter base={basePath}>
          <ClerkProviderWithRoutes />
        </WouterRouter>
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
      {showAudit && <AuditDashboard onClose={() => setShowAudit(false)} />}
    </>
  );
}

export default App;
