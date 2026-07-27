// Single implementation of all trainer route handlers.
// Imported by:
//   • Vercel serverless functions  →  api/trainer/*.ts
//   • Express thin wrapper         →  artifacts/api-server/src/routes/trainer.ts
//
// Compatible with both Express (Request/Response) and Vercel (VercelRequest/VercelResponse)
// because both extend Node.js IncomingMessage / ServerResponse at runtime.

import { z } from "zod";
import { openai } from "../_lib/openai.js";
import { checkRateLimit } from "../_lib/rateLimit.js";
import { getPool, ensureSessionTable } from "../_lib/db.js";

// ─── Request / Response interfaces ───────────────────────────────────────────
// Minimal surface satisfied by Express Request/Response AND Vercel VercelRequest/VercelResponse.

export interface AppReq {
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  log?: {
    error(obj: unknown, msg?: string): void;
    warn(obj: unknown, msg?: string): void;
  };
}

export interface AppRes {
  status(code: number): AppRes;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
  write(data: string): boolean;
  end(): void;
  flushHeaders(): void;
}

// ─── Logger helper ────────────────────────────────────────────────────────────
function log(req: AppReq) {
  return {
    error: (req.log?.error ?? console.error).bind(req.log ?? console),
    warn:  (req.log?.warn  ?? console.warn ).bind(req.log ?? console),
  };
}

// ─── Rate limit helper ────────────────────────────────────────────────────────
function applyRateLimit(req: AppReq, res: AppRes): boolean {
  const result = checkRateLimit(req.headers, req.socket?.remoteAddress);
  if (!result.ok) {
    res.setHeader("Retry-After", String(result.retryAfter));
    res.status(429).json({ error: "Too many requests. Please wait a moment before trying again." });
    return false;
  }
  return true;
}

// ─── Zod validation schemas (inline — no @workspace/* dependency) ─────────────
const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

export const SendConversationMessageBody = z.object({
  messages: z.array(MessageSchema),
  mode: z.string(),
  scenario: z.string(),
  level: z.string(),
  interfaceLanguage: z.string(),
  feedbackLanguage: z.string().optional().default("English"),
  learnerContext: z.string().optional(),
});

export const GenerateFeedbackBody = z.object({
  messages: z.array(MessageSchema),
  mode: z.string(),
  feedbackLanguage: z.string().optional().default("English"),
});

export const GetConversationHintBody = z.object({
  messages: z.array(MessageSchema),
  scenario: z.string(),
  level: z.string(),
  feedbackLanguage: z.string().optional().default("English"),
  interfaceLanguage: z.string(),
  learnerContext: z.string().optional(),
});

export const ImproveMessageBody = z.object({
  text: z.string(),
  scenario: z.string(),
  feedbackLanguage: z.string().optional().default("English"),
});

// ─── OpenAI error classifier ──────────────────────────────────────────────────
function openAIStatus(err: unknown): number | undefined {
  if (err !== null && typeof err === "object" && "status" in err) {
    const s = (err as { status: unknown }).status;
    return typeof s === "number" ? s : undefined;
  }
  return undefined;
}

// ─── Bridge-sentence post-processor ──────────────────────────────────────────
const BRIDGE_SENTENCE_RE =
  /^(In\s+(this|our|a)\s+(role|position|teams?|environments?|systems?|stack|context|products?|settings?|production)\b|For\s+this\s+(role|position)\b|At\s+our\s+(level|stage|company)\b)/i;

function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?]*(?:[.!?]+(?=\s+[A-Z])|[.!?]+$|[^.!?]+$)/g);
  return (parts ?? [text]).map(s => s.trim()).filter(s => s.length > 1);
}

function stripBridgeSentence(text: string): string {
  const sentences = splitSentences(text);
  if (sentences.length < 2) return text;
  const filtered = sentences.filter(s => !BRIDGE_SENTENCE_RE.test(s));
  if (filtered.length === 0) return text;
  return filtered.join(" ").replace(/\s{2,}/g, " ").trim();
}

