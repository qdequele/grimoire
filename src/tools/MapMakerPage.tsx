import { useT } from '@/i18n/t'
import { MapEditor } from '@/maps/editor/MapEditor'
import type { Lang } from '@/settings/lang'
import { TOOL_PATHS } from './pages'
import { ToolArticle, ToolIntro, ToolLayout } from './ToolLayout'

// /outils/generateur-de-plans, /tools/map-maker: draw a floor plan, a crypt or a village by hand (or
// start from a random one), then download it or print it. Everything stays in the browser; describing
// a place and letting the AI draw it is in the app only.

export function MapMakerPage({ lang }: { lang: Lang }) {
  const t = useT()
  const other: Lang = lang === 'fr' ? 'en' : 'fr'
  return (
    <ToolLayout lang={lang} alternate={TOOL_PATHS.map[other]}>
      <ToolIntro eyebrow={t('Gratuit, sans compte')} title={t('Générateur de plans pour le jeu de rôle')} crumbs={[[t('Outils'), TOOL_PATHS.hub[lang]], [t('Générateur de plans'), TOOL_PATHS.map[lang]]]}>
        <p>{t('Dessine le plan d’un manoir, d’une crypte ou d’un village : des pièces en deux gestes, des portes, des meubles, des arbres, des tombes. Marque ce qui est secret, puis télécharge la version des joueurs pour la leur montrer.')}</p>
      </ToolIntro>
      <MapEditor lang={lang} storageKey="grimoire-map-tool" />
      <ToolArticle title={t('Comment ça marche')}>
        <h3>{t('Un plan sur une grille')}</h3>
        <p>{t('Chaque case fait 1,5 mètre dans un bâtiment, 3 mètres sous terre et 10 mètres en extérieur. Trace une pièce en faisant glisser l’outil « Pièce » : les murs se placent tout seuls. Peins ensuite le sol : portes et fenêtres dans les murs, eau, herbe, routes et chemins.')}</p>
        <h3>{t('Des objets à poser')}</h3>
        <p>{t('Lits, bibliothèques, cheminées, sarcophages, puits, maisons, églises, barques : choisis un objet, clique sur le plan, tourne-le avec R. L’outil « Choisir » le déplace, l’agrandit ou le supprime.')}</p>
        <h3>{t('Ce que les joueurs ne doivent pas voir')}</h3>
        <p>{t('Une porte secrète, une salle cachée, un objet ou un nom marqués secrets apparaissent en rouge sur la version du gardien et disparaissent de celle des joueurs. Télécharge les deux : l’une pour toi, l’autre pour la table.')}</p>
      </ToolArticle>
    </ToolLayout>
  )
}
