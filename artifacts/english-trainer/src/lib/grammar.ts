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
];
