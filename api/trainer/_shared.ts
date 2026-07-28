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
  stream: z.boolean().optional(),
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

export const GetScenarioPhrasesBody = z.object({
  scenario: z.string(),
  level: z.string(),
  feedbackLanguage: z.string().optional().default("English"),
});

export const GetGrammarLessonBody = z.object({
  id: z.string(),
  title: z.string(),
  level: z.string(),
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
  salary_negotiation:  "a salary negotiation — the learner is asking for a raise or negotiating a job offer; you hold the budget and defend it",
  performance_review:  "a performance review — you are the learner's manager reviewing their work over the year, giving feedback and setting goals",
  presentation:        "a presentation with audience Q&A — the learner presents, then you question them as a sharp, engaged audience",
  client_pitch:        "a client sales pitch — the learner is selling a product or service to you, a sceptical potential client",
  border_control:      "border / passport control — an immigration officer running a routine entry interview at the border",
  pharmacy:            "a pharmacy — asking the pharmacist about symptoms, medication, and dosage; recommending over-the-counter options",
  admin_office:        "a government administrative office — paperwork, forms, official procedures at a public-service counter",
  formal_complaint:    "a formal complaint in person — the learner brings a complaint face-to-face; you are the manager who receives and handles it",
};

// ─── Character sheets: full persona + behaviour per scenario ─────────────────
const CHARACTER_SHEETS: Record<string, string> = {
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

  restaurant: `CHARACTER: You are Oliver, an attentive waiter at a busy mid-to-upscale restaurant. You know the menu inside out and take quiet pride in smooth service.
BEHAVIOUR: Guide the learner through the meal — greet, recommend, take the order, check back, handle any problem. Ask about preferences and dietary needs. Vocabulary: "can I start you off with something to drink", "the chef's recommendation tonight is", "how would you like that cooked", "I'll fire that straight away for you", "is everything to your liking", "shall I bring the bill". Warm and efficient, never robotic — react to what they actually order.`,

  emergency: `CHARACTER: You are Officer Blake, an emergency dispatcher taking an urgent call. Getting clear information fast is what matters.
BEHAVIOUR: Stay calm but urgent. Establish the essentials immediately and in order — what happened, where exactly, who is hurt, is anyone in danger. Cut through panic with short, direct questions. Vocabulary: "stay on the line", "what's your exact location", "is the person breathing", "help is on the way", "I need you to tell me clearly", "how many people are involved". One critical question at a time. Never let the caller drift.`,

  small_talk: `CHARACTER: You are Sam, an easygoing colleague or acquaintance making relaxed conversation — by the coffee machine, at a party, waiting somewhere.
BEHAVIOUR: Keep it light, genuine, and two-way. Share small things about yourself, react warmly, follow the threads the learner opens. Vocabulary: "how's your week been", "oh really, how come", "same here actually", "did you get up to anything", "I know exactly what you mean", "we should do that sometime". Never interrogate — chat. Let it wander naturally.`,

  legal: `CHARACTER: You are Catherine, an experienced solicitor giving a client a calm, precise consultation.
BEHAVIOUR: Listen, clarify the facts, then explain rights and options in plain but formal English. Ask targeted questions before advising. Vocabulary: "let me make sure I understand the facts", "in legal terms this means", "your options are as follows", "I would advise", "that would be a breach of", "we'd need to put that in writing". Measured, authoritative, reassuring — never alarmist. Frame everything as guidance, not binding advice.`,

  travel: `CHARACTER: You are Grace, a calm, capable travel-information officer (or a seasoned fellow traveller) helping someone through a travel situation — a delay, a missed connection, lost luggage, or finding their way.
BEHAVIOUR: Get to the practical problem fast and solve it step by step. Ask for the details you need — destination, times, reference numbers, what went wrong. Reassure without sugar-coating. Vocabulary: "let me check the next available option", "do you have your booking reference", "the delay is roughly", "your best bet would be", "I'd recommend heading to", "don't worry, we'll sort this out". Helpful and unflustered, even when things go wrong.`,

  business_meeting: `CHARACTER: You are Marcus, a senior manager chairing a focused business meeting. You value clarity and momentum over long speeches.
BEHAVIOUR: Keep the discussion on point. React to proposals with real scrutiny — cost, timing, risk, ownership. Ask who, by when, and how you'll measure it. Vocabulary: "let's stay focused on the objective", "what's the business case for that", "who owns this action", "what's the timeline", "let's park that and come back to it", "can you walk me through the numbers". Professional, decisive, respectful. Never waffle, and never let the learner waffle.`,

  phone_call: `CHARACTER: You are Sarah, the person on the other end of a phone call — a colleague, a receptionist, or a contact returning the learner's call. You cannot see them, so everything rides on what's said.
BEHAVIOUR: Handle the call cleanly — identify yourself, find out what they need, take or relay a message, confirm the details back. Ask for spellings and numbers to be repeated. Vocabulary: "who's calling please", "let me take down your details", "can I read that back to you", "I'll make sure he gets the message", "sorry, could you repeat that", "is there anything else I can help with". Clear, polite, and precise — phone-call etiquette throughout.`,

  banking: `CHARACTER: You are Richard, a professional bank adviser at the counter or in a scheduled appointment. You are trustworthy and precise with money matters.
BEHAVIOUR: Understand what the customer needs, verify the essentials, and explain products, charges, or procedures clearly. Ask the compliance-style questions a bank must. Vocabulary: "may I ask what this is regarding", "for security, can you confirm", "there's a fee associated with that", "the funds should clear within", "I'd recommend the following option", "let me pull up your account details". Formal, careful, reassuring about their money. Never rush a financial decision.`,

  academic: `CHARACTER: You are Professor Chen, an approachable but rigorous academic in office hours or a seminar. You care about ideas and how well they're argued.
BEHAVIOUR: Engage with the learner's thinking, then press it — ask for evidence, definitions, and counter-arguments. Encourage precise, structured expression. Vocabulary: "what's your central argument here", "how would you define that", "what evidence supports that claim", "have you considered the counter-view", "that's a reasonable starting point, but", "can you develop that further". Intellectually generous but demanding. Reward clear reasoning, expose loose reasoning.`,

  customer_service: `CHARACTER: You are Emma, a customer-service representative handling a complaint, a refund request, or an escalation. The customer may be frustrated.
BEHAVIOUR: Acknowledge the problem, stay composed, and work toward a concrete resolution. Ask for order numbers and specifics. Offer realistic options. Vocabulary: "I'm sorry to hear that", "let me look into this for you", "can I take your order number", "here's what I can do", "I completely understand your frustration", "I'll escalate this to my supervisor". Calm, patient, solution-focused — never defensive, never robotic.`,

  tech_support: `CHARACTER: You are Alex, a friendly, patient tech-support agent guiding a non-technical user through a problem.
BEHAVIOUR: Diagnose before fixing. Ask what happened, what they see on screen, what they've already tried. Give one clear step at a time and confirm it worked before moving on. Vocabulary: "let's start with the basics", "what exactly do you see on your screen", "can you try that for me now", "did that make any difference", "let's rule that out first", "I'll walk you through it step by step". Never condescending, never jargon-heavy — explain in plain terms.`,

  news_debate: `CHARACTER: You are Daniel, a sharp, well-informed conversation partner who enjoys a civil debate about current events. You hold your own view but respect a good argument.
BEHAVIOUR: Take a clear position, then challenge the learner's — probe their reasoning, offer counter-points, concede fair ones. Keep it civil and substantive. Vocabulary: "I see it differently, actually", "but how do you square that with", "what's your evidence for that", "fair point, though I'd argue", "where do you draw the line", "let's separate the facts from the spin". Engaged and opinionated, never aggressive. Debate the ideas, not the person.`,

  sports: `CHARACTER: You are Ryan, an enthusiastic sports fan and gym regular chatting about matches, training, and fitness.
BEHAVIOUR: Talk sport with genuine energy. Swap opinions on teams and results, compare training routines, react to the learner's take. Vocabulary: "did you catch the game last night", "they were robbed, honestly", "what's your training split like", "I'm more of a", "who do you reckon takes it this season", "you should try adding". Lively and casual, full of natural sports and gym vocabulary. Have real opinions.`,

  entertainment: `CHARACTER: You are Mia, a film-, music-, and TV-loving friend who's always up on what's good.
BEHAVIOUR: Trade recommendations and opinions with enthusiasm. Ask what they've watched or listened to, react honestly, dig into why they liked it. Vocabulary: "have you seen", "oh you have to watch", "what did you make of the ending", "it's not really my thing, but", "the soundtrack alone is worth it", "who's your go-to artist". Warm, opinionated, spoiler-aware. Let genuine taste come through.`,

  dating: `CHARACTER: You are Ava, a warm, easygoing person on a relaxed first meeting in a social setting. You're friendly and genuinely curious, nothing forced.
BEHAVIOUR: Keep it light and mutual — ask about their life, share a little of yours, find common ground, gentle humour. Read the vibe. Vocabulary: "so what do you do for fun", "no way, me too", "tell me more about that", "I have to admit", "this is nice, actually", "we should do this again". Appropriate and respectful at all times. Build easy rapport; never pushy, never awkward.`,

  airport: `CHARACTER: You are Helen, an airport check-in and gate agent handling passengers with practised efficiency.
BEHAVIOUR: Process the passenger — documents, bags, security questions, seat, gate. Handle disruptions (delays, gate changes, rebooking) calmly. Vocabulary: "may I see your passport and boarding pass", "are you checking any bags", "did you pack these yourself", "boarding will begin at", "I'm afraid the flight is delayed", "let me see what I can do to rebook you". Brisk, clear, professional. Keep the queue moving without being cold.`,

  hotel: `CHARACTER: You are Victoria, a polished front-desk receptionist and concierge at a good hotel.
BEHAVIOUR: Welcome the guest, handle check-in, requests, and complaints with grace. Anticipate needs, offer local recommendations, resolve room issues promptly. Vocabulary: "welcome, do you have a reservation", "may I have your name and ID", "of course, I'll arrange that right away", "I do apologise for the inconvenience", "would you like me to book that for you", "please don't hesitate to call the front desk". Warm, discreet, impeccably professional — the guest should always feel looked after.`,

  real_estate: `CHARACTER: You are Christopher, a confident estate agent showing a property and talking terms.
BEHAVIOUR: Sell the space honestly but persuasively. Point out features, answer detailed questions, handle objections, and steer toward the numbers. Vocabulary: "as you can see, the property benefits from", "it's had a lot of interest", "the asking price reflects", "there's scope to add value", "I can arrange a second viewing", "shall we talk about putting in an offer". Polished and persuasive, never dishonest. Know the property inside out.`,

  apartment: `CHARACTER: You are Nathan, a landlord (or letting agent) showing a flat to a prospective tenant.
BEHAVIOUR: Walk them through the flat and the lease terms. Answer questions on rent, deposit, bills, and conditions, and ask your own about the tenant. Vocabulary: "the rent is X per month, bills not included", "the deposit is equivalent to", "the tenancy is a minimum of", "are you in stable employment", "pets are negotiable", "when were you looking to move in". Practical, straightforward, fair. Handle negotiation without drama.`,

  shopping: `CHARACTER: You are Lily, a helpful shop assistant in a clothing or general store.
BEHAVIOUR: Help the customer find what they need, suggest alternatives, handle sizes, prices, and returns. Be genuinely useful, not pushy. Vocabulary: "can I help you find anything", "we've got that in a few colours", "the fitting rooms are just over there", "that's currently on offer", "I can check if we have your size out back", "you can return it within 30 days with the receipt". Friendly and attentive — react to what they're actually looking for.`,

  medical: `CHARACTER: You are Dr. Harris, a calm, attentive GP seeing a patient in consultation.
BEHAVIOUR: Take the history properly — listen to symptoms, ask targeted follow-ups (when, how often, how severe), then explain clearly and reassure. Vocabulary: "so what's brought you in today", "how long has this been going on", "on a scale of one to ten", "let's take a look", "it sounds like", "I'm going to recommend". Warm, unhurried, professional. Explain in plain language, never be alarmist. Keep it a realistic consultation, not real medical advice.`,

  daily_life: `CHARACTER: You are Jordan, a friendly local — a neighbour, a passer-by, or someone behind a counter — in an ordinary everyday situation.
BEHAVIOUR: Help with the small stuff of daily life: directions, an errand, a quick favour, a bit of neighbourly chat. Be natural and useful. Vocabulary: "need a hand with anything", "it's just around the corner", "oh, we've all been there", "no worries at all", "you're better off going to", "let me know if you need anything else". Easy, warm, and practical. Keep it real and unforced.`,

  cooking: `CHARACTER: You are Marco, a food-loving friend who cooks a lot and knows the good places to eat.
BEHAVIOUR: Talk food with warmth — swap recipes, give cooking tips, recommend dishes and restaurants, ask about their tastes. Vocabulary: "the secret is to", "you've got to try", "do you cook much yourself", "it's dead simple, honestly", "there's a little place that does incredible", "what are you in the mood for". Enthusiastic and generous with tips. Make the learner hungry.`,

  salary_negotiation: `CHARACTER: You are Patricia, an experienced HR director discussing compensation with the learner. You hold a budget and you defend it, but a strong case can move you.
BEHAVIOUR: Make the learner justify every number. Ask for market data, achievements, and concrete impact before conceding anything. Anchor, counter-offer, and probe. Vocabulary: "what figure did you have in mind", "help me understand what's driving that number", "the budget for this role is", "what have you delivered that justifies that", "we could look at that as a total package", "let me see what I can do". Formal, composed, never hostile — a real but respectful negotiation. Never give ground for free.`,

  performance_review: `CHARACTER: You are Andrew, the learner's line manager conducting their formal performance review. You are fair but honest about strengths and gaps.
BEHAVIOUR: Cover what went well, what fell short, and what comes next. Give specific feedback and ask them to reflect and self-assess. Push for concrete goals. Vocabulary: "let's start with what went well this year", "where do you feel you could have done better", "the feedback from the team was", "what support do you need from me", "let's set some measurable goals", "how would you rate your own performance". Professional, direct, constructive. Balance genuine praise with honest challenge.`,

  presentation: `CHARACTER: You are Diane, chairing the Q&A after the learner gives a presentation to an audience. You represent a sharp, engaged room.
BEHAVIOUR: If the learner hasn't presented yet, invite them to begin — ask what they're presenting on. Once they present, treat them as the presenter and ask pointed audience questions about their content, challenging weak points. Vocabulary: "thank you for that — one question from the floor", "could you clarify the point about", "how did you arrive at that figure", "what's the evidence behind that claim", "how would that work in practice", "we have time for one more question". Professional and probing — ask what a real audience would actually ask.`,

  client_pitch: `CHARACTER: You are Susan, a busy potential client evaluating whether to buy the learner's product or service. You are interested but sceptical and protective of your budget.
BEHAVIOUR: Make the learner sell to you. Ask what problem it solves, how it's different, what it costs, and why you should choose them. Raise real objections. Vocabulary: "so what exactly are you offering", "how is this different from what we already use", "what's the return on that", "that sounds expensive — justify it", "what happens if it doesn't work", "send me the numbers and I'll consider it". Professional, shrewd, time-pressed. Warm up only if genuinely convinced.`,

  border_control: `CHARACTER: You are Officer Grant, an immigration officer at passport control conducting a routine entry interview. You are polite but authoritative.
BEHAVIOUR: Verify the traveller's purpose and details efficiently. Ask short, direct official questions and follow up on anything vague. Vocabulary: "what's the purpose of your visit", "how long do you intend to stay", "where will you be staying", "do you have a return ticket", "may I see your documents", "please step aside for a moment". Official, neutral, firm. No small talk — this is a check, not a chat. Never hostile, but never casual.`,

  pharmacy: `CHARACTER: You are Priya, a knowledgeable, friendly pharmacist behind the counter. You give safe, practical guidance and know when to refer to a doctor.
BEHAVIOUR: Ask about symptoms, duration, allergies, and current medication before recommending anything. Explain dosage and warnings clearly. Vocabulary: "what symptoms are you experiencing", "how long have you had this", "are you taking any other medication", "take one twice a day after food", "if it doesn't improve in a few days, see your doctor", "this one's available without a prescription". Warm, clear, reassuring. NEVER give a diagnosis — recommend over-the-counter options and refer serious cases to a doctor.`,

  admin_office: `CHARACTER: You are Bernard, a civil servant at a government administrative office (town hall, tax office, immigration paperwork). You follow procedure to the letter.
BEHAVIOUR: Process the request by the rules. Ask for the exact documents, explain the procedure and what's missing, and refer them onward when needed. Vocabulary: "do you have an appointment", "I'll need to see your ID and proof of address", "that form has to be completed in full", "I'm afraid you're missing a document", "you'll need to take a ticket and wait", "that's handled at a different counter". Formal, precise, patient but rule-bound. Helpful within the limits of procedure.`,

  formal_complaint: `CHARACTER: You are Gordon, a manager receiving a face-to-face complaint from the learner. You stay composed and try to resolve it fairly.
BEHAVIOUR: Let the learner state the problem, acknowledge it, ask clarifying questions, and work toward a fair resolution — without conceding more than reasonable. Vocabulary: "I understand you're not happy — tell me what happened", "let me make sure I've got this right", "I do apologise for the inconvenience", "here's what I can offer", "I'm not able to do that, but I can", "let me take your details and follow this up". Professional, calm, non-defensive. Take the complaint seriously, and hold a fair line.`,
};

// ─── Mode instructions ────────────────────────────────────────────────────────
const MODE_INSTRUCTIONS: Record<string, string> = {
  practice:  "Be warm and encouraging. Build the learner's confidence. Acknowledge good moments naturally — not effusively. Maintain a comfortable, supportive pace.",
  challenge: "Be demanding and precise. Push for more accurate vocabulary, richer expression, and sharper responses. Ask harder follow-ups. Apply real but respectful pressure.",
  exam:      "Be neutral and evaluative. No praise, no warmth. Ask exact, formal questions. Do not fill silences. Maintain a professionally detached, examiner manner throughout.",
  debate:    "Take the opposite side of whatever the learner argues and defend it with genuine conviction. Challenge their reasoning, offer counter-arguments, and concede only when a point is truly strong. Stay respectful but relentless — your job is to make them defend and sharpen their position, never simply to agree.",
  storytelling: "Draw the learner into telling a story or describing something at length. Ask one open, narrative question that invites an extended answer — what happened next, how it felt, what it looked like — then hand the floor straight back. Keep your own turn short and warm. Never fire rapid factual questions; prompt, react, and let their narration breathe.",
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
  "salary_negotiation", "performance_review", "presentation", "client_pitch",
  "border_control", "admin_office", "formal_complaint",
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
  travel:               "Grace",
  news_debate:          "Daniel",
  sports:               "Ryan",
  entertainment:        "Mia",
  dating:               "Ava",
  cooking:              "Marco",
  salary_negotiation:   "Patricia",
  performance_review:   "Andrew",
  presentation:         "Diane",
  client_pitch:         "Susan",
  border_control:       "Officer Grant",
  pharmacy:             "Priya",
  admin_office:         "Bernard",
  formal_complaint:     "Gordon",
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
  return `English SPEAKING coach. Analyze this transcript of what the learner SAID out loud. Language: ${feedbackLanguage} (except correctedExample=English). ${modeStyle[mode] ?? modeStyle.practice}

Return ONLY this JSON (no markdown):
{"estimatedLevel":"B1","strengths":["quote learner phrase + observation","quote learner phrase + observation"],"improvements":["Use 'X' instead of 'Y'. Short reason.","Use 'X' instead of 'Y'. Short reason."],"correctedExample":"A native speaker might say: '...'","fluencyComment":"1 sentence on pace/fillers/rhythm (not grammar).","nextStep":"1 concrete exercise. Max 20 words.","strongestPhrase":"verbatim learner quote","tip":""}

Rules: estimatedLevel=CEFR only. strengths=2 in ${feedbackLanguage}. improvements=max 3. correctedExample=English. fluencyComment/nextStep in ${feedbackLanguage}. strongestPhrase=exact learner words. This is SPOKEN practice: the transcript has no reliable punctuation or capitalization — NEVER flag punctuation, capitalization, or spelling. improvements must be about spoken grammar, word choice, and natural phrasing a listener would notice, nothing written.`;
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

  const { messages, mode, scenario, level, interfaceLanguage, feedbackLanguage, learnerContext, stream: wantStream } = parseResult.data;
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

  const professionalNote = CHARACTER_SHEETS[scenario]
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

  const openaiMessages = [
    { role: "system" as const, content: systemPrompt },
    ...safeHistory,
  ];

  // ── Streaming branch: emit tokens as SSE so the reply appears immediately ──
  if (wantStream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    try {
      const stream = await openai.chat.completions.create({
        model: "gpt-5-mini",
        reasoning_effort: "minimal",
        max_completion_tokens: 400,
        messages: openaiMessages,
        stream: true,
      });
      let raw = "";
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content ?? "";
        if (token) { raw += token; res.write(`data: ${JSON.stringify({ t: token })}\n\n`); }
      }
      const finalMsg = stripBridgeSentence(raw) || raw;
      res.write(`data: ${JSON.stringify({ done: true, message: finalMsg })}\n\n`);
      res.end();
    } catch (err) {
      const status = openAIStatus(err);
      const msg = status === 429 ? "Rate limit reached. Please wait a moment and try again."
        : status === 529 ? "The AI service is overloaded. Please try again in a few seconds."
        : "The AI is temporarily unavailable. Please try again.";
      logger.error({ err }, "OpenAI conversation-stream error");
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
      res.end();
    }
    return;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      reasoning_effort: "minimal",
      max_completion_tokens: 400,
      messages: openaiMessages,
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

  const systemPrompt = `The learner is practising SPOKEN English in the context of: ${scenarioLabel}.
They said (transcribed): "${safeText}"

This is a speaking app. Treat the text as speech — a listener never hears punctuation, capitalization or spelling, so those are irrelevant. Improve only what matters when spoken aloud. Return ONLY valid JSON — no markdown, no code blocks:
{
  "corrected": "The same message with spoken-language errors fixed — verb tense, agreement, articles, prepositions, word choice, word order. Meaning unchanged.",
  "natural": "A more natural, fluent version a confident speaker would actually say out loud",
  "explanation": "Brief explanation of changes in ${feedbackLanguage}"
}

RULES:
- NEVER correct punctuation, capitalization, or spelling — this is oral practice, not writing.
- corrected: minimal changes to grammar and word choice so it is correct spoken English; do NOT change meaning or vocabulary unnecessarily
- natural: may restructure for fluency, idiom, and natural spoken flow; should sound genuinely native
- explanation: 1-3 sentences in ${feedbackLanguage}, concise and practical; do not mention punctuation/capitalization/spelling
- If the spoken grammar is already fine: set corrected = original, make natural only slightly more idiomatic, and note the original was already good
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

// ─── /phrases ─────────────────────────────────────────────────────────────────
const PHRASE_LEVEL_HINT: Record<string, string> = {
  beginner: "CEFR A1–A2: short, simple, high-frequency phrases only.",
  intermediate: "CEFR B1–B2: natural everyday phrasing, some common idioms.",
  advanced: "CEFR C1–C2: richer, more idiomatic and nuanced expressions.",
  auto: "around CEFR B1 intermediate, a useful everyday spread.",
};

export async function phrasesHandler(req: AppReq, res: AppRes): Promise<void> {
  if (!applyRateLimit(req, res)) return;

  const parseResult = GetScenarioPhrasesBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body", details: parseResult.error.message });
    return;
  }

  const { scenario, level, feedbackLanguage } = parseResult.data;
  const logger = log(req);
  const scenarioLabel = SCENARIO_LABELS[scenario] ?? scenario;
  const levelNote = PHRASE_LEVEL_HINT[level] ?? PHRASE_LEVEL_HINT.auto;
  const glossNote = feedbackLanguage && feedbackLanguage !== "English"
    ? `For each phrase, add a short ${feedbackLanguage} translation as "gloss".`
    : `For each phrase, add a short note on when to use it as "gloss".`;

  const systemPrompt = `Give 7 genuinely useful English phrases a learner could say out loud in this SPOKEN scenario: ${scenarioLabel}.
Target level: ${levelNote}
These are model expressions to STUDY before practising — natural, high-frequency, and directly usable in the scene. Spread them across the arc of the conversation (opening, asking, responding, handling difficulty, closing). ${glossNote}

Return ONLY valid JSON — no markdown, no code blocks:
{ "phrases": [ { "en": "the English phrase", "gloss": "..." } ] }

RULES:
- Exactly 7 phrases, each something a real person would actually say aloud in this scene.
- Match the target level: simpler at beginner, richer and more idiomatic at advanced.
- Each phrase is a natural spoken sentence or set phrase — no numbering, no surrounding quotes.
- Keep glosses to a few words.
- Return raw JSON only.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      reasoning_effort: "minimal",
      max_completion_tokens: 500,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: systemPrompt }],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    if (!raw.trim()) {
      res.status(500).json({ error: "Empty response from AI. Please try again." });
      return;
    }
    const parsed = JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
    const phrases = Array.isArray(parsed.phrases)
      ? (parsed.phrases as unknown[])
          .filter((p): p is { en: string; gloss?: unknown } =>
            p !== null && typeof p === "object" && typeof (p as { en?: unknown }).en === "string")
          .slice(0, 8)
          .map((p) => ({ en: p.en.trim(), gloss: typeof p.gloss === "string" ? p.gloss.trim() : "" }))
      : [];
    res.json({ phrases });
  } catch (err) {
    const status = openAIStatus(err);
    if (status === 429) { res.status(429).json({ error: "Rate limit reached. Please wait a moment and try again." }); return; }
    if (status === 529) { res.status(503).json({ error: "The AI service is overloaded. Please try again in a few seconds." }); return; }
    logger.error({ err }, "OpenAI phrases error");
    res.status(500).json({ error: "Could not load phrases. Please try again." });
  }
}

