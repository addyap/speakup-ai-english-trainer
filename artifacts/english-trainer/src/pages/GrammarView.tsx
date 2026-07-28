import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/lib/AppContext";
import { t } from "@/i18n/translations";
import { GRAMMAR_TOPICS, type GrammarTopic, type GrammarLevel } from "@/lib/grammar";

type Example = { en: string; gloss: string };
type Exercise = { prompt: string; answer: string; accept: string[]; explanation: string };
type Lesson = { explanation: string; examples: Example[]; exercises: Exercise[] };

const lessonCache = new Map<string, Lesson>();

async function fetchLesson(topic: GrammarTopic, feedbackLanguage: string): Promise<Lesson> {
  const res = await fetch("/api/trainer/grammar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: topic.id, title: topic.title, level: topic.level, feedbackLanguage }),
  });
  if (!res.ok) throw new Error(`Grammar HTTP ${res.status}`);
  const data = (await res.json()) as Partial<Lesson>;
  return {
    explanation: data.explanation ?? "",
    examples: Array.isArray(data.examples) ? data.examples : [],
    exercises: Array.isArray(data.exercises) ? data.exercises : [],
  };
}

const LEVELS: GrammarLevel[] = ["A1", "A2", "B1", "B2", "C1"];
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.!?,;:]+$/, "");

export function GrammarView() {
  const { setCurrentView, interfaceLanguage, feedbackLanguage } = useApp();
  const [selected, setSelected] = useState<GrammarTopic | null>(null);
  const tr = (k: string) => t(interfaceLanguage, k as Parameters<typeof t>[1]);

  return (
    <div className="min-h-[100dvh] bg-ivory text-ink">
      <header className="mx-auto flex w-full max-w-3xl items-center gap-3 px-5 pt-safe pt-8 pb-5 sm:px-8">
        <button
          onClick={() => (selected ? setSelected(null) : setCurrentView("home"))}
          aria-label={tr("back")}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-line bg-cream text-ink-soft transition-all hover:text-ink hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-semibold leading-tight text-ink">
            {selected ? selected.title : tr("grammarTitle")}
          </h1>
          <p className="mt-0.5 truncate text-sm text-clay">
            {selected ? `${tr("grammarLevel")} ${selected.level}` : tr("grammarSubtitle")}
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-5 pb-24 sm:px-8">
        {selected
          ? <Lesson topic={selected} interfaceLanguage={interfaceLanguage} feedbackLanguage={feedbackLanguage} />
          : <TopicList onSelect={setSelected} levelLabel={tr("grammarLevel")} />}
      </div>
    </div>
  );
}

