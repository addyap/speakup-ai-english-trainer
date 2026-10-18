// Everything that needs Clerk. App.tsx loads this module lazily, and only when
// it's needed: on /sign-in and /sign-up, or on every page when free access is
// off. In free-access mode no page uses a Clerk session, so the home page no
// longer downloads Clerk (about 130 KB from clerk.accounts.dev) on every visit.
import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { dark } from "@clerk/themes";
import { Switch, Route, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { AppProvider } from "@/lib/AppContext";
import { HomeView } from "@/pages/HomeView";
import { FREE_ACCESS_ENABLED } from "@/lib/freeAccess";
import AntonyAddyBar from "@/components/AntonyAddyBar";
import { ViewRouter } from "@/ViewRouter";

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
  // FREE_ACCESS_ENABLED: same bypass as App.tsx, for direct visits to /sign-in or /sign-up.
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
        <AntonyAddyBar />
        <Switch>
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route component={HomeView} />
        </Switch>
      </Show>
    </AppProvider>
  );
}

export default function ClerkApp() {
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
      <ClerkQueryClientCacheInvalidator />
      <Switch>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route component={AppRoutes} />
      </Switch>
    </ClerkProvider>
  );
}