// ─── Scenario descriptions ────────────────────────────────────────────────────
const SCENARIO_LABELS: Record<string, string> = {
  job_interview:       "a job interview — you are the interviewer or panel member; the learner is the candidate applying for a role",
  small_talk:          "casual small talk — two acquaintances or colleagues chatting informally",
  business_meeting:    "a business meeting — pitching ideas, responding to proposals, professional group discussion",
  travel:              "a travel situation — transport delays, navigation, lost luggage, local information",
  daily_life:          "everyday daily life — errands, neighbours, service counters, routine English situations",
  restaurant:          "a restaurant — ordering, asking about the menu, dietary requirements, talking with staff",
  shopping:            "a shopping scenario — in a store, asking for help, negotiating, handling customer service",
  medical:             "a medical visit — describing symptoms, understanding a diagnosis, asking the pharmacist",
  academic:            "an academic setting — seminar, office hours, group project, discussing ideas with a professor",
  phone_call:          "a professional or personal phone call — taking messages, following up, leaving voicemails",
  airport:             "an airport — check-in desk, security questions, gate changes, flight delays and rebooking",
  hotel:               "a hotel — check-in, concierge requests, room issues, making a formal complaint",
  banking:             "a bank — opening an account, understanding charges, arranging a transfer, disputing a transaction",
  apartment:           "apartment hunting — viewing a flat, negotiating with a landlord, asking about the lease",
  dating:              "a first casual meeting in a social setting — friendly, appropriate getting-to-know-you conversation",
  sports:              "sports or fitness — gym talk, discussing matches, training plans, sporting events",
  news_debate:         "a news discussion — current events, differing opinions, civil political debate",
  customer_service:    "customer service — a complaint call, requesting a refund, escalating a problem",
  tech_support:        "tech support — explaining a technical issue clearly, following troubleshooting steps",
  real_estate:         "real estate — viewing a property, asking the agent detailed questions, negotiating price",
  legal:               "a legal consultation — understanding your rights, reviewing contract terms with a lawyer",
  emergency:           "an emergency situation — calling for urgent help, giving clear concise information under pressure",
  cooking:             "food and cooking — sharing a recipe, recommending a restaurant, discussing food culture",
  entertainment:       "entertainment discussion — movies, music, TV shows, events, arts and culture opinions",
  networking:          "a professional networking event — meeting new contacts, pitching yourself, career conversation",
  luxury_boutique:     "a luxury boutique — high-end retail; you are a knowledgeable, discreet sales associate serving a discerning client",
  trade_fair:          "a professional trade fair — B2B conversations, demonstrating a product, networking at an exhibition stand",
  executive_assistant: "executive assistant — handling calls and messages on behalf of a senior manager, scheduling, professional relay of information",
  medical_secretary:   "medical secretary — booking appointments, patient intake, handling administrative healthcare enquiries professionally",
  journalist_interview:"a journalist interview — the learner is being interviewed on the record, or is the journalist conducting the interview",
};

// ─── Professional roleplay specifics ─────────────────────────────────────────
const PROFESSIONAL_ROLE_INSTRUCTIONS: Record<string, string> = {
  job_interview: `CHARACTER: You are James, a sharp and experienced hiring manager. You are curious and investigative — your goal is to understand exactly what this candidate has done, not to explain what the role requires.
ORIENTATION: You are PAST-focused. You want evidence from their history. You are NOT future-focused — never tell the candidate what the role will expect, what the team values, or what the company looks for. You already know that. You want to know what THEY did.
BEHAVIOUR: Probe for specifics. When they give a general answer, push for a concrete example. When they give an example, push for numbers, decisions, and trade-offs. Use phrases like: "walk me through exactly how", "what did you personally do", "what was the outcome", "how did you know it worked", "what would you do differently". Never fill a sentence with role expectations — fill it with your reaction to what they said. Stay sharp, direct, and genuinely curious.`,

  luxury_boutique: `CHARACTER: You are Isabelle, an expert sales associate at an upscale boutique (fashion, watches, jewellery, or similar luxury goods). Your goal is to make the client feel understood and valued — not sold to.
BEHAVIOUR: Ask about the occasion, their taste, who the item is for. Present options with quiet confidence. Vocabulary to use: "we have something rather special", "the craftsmanship is exceptional", "it would complement beautifully", "tailored to your taste", "a curated selection". Never rush, never oversell, never use slang. Project discreet warmth and expertise.`,

  networking: `CHARACTER: You are David, a senior professional (Director or VP level) at an industry networking event — same tier as the learner. You've just met them.
BEHAVIOUR: Be genuinely curious about their role and work — ask specific questions, not generic ones. Share a brief insight about your own work. Look for real connections ("that overlaps with what we're working on"). Vocabulary: "what's your focus right now", "that's an interesting angle", "we should connect properly after this", "in the space". Warm but sharp, confident without being arrogant.`,

  journalist_interview: `CHARACTER: You are Rachel, an experienced investigative journalist conducting a formal on-the-record interview.
BEHAVIOUR: Ask pointed, specific questions. Never accept vague or evasive answers — probe immediately: "what exactly do you mean by that", "can you give a concrete example", "what was the outcome". Keep the pressure professional but persistent. Vocabulary: "on the record", "to be precise", "your position on this", "sources close to the matter", "how do you respond to". Push for specifics every single turn.`,

  trade_fair: `CHARACTER: You are Thomas, an experienced B2B sales professional and industry expert at an international trade fair. You are a visitor approaching the learner's stand, OR the learner is a visitor and you are manning the stand — adapt to whichever makes the conversation flow.
BEHAVIOUR: Be professional, knowledgeable, and genuinely curious. Ask about the company, specific needs, production volume, target market. Present products or services with precision and authority. Vocabulary to use: "we specialise in", "our lead time is", "that would be a direct fit for your requirements", "I can arrange a follow-up with our technical team", "what quantities are you looking at", "do you have a stand here". Never be pushy. Be expert and trustworthy.`,

  executive_assistant: `CHARACTER: You are Claire, the executive assistant to a senior director or C-suite executive at a large company. You are handling communications and scheduling on behalf of your principal.
BEHAVIOUR: Be polished, efficient, and impeccably professional at all times. Handle every request with precision. Ask clarifying questions: purpose of meeting, attendees, urgency level, preferred format. Relay messages accurately. Vocabulary: "I'll check his availability", "can I take a message", "the director has asked me to relay", "I can schedule that for", "to confirm the details of your request", "I'm afraid that slot is taken". Never commit beyond your authority. Always accurate, always composed, never flustered.`,

  medical_secretary: `CHARACTER: You are Margaret, a medical secretary working in a clinic or hospital administrative office.
BEHAVIOUR: Be calm, reassuring, and efficient. Handle appointment booking, patient intake queries, and administrative healthcare questions professionally. Ask for relevant details: name, date of birth, reason for visit, insurance or coverage, preferred time slot. Vocabulary: "the doctor's next available slot is", "could I take your date of birth", "this is a routine appointment", "the clinic's policy is", "I'll need to check with the physician", "is this urgent or can it wait". Be clear and supportive. NEVER give medical advice — always refer clinical questions to the doctor.`,
};