function TopicList({ onSelect, levelLabel }: { onSelect: (t: GrammarTopic) => void; levelLabel: string }) {
  return (
    <div className="space-y-6">
      {LEVELS.map((lvl) => {
        const topics = GRAMMAR_TOPICS.filter((t) => t.level === lvl);
        if (topics.length === 0) return null;
        return (
          <section key={lvl}>
            <h2 className="mb-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-clay">{levelLabel} {lvl}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {topics.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSelect(t)}
                  className="flex flex-col rounded-2xl border border-line bg-cream px-4 py-3.5 text-left transition-all hover:border-line-strong hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-ink">{t.title}</span>
                    <span className="rounded-md bg-forest-soft px-1.5 py-0.5 font-mono text-[10px] font-bold text-forest">{t.level}</span>
                  </span>
                  <span className="mt-0.5 text-[12px] leading-snug text-clay">{t.blurb}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n\n+/).map((para, i) => (
        <p key={i} className="mb-2.5 text-[14px] leading-relaxed text-ink-soft last:mb-0">
          {para.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
            seg.startsWith("**") && seg.endsWith("**")
              ? <strong key={j} className="font-semibold text-ink">{seg.slice(2, -2)}</strong>
              : <span key={j}>{seg}</span>
          )}
        </p>
      ))}
    </>
  );
}

function Lesson({ topic, interfaceLanguage, feedbackLanguage }: {
  topic: GrammarTopic; interfaceLanguage: string; feedbackLanguage: string;
}) {
  const tr = (k: string) => t(interfaceLanguage as Parameters<typeof t>[0], k as Parameters<typeof t>[1]);
  const cacheKey = `${topic.id}|${feedbackLanguage}`;
  const [lesson, setLesson] = useState<Lesson | null>(lessonCache.get(cacheKey) ?? null);
  const [loading, setLoading] = useState(!lessonCache.has(cacheKey));
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const cached = lessonCache.get(cacheKey);
    if (cached) { setLesson(cached); setLoading(false); setError(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchLesson(topic, feedbackLanguage)
      .then((l) => { if (cancelled) return; lessonCache.set(cacheKey, l); setLesson(l); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cacheKey, topic, feedbackLanguage, reloadKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2.5 py-10 text-sm text-clay">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-coral" />
        {tr("grammarWriting")}
      </div>
    );
  }
  if (error || !lesson) {
    return (
      <button
        onClick={() => { lessonCache.delete(cacheKey); setReloadKey((k) => k + 1); }}
        className="mt-4 rounded-xl border border-coral/30 bg-coral-soft px-4 py-2.5 text-sm font-medium text-coral-dark"
      >
        {tr("grammarError")}
      </button>
    );
  }

  return (
    <div className="space-y-6">
      {lesson.explanation && (
        <section className="rounded-2xl border border-line bg-cream p-5">
          <RichText text={lesson.explanation} />
        </section>
      )}

      {lesson.examples.length > 0 && (
        <section>
          <h2 className="mb-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-clay">{tr("grammarExamples")}</h2>
          <ul className="space-y-1.5">
            {lesson.examples.map((ex, i) => (
              <li key={i} className="rounded-xl border border-line bg-cream px-4 py-3">
                <p className="text-[15px] font-medium leading-snug text-ink">{ex.en}</p>
                {ex.gloss && <p className="mt-0.5 text-[13px] leading-snug text-clay">{ex.gloss}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {lesson.exercises.length > 0 && (
        <section>
          <h2 className="mb-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-clay">{tr("grammarPractice")}</h2>
          <div className="space-y-2.5">
            {lesson.exercises.map((ex, i) => (
              <ExerciseItem key={i} ex={ex} tr={tr} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ExerciseItem({ ex, tr }: { ex: Exercise; tr: (k: string) => string }) {
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);

  const isCorrect = checked && (norm(value) === norm(ex.answer) || ex.accept.some((a) => norm(a) === norm(value)));
  const promptParts = ex.prompt.split(/_{2,}/);

  return (
    <div className={`rounded-2xl border px-4 py-3.5 transition-colors ${
      !checked ? "border-line bg-cream" : isCorrect ? "border-forest/40 bg-forest-soft" : "border-coral/40 bg-coral-soft"
    }`}>
      <p className="text-[14px] leading-relaxed text-ink">
        {promptParts[0]}
        <span className="mx-1 font-semibold text-coral">{checked ? ex.answer : "____"}</span>
        {promptParts[1] ?? ""}
      </p>

      {!checked ? (
        <form
          className="mt-2.5 flex gap-2"
          onSubmit={(e) => { e.preventDefault(); if (value.trim()) setChecked(true); }}
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={tr("grammarYourAnswer")}
            className="min-w-0 flex-1 rounded-xl border border-line bg-ivory px-3.5 py-2.5 text-sm text-ink placeholder:text-clay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40"
          />
          <button
            type="submit"
            disabled={!value.trim()}
            className="flex-shrink-0 rounded-xl bg-coral px-4 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-coral-dark disabled:opacity-40"
          >
            {tr("grammarCheck")}
          </button>
        </form>
      ) : (
        <AnimatePresence>
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2">
            <p className={`text-[13px] font-semibold ${isCorrect ? "text-forest" : "text-coral-dark"}`}>
              {isCorrect ? `✓ ${tr("grammarCorrect")}` : `✗ ${tr("grammarYouWrote")} “${value}”`}
            </p>
            {ex.explanation && <p className="mt-1 text-[13px] leading-snug text-ink-soft">{ex.explanation}</p>}
            <button
              onClick={() => { setChecked(false); setValue(""); }}
              className="mt-2 text-[12px] font-medium text-clay underline decoration-line underline-offset-2 hover:text-ink-soft"
            >
              {tr("grammarTryAgain")}
            </button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
