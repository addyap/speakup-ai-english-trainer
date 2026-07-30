// Curated, ordered English grammar syllabus (A1 → C1).
// Each topic opens an AI-generated lesson (see /api/trainer/grammar),
// explained in the learner's feedback language.
export type GrammarLevel = "A1" | "A2" | "B1" | "B2" | "C1";

export type GrammarTopic = {
  id: string;
  title: string;    // English name of the grammar point
  level: GrammarLevel;
  blurb: string;    // one-line English summary
};

export const GRAMMAR_TOPICS: GrammarTopic[] = [
  { id: "present_simple",       title: "Present simple",            level: "A1", blurb: "Facts, habits and routines." },
  { id: "present_continuous",   title: "Present continuous",        level: "A1", blurb: "Things happening right now." },
  { id: "articles",             title: "Articles (a / an / the)",   level: "A1", blurb: "When to use each — and none." },
  { id: "plurals",              title: "Plurals",                   level: "A1", blurb: "Regular and irregular plural nouns." },
  { id: "prepositions_place",   title: "Prepositions of place",     level: "A1", blurb: "in, on, at, under, between…" },
  { id: "past_simple",          title: "Past simple",               level: "A2", blurb: "Finished actions in the past." },
  { id: "comparatives",         title: "Comparatives & superlatives", level: "A2", blurb: "bigger, the biggest, more / most." },
  { id: "countable_uncountable",title: "Countable & uncountable",   level: "A2", blurb: "some, any, much, many, a lot of." },
  { id: "future_forms",         title: "Future: will / going to",   level: "A2", blurb: "Predictions, plans and decisions." },
  { id: "modals",               title: "Modal verbs",               level: "A2", blurb: "can, must, should, have to." },
  { id: "present_perfect",      title: "Present perfect",           level: "B1", blurb: "Experiences and the unfinished past." },
  { id: "past_continuous",      title: "Past continuous",           level: "B1", blurb: "Actions in progress in the past." },
  { id: "first_conditional",    title: "First conditional",         level: "B1", blurb: "Real future possibilities (if + will)." },
  { id: "phrasal_verbs",        title: "Phrasal verbs",             level: "B1", blurb: "get up, look after, turn down…" },
  { id: "conditionals_2_3",     title: "Second & third conditionals", level: "B2", blurb: "Hypothetical and past-unreal situations." },
  { id: "passive",              title: "The passive",               level: "B2", blurb: "When the action matters more than who did it." },
  { id: "reported_speech",      title: "Reported speech",           level: "B2", blurb: "Telling people what others said." },
  { id: "relative_clauses",     title: "Relative clauses",          level: "B2", blurb: "who, which, that, where." },
  { id: "perfect_aspects",      title: "Perfect & continuous aspects", level: "C1", blurb: "The finer nuances of English tenses." },

  // ── Oral-essential additions (functional / conversational grammar) ──
  { id: "question_forms",       title: "Question forms & word order",   level: "A1", blurb: "Turning statements into questions out loud." },
  { id: "short_answers",        title: "Short answers",                 level: "A1", blurb: "Yes, I do. / No, they aren't." },
  { id: "contractions",         title: "Contractions",                  level: "A1", blurb: "I'm, don't, it's — how English really sounds." },
  { id: "there_is_are",         title: "There is / There are",          level: "A1", blurb: "Saying what exists around you." },
  { id: "have_got",             title: "Have got",                      level: "A1", blurb: "Talking about what you have." },
  { id: "adverbs_frequency",    title: "Adverbs of frequency",          level: "A2", blurb: "always, usually, sometimes, never." },
  { id: "like_ing",             title: "like / love / hate + -ing",     level: "A2", blurb: "Talking about what you enjoy." },
  { id: "suggestions_offers",   title: "Suggestions & offers",          level: "A2", blurb: "Let's…, Shall we…, How about…?" },
  { id: "linking_words",        title: "Linking words",                 level: "A2", blurb: "and, but, because, so — joining your ideas." },
  { id: "used_to",              title: "used to / would",               level: "B1", blurb: "Past habits and how things used to be." },
  { id: "question_tags",        title: "Question tags",                 level: "B1", blurb: "…isn't it? …don't you? Keeping talk going." },
  { id: "gerund_infinitive",    title: "Gerunds & infinitives",         level: "B1", blurb: "want to go vs enjoy going." },
  { id: "so_such_too_enough",   title: "so / such / too / enough",      level: "B1", blurb: "Adding emphasis and degree when you speak." },
  { id: "polite_requests",      title: "Polite requests & indirect questions", level: "B1", blurb: "Could you…? Do you know where…?" },
  { id: "present_perfect_cont", title: "Present perfect continuous",    level: "B2", blurb: "How long you've been doing something." },
  { id: "modals_deduction",     title: "Modals of deduction",           level: "B2", blurb: "must be, might be, can't be — speculating." },
  { id: "discourse_markers",    title: "Discourse markers",             level: "B2", blurb: "well, actually, I mean — sounding natural." },
  { id: "cleft_emphasis",       title: "Cleft sentences (emphasis)",    level: "C1", blurb: "What I love is…, It's you who…" },
  { id: "hedging_softening",    title: "Hedging & softening",           level: "C1", blurb: "sort of, I suppose, tend to — diplomatic speech." },
];
