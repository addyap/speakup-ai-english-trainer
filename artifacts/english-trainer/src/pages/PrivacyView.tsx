import type { ReactNode } from "react";
import { useApp } from "@/lib/AppContext";
import { t } from "@/i18n/translations";

// SpeakUp AI — Privacy Policy & Legal Notice.
// Operator identity reused from antonyaddy.com; data-handling section reflects
// how this app actually works (anonymous use; message/voice content sent to
// OpenAI to power the AI features). English is the canonical version for this
// international audience; the French "mentions légales" live on antonyaddy.com.

const UPDATED = "27 July 2026";
const CONTACT = "formations@antonyaddy.com";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="mb-2 font-serif text-lg font-semibold text-ink">{title}</h2>
      <div className="space-y-2.5 text-[13.5px] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

export function PrivacyView() {
  const { setCurrentView, interfaceLanguage } = useApp();

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-ivory px-5 pt-safe pt-6 pb-16 text-ink">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => setCurrentView("home")}
          className="mb-7 inline-flex items-center gap-2 rounded-full border border-line bg-cream px-4 py-2 text-sm text-ink-soft transition-colors hover:text-ink"
        >
          ← {t(interfaceLanguage, "back")}
        </button>

        <h1 className="font-serif text-3xl font-semibold text-ink">Privacy &amp; Legal</h1>
        <p className="mt-1 mb-8 text-xs text-clay">SpeakUp AI · Last updated {UPDATED}</p>

        {/* ── Privacy Policy ─────────────────────────────────────────── */}
        <h2 className="mb-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-coral">Privacy Policy</h2>

        <Section title="No account, anonymous by design">
          <p>
            You can use SpeakUp AI without creating an account or giving your name, email, or any
            personal contact details. A random anonymous identifier is generated in your browser to
            remember your progress between sessions — it is not linked to your real identity.
          </p>
        </Section>

        <Section title="What is stored in your browser">
          <p>
            Your learning progress — an estimated CEFR level, recurring error tags, session count and
            your language preferences — is saved locally in your browser (localStorage). It stays on
            your device and you can erase it at any time by clearing your browser's site data.
          </p>
        </Section>

        <Section title="What is sent to our AI provider">
          <p>
            To power the conversation, hints, corrections, end-of-session feedback, transcription and
            spoken replies, the <strong className="text-ink">text of your messages and your recorded
            voice audio</strong> are sent to <strong className="text-ink">OpenAI</strong> (OpenAI,
            L.L.C., USA), which processes them on our behalf to generate the AI responses. Your voice
            recording is used only to produce the transcription and is not stored by us afterwards.
            Please avoid sharing sensitive personal information in your practice conversations.
          </p>
        </Section>

        <Section title="Anonymous usage records">
          <p>
            To understand how the app is used and to improve it, we may store anonymous session records
            (the anonymous device identifier, estimated level, error tags, chosen scenario and language
            settings). These records contain no name, email address or other directly identifying
            information.
          </p>
        </Section>

        <Section title="Cookies & tracking">
          <p>
            SpeakUp AI uses no advertising cookies and no third-party audience-tracking or analytics
            tools. Only technical browser storage strictly necessary for the app to function is used.
          </p>
        </Section>

        <Section title="Processors & international transfers">
          <p>Data is shared only with technical providers acting on our behalf:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li><strong className="text-ink">OpenAI, L.L.C.</strong> (USA) — AI language, speech and transcription processing.</li>
            <li><strong className="text-ink">Vercel Inc.</strong> (USA) — website hosting and delivery.</li>
            <li><strong className="text-ink">Clerk</strong> — authentication infrastructure (used only if sign-in is enabled).</li>
          </ul>
          <p>
            Transfers outside the European Union are covered by appropriate safeguards under the GDPR
            (such as the European Commission's Standard Contractual Clauses).
          </p>
        </Section>

        <Section title="Legal basis & retention">
          <p>
            Processing is based on your consent and our legitimate interest in providing and improving
            the service. Data stored in your browser remains until you clear it; anonymous usage records
            are kept only as long as useful for improving the product.
          </p>
        </Section>

        <Section title="Your rights (GDPR / RGPD)">
          <p>
            You have the right to access, rectify, erase, restrict, object to and port your data. Because
            the app is anonymous, the simplest way to remove your local data is to clear your browser's
            site storage. For any request, contact{" "}
            <a href={`mailto:${CONTACT}`} className="font-medium text-coral underline decoration-line underline-offset-2">{CONTACT}</a>.
            You may also lodge a complaint with the French data-protection authority, the CNIL
            (<a href="https://www.cnil.fr" className="font-medium text-coral underline decoration-line underline-offset-2" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>).
          </p>
        </Section>

        {/* ── Legal Notice ───────────────────────────────────────────── */}
        <div className="my-9 h-px w-full bg-line" />
        <h2 className="mb-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-coral">Legal Notice (Mentions légales)</h2>

        <Section title="Publisher">
          <p>
            <strong className="text-ink">Antony Addy</strong> — auto-entrepreneur (independent
            professional adult trainer).<br />
            135 rue Henri Vadon, Résidence des Arènes, 83600 Fréjus, France.<br />
            SIRET 48317889300028 · Déclaration d'activité 93830738883 registered with DREETS
            Provence-Alpes-Côte d'Azur (this registration <em>ne vaut pas agrément de l'État</em>).<br />
            Contact: <a href={`mailto:${CONTACT}`} className="font-medium text-coral underline decoration-line underline-offset-2">{CONTACT}</a> · +33 6 49 82 98 26.<br />
            Publication director: Antony Addy.
          </p>
        </Section>

        <Section title="Hosting">
          <p>
            This site is hosted by <strong className="text-ink">Vercel Inc.</strong>, 340 S Lemon Ave
            #4133, Walnut, CA 91789, USA — <a href="https://vercel.com" className="font-medium text-coral underline decoration-line underline-offset-2" target="_blank" rel="noopener noreferrer">vercel.com</a>.
          </p>
        </Section>

        <Section title="Intellectual property">
          <p>
            All content on this site — texts, design, and pedagogical materials — is the exclusive
            property of Antony Addy. Any reproduction without prior authorization is prohibited.
          </p>
        </Section>

        <p className="mt-8 text-[11px] leading-relaxed text-clay">
          The French legal notice and privacy policy for Antony Addy's activity are also available at{" "}
          <a href="https://antonyaddy.com/mentions-legales" className="text-coral underline decoration-line underline-offset-2" target="_blank" rel="noopener noreferrer">antonyaddy.com</a>.
        </p>
      </div>
    </div>
  );
}