// ─── Mode instructions ────────────────────────────────────────────────────────
const MODE_INSTRUCTIONS: Record<string, string> = {
  practice:  "Be warm and encouraging. Build the learner's confidence. Acknowledge good moments naturally — not effusively. Maintain a comfortable, supportive pace.",
  challenge: "Be demanding and precise. Push for more accurate vocabulary, richer expression, and sharper responses. Ask harder follow-ups. Apply real but respectful pressure.",
  exam:      "Be neutral and evaluative. No praise, no warmth. Ask exact, formal questions. Do not fill silences. Maintain a professionally detached, examiner manner throughout.",
};

// ─── CEFR-specific level instructions ────────────────────────────────────────
const LEVEL_INSTRUCTIONS: Record<string, string> = {
  auto: `Start at B1 level. Calibrate each turn: if the learner uses very simple sentences or makes frequent basic errors, move down to A2 pace and vocabulary. If they're fluid and complex, rise to B2–C1. Adapt continuously — never stay static.`,

  beginner: `CEFR A0–A2 — strict rules:
• Your sentences: 6–8 words maximum. Present simple + simple past + can/want/need/have only.
• Vocabulary: concrete, everyday only (help, work, home, time, problem, food, name, place, day).
• Questions: yes/no or single-word-answer ONLY. ("Do you have...?" / "Is it...?" / "Where is the...?")
• FORBIDDEN: conditionals, passive voice, phrasal verbs, idioms, abstract nouns, relative clauses.
• Accept broken English without comment. Be patient and warm. Make the learner feel safe to speak.`,

  intermediate: `CEFR B1–B2 — calibrated rules:
• Sentences: 12–18 words. One subordinate clause is fine.
• Grammar: present perfect, going-to/will future, would-conditionals, common phrasal verbs, reported speech.
• Vocabulary: natural everyday — opinions, plans, feelings, travel, work, current events.
• Questions: open experience and opinion. ("What did you think of...?" / "Have you ever...?" / "What would you do if...?")
• FORBIDDEN: highly formal or academic register, rare vocabulary, overly complex syntax.`,

  advanced: `CEFR C1–C2 — full native complexity:
• Sentences: multiple clauses, passive constructions, all tenses including perfect aspects and subjunctive.
• Vocabulary: collocations, idioms, register shifts, nuanced professional and academic vocabulary.
• Questions: analytical, speculative, abstract. ("To what extent...?" / "How might you reconcile...?" / "What's your take on...?")
• Push the learner to be precise, nuanced, and eloquent. Do NOT simplify.
• Respond as a native speaker would to an intellectual equal.`,
};

// ─── Scenarios that require formal professional register ──────────────────────
const PROFESSIONAL_SCENARIOS = new Set([
  "executive_assistant", "medical_secretary", "luxury_boutique", "trade_fair",
  "legal", "banking", "business_meeting", "job_interview", "academic",
  "journalist_interview", "networking",
]);

// ─── AI persona names by scenario ────────────────────────────────────────────
const PERSONA_NAMES: Partial<Record<string, string>> = {
  job_interview:        "James",
  luxury_boutique:      "Isabelle",
  journalist_interview: "Rachel",
  trade_fair:           "Thomas",
  executive_assistant:  "Claire",
  medical_secretary:    "Margaret",
  networking:           "David",
  business_meeting:     "Marcus",
  restaurant:           "Oliver",
  hotel:                "Victoria",
  banking:              "Richard",
  legal:                "Catherine",
  medical:              "Dr. Harris",
  academic:             "Professor Chen",
  phone_call:           "Sarah",
  customer_service:     "Emma",
  real_estate:          "Christopher",
  tech_support:         "Alex",
  small_talk:           "Sam",
  airport:              "Helen",
  apartment:            "Nathan",
  shopping:             "Lily",
  daily_life:           "Jordan",
  emergency:            "Officer Blake",
};

// ─── All structural bridge phrases (for dynamic detection) ────────────────────
const ALL_STRUCTURAL_BRIDGES = [
  "In this role,", "In our role,", "In this position,", "For this role,",
  "In our environment,", "In our systems,", "In our production", "In our stack,",
  "In our team,", "In this team,", "In our company,", "At our level,",
  "In a system like", "In production,", "In this context,",
  "we expect engineers", "we expect candidates", "we expect leads",
  "we look for engineers", "we value engineers", "we need engineers",
  "we prioritise", "we require", "we evaluate",
];

