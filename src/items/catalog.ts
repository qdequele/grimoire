// The built-in items the keeper gives from (« Catalogue »): period equipment for investigation and horror
// games, with simple, original stats. Texts are French (the key) and translated where shown, like skills.
// A given card is copied into character_items with its catalogue id, so changing an entry here never
// changes cards already given.
import type { ItemCard } from './item'

export interface CatalogItem {
  /** Stable id (stored on given cards). */
  id: string
  card: ItemCard
  /** A paper the keeper fills in when giving it (its title and text: the letter that matters to their story). */
  fill?: true
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
  {
    id: 'pocket-knife',
    card: {
      name: 'Couteau de poche', kind: 'weapon', art: 'knife', rarity: 1,
      weapon: { skill: 'fighting-brawl', damage: '1D4', db: true, range: 'contact', rate: '1', impale: true },
      text: 'Il sert à tout : couper, gratter, dévisser. Et parfois à se défendre.',
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
  { id: 'dark-lantern', card: { name: 'Lanterne sourde', kind: 'light', art: 'lantern', rarity: 2, uses: 6, unit: 'heures', bonus: { skill: 'stealth', note: 'volet fermé, la flamme ne se voit plus' }, text: 'Un volet coulissant cache la lumière d’un geste. La lanterne des rôdeurs.' } },
  { id: 'carbide-lamp', card: { name: 'Lampe à carbure', kind: 'light', art: 'lantern', rarity: 1, uses: 8, unit: 'heures', text: 'La lampe des mineurs : une flamme blanche qui siffle doucement et ne craint pas le vent.' } },
  { id: 'searchlight', card: { name: 'Projecteur', kind: 'light', art: 'flashlight', rarity: 2, uses: 2, unit: 'heures', text: 'Un faisceau qui porte à cent mètres. Lourd, et il lui faut une batterie de voiture.' } },
  // ------------------------------------------------------------ tools
  { id: 'rope', card: { name: 'Corde de chanvre (15 m)', kind: 'tool', art: 'rope', rarity: 1, bonus: { skill: 'climb', note: 'dé bonus pour descendre ou monter avec' }, text: 'Assez solide pour un homme et son sac.' } },
  { id: 'crowbar', card: { name: 'Pied-de-biche', kind: 'tool', art: 'crowbar', rarity: 1, weapon: { skill: 'fighting-brawl', damage: '1D6', db: true, range: 'contact', rate: '1' }, text: 'Ouvre une caisse, une fenêtre, une tombe. Fait une arme honnête.' } },
  { id: 'chain-padlock', card: { name: 'Chaîne et cadenas', kind: 'tool', art: 'key', rarity: 1, text: 'Pour fermer une grille ou une porte de l’intérieur. Ce qui est enfermé ne sort plus, en principe.' } },
  { id: 'hand-drill', card: { name: 'Chignole', kind: 'tool', art: 'toolkit', rarity: 1, bonus: { skill: 'locksmith', note: 'percer la serrure plutôt que la crocheter' }, text: 'Un trou dans une porte suffit pour voir de l’autre côté, ou pour écouter.' } },
  { id: 'hacksaw', card: { name: 'Scie à métaux', kind: 'tool', art: 'toolkit', rarity: 1, text: 'Vient à bout d’un barreau ou d’un cadenas, lentement et bruyamment.' } },
  { id: 'blowtorch', card: { name: 'Chalumeau', kind: 'tool', art: 'flare', rarity: 2, uses: 3, unit: 'charges', text: 'Une flamme courte et très chaude : découpe le métal, allume un feu sous la pluie.' } },
  { id: 'climbing-irons', card: { name: 'Crampons de grimpeur', kind: 'tool', art: 'toolkit', rarity: 2, bonus: { skill: 'climb', note: 'dé bonus pour un arbre ou un poteau' }, text: 'Des pointes d’acier sanglées aux bottes, comme en ont les monteurs de lignes.' } },
  { id: 'block-tackle', card: { name: 'Palan', kind: 'tool', art: 'rope', rarity: 2, text: 'Une poulie et sa corde : un homme seul soulève une dalle, une malle ou un camarade.' } },
  { id: 'lockpicks', card: { name: 'Trousse de crochets', kind: 'tool', art: 'lockpicks', rarity: 2, bonus: { skill: 'locksmith', note: 'sans elle, Crochetage est plus difficile' }, text: 'Crochets et tensions dans un rouleau de cuir. Mieux vaut ne pas se faire prendre avec.' } },
  { id: 'pocket-mirror', card: { name: 'Miroir de poche', kind: 'tool', art: 'magnifier', rarity: 1, bonus: { skill: 'spot-hidden', note: 'voir au coin d’un mur sans se montrer' }, text: 'Pour regarder derrière un angle, ou faire un signal au soleil.' } },
  { id: 'toolkit', card: { name: 'Caisse à outils', kind: 'tool', art: 'toolkit', rarity: 1, bonus: { skill: 'mechanical-repair' }, text: 'Clés, marteau, tournevis, fil de fer. Lourde.' } },
  { id: 'binoculars', card: { name: 'Jumelles', kind: 'tool', art: 'binoculars', rarity: 1, bonus: { skill: 'spot-hidden', note: 'pour ce qui est loin' }, text: 'Jumelles de marine dans leur étui.' } },
  { id: 'compass', card: { name: 'Boussole', kind: 'tool', art: 'compass', rarity: 1, bonus: { skill: 'navigate' }, text: 'Le nord, même dans le brouillard. Certains lieux la font tourner en rond.' } },
  { id: 'magnifier', card: { name: 'Loupe', kind: 'tool', art: 'magnifier', rarity: 1, bonus: { skill: 'spot-hidden', note: 'pour un détail sous les yeux' }, text: 'Pour les empreintes, les signatures et les petits caractères.' } },
  { id: 'shovel', card: { name: 'Pelle', kind: 'tool', art: 'shovel', rarity: 1, text: 'Pour creuser. Personne ne demande jamais quoi.' } },
  { id: 'camera', card: { name: 'Appareil photo', kind: 'tool', art: 'camera', rarity: 2, uses: 12, unit: 'plaques', bonus: { skill: 'art-craft', note: 'Photographie' }, text: 'Une preuve que l’on peut montrer. Le flash au magnésium aveugle un instant.' } },
  { id: 'notebook', card: { name: 'Carnet et crayon', kind: 'document', art: 'notebook', rarity: 1, text: 'Pour noter les noms, les dates et ce qu’on n’ose pas dire.' } },
  { id: 'map', card: { name: 'Carte de la région', kind: 'document', art: 'map', rarity: 1, bonus: { skill: 'navigate' }, text: 'Routes, fermes et chemins. Les marges ont été annotées à la main.' } },
  { id: 'forged-papers', card: { name: 'Faux papiers', kind: 'document', art: 'map', rarity: 2, bonus: { skill: 'disguise', note: 'un autre nom, une autre profession' }, text: 'Tiennent tant que personne ne vérifie de trop près.' } },
  // Papers the keeper fills in when giving them: the words that matter to their story.
  { id: 'letter', fill: true, card: { name: 'Lettre', kind: 'document', art: 'notebook', rarity: 1, text: 'Une lettre pliée en trois. Le gardien écrit ce qu’elle dit.' } },
  { id: 'telegram', fill: true, card: { name: 'Télégramme', kind: 'document', art: 'notebook', rarity: 1, text: 'Quelques mots collés sur un formulaire bleu. STOP.' } },
  { id: 'newspaper-clipping', fill: true, card: { name: 'Coupure de presse', kind: 'document', art: 'notebook', rarity: 1, text: 'Un article découpé, jauni, parfois annoté dans la marge.' } },
  { id: 'floor-plan', fill: true, card: { name: 'Plan d’un bâtiment', kind: 'document', art: 'map', rarity: 2, text: 'Les pièces, les couloirs, et parfois ce qui n’apparaît sur aucun autre plan.' } },
  { id: 'photograph', fill: true, card: { name: 'Photographie', kind: 'document', art: 'camera', rarity: 1, text: 'Un tirage noir et blanc. Au dos, quelques mots au crayon.' } },
  { id: 'diary', fill: true, card: { name: 'Journal intime', kind: 'document', art: 'notebook', rarity: 2, text: 'Des pages datées, une écriture qui change vers la fin.' } },
  { id: 'asylum-file', fill: true, card: { name: 'Dossier d’internement', kind: 'document', art: 'notebook', rarity: 2, text: 'Un dossier d’asile : diagnostic, traitements, et ce que le patient répétait.' } },
  { id: 'notary-deed', fill: true, card: { name: 'Acte notarié', kind: 'document', art: 'notebook', rarity: 2, text: 'Un testament ou un acte de vente, tamponné et signé. Les clauses comptent.' } },
  { id: 'watch', card: { name: 'Montre de gousset', kind: 'gear', art: 'watch', rarity: 1, text: 'L’heure exacte, quand elle compte.' } },
  { id: 'keyring', card: { name: 'Trousseau de clés', kind: 'key', art: 'key', rarity: 1, text: 'Une dizaine de clés sans étiquette. L’une d’elles ouvre forcément quelque chose.' } },
  // Keys: the keeper can say what each one opens when giving it.
  { id: 'casket-key', fill: true, card: { name: 'Petite clé de coffret', kind: 'key', art: 'key', rarity: 1, text: 'Une clé de laiton pas plus longue qu’un doigt : un coffret à bijoux, une boîte à musique, un journal fermé.' } },
  { id: 'rusty-key', fill: true, card: { name: 'Vieille clé rouillée', kind: 'key', art: 'key', rarity: 2, text: 'Grosse, lourde, rongée de rouille. Une grille, une crypte, une cave oubliée. Elle force un peu, mais elle tourne.' } },
  { id: 'house-key', fill: true, card: { name: 'Clé de maison', kind: 'key', art: 'key', rarity: 1, text: 'Une clé de porte d’entrée, une étiquette de carton nouée au bout. L’adresse est presque effacée.' } },
  { id: 'hotel-key', fill: true, card: { name: 'Clé de chambre d’hôtel', kind: 'key', art: 'key', rarity: 1, text: 'Accrochée à une lourde plaque de laiton numérotée. Quelqu’un ne l’a jamais rendue.' } },
  { id: 'deposit-key', fill: true, card: { name: 'Clé de coffre de banque', kind: 'key', art: 'key', rarity: 2, text: 'Une clé plate à double panneton, un numéro gravé. Encore faut-il savoir quelle banque.' } },
  { id: 'skeleton-key', card: { name: 'Passe-partout', kind: 'key', art: 'key', rarity: 2, bonus: { skill: 'locksmith', note: 'dé bonus contre les vieilles serrures simples' }, text: 'Un panneton limé jusqu’à l’os. Les serrures d’avant-guerre ne lui résistent guère.' } },
  { id: 'backpack', card: { name: 'Sac à dos', kind: 'gear', art: 'backpack', rarity: 1, text: 'Toile épaisse et sangles de cuir. De quoi tenir deux jours dehors.' } },
  { id: 'flask', card: { name: 'Flasque de whisky', kind: 'gear', art: 'flask', rarity: 1, uses: 3, unit: 'gorgées', text: 'Une gorgée aide à tenir le coup. Trop, et la main tremble.' } },
  { id: 'canteen', card: { name: 'Gourde', kind: 'gear', art: 'flask', rarity: 1, uses: 4, unit: 'gorgées', text: 'De l’eau pour une journée de marche. Dans certains endroits, c’est ce qui manque en premier.' } },
  { id: 'tent', card: { name: 'Tente', kind: 'gear', art: 'backpack', rarity: 1, text: 'Deux places, toile goudronnée. Pour dormir dehors sans geler, sinon sans entendre.' } },
  { id: 'blanket', card: { name: 'Couverture de laine', kind: 'gear', art: 'backpack', rarity: 1, text: 'Contre le froid d’une nuit dehors, ou pour couvrir ce qu’on ne veut plus voir.' } },
  { id: 'camp-stove', card: { name: 'Réchaud', kind: 'gear', art: 'lantern', rarity: 1, uses: 6, unit: 'utilisations', text: 'Un repas chaud, du café, de l’eau bouillie. Le moral tient mieux.' } },
  { id: 'bear-trap', card: { name: 'Piège à mâchoires', kind: 'tool', art: 'toolkit', rarity: 2, text: 'Posé sur un passage, il retient ce qui marche dessus. Le gardien décide de ce qui s’y prend.' } },
  { id: 'straitjacket', card: { name: 'Camisole de force', kind: 'gear', art: 'backpack', rarity: 2, text: 'Pour qui ne se maîtrise plus. On espère ne jamais devoir s’en servir sur un ami.' } },
  { id: 'gas-mask', card: { name: 'Masque à gaz', kind: 'gear', art: 'binoculars', rarity: 2, text: 'Filtre la fumée, les gaz et ce qui flotte dans l’air des caves. On y voit mal sur les côtés.' } },
  { id: 'diving-suit', card: { name: 'Scaphandre', kind: 'gear', art: 'amulet', rarity: 3, bonus: { skill: 'swim', note: 'respirer sous l’eau, avec une pompe en surface' }, text: 'Casque de cuivre et combinaison lestée. Il faut deux personnes en surface pour pomper l’air.' } },
  { id: 'gin-bottle', card: { name: 'Gin de contrebande', kind: 'gear', art: 'vial', rarity: 1, uses: 6, unit: 'gorgées', bonus: { skill: 'charm', note: 'offrir un verre délie les langues' }, text: 'Prohibition oblige, mieux vaut ne pas la montrer à un policier.' } },
  { id: 'cigarettes', card: { name: 'Paquet de cigarettes', kind: 'gear', art: 'matches', rarity: 1, uses: 20, unit: 'utilisations', bonus: { skill: 'fast-talk', note: 'en offrir une ouvre la conversation' }, text: 'Une excuse pour s’attarder dehors, ou pour partager un silence.' } },
  { id: 'playing-cards', card: { name: 'Jeu de cartes', kind: 'gear', art: 'notebook', rarity: 1, bonus: { skill: 'psychology', note: 'une partie fait parler les gens du coin' }, text: 'Une partie à l’auberge en apprend plus qu’un interrogatoire.' } },
  { id: 'banknotes', card: { name: 'Liasse de billets', kind: 'gear', art: 'notebook', rarity: 2, uses: 5, unit: 'utilisations', bonus: { skill: 'persuade', note: 'un billet glissé aide à convaincre' }, text: 'Petites coupures. Un pourboire bien placé ouvre des portes et ferme des bouches.' } },
  // ------------------------------------------------------------ medical
  { id: 'first-aid-kit', card: { name: 'Trousse de premiers soins', kind: 'medical', art: 'medkit', rarity: 1, uses: 5, unit: 'utilisations', bonus: { skill: 'first-aid' }, text: 'Bandes, désinfectant, attelle. Sans elle, Premiers soins est plus difficile.' } },
  { id: 'bandages', card: { name: 'Bandages', kind: 'medical', art: 'bandage', rarity: 1, uses: 6, unit: 'utilisations', bonus: { skill: 'first-aid' }, text: 'De quoi arrêter un saignement.' } },
  { id: 'laudanum', card: { name: 'Flacon de laudanum', kind: 'medical', art: 'vial', rarity: 2, uses: 4, unit: 'doses', text: 'Calme la douleur et les nerfs. On s’y habitue trop vite.' } },
  { id: 'doctors-bag', card: { name: 'Sacoche de médecin', kind: 'medical', art: 'medkit', rarity: 2, uses: 8, unit: 'utilisations', bonus: { skill: 'medicine', note: 'sans elle, Médecine est plus difficile' }, text: 'Stéthoscope, instruments, fil et aiguilles, flacons étiquetés.' } },
  { id: 'smelling-salts', card: { name: 'Sels', kind: 'medical', art: 'vial', rarity: 1, uses: 3, unit: 'doses', bonus: { skill: 'first-aid', note: 'réveille quelqu’un d’évanoui' }, text: 'Une bouffée, et l’on revient à soi en toussant.' } },
  { id: 'morphine', card: { name: 'Seringues de morphine', kind: 'medical', art: 'vial', rarity: 2, uses: 3, unit: 'doses', text: 'Fait taire la douleur d’une blessure grave pour quelques heures. L’esprit flotte un peu.' } },
  // ------------------------------------------------------------ occult
  { id: 'crucifix', card: { name: 'Crucifix', kind: 'occult', art: 'cross', rarity: 1, text: 'Un réconfort pour qui y croit. Pour le reste, le gardien décide.' } },
  { id: 'amulet', card: { name: 'Amulette ancienne', kind: 'occult', art: 'amulet', rarity: 3, text: 'Un œil gravé dans un métal qui ne ternit pas. Personne ne sait ce qu’elle fait.' } },
  { id: 'rabbit-foot', card: { name: 'Patte de lapin', kind: 'occult', art: 'amulet', rarity: 1, text: 'Un porte-bonheur. Le joueur peut y croire ; le gardien, lui, sourit.' } },
  { id: 'chalk-salt', card: { name: 'Craie et sel', kind: 'occult', art: 'chalk', rarity: 2, uses: 3, unit: 'utilisations', bonus: { skill: 'occult' }, text: 'Pour tracer un cercle sur le sol. Les vieux livres disent que certaines choses ne le franchissent pas.' } },
  { id: 'old-book', card: { name: 'Livre ancien', kind: 'occult', art: 'book', rarity: 3, bonus: { skill: 'occult' }, text: 'Reliure fatiguée, fermoir de cuivre. Le lire prend des semaines, et coûte peut-être davantage.' } },
  // Eldritch artefacts: rare, unsettling, often at a cost. The SAN losses are suggestions; the keeper decides.
  { id: 'skin-psalter', card: { name: 'Psautier des Eaux Basses', kind: 'occult', art: 'book', rarity: 3, bonus: { skill: 'occult' }, text: 'Un psautier relié d’une peau trop fine, les prières y sont adressées à quelque chose sous la mer. Le lire en entier : 1D6 SAN et une semaine de mauvais rêves.' } },
  { id: 'squatting-idol', card: { name: 'Statuette accroupie', kind: 'occult', art: 'amulet', rarity: 3, text: 'Pierre noire, une chose accroupie aux bras trop nombreux. Elle reste froide au soleil. La fixer longtemps : 0/1D3 SAN.' } },
  {
    id: 'ritual-dagger',
    card: {
      name: 'Dague rituelle', kind: 'weapon', art: 'knife', rarity: 3,
      weapon: { skill: 'fighting-brawl', damage: '1D4+2', db: true, range: 'contact', rate: '1', impale: true },
      text: 'Lame d’obsidienne emmanchée d’os, des signes usés sur la garde. Elle a déjà servi, et pas en cuisine.',
    },
  },
  { id: 'phonograph-cylinder', card: { name: 'Cylindre de phonographe', kind: 'occult', art: 'vial', rarity: 2, text: 'Un chant enregistré dans une langue que personne ne reconnaît, et une voix de trop dans le chœur. L’écouter jusqu’au bout : 1/1D4 SAN.' } },
  { id: 'sealed-jar', card: { name: 'Bocal scellé', kind: 'occult', art: 'vial', rarity: 3, text: 'Verre épais, cire sur le couvercle. Ce qui flotte dedans bouge quand personne ne regarde.' } },
  { id: 'black-mirror', card: { name: 'Miroir noir', kind: 'occult', art: 'amulet', rarity: 3, bonus: { skill: 'occult', note: 'on y voit ce qui se tient derrière soi' }, text: 'Un disque d’obsidienne poli. Qui s’y regarde de nuit ne s’y voit pas toujours seul.' } },
  { id: 'hag-stone', card: { name: 'Pierre trouée', kind: 'occult', art: 'amulet', rarity: 2, bonus: { skill: 'spot-hidden', note: 'regarder par le trou montre ce qui se cache' }, text: 'Un galet percé par la mer. À travers, on voit ce qui ne veut pas être vu. Le gardien décide de ce que ça coûte.' } },
  { id: 'strange-key', card: { name: 'Clé d’un métal inconnu', kind: 'key', art: 'key', rarity: 3, text: 'Tiède au toucher, sans une trace de rouille, d’aucune serrure connue. Elle tire un peu, toujours dans la même direction.' } },
  { id: 'ceremonial-robe', card: { name: 'Robe de cérémonie', kind: 'gear', art: 'backpack', rarity: 2, bonus: { skill: 'disguise', note: 'de loin, on passe pour l’un des leurs' }, text: 'Une robe à capuche brodée de signes que l’on préfère ne pas comprendre.' } },
  { id: 'wrong-compass', card: { name: 'Boussole déréglée', kind: 'occult', art: 'compass', rarity: 3, text: 'L’aiguille ne montre pas le nord, mais toujours le même point. Et ce point se déplace.' } },
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
