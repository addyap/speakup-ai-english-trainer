import { Suspense, lazy, useEffect } from "react";
import { useApp } from "@/lib/AppContext";
import { HomeView } from "@/pages/HomeView";
import { trackEvent } from "@/lib/analytics";
import AntonyAddyBar from "@/components/AntonyAddyBar";

// Only the home view ships in the entry bundle; every other view loads when
// the visitor first opens it, which keeps the landing page light on mobile.
const LanguageSelectionView = lazy(() => import("@/pages/LanguageSelectionView").then((m) => ({ default: m.LanguageSelectionView })));
const SessionSetupView = lazy(() => import("@/pages/SessionSetupView").then((m) => ({ default: m.SessionSetupView })));
const ConversationView = lazy(() => import("@/pages/ConversationView").then((m) => ({ default: m.ConversationView })));
const FeedbackView = lazy(() => import("@/pages/FeedbackView").then((m) => ({ default: m.FeedbackView })));
const PrivacyView = lazy(() => import("@/pages/PrivacyView").then((m) => ({ default: m.PrivacyView })));
const GrammarView = lazy(() => import("@/pages/GrammarView").then((m) => ({ default: m.GrammarView })));

function currentViewElement(view: string) {
  switch (view) {
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

export function ViewRouter() {
  const { currentView } = useApp();
  useEffect(() => { trackEvent("view", { view: currentView }); }, [currentView]);
  // The conversation fills exactly one screen with the mic at the bottom, so
  // the Antony Addy bar steps aside while a session is running.
  return (
    <>
      {currentView !== "conversation" && <AntonyAddyBar />}
      <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
        {currentViewElement(currentView)}
      </Suspense>
    </>
  );
}