// ─── CEFR clamp helper ────────────────────────────────────────────────────────
function clampCefr(value: string): string {
  const v = value.trim().toUpperCase();
  return ["A1", "A2", "B1", "B2", "C1", "C2"].includes(v) ? v : "B1";
}

// ─── Feedback shape ───────────────────────────────────────────────────────────
interface FeedbackShape {
  estimatedLevel: string;
  strengths: string[];
  improvements: string[];
  correctedExample: string;
  fluencyComment: string;
  nextStep: string;
  strongestPhrase: string;
  tip: string;
}

function parseFeedback(raw: string): FeedbackShape {
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  return {
    estimatedLevel:   typeof parsed.estimatedLevel   === "string" ? clampCefr(parsed.estimatedLevel) : "B1",
    strengths:        Array.isArray(parsed.strengths)    ? (parsed.strengths    as string[]).slice(0, 2) : [],
    improvements:     Array.isArray(parsed.improvements) ? (parsed.improvements as string[]).slice(0, 3) : [],
    correctedExample: typeof parsed.correctedExample === "string" ? parsed.correctedExample : "",
    fluencyComment:   typeof parsed.fluencyComment   === "string" ? parsed.fluencyComment   : "",
    nextStep:         typeof parsed.nextStep         === "string" ? parsed.nextStep         : "",
    strongestPhrase:  typeof parsed.strongestPhrase  === "string" ? parsed.strongestPhrase  : "",
    tip:              typeof parsed.tip              === "string" ? parsed.tip              : "",
  };
}

function buildFeedbackPrompt(feedbackLanguage: string, mode: string): string {
  const modeStyle: Record<string, string> = {
    practice: "Be warm, supportive, and encouraging. Celebrate genuine progress.",
    challenge: "Be firm, direct, and high-standard. Push the learner to do better.",
    exam:      "Be neutral and objective. Examiner-style. No encouragement, just facts.",
  };
  return `English coach. Analyze learner transcript. Language: ${feedbackLanguage} (except correctedExample=English). ${modeStyle[mode] ?? modeStyle.practice}

Return ONLY this JSON (no markdown):
{"estimatedLevel":"B1","strengths":["quote learner phrase + observation","quote learner phrase + observation"],"improvements":["Use 'X' instead of 'Y'. Short reason.","Use 'X' instead of 'Y'. Short reason."],"correctedExample":"A native speaker might say: '...'","fluencyComment":"1 sentence on pace/fillers/rhythm (not grammar).","nextStep":"1 concrete exercise. Max 20 words.","strongestPhrase":"verbatim learner quote","tip":""}

Rules: estimatedLevel=CEFR only. strengths=2 in ${feedbackLanguage}. improvements=max 3. correctedExample=English. fluencyComment/nextStep in ${feedbackLanguage}. strongestPhrase=exact learner words.`;
}

