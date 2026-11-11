// The built-in items the keeper gives from (« Catalogue »): period equipment for investigation and horror
// games, with simple, original stats. Texts are French (the key) and translated where shown, like skills.
// A given card is copied into character_items with its catalogue id, so changing an entry here never
// changes cards already given.
import type { ItemCard } from './item'

export interface CatalogItem {
  /** Stable id (stored on given cards). */
  id: string
  card: ItemCard
}

/** A firearm: impales, jams at `malfunction`, holds `uses` rounds of `ammo`. */
const gun = (skill: string, damage: string, range: string, rate: string, uses: number, ammo: string, malfunction = 100): Pick<ItemCard, 'weapon' | 'uses' | 'ammo'> =>
  ({ weapon: { skill, damage, range, rate, malfunction, impale: true }, uses, ammo })

export const CATALOG: CatalogItem[] = [
  // ------------------------------------------------------------ weapons
  {
    id: 'revolver-38',
    card: {
      name: 'Revolver .38', kind: 'weapon', art: 'revolver', rarity: 1, unit: 'balles',
      ...gun('firearms-handgun', '1D10', '15 m', '1 (3)', 6, '.38'),
      text: 'Six coups dans le barillet. Fiable, discret sous une veste.',
    },
  },
  {
    id: 'pistol-45',
    card: {
      name: 'Pistolet .45', kind: 'weapon', art: 'pistol', rarity: 2, unit: 'balles',
      ...gun('firearms-handgun', '1D10+2', '15 m', '1 (3)', 7, '.45'),
      text: 'Pistolet automatique, lourd et bruyant. Un chargeur de sept balles.',
    },
  },
  {
    id: 'derringer-41',
    card: {
      name: 'Derringer .41', kind: 'weapon', art: 'derringer', rarity: 2, unit: 'balles',
      ...gun('firearms-handgun', '1D8', '3 m', '1', 2, '.41'),
      text: 'Tient dans une poche de gilet ou une jarretière. Deux coups, pas un de plus.',
    },
  },
  {
    id: 'rifle-3006',
    card: {
      name: 'Fusil à verrou .30-06', kind: 'weapon', art: 'rifle', rarity: 2, unit: 'balles',
      ...gun('firearms-rifle', '2D6+4', '110 m', '1', 5, '.30-06'),
      text: 'Fusil de chasse au gros gibier. Précis de loin, encombrant de près.',
    },
  },
  {
    id: 'rifle-22',
    card: {
      name: 'Carabine .22', kind: 'weapon', art: 'rifle', rarity: 1, unit: 'balles',
      ...gun('firearms-rifle', '1D6+1', '30 m', '1', 6, '.22', 99),
      text: 'La carabine de la ferme, contre les nuisibles.',
    },
  },
  {
    id: 'shotgun-12',
    card: {
      name: 'Fusil de chasse calibre 12', kind: 'weapon', art: 'shotgun', rarity: 1, unit: 'cartouches',
      weapon: { skill: 'firearms-rifle', damage: '4D6/2D6/1D6', range: '10/20/50 m', rate: '1 ou 2', malfunction: 100 },
      uses: 2, ammo: '12',
      text: 'Double canon. Les dégâts baissent avec la distance : à bout portant, à 20 m, à 50 m.',
    },
  },
  {
    id: 'knife',
    card: {
      name: 'Couteau de chasse', kind: 'weapon', art: 'knife', rarity: 1,
      weapon: { skill: 'fighting-brawl', damage: '1D6', db: true, range: 'contact', rate: '1', impale: true },
      text: 'Lame fixe dans un étui de cuir. Sert aussi à couper une corde ou forcer un tiroir.',
    },
  },
  {
    id: 'club',
    card: {
      name: 'Matraque', kind: 'weapon', art: 'club', rarity: 1,
      weapon: { skill: 'fighting-brawl', damage: '1D6', db: true, range: 'contact', rate: '1' },
      text: 'Bois dur et lanière de cuir. Assomme plus souvent qu’elle ne tue.',
    },
  },
  {
    id: 'hatchet',
    card: {
      name: 'Hachette', kind: 'weapon', art: 'hatchet', rarity: 1,
      weapon: { skill: 'fighting-brawl', damage: '1D6+1', db: true, range: 'contact', rate: '1', impale: true },
      text: 'Pour le petit bois, les portes coincées, et le reste.',
    },
  },
  {
    id: 'sword-cane',
    card: {
      name: 'Canne-épée', kind: 'weapon', art: 'cane', rarity: 3,
      weapon: { skill: 'fighting-brawl', damage: '1D6', db: true, range: 'contact', rate: '1', impale: true },
      text: 'Une canne de gentleman, et une lame fine dans le fût.',
    },
  },
  {
    id: 'dynamite',
    card: {
      name: 'Bâtons de dynamite', kind: 'weapon', art: 'dynamite', rarity: 3, unit: 'charges',
      weapon: { skill: 'throw', damage: '4D10', range: 'lancer, 3 m', rate: '1' },
      uses: 3,
      text: 'Tous ceux qui sont à moins de 3 m de l’explosion prennent les dégâts. Mèche courte.',
    },
  },
  // ------------------------------------------------------------ ammunition
  { id: 'ammo-38', card: { name: 'Boîte de balles .38', kind: 'ammo', art: 'bullets', rarity: 1, uses: 20, unit: 'balles', ammo: '.38', text: 'Recharge un revolver .38.' } },
  { id: 'ammo-45', card: { name: 'Balles .45', kind: 'ammo', art: 'bullets', rarity: 1, uses: 14, unit: 'balles', ammo: '.45', text: 'Deux chargeurs pleins pour un pistolet .45.' } },
  { id: 'ammo-41', card: { name: 'Balles .41', kind: 'ammo', art: 'bullets', rarity: 2, uses: 10, unit: 'balles', ammo: '.41', text: 'Pour un derringer .41.' } },
  { id: 'ammo-3006', card: { name: 'Balles .30-06', kind: 'ammo', art: 'bullets', rarity: 1, uses: 10, unit: 'balles', ammo: '.30-06', text: 'Pour un fusil à verrou .30-06.' } },
  { id: 'ammo-22', card: { name: 'Balles .22', kind: 'ammo', art: 'bullets', rarity: 1, uses: 25, unit: 'balles', ammo: '.22', text: 'Pour une carabine .22.' } },
  { id: 'ammo-12', card: { name: 'Cartouches calibre 12', kind: 'ammo', art: 'shells', rarity: 1, uses: 10, unit: 'cartouches', ammo: '12', text: 'Chevrotine pour un fusil de chasse calibre 12.' } },
  // ------------------------------------------------------------ light
  { id: 'flashlight', card: { name: 'Lampe torche', kind: 'light', art: 'flashlight', rarity: 1, uses: 3, unit: 'heures', text: 'Un faisceau étroit. Les piles faiblissent vite dans le froid.' } },
  { id: 'lantern', card: { name: 'Lanterne à pétrole', kind: 'light', art: 'lantern', rarity: 1, uses: 6, unit: 'heures', text: 'Éclaire toute une pièce. Se voit de loin, et le verre se brise.' } },
  { id: 'candles', card: { name: 'Bougies', kind: 'light', art: 'candle', rarity: 1, uses: 6, unit: 'bougies', text: 'Une lumière fragile. Un courant d’air suffit à l’éteindre.' } },
  { id: 'matches', card: { name: 'Boîte d’allumettes', kind: 'light', art: 'matches', rarity: 1, uses: 20, unit: 'allumettes', text: 'Quelques secondes de lumière, ou de quoi allumer un feu.' } },
  { id: 'flare', card: { name: 'Fusées de détresse', kind: 'light', art: 'flare', rarity: 2, uses: 2, unit: 'charges', text: 'Une lumière rouge et violente pendant une minute. Se voit à des kilomètres.' } },
  // ------------------------------------------------------------ tools
  { id: 'rope', card: { name: 'Corde de chanvre (15 m)', kind: 'tool', art: 'rope', rarity: 1, bonus: { skill: 'climb', note: 'dé bonus pour descendre ou monter avec' }, text: 'Assez solide pour un homme et son sac.' } },
  { id: 'crowbar', card: { name: 'Pied-de-biche', kind: 'tool', art: 'crowbar', rarity: 1, weapon: { skill: 'fighting-brawl', damage: '1D6', db: true, range: 'contact', rate: '1' }, text: 'Ouvre une caisse, une fenêtre, une tombe. Fait une arme honnête.' } },
  { id: 'lockpicks', card: { name: 'Trousse de crochets', kind: 'tool', art: 'lockpicks', rarity: 2, bonus: { skill: 'locksmith', note: 'sans elle, Crochetage est plus difficile' }, text: 'Crochets et tensions dans un rouleau de cuir. Mieux vaut ne pas se faire prendre avec.' } },
  { id: 'toolkit', card: { name: 'Caisse à outils', kind: 'tool', art: 'toolkit', rarity: 1, bonus: { skill: 'mechanical-repair' }, text: 'Clés, marteau, tournevis, fil de fer. Lourde.' } },
  { id: 'binoculars', card: { name: 'Jumelles', kind: 'tool', art: 'binoculars', rarity: 1, bonus: { skill: 'spot-hidden', note: 'pour ce qui est loin' }, text: 'Jumelles de marine dans leur étui.' } },
  { id: 'compass', card: { name: 'Boussole', kind: 'tool', art: 'compass', rarity: 1, bonus: { skill: 'navigate' }, text: 'Le nord, même dans le brouillard. Certains lieux la font tourner en rond.' } },
  { id: 'magnifier', card: { name: 'Loupe', kind: 'tool', art: 'magnifier', rarity: 1, bonus: { skill: 'spot-hidden', note: 'pour un détail sous les yeux' }, text: 'Pour les empreintes, les signatures et les petits caractères.' } },
  { id: 'shovel', card: { name: 'Pelle', kind: 'tool', art: 'shovel', rarity: 1, text: 'Pour creuser. Personne ne demande jamais quoi.' } },
  { id: 'camera', card: { name: 'Appareil photo', kind: 'tool', art: 'camera', rarity: 2, uses: 12, unit: 'plaques', bonus: { skill: 'art-craft', note: 'Photographie' }, text: 'Une preuve que l’on peut montrer. Le flash au magnésium aveugle un instant.' } },
  { id: 'notebook', card: { name: 'Carnet et crayon', kind: 'document', art: 'notebook', rarity: 1, text: 'Pour noter les noms, les dates et ce qu’on n’ose pas dire.' } },
  { id: 'map', card: { name: 'Carte de la région', kind: 'document', art: 'map', rarity: 1, bonus: { skill: 'navigate' }, text: 'Routes, fermes et chemins. Les marges ont été annotées à la main.' } },
  { id: 'watch', card: { name: 'Montre de gousset', kind: 'gear', art: 'watch', rarity: 1, text: 'L’heure exacte, quand elle compte.' } },
  { id: 'backpack', card: { name: 'Sac à dos', kind: 'gear', art: 'backpack', rarity: 1, text: 'Toile épaisse et sangles de cuir. De quoi tenir deux jours dehors.' } },
  { id: 'flask', card: { name: 'Flasque de whisky', kind: 'gear', art: 'flask', rarity: 1, uses: 3, unit: 'gorgées', text: 'Une gorgée aide à tenir le coup. Trop, et la main tremble.' } },
  // ------------------------------------------------------------ medical
  { id: 'first-aid-kit', card: { name: 'Trousse de premiers soins', kind: 'medical', art: 'medkit', rarity: 1, uses: 5, unit: 'utilisations', bonus: { skill: 'first-aid' }, text: 'Bandes, désinfectant, attelle. Sans elle, Premiers soins est plus difficile.' } },
  { id: 'bandages', card: { name: 'Bandages', kind: 'medical', art: 'bandage', rarity: 1, uses: 6, unit: 'utilisations', bonus: { skill: 'first-aid' }, text: 'De quoi arrêter un saignement.' } },
  { id: 'laudanum', card: { name: 'Flacon de laudanum', kind: 'medical', art: 'vial', rarity: 2, uses: 4, unit: 'doses', text: 'Calme la douleur et les nerfs. On s’y habitue trop vite.' } },
  // ------------------------------------------------------------ occult
  { id: 'crucifix', card: { name: 'Crucifix', kind: 'occult', art: 'cross', rarity: 1, text: 'Un réconfort pour qui y croit. Pour le reste, le gardien décide.' } },
  { id: 'amulet', card: { name: 'Amulette ancienne', kind: 'occult', art: 'amulet', rarity: 3, text: 'Un œil gravé dans un métal qui ne ternit pas. Personne ne sait ce qu’elle fait.' } },
  { id: 'chalk-salt', card: { name: 'Craie et sel', kind: 'occult', art: 'chalk', rarity: 2, uses: 3, unit: 'utilisations', bonus: { skill: 'occult' }, text: 'Pour tracer un cercle sur le sol. Les vieux livres disent que certaines choses ne le franchissent pas.' } },
  { id: 'old-book', card: { name: 'Livre ancien', kind: 'occult', art: 'book', rarity: 3, bonus: { skill: 'occult' }, text: 'Reliure fatiguée, fermoir de cuivre. Le lire prend des semaines, et coûte peut-être davantage.' } },
]

export const CATALOG_BY_ID = new Map(CATALOG.map((c) => [c.id, c]))

/** "12/43": the card's number in the catalogue, like a card set's. */
export function catalogNumber(id: string): string | null {
  const i = CATALOG.findIndex((c) => c.id === id)
  return i < 0 ? null : `${i + 1}/${CATALOG.length}`
}

/** The catalogue's French texts, translated where shown (src/i18n/keys.ts lists them). Numbers ("15 m", "1 (3)") stay as they are. */
export const catalogTexts = (): string[] =>
  CATALOG.flatMap(({ card: c }) => [c.name, c.text ?? '', c.bonus?.note ?? '', c.weapon?.range ?? '', c.weapon?.rate ?? ''])
    .filter((x) => /\p{L}{2,}/u.test(x))
