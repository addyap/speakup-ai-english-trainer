import type { ReactNode } from "react";
import { useApp } from "@/lib/AppContext";
import { t } from "@/i18n/translations";

// SpeakUp AI — Politique de confidentialité & Mentions légales (FR).
// L'activité est une auto-entreprise française : le français est la version
// de référence des documents légaux (mentions légales obligatoires en droit
// français). Identité de l'éditeur reprise de antonyaddy.com ; la section
// « données » reflète le fonctionnement réel de l'application (usage anonyme ;
// contenu des messages et voix transmis à OpenAI pour faire fonctionner l'IA).

const UPDATED = "27 juillet 2026";
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

        <h1 className="font-serif text-3xl font-semibold text-ink">Confidentialité &amp; Mentions légales</h1>
        <p className="mt-1 mb-8 text-xs text-clay">SpeakUp AI · Dernière mise à jour : {UPDATED}</p>

        {/* ── Politique de confidentialité ───────────────────────────── */}
        <h2 className="mb-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-coral">Politique de confidentialité</h2>

        <Section title="Aucun compte, anonyme par conception">
          <p>
            Vous pouvez utiliser SpeakUp AI sans créer de compte ni communiquer votre nom, votre adresse
            e-mail ou toute autre coordonnée personnelle. Un identifiant anonyme aléatoire est généré dans
            votre navigateur pour mémoriser votre progression d'une session à l'autre ; il n'est pas relié
            à votre identité réelle.
          </p>
        </Section>

        <Section title="Ce qui est stocké dans votre navigateur">
          <p>
            Votre progression — un niveau estimé (CECRL), les types d'erreurs récurrentes, le nombre de
            sessions et vos préférences de langue — est enregistrée localement dans votre navigateur
            (localStorage). Ces données restent sur votre appareil et vous pouvez les effacer à tout moment
            en vidant les données du site dans votre navigateur.
          </p>
        </Section>

        <Section title="Ce qui est transmis à notre prestataire d'IA">
          <p>
            Pour faire fonctionner la conversation, les suggestions, les corrections, le bilan de fin de
            session, la transcription et les réponses vocales, le{" "}
            <strong className="text-ink">texte de vos messages et l'enregistrement de votre voix</strong>{" "}
            sont transmis à <strong className="text-ink">OpenAI</strong> (OpenAI, L.L.C., États-Unis), qui
            les traite pour notre compte afin de générer les réponses de l'IA. Votre enregistrement vocal
            sert uniquement à produire la transcription et n'est pas conservé par nos soins ensuite. Merci
            d'éviter de communiquer des informations personnelles sensibles pendant vos conversations
            d'entraînement.
          </p>
        </Section>

        <Section title="Données d'usage anonymes">
          <p>
            Afin de comprendre l'utilisation de l'application et de l'améliorer, nous pouvons conserver des
            enregistrements de session anonymes (identifiant anonyme, niveau estimé, types d'erreurs,
            scénario choisi et paramètres de langue). Ces enregistrements ne contiennent aucun nom, adresse
            e-mail ni autre information permettant de vous identifier directement.
          </p>
        </Section>

        <Section title="Cookies & traceurs">
          <p>
            SpeakUp AI n'utilise aucun cookie publicitaire ni outil de mesure d'audience ou de suivi tiers.
            Seul le stockage technique strictement nécessaire au fonctionnement de l'application est utilisé.
          </p>
        </Section>

        <Section title="Sous-traitants & transferts internationaux">
          <p>Les données ne sont partagées qu'avec des prestataires techniques agissant pour notre compte :</p>
          <ul className="ml-4 list-disc space-y-1">
            <li><strong className="text-ink">OpenAI, L.L.C.</strong> (États-Unis) — traitement du langage, de la parole et de la transcription par IA.</li>
            <li><strong className="text-ink">Vercel Inc.</strong> (États-Unis) — hébergement et diffusion du site.</li>
            <li><strong className="text-ink">Clerk</strong> — infrastructure d'authentification (utilisée uniquement si la connexion est activée).</li>
          </ul>
          <p>
            Les transferts en dehors de l'Union européenne sont encadrés par des garanties appropriées au
            titre du RGPD (notamment les clauses contractuelles types de la Commission européenne).
          </p>
        </Section>

        <Section title="Base légale & conservation">
          <p>
            Le traitement repose sur votre consentement et sur notre intérêt légitime à fournir et améliorer
            le service. Les données stockées dans votre navigateur y demeurent jusqu'à ce que vous les
            effaciez ; les enregistrements d'usage anonymes ne sont conservés que le temps utile à
            l'amélioration du produit.
          </p>
        </Section>

        <Section title="Vos droits (RGPD)">
          <p>
            Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et
            de portabilité de vos données. L'application étant anonyme, le moyen le plus simple de supprimer
            vos données locales est de vider le stockage du site dans votre navigateur. Pour toute demande,
            écrivez à{" "}
            <a href={`mailto:${CONTACT}`} className="font-medium text-coral underline decoration-line underline-offset-2">{CONTACT}</a>.
            Vous pouvez également introduire une réclamation auprès de la CNIL
            (<a href="https://www.cnil.fr" className="font-medium text-coral underline decoration-line underline-offset-2" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>).
          </p>
        </Section>

        {/* ── Mentions légales ───────────────────────────────────────── */}
        <div className="my-9 h-px w-full bg-line" />
        <h2 className="mb-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-coral">Mentions légales</h2>

        <Section title="Éditeur">
          <p>
            <strong className="text-ink">Antony Addy</strong> — auto-entrepreneur (formateur professionnel
            d'adultes indépendant).<br />
            135 rue Henri Vadon, Résidence des Arènes, 83600 Fréjus, France.<br />
            SIRET 48317889300028 · Déclaration d'activité n° 93830738883 enregistrée auprès de la DREETS
            Provence-Alpes-Côte d'Azur (cet enregistrement ne vaut pas agrément de l'État).<br />
            Contact : <a href={`mailto:${CONTACT}`} className="font-medium text-coral underline decoration-line underline-offset-2">{CONTACT}</a> · +33 6 49 82 98 26.<br />
            Directeur de la publication : Antony Addy.
          </p>
        </Section>

        <Section title="Hébergement">
          <p>
            Ce site est hébergé par <strong className="text-ink">Vercel Inc.</strong>, 340 S Lemon Ave
            #4133, Walnut, CA 91789, États-Unis — <a href="https://vercel.com" className="font-medium text-coral underline decoration-line underline-offset-2" target="_blank" rel="noopener noreferrer">vercel.com</a>.
          </p>
        </Section>

        <Section title="Propriété intellectuelle">
          <p>
            L'ensemble du contenu de ce site — textes, design et supports pédagogiques — est la propriété
            exclusive d'Antony Addy. Toute reproduction sans autorisation préalable est interdite.
          </p>
        </Section>

        <p className="mt-8 text-[11px] leading-relaxed text-clay">
          Les mentions légales et la politique de confidentialité complètes de l'activité d'Antony Addy sont
          également disponibles sur{" "}
          <a href="https://antonyaddy.com/mentions-legales" className="text-coral underline decoration-line underline-offset-2" target="_blank" rel="noopener noreferrer">antonyaddy.com</a>.
        </p>
      </div>
    </div>
  );
}
