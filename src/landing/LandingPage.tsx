import { useEffect } from 'react'
import { Link } from 'react-router'
import { useT } from '@/i18n/t'
import { LegalLinks } from '@/legal/LegalPage'
import { LANG_LABEL, useLang } from '@/settings/lang'
import { Epigraph, Masthead, SkinToggle } from '@/theme/Masthead'
import { AmbianceDemo } from './AmbianceDemo'
import { CombatDemo } from './CombatDemo'
import { CreatorDemo } from './CreatorDemo'
import { DiceDemo } from './DiceDemo'
import { Feature, LinkButton, SectionTitle, Showcase } from './parts'
import { ProgressDemo } from './ProgressDemo'
import { SoundDemo } from './SoundDemo'
import { TOOL_PATHS, type ToolKind } from '@/tools/pages'

// The public front page: what signed-out visitors see at "/" (signed-in keepers get the home menu).
// Laid out like the rest of the app (legacy home screen: eyebrows, diamond bullets, gold rules), and
// it shows the real pieces rather than pictures of them: the ambiance screen's drawn décors, the
// phones' 3D dice, and cut-down versions of the combat helper, the creation wizard, the improvement
// phase and the sound panel, on the same engine functions as the app.

const SIGN_UP = '/login?mode=signup'

function LangSwitch() {
  const { lang, setLang } = useLang()
  const other = lang === 'fr' ? 'en' : 'fr'
  return (
    <button
      type="button"
      lang={other}
      aria-label={LANG_LABEL[other]}
      onClick={() => setLang(other)}
      className="text-xs tracking-[0.14em] text-muted-foreground uppercase hover:text-gold"
    >
      {/* "EN" on phones: the header has no room for "English" next to the sign-in button. */}
      <span className="sm:hidden">{other}</span>
      <span className="hidden sm:inline">{LANG_LABEL[other]}</span>
    </button>
  )
}

/** One way to get a story: a title, a few lines, and the steps it goes through. */
function StoryPath({ title, text, steps }: { title: string; text: string; steps: string[] }) {
  return (
    <li className="flex flex-col gap-3 border border-border bg-card p-5">
      <h3 className="flex items-baseline gap-3 font-heading text-2xl leading-tight">
        <span aria-hidden="true" className="diamond" />
        {title}
      </h3>
      <p className="font-serif text-lg leading-relaxed text-muted-foreground">{text}</p>
      <ol className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-3 text-[0.6875rem] tracking-[0.12em] text-muted-foreground uppercase">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true" className="text-gold">→</span>}
            {s}
          </li>
        ))}
      </ol>
    </li>
  )
}