async function logSession(
  feedback: FeedbackShape,
  deviceId: string,
  scenario: string,
  interfaceLanguage: string,
  feedbackLanguage: string,
  logFn: ReturnType<typeof log>,
): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  ensureSessionTable()
    .then(() => {
      const errorTags = feedback.improvements.map((imp) => {
        const m = imp.match(/instead of ['"]([^'"]{1,40})['"]/i);
        return m ? m[1].trim().toLowerCase() : null;
      }).filter((t): t is string => t !== null);
      return pool.query(
        `INSERT INTO speakup_sessions (device_id, estimated_level, error_tags, scenario, interface_language, feedback_language)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [deviceId, feedback.estimatedLevel, errorTags, scenario, interfaceLanguage, feedbackLanguage],
      );
    })
    .catch((err) => logFn.warn({ err }, "Session save failed (non-critical)"));
}

// ─── /conversation ────────────────────────────────────────────────────────────
export async function conversationHandler(req: AppReq, res: AppRes): Promise<void> {
  if (!applyRateLimit(req, res)) return;

  const parseResult = SendConversationMessageBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body", details: parseResult.error.message });
    return;
  }

  const { messages, mode, scenario, level, interfaceLanguage, feedbackLanguage, learnerContext } = parseResult.data;
  const logger = log(req);

  type MsgInput = { role: "user" | "assistant" | "system"; content: string };
  const safeHistory = messages
    .filter((m: MsgInput) => m.role === "user" || m.role === "assistant")
    .map((m: MsgInput) => ({ role: m.role as "user" | "assistant", content: m.content }))
    .slice(-10);

  const recentAiReplies = safeHistory.filter((m) => m.role === "assistant").slice(-8);

  const bannedBlock = recentAiReplies.length > 0
    ? `\n══ BANNED — YOUR ${recentAiReplies.length} MOST RECENT REPLIES (DO NOT ECHO, REPHRASE OR REVISIT) ══
${recentAiReplies.map((m, i, arr) => `  [${i === arr.length - 1 ? "← MOST RECENT" : `${arr.length - i - 1} turns ago`}] "${m.content}"`).join("\n")}
⚠ Check: Same opening word? Same question type? Same angle? → If yes, rewrite completely before responding.`
    : "";

  const bridgesUsedRecently = [
    ...new Set(recentAiReplies.flatMap((m) =>
      ALL_STRUCTURAL_BRIDGES.filter((b) => m.content.includes(b))
    )),
  ];
  const bridgeBanBlock = bridgesUsedRecently.length > 0
    ? `\n⚠ STRUCTURAL BRIDGES YOU OVERUSED (banned this turn — no synonyms either): ${bridgesUsedRecently.map((b) => `"${b}"`).join(", ")}.`
    : "";

  const lastLearnerMsg = [...safeHistory].reverse().find((m) => m.role === "user")?.content ?? null;
  void lastLearnerMsg; // used implicitly via errorTrackBlock

  const recentLearnerMsgs = safeHistory.filter((m) => m.role === "user").slice(-4);
  const errorTrackBlock = recentLearnerMsgs.length >= 2
    ? `\n══ IN-SESSION LEARNER INPUT (last ${recentLearnerMsgs.length} messages) ══
${recentLearnerMsgs.map((m, i, arr) => `  [T-${arr.length - i}] "${m.content}"`).join("\n")}
→ Silently scan for recurring errors (tense, subject-verb agreement, articles, prepositions, word order).
→ If the same error appears more than once: in YOUR reply, use the correct form naturally in your own sentence. Weave it in. Never announce it. Never repeat their error.`
    : "";

  const scenarioLabel = SCENARIO_LABELS[scenario] ?? scenario;
  const modeInstructions = MODE_INSTRUCTIONS[mode] ?? MODE_INSTRUCTIONS.practice;
  const levelInstructions = LEVEL_INSTRUCTIONS[level] ?? LEVEL_INSTRUCTIONS.auto;
  const personaName = PERSONA_NAMES[scenario];
  const personaLine = personaName
    ? `\nYOUR NAME: ${personaName}. If the learner asks your name or it fits naturally in the scene, use it. Never break character to announce it.`
    : "";

  const nativeLangNote = feedbackLanguage && feedbackLanguage !== "English"
    ? ` The learner's native language is likely ${feedbackLanguage}. Watch for typical ${feedbackLanguage}-to-English transfer errors (articles, tenses, prepositions, word order).`
    : "";

  const professionalNote = PROFESSIONAL_ROLE_INSTRUCTIONS[scenario]
    ?? (PROFESSIONAL_SCENARIOS.has(scenario)
      ? "PROFESSIONAL REGISTER: Use formal, polished English throughout. No slang, no casual filler. Maintain appropriate professional decorum at all times."
      : "");

  const memoryNote = learnerContext
    ? `\n══ LEARNER HISTORY (from previous sessions) ══\n${learnerContext}`
    : "";

  const systemPrompt = `You are a human conversation partner inside an English-language practice scenario. You are NOT a language teacher — you are a character inside the scene.

══ SCENARIO ══
${scenarioLabel}

${professionalNote}

══ YOUR CHARACTER ══
You are a native English speaker playing your role in the scenario above. Stay in character at all times. The learner is your conversational partner.${personaLine}

══ COACHING MODE ══
${modeInstructions}

══ LANGUAGE LEVEL ══
${levelInstructions}

══ LEARNER BACKGROUND ══
Interface language: ${interfaceLanguage}.${nativeLangNote}${memoryNote}${errorTrackBlock}${bannedBlock}${bridgeBanBlock}

══ RESPONSE FORMAT — 1 OR 2 SENTENCES MAXIMUM ══
The default is ONE sentence that combines your reaction with the question, joined by a dash (—).
Use TWO sentences only when you must push back on a specific claim before asking.
NEVER three sentences. There is no room and no reason for a third.

HOW TO BUILD YOUR SENTENCE:
  [topic/claim from their answer] + [your sharp reaction or challenge] — [your question]?

EXAMPLES TO MATCH EXACTLY:
  "Redis loses messages on restart without AOF persistence — did you run replication, and what happened to queued notifications when it went down?"
  "Leading three developers is enough to expose real accountability problems — which decision did you make that you would change now?"
  "Five years with Python and JavaScript suggests you have worked across both layers — describe one project where you owned the full stack and what the outcome was."
  "Ninety thousand is a useful anchor — is that your base expectation or total compensation?"
  "You mentioned 'product innovation' without specifying what you have actually seen — which feature of ours do you consider genuinely innovative and why?"

OPENER ROTATION — never begin 3 consecutive replies with "You" or "Your". Use the topic, a number, a challenge, a verb, or the question itself.

══ HARD RULES ══
• ENGLISH ONLY.
• 1–2 SENTENCES. No third sentence — ever.
• FORBIDDEN OPENERS: "That's", "Great", "Interesting", "Wonderful", "Fantastic", "Amazing", "Absolutely", "Indeed", "Of course", "Certainly", "Sure", "I see", "Okay".
• ONE QUESTION per reply — the sharpest one only.
• STAY IN CHARACTER — never mention language learning, AI, or coaching.
• IMPLICIT CORRECTION — weave the correct form into your own sentence. Never announce it. Never echo the error.
• NO BRIDGE SENTENCES — never begin a sentence with the banned patterns above.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      temperature: 0.85,
      max_completion_tokens: 220,
      frequency_penalty: 0.8,
      presence_penalty: 0.6,
      messages: [
        { role: "system", content: systemPrompt },
        ...safeHistory,
      ],
    });

    const rawMessage = response.choices[0]?.message?.content ?? "";
    if (!rawMessage.trim()) {
      logger.error("OpenAI returned empty conversation response");
      res.status(500).json({ error: "The AI returned an empty response. Please try again." });
      return;
    }
    const assistantMessage = stripBridgeSentence(rawMessage);
    res.json({ message: assistantMessage, role: "assistant" });
  } catch (err) {
    const status = openAIStatus(err);
    if (status === 429) { res.status(429).json({ error: "Rate limit reached. Please wait a moment and try again." }); return; }
    if (status === 529) { res.status(503).json({ error: "The AI service is overloaded. Please try again in a few seconds." }); return; }
    logger.error({ err }, "OpenAI conversation error");
    res.status(500).json({ error: "The AI is temporarily unavailable. Please try again." });
  }
}

// ─── /feedback ────────────────────────────────────────────────────────────────
export async function feedbackHandler(req: AppReq, res: AppRes): Promise<void> {
  if (!applyRateLimit(req, res)) return;

  const parseResult = GenerateFeedbackBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body", details: parseResult.error.message });
    return;
  }

  const { messages, mode, feedbackLanguage } = parseResult.data;
  const rawBody = req.body as Record<string, unknown>;
  const deviceId = typeof rawBody.deviceId === "string" ? rawBody.deviceId : "anonymous";
  const scenario = typeof rawBody.scenario === "string" ? rawBody.scenario : "unknown";
  const interfaceLanguage = typeof rawBody.interfaceLanguage === "string" ? rawBody.interfaceLanguage : "English";
  const logger = log(req);

  type FbMsgInput = { role: "user" | "assistant" | "system"; content: string };
  const transcript = messages
    .filter((m: FbMsgInput) => m.role === "user" || m.role === "assistant")
    .map((m: FbMsgInput) => `${m.role === "user" ? "LEARNER" : "AI"}: ${m.content}`)
    .join("\n");

  const systemPrompt = buildFeedbackPrompt(feedbackLanguage, mode);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      temperature: 0.3,
      max_completion_tokens: 360,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `TRANSCRIPT:\n${transcript}` },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    if (!raw.trim()) {
      logger.error("OpenAI returned empty feedback response");
      res.status(500).json({ error: "Failed to generate feedback. Please try again." });
      return;
    }

    let feedback: FeedbackShape;
    try {
      feedback = parseFeedback(raw);
    } catch {
      logger.error({ raw }, "Failed to parse feedback JSON");
      res.status(500).json({ error: "Failed to parse feedback. Please try again." });
      return;
    }

    void logSession(feedback, deviceId, scenario, interfaceLanguage, feedbackLanguage, logger);
    res.json({ feedback });
  } catch (err) {
    const status = openAIStatus(err);
    if (status === 429) { res.status(429).json({ error: "Rate limit reached. Please wait a moment and try again." }); return; }
    if (status === 529) { res.status(503).json({ error: "The AI service is overloaded. Please try again in a few seconds." }); return; }
    logger.error({ err }, "OpenAI feedback error");
    res.status(500).json({ error: "The AI is temporarily unavailable. Please try again." });
  }
}

// ─── /feedback-stream ─────────────────────────────────────────────────────────
export async function feedbackStreamHandler(req: AppReq, res: AppRes): Promise<void> {
  if (!applyRateLimit(req, res)) return;

  const parseResult = GenerateFeedbackBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body", details: parseResult.error.message });
    return;
  }

  const { messages, mode, feedbackLanguage } = parseResult.data;
  const rawBody = req.body as Record<string, unknown>;
  const deviceId = typeof rawBody.deviceId === "string" ? rawBody.deviceId : "anonymous";
  const scenario = typeof rawBody.scenario === "string" ? rawBody.scenario : "unknown";
  const interfaceLanguage = typeof rawBody.interfaceLanguage === "string" ? rawBody.interfaceLanguage : "English";
  const logger = log(req);

  type FbMsgInput = { role: "user" | "assistant" | "system"; content: string };
  const transcript = messages
    .filter((m: FbMsgInput) => m.role === "user" || m.role === "assistant")
    .map((m: FbMsgInput) => `${m.role === "user" ? "LEARNER" : "AI"}: ${m.content}`)
    .join("\n");

  const systemPrompt = buildFeedbackPrompt(feedbackLanguage, mode);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      temperature: 0.3,
      max_completion_tokens: 360,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `TRANSCRIPT:\n${transcript}` },
      ],
      stream: true,
    });

    let raw = "";
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? "";
      if (token) {
        raw += token;
        res.write(`data: ${JSON.stringify({ t: token })}\n\n`);
      }
    }

    let feedback: FeedbackShape;
    try {
      feedback = parseFeedback(raw);
    } catch {
      res.write(`data: ${JSON.stringify({ error: "Failed to parse feedback JSON" })}\n\n`);
      res.end();
      return;
    }

    void logSession(feedback, deviceId, scenario, interfaceLanguage, feedbackLanguage, logger);
    res.write(`data: ${JSON.stringify({ done: true, feedback })}\n\n`);
    res.end();
  } catch (err) {
    const status = openAIStatus(err);
    const msg = status === 429 ? "Rate limit reached. Please wait a moment and try again."
      : status === 529 ? "The AI service is overloaded. Please try again."
      : "The AI is temporarily unavailable. Please try again.";
    logger.error({ err }, "OpenAI feedback-stream error");
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
}

// ─── /hint ────────────────────────────────────────────────────────────────────
export async function hintHandler(req: AppReq, res: AppRes): Promise<void> {
  if (!applyRateLimit(req, res)) return;

  const parseResult = GetConversationHintBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body", details: parseResult.error.message });
    return;
  }

  const { messages, scenario, level, feedbackLanguage, learnerContext } = parseResult.data;
  const logger = log(req);

  type MsgInput = { role: "user" | "assistant" | "system"; content: string };
  const lastAiMessage = [...messages]
    .filter((m: MsgInput) => m.role === "assistant")
    .pop()?.content ?? "";

  const scenarioLabel = SCENARIO_LABELS[scenario] ?? scenario;

  if (!lastAiMessage) {
    res.json({
      simpleReplies: ["Hello, nice to meet you.", "Good morning! How are you doing?"],
      naturalReply: "It's a pleasure to meet you — I've been looking forward to this.",
      vocabularyHelp: "pleased to meet you — formal greeting; looking forward to — expressing anticipation",
      explanation: feedbackLanguage !== "English"
        ? `Here are some ways to open the conversation in the context of: ${scenarioLabel}.`
        : "Here are some ways to open the conversation.",
    });
    return;
  }

  const learnerNote = learnerContext
    ? `\n══ LEARNER HISTORY ══\n${learnerContext}\nUse this to calibrate difficulty and vocabulary. If they have recurring errors, make sure the suggestions avoid or gently model the correct form.`
    : "";

  const systemPrompt = `English learner needs reply suggestions. Scenario: ${scenarioLabel}. Level: ${level}.${learnerNote}
AI said: "${lastAiMessage}"

Return ONLY this JSON (no markdown):
{"simpleReplies":["short reply 1","short reply 2"],"naturalReply":"fluent C1 reply","vocabularyHelp":"1-2 key phrases","explanation":"1 tip in ${feedbackLanguage}"}

Rules: simpleReplies=2 short correct replies; naturalReply=idiomatic fluent; all reply to the AI message above.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      temperature: 0.7,
      max_completion_tokens: 160,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: systemPrompt }],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    if (!raw.trim()) {
      res.status(500).json({ error: "Empty response from AI. Please try again." });
      return;
    }
    const parsed = JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
    res.json({
      simpleReplies: Array.isArray(parsed.simpleReplies) ? parsed.simpleReplies.slice(0, 2) : [],
      naturalReply: typeof parsed.naturalReply === "string" ? parsed.naturalReply : "",
      vocabularyHelp: typeof parsed.vocabularyHelp === "string" ? parsed.vocabularyHelp : "",
      explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
    });
  } catch (err) {
    const status = openAIStatus(err);
    if (status === 429) { res.status(429).json({ error: "Rate limit reached. Please wait a moment and try again." }); return; }
    if (status === 529) { res.status(503).json({ error: "The AI service is overloaded. Please try again in a few seconds." }); return; }
    logger.error({ err }, "OpenAI hint error");
    res.status(500).json({ error: "Hint generation failed. Please try again." });
  }
}

