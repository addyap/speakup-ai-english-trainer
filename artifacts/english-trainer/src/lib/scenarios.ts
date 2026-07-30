import type { Scenario } from "./AppContext";
import type { t } from "@/i18n/translations";

type TranslationKey = Parameters<typeof t>[1];

// ─── Single source of truth for scenario emoji + i18n label key ───────────────
// Typed as Record<Scenario, …> so TypeScript forces every scenario to be listed
// here. The frontend typecheck gate (pnpm typecheck) fails the build if a new
// scenario is added to the Scenario union without a matching entry — which is
// exactly the drift that previously left 8 scenarios with blank emoji/labels in
// the conversation and feedback headers.

export type ScenarioCategory = "work" | "travel" | "everyday" | "services" | "academic";

export interface ScenarioMeta {
  emoji: string;
  labelKey: TranslationKey;
  category: ScenarioCategory;
}

export const SCENARIO_META: Record<Scenario, ScenarioMeta> = {
  small_talk:           { emoji: "☕",   labelKey: "smallTalk",           category: "everyday" },
  job_interview:        { emoji: "💼",   labelKey: "jobInterview",        category: "work" },
  travel:               { emoji: "✈️",   labelKey: "travel",              category: "travel" },
  luxury_boutique:      { emoji: "💎",   labelKey: "luxuryBoutique",      category: "everyday" },
  journalist_interview: { emoji: "🎙️",  labelKey: "journalistInterview", category: "academic" },
  networking:           { emoji: "🤝",   labelKey: "networking",          category: "work" },
  executive_assistant:  { emoji: "🗂️",  labelKey: "executiveAssistant",  category: "work" },
  medical_secretary:    { emoji: "🩺",   labelKey: "medicalSecretary",    category: "services" },
  business_meeting:     { emoji: "📊",   labelKey: "businessMeeting",     category: "work" },
  phone_call:           { emoji: "📞",   labelKey: "phoneCall",           category: "work" },
  trade_fair:           { emoji: "🏛️",  labelKey: "tradeFair",           category: "work" },
  legal:                { emoji: "⚖️",   labelKey: "legal",               category: "services" },
  banking:              { emoji: "🏦",   labelKey: "banking",             category: "services" },
  academic:             { emoji: "🎓",   labelKey: "academic",            category: "academic" },
  customer_service:     { emoji: "🎯",   labelKey: "customerService",     category: "services" },
  tech_support:         { emoji: "💻",   labelKey: "techSupport",         category: "services" },
  news_debate:          { emoji: "📰",   labelKey: "newsDebate",          category: "academic" },
  sports:               { emoji: "🏋️",  labelKey: "sports",              category: "everyday" },
  entertainment:        { emoji: "🎬",   labelKey: "entertainment",       category: "everyday" },
  dating:               { emoji: "💬",   labelKey: "dating",              category: "everyday" },
  airport:              { emoji: "🛫",   labelKey: "airport",             category: "travel" },
  hotel:                { emoji: "🏨",   labelKey: "hotel",               category: "travel" },
  real_estate:          { emoji: "🏡",   labelKey: "realEstate",          category: "services" },
  apartment:            { emoji: "🏠",   labelKey: "apartment",           category: "services" },
  restaurant:           { emoji: "🍽️",  labelKey: "restaurant",          category: "everyday" },
  shopping:             { emoji: "🛍️",  labelKey: "shopping",            category: "everyday" },
  medical:              { emoji: "🏥",   labelKey: "medical",             category: "services" },
  daily_life:           { emoji: "🏙️",  labelKey: "dailyLife",           category: "everyday" },
  emergency:            { emoji: "🚨",   labelKey: "emergency",           category: "services" },
  cooking:              { emoji: "👨‍🍳", labelKey: "cooking",             category: "everyday" },
  salary_negotiation:   { emoji: "💰",   labelKey: "salaryNegotiation",   category: "work" },
  performance_review:   { emoji: "📈",   labelKey: "performanceReview",   category: "work" },
  presentation:         { emoji: "🎤",   labelKey: "presentation",        category: "work" },
  client_pitch:         { emoji: "📣",   labelKey: "clientPitch",         category: "work" },
  border_control:       { emoji: "🛂",   labelKey: "borderControl",       category: "travel" },
  pharmacy:             { emoji: "💊",   labelKey: "pharmacy",            category: "services" },
  admin_office:         { emoji: "📋",   labelKey: "adminOffice",         category: "services" },
  formal_complaint:     { emoji: "🗣️",  labelKey: "formalComplaint",     category: "services" },
};

// Which 8 scenarios head the picker and fill the "Popular" chip (display order).
export const FEATURED_SCENARIOS: Scenario[] = [
  "small_talk", "job_interview", "travel", "luxury_boutique",
  "journalist_interview", "networking", "executive_assistant", "medical_secretary",
];

// The picker's full catalogue, DERIVED from SCENARIO_META so it can never drift:
// featured 8 first, then every remaining scenario in SCENARIO_META order. Adding
// a scenario to the Scenario union forces a SCENARIO_META entry (typed Record),
// which automatically makes it selectable here — no separate list to update.
export const ALL_SCENARIOS: { value: Scenario; emoji: string; labelKey: TranslationKey }[] = (() => {
  const featured = new Set(FEATURED_SCENARIOS);
  const rest = (Object.keys(SCENARIO_META) as Scenario[]).filter((s) => !featured.has(s));
  return [...FEATURED_SCENARIOS, ...rest].map((value) => ({
    value,
    emoji: SCENARIO_META[value].emoji,
    labelKey: SCENARIO_META[value].labelKey,
  }));
})();

export function scenarioEmoji(scenario: Scenario): string {
  return SCENARIO_META[scenario].emoji;
}

export function scenarioLabelKey(scenario: Scenario): TranslationKey {
  return SCENARIO_META[scenario].labelKey;
}