export function LandingPage() {
  const t = useT()

  useEffect(() => {
    const before = document.title
    document.title = t('Grimoire · Le compagnon du gardien')
    return () => {
      document.title = before
    }
  }, [t])

  const steps: [string, string][] = [
    [t('Choisis une histoire'), t('Dans la bibliothèque, parmi tes propres histoires, ou écris-en une nouvelle avec l’IA.')],
    [t('Crée les investigateurs'), t('Un assistant pas à pas : caractéristiques, occupation, compétences, profil.')],
    [t('Invite la table'), t('Un QR code par joueur. Ils ouvrent leur fiche sur leur téléphone, sans compte.')],
    [t('Joue'), t('Scène après scène, Grimoire tient les règles, les points et le journal. Toi, tu racontes.')],
  ]

  const tools: [ToolKind, string, string][] = [
    ['dice', t('Lanceur de dés'), t('Un d100 avec dés bonus et de pénalité, et tous les dés du D3 au D100.')],
    ['investigator', t('Créer un investigateur'), t('Pas à pas ou au hasard, avec la fiche prête à imprimer.')],
    ['sheet', t('Fiche d’investigateur vierge'), t('Deux pages A4 à remplir au crayon.')],
    ['scenarios', t('Scénarios gratuits'), t('Des histoires originales complètes, à lire, imprimer ou jouer.')],
  ]

  return (
    <div className="flex min-h-svh flex-col">
      <header className="app-header sticky top-0 z-20 bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-10">
          <Link to="/" className="font-heading text-2xl text-gold">Grimoire</Link>
          <span className="flex-1" />
          <LangSwitch />
          <LinkButton variant="outline" size="sm" to="/login">{t('Se connecter')}</LinkButton>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-28 px-4 py-16 sm:px-10 lg:py-[4.5rem]">
        <section className="grid items-center gap-12 lg:grid-cols-[5fr_6fr] lg:gap-16">
          <div className="flex flex-col gap-8">
            <Masthead eyebrow={t('Écran du gardien')} title="Grimoire" subtitle={t('Le compagnon du gardien, scène par scène')} />
            <p className="font-serif text-xl leading-relaxed text-pretty">
              {t('Tout ce qu’il faut pour mener une partie d’enquête et d’horreur au d100 : l’histoire scène par scène, les jets de dés, les fiches des joueurs sur leur téléphone et une ambiance vivante sur l’écran de la table.')}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <LinkButton size="lg" to={SIGN_UP}>{t('Créer un compte')}</LinkButton>
              <LinkButton variant="ghost" size="lg" to="/login">{t("J'ai déjà un compte")}</LinkButton>
            </div>
            <p className="text-sm text-muted-foreground">{t('Dans le navigateur : ordinateur, tablette ou téléphone. Rien à installer.')}</p>
          </div>
          <AmbianceDemo />
        </section>

        <section aria-labelledby="table" className="flex scroll-mt-24 flex-col gap-12">
          <SectionTitle id="table" eyebrow={t('À la table')} title={t('Tu racontes, Grimoire tient les fils')} />
          <ul className="grid gap-x-12 gap-y-10 md:grid-cols-2">
            <Feature title={t('Le fil de la scène')}>
              {t('Chaque scène avec son texte à lire, ses PNJ, ses indices et ses tests. Jets, combats et santé mentale suivent les règles ; le journal garde tout.')}
            </Feature>
            <Feature title={t("L'écran d'ambiance")}>
              {t('Une télé ou une tablette au milieu de la table : le décor de la scène, la pluie, le brouillard, le feu, et les documents à montrer aux joueurs.')}
            </Feature>
            <Feature title={t('Le narrateur')}>
              {t('Une IA qui connaît la scène en cours t’aide à décrire un lieu, improviser une réplique ou relancer les joueurs.')}
            </Feature>
            <Feature title={t('Le journal de la partie')}>
              {t('Chaque jet, chaque point perdu, chaque note. La partie est gardée dans ton compte et reprend où tu l’as laissée, sur n’importe quel appareil.')}
            </Feature>
          </ul>
        </section>

        <Showcase
          id="des"
          eyebrow={t('Les dés')}
          title={t('Les joueurs lancent, le gardien voit tout')}
          text={t('Un lien ou un QR code suffit : pas de compte, pas d’application. Chaque joueur lance ses dés sur son téléphone ; le résultat s’affiche chez le gardien et s’inscrit au journal de la partie.')}
          points={[
            t('Tests de compétence, de caractéristique, de santé mentale et de chance, avec leur niveau de réussite.'),
            t('Dés bonus et de pénalité, et tous les dés du D3 au D100 pour les dégâts.'),
            t('Côté gardien, un jet pour plusieurs investigateurs d’un coup.'),
          ]}
          demo={<DiceDemo />}
          flip
        />

        <Showcase
          id="combat"
          eyebrow={t('Le combat')}
          title={t('Un combat sans calculette')}
          text={t('Choisis les adversaires et les investigateurs engagés : Grimoire les range par DEX, compte les rounds et applique les dégâts selon les règles.')}
          points={[
            t('Blessure grave, inconscience, agonie et mort : l’état suit les points de vie.'),
            t('Les attaques et la protection de chaque créature, prêtes à lancer.'),
            t('Tout s’écrit au journal, round par round.'),
          ]}
          demo={<CombatDemo />}
        />

        <Showcase
          id="sons"
          eyebrow={t('Les sons')}
          title={t('Une table de mixage pour l’angoisse')}
          text={t('Chaque scène propose ses ambiances. Mélange la pluie, le vent et une horloge, puis lâche un coup de tonnerre au bon moment.')}
          points={[
            t('Des ambiances en boucle qui se fondent l’une dans l’autre, un volume pour chacune.'),
            t('Des bruitages à déclencher d’un geste : portes, pas, loups, orage.'),
            t('Le son peut aussi passer par l’écran d’ambiance.'),
          ]}
          demo={<SoundDemo />}
          flip
        />

        <Showcase
          id="investigateurs"
          eyebrow={t('Investigateurs')}
          title={t('Un investigateur en quelques minutes')}
          text={t('Un assistant pas à pas, au gardien ou sur le téléphone du joueur : il tire les caractéristiques, calcule les valeurs dérivées et répartit les points de compétence.')}
          points={[
            t('Les occupations, leurs compétences et les points à répartir, vérifiés à chaque étape.'),
            t('Un générateur de noms et une aide IA pour le profil : idéologie, personne importante, lieu significatif, traits.'),
            t('Une photo pour chaque investigateur, chez le gardien et sur les téléphones.'),
          ]}
          demo={<CreatorDemo />}
        />

        <Showcase
          id="progression"
          eyebrow={t('Au long cours')}
          title={t('Tes investigateurs grandissent d’une partie à l’autre')}
          text={t('Les investigateurs vivent dans ton compte, pas dans une partie. Coche les compétences réussies pendant le jeu ; la phase d’amélioration les fait progresser, et ils arrivent plus forts à la partie suivante.')}
          points={[
            t('Compétences, santé mentale et historique suivent l’investigateur dans chaque nouvelle partie.'),
            t('Chaque joueur retrouve les siens : la page Joueurs résume leurs investigateurs et leurs progrès.'),
          ]}
          demo={<ProgressDemo />}
          flip
        />

        <section aria-labelledby="histoires" className="flex scroll-mt-24 flex-col gap-12">
          <SectionTitle id="histoires" eyebrow={t('Histoires')} title={t('Ton histoire, comme tu veux l’écrire')} />
          <p className="max-w-3xl font-serif text-lg leading-relaxed text-muted-foreground">
            {t('Une bibliothèque d’histoires originales prêtes à jouer, et trois façons d’ajouter les tiennes. Elles restent privées, dans ton compte.')}
          </p>
          <ul className="grid gap-6 lg:grid-cols-3">
            <StoryPath
              title={t('Avec le créateur')}
              text={t('Quelques questions sur l’époque, le lieu, le ton et la menace. L’IA propose un plan ; tu le relis et le corriges avant qu’elle n’écrive les scènes, avec leurs PNJ, leurs indices et leur ambiance.')}
              steps={[t('Questions'), t('Plan'), t('Scènes')]}
            />
            <StoryPath
              title={t('À partir de tes notes')}
              text={t('Photographie tes notes ou les pages d’un livre que tu possèdes : l’IA en tire les scènes, les PNJ et les documents, et en fait une histoire jouable. Ou glisse tes idées dans le questionnaire du créateur.')}
              steps={[t('Photos'), t('Lecture par l’IA'), t('Histoire')]}
            />
            <StoryPath
              title={t('Avec ton agent')}
              text={t('Branche Grimoire à ChatGPT ou Claude : ton assistant écrit une histoire avec toi ou retouche une scène. Grimoire vérifie chaque changement et le range dans ta bibliothèque.')}
              steps={[t('ChatGPT ou Claude'), t('Vérification'), t('Bibliothèque')]}
            />
          </ul>
          <p className="text-sm text-muted-foreground">
            {t('Chaque histoire est aussi un pack que tu peux télécharger, partager et réimporter.')}
          </p>
        </section>

        <section aria-labelledby="outils" className="flex scroll-mt-24 flex-col gap-10">
          <SectionTitle id="outils" eyebrow={t('Gratuit, sans compte')} title={t('Des outils pour ta prochaine partie')} />
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {tools.map(([kind, title, text]) => (
              <li key={kind} className="flex">
                <Link to={TOOL_PATHS[kind][t.lang]} className="group flex w-full flex-col gap-2 border border-border bg-card p-5 hover:border-gold/60">
                  <h3 className="font-heading text-xl leading-tight group-hover:text-gold">{title}</h3>
                  <p className="font-serif text-lg leading-relaxed text-muted-foreground">{text}</p>
                  <span className="mt-auto text-sm text-gold">{t('Ouvrir')} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="deroulement" className="flex scroll-mt-24 flex-col gap-12">
          <SectionTitle id="deroulement" eyebrow={t('Comment ça marche')} title={t('De l’histoire à la table, en quatre temps')} />
          <ol className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(([title, text], i) => (
              <li key={title} className="flex flex-col gap-2 border-t border-gold/40 pt-4">
                <span className="font-heading text-4xl text-gold" aria-hidden="true">{i + 1}</span>
                <h3 className="font-heading text-xl">{title}</h3>
                <p className="font-serif text-lg leading-relaxed text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid items-center gap-10 border-t border-gold/40 pt-12 lg:grid-cols-2 lg:gap-16">
          <Epigraph quote={t("La lampe du phare s'est éteinte il y a trois nuits. Quelqu'un doit aller voir.")} />
          <div className="flex flex-col gap-4 lg:items-start">
            <p className="font-serif text-xl">{t('Ta prochaine partie commence ici.')}</p>
            <div className="flex flex-wrap gap-3">
              <LinkButton size="lg" to={SIGN_UP}>{t('Créer un compte')}</LinkButton>
              <LinkButton variant="ghost" size="lg" to="/login">{t('Se connecter')}</LinkButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 pb-6 sm:px-10">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <LegalLinks t={t} />
          <Link to={TOOL_PATHS.hub[t.lang]} className="text-xs tracking-[0.14em] text-muted-foreground uppercase hover:text-gold">{t('Outils gratuits')}</Link>
        </div>
        <SkinToggle />
      </footer>
    </div>
  )
}