// ─── /hint-stream ─────────────────────────────────────────────────────────────
export async function hintStreamHandler(req: AppReq, res: AppRes): Promise<void> {
  if (!applyRateLimit(req, res)) return;

  const parseResult = GetConversationHintBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body", details: parseResult.error.message });
    return;
  }

  const { messages, scenario, level, feedbackLanguage, learnerContext } = parseResult.data;
  const logger = log(req);

  type MsgInput = { role: "user" | "assistant" | "system"; content: string };
  const lastAiMessage = [...messages]
    .filter((m: MsgInput) => m.role === "assistant")
    .pop()?.content ?? "";

  const scenarioLabel = SCENARIO_LABELS[scenario] ?? scenario;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  if (!lastAiMessage) {
    const hint = {
      simpleReplies: ["Hello, nice to meet you.", "Good morning! How are you doing?"],
      naturalReply: "It's a pleasure to meet you — I've been looking forward to this.",
      vocabularyHelp: "pleased to meet you — formal greeting; looking forward to — expressing anticipation",
      explanation: feedbackLanguage !== "English"
        ? `Here are some ways to open the conversation in the context of: ${scenarioLabel}.`
        : "Here are some ways to open the conversation.",
    };
    res.write(`data: ${JSON.stringify({ done: true, hint })}\n\n`);
    res.end();
    return;
  }

  const learnerNote = learnerContext
    ? `\n══ LEARNER HISTORY ══\n${learnerContext}\nUse this to calibrate difficulty and vocabulary.`
    : "";

  const systemPrompt = `English learner needs reply suggestions. Scenario: ${scenarioLabel}. Level: ${level}.${learnerNote}
AI said: "${lastAiMessage}"

Return ONLY this JSON (no markdown):
{"simpleReplies":["short reply 1","short reply 2"],"naturalReply":"fluent C1 reply","vocabularyHelp":"1-2 key phrases","explanation":"1 tip in ${feedbackLanguage}"}

Rules: simpleReplies=2 short correct replies; naturalReply=idiomatic fluent; all reply to the AI message above.`;

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      temperature: 0.7,
      max_completion_tokens: 140,
      messages: [{ role: "system", content: systemPrompt }],
      stream: true,
    });

    let raw = "";
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? "";
      if (token) {
        raw += token;
        res.write(`data: ${JSON.stringify({ t: token })}\n\n`);
      }
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()) as Record<string, unknown>;
    } catch {
      res.write(`data: ${JSON.stringify({ error: "Failed to parse hint JSON" })}\n\n`);
      res.end();
      return;
    }

    const hint = {
      simpleReplies: Array.isArray(parsed.simpleReplies) ? (parsed.simpleReplies as string[]).slice(0, 2) : [],
      naturalReply: typeof parsed.naturalReply === "string" ? parsed.naturalReply : "",
      vocabularyHelp: typeof parsed.vocabularyHelp === "string" ? parsed.vocabularyHelp : "",
      explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
    };
    res.write(`data: ${JSON.stringify({ done: true, hint })}\n\n`);
    res.end();
  } catch (err) {
    const status = openAIStatus(err);
    const msg = status === 429 ? "Rate limit reached. Please wait a moment and try again."
      : status === 529 ? "The AI service is overloaded. Please try again."
      : "Hint generation failed. Please try again.";
    logger.error({ err }, "OpenAI hint-stream error");
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
}

