// OpenAI TTS voice for each scenario's persona, so the voice matches the
// character the learner is talking to (see PERSONA_NAMES in
// api/trainer/_shared.ts). Female names get a female voice, male names a male
// voice; voices rotate so neighbouring scenarios don't all sound the same.
// Names whose character sheet gives no gender (Sam, Alex, Jordan, Dr. Harris,
// Professor Chen, Officer Blake, Officer Grant) are left out and keep the
// default voice. Keep this in sync when a persona is added or renamed.

export type TtsVoice =
  | "alloy" | "ash" | "ballad" | "coral" | "echo" | "fable"
  | "nova" | "onyx" | "sage" | "shimmer" | "verse";

export const PERSONA_VOICES: Partial<Record<string, TtsVoice>> = {
  // female personas
  luxury_boutique:      "shimmer", // Isabelle
  journalist_interview: "nova",    // Rachel
  executive_assistant:  "coral",   // Claire
  medical_secretary:    "sage",    // Margaret
  hotel:                "shimmer", // Victoria
  legal:                "sage",    // Catherine
  phone_call:           "coral",   // Sarah
  customer_service:     "nova",    // Emma
  airport:              "sage",    // Helen
  shopping:             "nova",    // Lily
  travel:               "coral",   // Grace
  entertainment:        "nova",    // Mia
  dating:               "shimmer", // Ava
  salary_negotiation:   "sage",    // Patricia
  presentation:         "coral",   // Diane
  client_pitch:         "shimmer", // Susan
  pharmacy:             "nova",    // Priya
  // male personas
  job_interview:        "ash",     // James
  trade_fair:           "echo",    // Thomas
  networking:           "verse",   // David
  business_meeting:     "onyx",    // Marcus
  restaurant:           "fable",   // Oliver
  banking:              "onyx",    // Richard
  real_estate:          "echo",    // Christopher
  apartment:            "verse",   // Nathan
  news_debate:          "ash",     // Daniel
  sports:               "echo",    // Ryan
  cooking:              "verse",   // Marco
  performance_review:   "ash",     // Andrew
  admin_office:         "onyx",    // Bernard
  formal_complaint:     "ballad",  // Gordon
};

export function voiceForScenario(scenario: string | undefined): TtsVoice | undefined {
  return scenario ? PERSONA_VOICES[scenario] : undefined;
}