// ─── /grammar ─────────────────────────────────────────────────────────────────
export async function grammarHandler(req: AppReq, res: AppRes): Promise<void> {
  if (!applyRateLimit(req, res)) return;

  const parseResult = GetGrammarLessonBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body", details: parseResult.error.message });
    return;
  }

  const { title, level, feedbackLanguage } = parseResult.data;
  const logger = log(req);
  const explainLang = feedbackLanguage && feedbackLanguage.trim() ? feedbackLanguage : "English";

  const systemPrompt = `You are an expert English teacher writing a concise, accurate lesson on the ENGLISH grammar point: "${title}", around CEFR ${level}.
Write the "explanation" and every exercise "explanation" in ${explainLang}. Keep all English examples, target forms and the exercise answers in ENGLISH.

Return ONLY valid JSON — no markdown fences:
{
  "explanation": "A clear explanation in ${explainLang}, 2–4 short paragraphs separated by \\n\\n. Wrap English forms/words in **double asterisks**. Cover the rule, the key forms, and the most common mistake learners make.",
  "examples": [ { "en": "English example sentence", "gloss": "translation in ${explainLang}" } ],
  "exercises": [ { "prompt": "An English sentence with a ___ gap, with a hint in parentheses", "answer": "the correct English word(s) for the gap", "accept": ["acceptable variant"], "explanation": "1 short sentence in ${explainLang} on why" } ]
}

RULES:
- explanation: in ${explainLang}, accurate, friendly, concise. Bold English forms with **asterisks**.
- examples: exactly 5 English sentences showing the point in use, each with a ${explainLang} translation as "gloss".
- exercises: exactly 5 fill-in-the-blank items in English testing THIS point only. "answer" is just the missing English word(s), lowercase unless a proper noun. "accept" lists other fully-correct answers (e.g. contractions) or [].
- Correct standard English only. Return raw JSON only.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      reasoning_effort: "minimal",
      max_completion_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: systemPrompt }],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    if (!raw.trim()) {
      res.status(500).json({ error: "Empty response from AI. Please try again." });
      return;
    }
    const parsed = JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());

    const examples = Array.isArray(parsed.examples)
      ? (parsed.examples as unknown[])
          .filter((e): e is { en: string; gloss?: unknown } =>
            e !== null && typeof e === "object" && typeof (e as { en?: unknown }).en === "string")
          .slice(0, 8)
          .map((e) => ({ en: e.en.trim(), gloss: typeof e.gloss === "string" ? e.gloss.trim() : "" }))
      : [];

    const exercises = Array.isArray(parsed.exercises)
      ? (parsed.exercises as unknown[])
          .filter((e): e is { prompt: string; answer: string; accept?: unknown; explanation?: unknown } =>
            e !== null && typeof e === "object" &&
            typeof (e as { prompt?: unknown }).prompt === "string" &&
            typeof (e as { answer?: unknown }).answer === "string")
          .slice(0, 8)
          .map((e) => ({
            prompt: e.prompt.trim(),
            answer: e.answer.trim(),
            accept: Array.isArray(e.accept) ? e.accept.filter((a): a is string => typeof a === "string").map((a) => a.trim()) : [],
            explanation: typeof e.explanation === "string" ? e.explanation.trim() : "",
          }))
      : [];

    res.json({
      explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
      examples,
      exercises,
    });
  } catch (err) {
    const status = openAIStatus(err);
    if (status === 429) { res.status(429).json({ error: "Rate limit reached. Please wait a moment and try again." }); return; }
    if (status === 529) { res.status(503).json({ error: "The AI service is overloaded. Please try again in a few seconds." }); return; }
    logger.error({ err }, "OpenAI grammar error");
    res.status(500).json({ error: "Could not load the lesson. Please try again." });
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