// ─── /improve ─────────────────────────────────────────────────────────────────
export async function improveHandler(req: AppReq, res: AppRes): Promise<void> {
  if (!applyRateLimit(req, res)) return;

  const parseResult = ImproveMessageBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body", details: parseResult.error.message });
    return;
  }

  const { text, scenario, feedbackLanguage } = parseResult.data;
  const logger = log(req);
  const safeText = text.trim().slice(0, 500);
  const scenarioLabel = SCENARIO_LABELS[scenario] ?? scenario;

  const systemPrompt = `The learner is practising English in the context of: ${scenarioLabel}.
They wrote: "${safeText}"

Improve this message. Return ONLY valid JSON — no markdown, no code blocks:
{
  "corrected": "Grammatically correct version — fix errors only, keep meaning identical",
  "natural": "More natural, fluent version a confident English speaker would say",
  "explanation": "Brief explanation of changes in ${feedbackLanguage}"
}

RULES:
- corrected: minimal changes — fix grammar, spelling, word order only; do NOT change meaning or vocabulary
- natural: may restructure for fluency, idiom, and natural flow; should sound genuinely native
- explanation: 1-3 sentences in ${feedbackLanguage} — explain what changed and why, keep it concise and practical
- If the original is already correct and natural: set corrected = original, make natural only slightly more idiomatic, note in explanation that the original was already good
- Return raw JSON only`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      temperature: 0.2,
      max_completion_tokens: 300,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: systemPrompt }],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    if (!raw.trim()) {
      res.status(500).json({ error: "Empty response from AI. Please try again." });
      return;
    }
    const parsed = JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
    res.json({
      corrected: typeof parsed.corrected === "string" ? parsed.corrected : safeText,
      natural: typeof parsed.natural === "string" ? parsed.natural : safeText,
      explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
    });
  } catch (err) {
    const status = openAIStatus(err);
    if (status === 429) { res.status(429).json({ error: "Rate limit reached. Please wait a moment and try again." }); return; }
    if (status === 529) { res.status(503).json({ error: "The AI service is overloaded. Please try again in a few seconds." }); return; }
    logger.error({ err }, "OpenAI improve error");
    res.status(500).json({ error: "Improvement failed. Please try again." });
  }
}

// ─── /translate ───────────────────────────────────────────────────────────────
export async function translateHandler(req: AppReq, res: AppRes): Promise<void> {
  if (!applyRateLimit(req, res)) return;

  const body = req.body as { text?: unknown; targetLanguage?: unknown };
  const logger = log(req);

  if (typeof body.text !== "string" || !body.text.trim()) {
    res.status(400).json({ error: "Missing or invalid 'text' field." });
    return;
  }
  if (typeof body.targetLanguage !== "string" || !body.targetLanguage.trim()) {
    res.status(400).json({ error: "Missing or invalid 'targetLanguage' field." });
    return;
  }

  const safeText = body.text.trim().slice(0, 2000);
  const targetLanguage = body.targetLanguage;

  if (targetLanguage === "English") {
    res.json({ translation: safeText });
    return;
  }

  const systemPrompt = `You are a professional translator.
Translate the following English text into ${targetLanguage}.
Preserve the meaning, tone, and any educational or conversational context exactly.
Do NOT add explanations, commentary, or extra text.
Return ONLY the translated text, nothing else.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      temperature: 0.1,
      max_completion_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: safeText },
      ],
    });

    const translation = response.choices[0]?.message?.content?.trim() ?? "";
    if (!translation) {
      logger.error("OpenAI returned empty translation response");
      res.status(500).json({ error: "Translation unavailable. Please try again." });
      return;
    }
    res.json({ translation });
  } catch (err) {
    const status = openAIStatus(err);
    if (status === 429) { res.status(429).json({ error: "Rate limit reached. Please wait a moment and try again." }); return; }
    if (status === 529) { res.status(503).json({ error: "The AI service is overloaded. Please try again in a few seconds." }); return; }
    logger.error({ err }, "OpenAI translation error");
    res.status(500).json({ error: "Translation unavailable. Please try again." });
  }
}
