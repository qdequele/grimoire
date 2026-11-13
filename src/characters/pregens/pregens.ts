// Pre-generated investigators ("prétirés"): twelve 1920s investigators, mostly American, ready to
// play. Original characters (no names from published games or fiction). Each is a wizard draft built
// with the app's creation rules (fixed characteristic array, occupation values, four personal
// interests), so `checkDraft` finds nothing and the wizard reopens a copied one as it was. Their texts
// are written in French and English; a keeper's copy takes the app's language. Portraits are drawn
// files (`portraits/<id>.jpg`, see portraits.ts).
// No Supabase import: the list can be shown and tested anywhere.
import type { CharacterData } from '@/characters/character'
import { toCharacterData } from '@/characters/character'
import { applyOccupation, newDraft, type CreationDraft } from '@/engine/creation'
import type { Lang } from '@/settings/lang'
import type { Characteristic, ProfileField } from '@/rules/d100'

interface PregenText {
  /** One line on the list: who they are, what drags them into trouble. */
  hook: string
  profile: Record<ProfileField, string>
}

export interface Pregen {
  /** Stable id (also the portrait's file name). */
  id: string
  name: string
  /** Occupation id (src/rules/d100.ts). */
  occupation: string
  age: number
  /** Where they come from, in a few words (list filter and card). */
  origin: Record<Lang, string>
  characteristics: Record<Characteristic, number>
  luck: number
  /** The occupation's 8 skills: its own, then the ones chosen. */
  skills: string[]
  /** Value placed on each occupation skill and on credit-rating (OCCUPATION_ARRAY, all used). */
  values: Record<string, number>
  /** Four personal interests (+20). */
  interests: string[]
  /** Specialties beyond the occupation's defaults (French labels, translated where shown). */
  specialties?: Record<string, string>
  text: Record<Lang, PregenText>
}

export const PREGENS: Pregen[] = [
  {
    id: 'eleanor-whitcomb',
    name: 'Eleanor Whitcomb',
    occupation: 'journalist',
    age: 29,
    origin: { fr: 'Boston', en: 'Boston' },
    characteristics: { STR: 40, CON: 50, SIZ: 50, DEX: 60, APP: 60, INT: 80, POW: 70, EDU: 50 },
    luck: 55,
    skills: ['art-craft', 'library-use', 'history', 'language-own', 'psychology', 'fast-talk', 'spot-hidden', 'stealth'],
    values: {
      'spot-hidden': 70, 'library-use': 60, 'fast-talk': 60, psychology: 50, 'art-craft': 50, 'language-own': 50,
      stealth: 40, history: 40, 'credit-rating': 40,
    },
    interests: ['drive-auto', 'listen', 'charm', 'locksmith'],
    text: {
      fr: {
        hook: 'Reporter au flair redoutable, elle suit les faits divers que son journal refuse d’imprimer.',
        profile: {
          description: 'Menue, cheveux courts sous un chapeau cloche, toujours un crayon derrière l’oreille. Tout le monde l’appelle Nell.',
          ideology: 'La vérité finit toujours par sortir, il suffit d’aider un peu.',
          significantPeople: 'Son rédacteur en chef, Amos Pratt, qui la protège autant qu’il la freine.',
          meaningfulLocations: 'La salle de rédaction enfumée du Boston Evening Ledger, à deux heures du matin.',
          treasuredPossessions: 'Le carnet de son père, reporter lui aussi, disparu en mer en 1912.',
          traits: 'Curieuse, culottée, incapable de lâcher une piste.',
        },
      },
      en: {
        hook: 'A reporter with a keen nose who chases the stories her paper refuses to print.',
        profile: {
          description: 'Slight, bobbed hair under a cloche hat, always a pencil behind her ear. Everyone calls her Nell.',
          ideology: 'The truth always comes out; it just needs a little help.',
          significantPeople: 'Her editor, Amos Pratt, who protects her as much as he holds her back.',
          meaningfulLocations: 'The smoky newsroom of the Boston Evening Ledger at two in the morning.',
          treasuredPossessions: 'The notebook of her father, a reporter too, lost at sea in 1912.',
          traits: 'Curious, bold, unable to let a lead go.',
        },
      },
    },
  },
  {
    id: 'isaiah-freeman',
    name: 'Isaiah Freeman',
    occupation: 'journalist',
    age: 34,
    origin: { fr: 'Harlem, New York', en: 'Harlem, New York' },
    characteristics: { STR: 60, CON: 70, SIZ: 50, DEX: 50, APP: 40, INT: 60, POW: 50, EDU: 80 },
    luck: 50,
    skills: ['art-craft', 'library-use', 'history', 'language-own', 'psychology', 'persuade', 'language-other', 'listen'],
    values: {
      persuade: 70, history: 60, psychology: 60, 'art-craft': 50, 'library-use': 50, 'language-own': 50,
      listen: 40, 'language-other': 40, 'credit-rating': 40,
    },
    interests: ['firearms-rifle', 'first-aid', 'spot-hidden', 'fighting-brawl'],
    specialties: { 'art-craft': 'Littérature', 'language-other': 'Français' },
    text: {
      fr: {
        hook: 'Ancien soldat devenu chroniqueur d’un hebdomadaire de Harlem, il écrit ce que personne d’autre n’ose écrire.',
        profile: {
          description: 'Large d’épaules, lunettes rondes, la voix posée de quelqu’un qui a appris à se faire écouter.',
          ideology: 'Un fait bien documenté est plus fort qu’un poing.',
          significantPeople: 'Sa sœur Lorraine, institutrice, qui relit chacun de ses articles.',
          meaningfulLocations: 'Les tranchées de l’Argonne, en 1918, qu’il revoit encore certaines nuits.',
          treasuredPossessions: 'Une médaille française gagnée au front, qu’il ne porte jamais.',
          traits: 'Patient, obstiné, ironique quand il a peur.',
        },
      },
      en: {
        hook: 'A former soldier turned columnist for a Harlem weekly, he writes what no one else dares to.',
        profile: {
          description: 'Broad-shouldered, round spectacles, the steady voice of someone who learned to be heard.',
          ideology: 'A well-documented fact hits harder than a fist.',
          significantPeople: 'His sister Lorraine, a schoolteacher, who proofreads every one of his articles.',
          meaningfulLocations: 'The trenches of the Argonne in 1918, which he still sees some nights.',
          treasuredPossessions: 'A French medal earned at the front, which he never wears.',
          traits: 'Patient, stubborn, wry when he is afraid.',
        },
      },
    },
  },
  {
    id: 'harlan-moss',
    name: 'Harlan Moss',
    occupation: 'private-eye',
    age: 46,
    origin: { fr: 'Chicago', en: 'Chicago' },
    characteristics: { STR: 70, CON: 60, SIZ: 80, DEX: 50, APP: 40, INT: 60, POW: 50, EDU: 50 },
    luck: 45,
    skills: ['art-craft', 'library-use', 'law', 'disguise', 'psychology', 'spot-hidden', 'intimidate', 'firearms-handgun'],
    values: {
      'spot-hidden': 70, 'firearms-handgun': 60, intimidate: 60, psychology: 50, law: 50, disguise: 50,
      'art-craft': 40, 'library-use': 40, 'credit-rating': 40,
    },
    interests: ['locksmith', 'stealth', 'fighting-brawl', 'drive-auto'],
    text: {
      fr: {
        hook: 'Ancien détective des chemins de fer, il loue ses services à qui paie, et paie lui-même ses dettes en silence.',
        profile: {
          description: 'Un colosse fatigué au nez cassé, chapeau cabossé, odeur de tabac froid.',
          ideology: 'Tout le monde ment. La question, c’est pourquoi.',
          significantPeople: 'Rosa, la serveuse du diner d’en face, la seule à qui il dit la vérité.',
          meaningfulLocations: 'Son bureau au-dessus d’un prêteur sur gages, près des abattoirs.',
          treasuredPossessions: 'Un revolver de service qu’il n’a jamais rendu.',
          traits: 'Cynique en surface, loyal jusqu’à l’os.',
        },
      },
      en: {
        hook: 'A former railroad detective who works for whoever pays, and pays his own debts in silence.',
        profile: {
          description: 'A tired giant with a broken nose, a battered hat and the smell of stale tobacco.',
          ideology: 'Everybody lies. The question is why.',
          significantPeople: 'Rosa, the waitress at the diner across the street, the only one he tells the truth.',
          meaningfulLocations: 'His office above a pawnshop near the stockyards.',
          treasuredPossessions: 'A service revolver he never handed back.',
          traits: 'Cynical on the surface, loyal to the bone.',
        },
      },
    },
  },
  {
    id: 'ruth-abernathy',
    name: 'Ruth Abernathy',
    occupation: 'doctor',
    age: 38,
    origin: { fr: 'Providence, Rhode Island', en: 'Providence, Rhode Island' },
    characteristics: { STR: 50, CON: 60, SIZ: 50, DEX: 60, APP: 40, INT: 70, POW: 50, EDU: 80 },
    luck: 60,
    skills: ['language-other', 'medicine', 'first-aid', 'psychology', 'science', 'science-2', 'psychoanalysis', 'spot-hidden'],
    values: {
      medicine: 70, 'first-aid': 60, 'credit-rating': 60, science: 50, 'science-2': 50, psychology: 50,
      'spot-hidden': 40, psychoanalysis: 40, 'language-other': 40,
    },
    interests: ['listen', 'drive-auto', 'stealth', 'library-use'],
    text: {
      fr: {
        hook: 'Infirmière sur le front en 1917, devenue médecin à force de volonté, elle a vu des blessures qu’aucun manuel n’explique.',
        profile: {
          description: 'Cheveux tirés, gestes précis, un regard qui jauge avant de parler.',
          ideology: 'La science, d’abord. Mais elle garde un doute pour les nuits sans sommeil.',
          significantPeople: 'Le docteur Elias Ward, son mentor, interné depuis l’an dernier.',
          meaningfulLocations: 'Un hôpital de campagne près de Verdun, où elle a appris son métier.',
          treasuredPossessions: 'Sa trousse de chirurgie, rapportée de France.',
          traits: 'Froide dans l’urgence, tendre avec les mourants.',
        },
      },
      en: {
        hook: 'A front-line nurse in 1917 who willed herself into becoming a doctor, she has seen wounds no textbook explains.',
        profile: {
          description: 'Hair pulled back, precise hands, a gaze that weighs you up before she speaks.',
          ideology: 'Science first. But she keeps one doubt for sleepless nights.',
          significantPeople: 'Dr. Elias Ward, her mentor, committed to an asylum since last year.',
          meaningfulLocations: 'A field hospital near Verdun, where she learned her trade.',
          treasuredPossessions: 'Her surgical kit, brought back from France.',
          traits: 'Cold in an emergency, tender with the dying.',
        },
      },
    },
  },
  {
    id: 'grace-liang',
    name: 'Grace Liang',
    occupation: 'doctor',
    age: 35,
    origin: { fr: 'San Francisco', en: 'San Francisco' },
    characteristics: { STR: 40, CON: 50, SIZ: 50, DEX: 60, APP: 50, INT: 70, POW: 60, EDU: 80 },
    luck: 65,
    skills: ['language-other', 'medicine', 'first-aid', 'psychology', 'science', 'science-2', 'natural-world', 'library-use'],
    values: {
      'science-2': 70, science: 60, medicine: 60, 'first-aid': 50, 'natural-world': 50, 'library-use': 50,
      psychology: 40, 'language-other': 40, 'credit-rating': 40,
    },
    interests: ['occult', 'listen', 'stealth', 'appraise'],
    specialties: { science: 'Chimie' },
    text: {
      fr: {
        hook: 'Pharmacienne et médecin à Chinatown, elle reconnaît un poison à l’odeur et une mauvaise excuse au premier mot.',
        profile: {
          description: 'Chignon impeccable, blouse de soie sous la blouse blanche, des mains qui sentent les herbes.',
          ideology: 'Les remèdes de sa grand-mère et ceux de l’université ont plus en commun qu’on ne croit.',
          significantPeople: 'Sa grand-mère Mei, herboriste, qui connaît des plantes absentes de tous les livres.',
          meaningfulLocations: 'L’arrière-boutique de l’herboristerie familiale, sur Grant Avenue.',
          treasuredPossessions: 'Une boîte à remèdes en laque, aux quarante tiroirs.',
          traits: 'Méthodique, discrète, d’une franchise désarmante.',
        },
      },
      en: {
        hook: 'A pharmacist and physician in Chinatown, she knows a poison by its smell and a bad excuse by its first word.',
        profile: {
          description: 'A flawless bun, a silk blouse under the white coat, hands that smell of herbs.',
          ideology: 'Her grandmother’s remedies and the university’s have more in common than people think.',
          significantPeople: 'Her grandmother Mei, an herbalist who knows plants missing from every book.',
          meaningfulLocations: 'The back room of the family herb shop on Grant Avenue.',
          treasuredPossessions: 'A lacquered remedy chest with forty drawers.',
          traits: 'Methodical, discreet, disarmingly frank.',
        },
      },
    },
  },
  {
    id: 'silas-crane',
    name: 'Silas Crane',
    occupation: 'professor',
    age: 58,
    origin: { fr: 'Nouvelle-Angleterre', en: 'New England' },
    characteristics: { STR: 40, CON: 50, SIZ: 60, DEX: 50, APP: 50, INT: 80, POW: 60, EDU: 70 },
    luck: 40,
    skills: ['library-use', 'language-own', 'language-other', 'psychology', 'anthropology', 'history', 'occult', 'archaeology'],
    values: {
      'library-use': 70, occult: 60, history: 60, anthropology: 50, 'language-other': 50, archaeology: 50,
      'language-own': 40, psychology: 40, 'credit-rating': 40,
    },
    interests: ['spot-hidden', 'persuade', 'natural-world', 'navigate'],
    specialties: { 'language-other': 'Grec ancien' },
    text: {
      fr: {
        hook: 'Professeur de folklore comparé dans un petit collège de la côte, il collectionne les légendes que les villageois ne racontent qu’à voix basse.',
        profile: {
          description: 'Grand, voûté, barbe grise, pince-nez qu’il retire pour réfléchir.',
          ideology: 'Chaque superstition cache un fait que l’on a oublié.',
          significantPeople: 'Son ancien étudiant, Daniel Hale, parti en expédition et jamais revenu.',
          meaningfulLocations: 'Son bureau sous les combles, envahi de livres et de cartes annotées.',
          treasuredPossessions: 'Un carnet de terrain rempli de chants notés en phonétique.',
          traits: 'Distrait, passionné, plus brave qu’il ne le croit.',
        },
      },
      en: {
        hook: 'A professor of comparative folklore at a small coastal college, he collects the legends villagers only tell in whispers.',
        profile: {
          description: 'Tall, stooped, grey beard, a pince-nez he takes off to think.',
          ideology: 'Every superstition hides a fact someone forgot.',
          significantPeople: 'His former student, Daniel Hale, who left on an expedition and never came back.',
          meaningfulLocations: 'His attic study, overrun with books and annotated maps.',
          treasuredPossessions: 'A field notebook full of songs written down phonetically.',
          traits: 'Absent-minded, passionate, braver than he believes.',
        },
      },
    },
  },
  {
    id: 'esperanza-vidal',
    name: 'Esperanza Vidal',
    occupation: 'professor',
    age: 45,
    origin: { fr: 'Mexico, puis la Californie', en: 'Mexico City, then California' },
    characteristics: { STR: 50, CON: 70, SIZ: 40, DEX: 60, APP: 50, INT: 60, POW: 50, EDU: 80 },
    luck: 55,
    skills: ['library-use', 'language-own', 'language-other', 'psychology', 'archaeology', 'history', 'anthropology', 'climb'],
    values: {
      archaeology: 70, history: 60, 'language-other': 60, anthropology: 50, 'library-use': 50, climb: 50,
      'language-own': 40, psychology: 40, 'credit-rating': 40,
    },
    interests: ['survival', 'navigate', 'ride', 'firearms-rifle'],
    specialties: { 'language-other': 'Anglais', survival: 'Désert' },
    text: {
      fr: {
        hook: 'Archéologue venue de Mexico, professeure invitée en Californie, elle fouille là où les autres ont renoncé.',
        profile: {
          description: 'Peau tannée, une mèche grise, chapeau de terrain et bottes toujours poussiéreuses.',
          ideology: 'Les morts ont des choses à dire à qui sait creuser.',
          significantPeople: 'Son frère Tomás, guide dans le désert de Sonora.',
          meaningfulLocations: 'Une pyramide à demi enterrée qu’elle a découverte à vingt-cinq ans.',
          treasuredPossessions: 'Une truelle usée jusqu’au manche, offerte par son premier professeur.',
          traits: 'Endurante, directe, d’une patience de pierre.',
        },
      },
      en: {
        hook: 'An archaeologist from Mexico City and visiting professor in California, she digs where others gave up.',
        profile: {
          description: 'Weathered skin, a streak of grey, a field hat and boots that are always dusty.',
          ideology: 'The dead have things to say to whoever knows how to dig.',
          significantPeople: 'Her brother Tomás, a guide in the Sonoran desert.',
          meaningfulLocations: 'A half-buried pyramid she discovered at twenty-five.',
          treasuredPossessions: 'A trowel worn down to the handle, a gift from her first teacher.',
          traits: 'Tireless, blunt, patient as stone.',
        },
      },
    },
  },
  {
    id: 'theodore-van-ness',
    name: 'Theodore Van Ness',
    occupation: 'dilettante',
    age: 26,
    origin: { fr: 'New York', en: 'New York' },
    characteristics: { STR: 60, CON: 60, SIZ: 50, DEX: 80, APP: 70, INT: 50, POW: 40, EDU: 50 },
    luck: 70,
    skills: ['art-craft', 'firearms-rifle', 'ride', 'language-other', 'charm', 'pilot', 'drive-auto', 'swim'],
    values: {
      'credit-rating': 70, charm: 60, pilot: 60, 'drive-auto': 50, 'firearms-rifle': 50, 'art-craft': 50,
      'language-other': 40, swim: 40, ride: 40,
    },
    interests: ['fast-talk', 'mechanical-repair', 'jump', 'navigate'],
    specialties: { 'art-craft': 'Musique', 'language-other': 'Français', pilot: 'Avion' },
    text: {
      fr: {
        hook: 'Héritier d’une vieille fortune new-yorkaise, il pilote son propre biplan et s’ennuie à mourir, jusqu’à ce soir.',
        profile: {
          description: 'Beau garçon gominé, veste d’aviateur sur un nœud papillon défait, sourire insolent. Ses amis l’appellent Teddy.',
          ideology: 'La vie est trop courte pour la passer assis.',
          significantPeople: 'Sa tante Cornelia, qui tient les cordons de la bourse et le croit perdu.',
          meaningfulLocations: 'Un club de jazz clandestin de la 52e Rue, où il joue parfois du piano.',
          treasuredPossessions: 'Son biplan, le « Lucky Nell », et la montre de son grand-père.',
          traits: 'Charmeur, téméraire, plus généreux qu’il ne veut le paraître.',
        },
      },
      en: {
        hook: 'Heir to an old New York fortune, he flies his own biplane and is bored to death, until tonight.',
        profile: {
          description: 'A handsome young man with slicked hair, an aviator jacket over an untied bow tie, an insolent grin. His friends call him Teddy.',
          ideology: 'Life is too short to spend it sitting down.',
          significantPeople: 'His aunt Cornelia, who holds the purse strings and thinks him a lost cause.',
          meaningfulLocations: 'A speakeasy on 52nd Street where he sometimes plays the piano.',
          treasuredPossessions: 'His biplane, the “Lucky Nell”, and his grandfather’s watch.',
          traits: 'Charming, reckless, more generous than he lets on.',
        },
      },
    },
  },
  {
    id: 'josephine-baptiste',
    name: 'Josephine Baptiste',
    occupation: 'author',
    age: 33,
    origin: { fr: 'La Nouvelle-Orléans', en: 'New Orleans' },
    characteristics: { STR: 40, CON: 50, SIZ: 50, DEX: 60, APP: 60, INT: 70, POW: 80, EDU: 50 },
    luck: 60,
    skills: ['art-craft', 'library-use', 'history', 'language-own', 'language-other', 'psychology', 'occult', 'listen'],
    values: {
      'art-craft': 70, occult: 60, 'language-other': 60, history: 50, psychology: 50, 'library-use': 50,
      'language-own': 40, listen: 40, 'credit-rating': 40,
    },
    interests: ['charm', 'spot-hidden', 'swim', 'sleight-of-hand'],
    specialties: { 'language-other': 'Français' },
    text: {
      fr: {
        hook: 'Romancière créole, ses histoires de fantômes se vendent par milliers. Elle ne dit à personne qu’elles sont presque toutes vraies.',
        profile: {
          description: 'Foulard de soie, grands anneaux d’or, un stylo-plume toujours à portée de main.',
          ideology: 'Les morts ne partent jamais tout à fait. Il faut juste savoir les écouter.',
          significantPeople: 'Sa marraine, Tante Odile, qui lisait l’avenir dans le marc de café.',
          meaningfulLocations: 'La maison familiale aux volets verts, dans le quartier de Tremé.',
          treasuredPossessions: 'Un chapelet d’ébène hérité de sa marraine, qui se réchauffe parfois tout seul.',
          traits: 'Intuitive, moqueuse, impossible à effrayer, ou presque.',
        },
      },
      en: {
        hook: 'A Creole novelist whose ghost stories sell by the thousand. She tells no one that most of them are true.',
        profile: {
          description: 'A silk head wrap, large gold hoops, a fountain pen always within reach.',
          ideology: 'The dead never quite leave. You just have to know how to listen.',
          significantPeople: 'Her godmother, Tante Odile, who read the future in coffee grounds.',
          meaningfulLocations: 'The family house with green shutters in the Tremé neighborhood.',
          treasuredPossessions: 'An ebony rosary from her godmother, which sometimes grows warm on its own.',
          traits: 'Intuitive, teasing, impossible to frighten, almost.',
        },
      },
    },
  },
  {
    id: 'frank-mallory',
    name: 'Frank Mallory',
    occupation: 'police-detective',
    age: 41,
    origin: { fr: 'Boston', en: 'Boston' },
    characteristics: { STR: 70, CON: 80, SIZ: 60, DEX: 50, APP: 40, INT: 60, POW: 50, EDU: 50 },
    luck: 40,
    skills: ['disguise', 'firearms-handgun', 'law', 'listen', 'psychology', 'spot-hidden', 'intimidate', 'fighting-brawl'],
    values: {
      'spot-hidden': 70, 'firearms-handgun': 60, psychology: 60, intimidate: 50, law: 50, 'fighting-brawl': 50,
      listen: 40, disguise: 40, 'credit-rating': 40,
    },
    interests: ['drive-auto', 'first-aid', 'persuade', 'locksmith'],
    text: {
      fr: {
        hook: 'Sergent-détective de la police de Boston, il a classé trop d’affaires « sans suite » pour bien dormir.',
        profile: {
          description: 'Mâchoire carrée, cheveux roux grisonnants, chapeau melon et pardessus de laine.',
          ideology: 'La loi, c’est ce qui reste quand tout le reste lâche.',
          significantPeople: 'Sa femme Maureen et leurs trois garçons, qu’il voit trop peu.',
          meaningfulLocations: 'Le commissariat du port, où il a commencé comme simple agent.',
          treasuredPossessions: 'Son insigne, et une photo de classe de 1898 où un visage a été gratté.',
          traits: 'Bourru, honnête, sceptique jusqu’à ce qu’il ne le soit plus.',
        },
      },
      en: {
        hook: 'A detective sergeant with the Boston police, he has closed too many cases as “unsolved” to sleep well.',
        profile: {
          description: 'Square jaw, red hair going grey, a bowler hat and a wool overcoat.',
          ideology: 'The law is what is left when everything else gives way.',
          significantPeople: 'His wife Maureen and their three boys, whom he sees too little.',
          meaningfulLocations: 'The harbor precinct, where he started as a beat cop.',
          treasuredPossessions: 'His badge, and a class photo from 1898 with one face scratched out.',
          traits: 'Gruff, honest, skeptical until he is not.',
        },
      },
    },
  },
  {
    id: 'clayton-rhodes',
    name: 'Clayton Rhodes',
    occupation: 'police-detective',
    age: 50,
    origin: { fr: 'El Paso, Texas', en: 'El Paso, Texas' },
    characteristics: { STR: 60, CON: 70, SIZ: 60, DEX: 80, APP: 40, INT: 50, POW: 50, EDU: 50 },
    luck: 50,
    skills: ['disguise', 'firearms-handgun', 'law', 'listen', 'psychology', 'spot-hidden', 'intimidate', 'track'],
    values: {
      'firearms-handgun': 70, track: 60, 'spot-hidden': 60, intimidate: 50, listen: 50, psychology: 50,
      law: 40, disguise: 40, 'credit-rating': 40,
    },
    interests: ['ride', 'firearms-rifle', 'survival', 'language-other'],
    specialties: { survival: 'Désert', 'language-other': 'Espagnol' },
    text: {
      fr: {
        hook: 'Ancien ranger du Texas devenu enquêteur du shérif, il suit une piste dans le désert mieux que n’importe quel chien.',
        profile: {
          description: 'Visage buriné, moustache grise, grand chapeau et étoile ternie sur le gilet.',
          ideology: 'On ne juge pas un homme à sa parole, mais à ses traces.',
          significantPeople: 'Ramón Ortega, son ancien coéquipier, qui lui a sauvé la vie deux fois.',
          meaningfulLocations: 'Un ranch abandonné près du Rio Grande, où il a vu une chose qu’il ne raconte pas.',
          treasuredPossessions: 'Un colt à crosse d’ivoire et une selle qui a connu trois chevaux.',
          traits: 'Taiseux, patient, impitoyable quand il le faut.',
        },
      },
      en: {
        hook: 'A former Texas Ranger turned investigator for the sheriff, he follows a trail across the desert better than any hound.',
        profile: {
          description: 'A weathered face, grey moustache, a wide hat and a tarnished star on his vest.',
          ideology: 'You don’t judge a man by his word, but by his tracks.',
          significantPeople: 'Ramón Ortega, his old partner, who saved his life twice.',
          meaningfulLocations: 'An abandoned ranch near the Rio Grande, where he saw something he never talks about.',
          treasuredPossessions: 'An ivory-handled revolver and a saddle that has outlived three horses.',
          traits: 'Quiet, patient, ruthless when he has to be.',
        },
      },
    },
  },
  {
    id: 'adelaide-prentiss',
    name: 'Adelaide Prentiss',
    occupation: 'antiquarian',
    age: 63,
    origin: { fr: 'Côte du Massachusetts', en: 'Massachusetts coast' },
    characteristics: { STR: 40, CON: 50, SIZ: 50, DEX: 50, APP: 60, INT: 70, POW: 80, EDU: 60 },
    luck: 45,
    skills: ['art-craft', 'library-use', 'appraise', 'history', 'language-other', 'spot-hidden', 'persuade', 'occult'],
    values: {
      appraise: 70, history: 60, 'library-use': 60, 'credit-rating': 50, occult: 50, 'spot-hidden': 50,
      persuade: 40, 'art-craft': 40, 'language-other': 40,
    },
    interests: ['psychology', 'listen', 'locksmith', 'natural-world'],
    specialties: { 'art-craft': 'Reliure', 'language-other': 'Latin' },
    text: {
      fr: {
        hook: 'Veuve et antiquaire dans un vieux port de pêche, elle achète les bibliothèques des morts, et lit ce qu’elle y trouve.',
        profile: {
          description: 'Chignon d’argent, col de dentelle, camée, une loupe de joaillier au bout d’un ruban.',
          ideology: 'Les objets se souviennent de ce que les gens oublient.',
          significantPeople: 'Son défunt mari, le capitaine Josiah Prentiss, dont elle relit les livres de bord.',
          meaningfulLocations: 'Sa boutique, Prentiss & Fils, aux étagères qui craquent la nuit.',
          treasuredPossessions: 'Un livre de bord relié de cuir, dont les dernières pages sont collées entre elles.',
          traits: 'Courtoise, rusée, d’une curiosité qui ne connaît pas l’âge.',
        },
      },
      en: {
        hook: 'A widowed antiquarian in an old fishing port, she buys dead people’s libraries, and reads what she finds in them.',
        profile: {
          description: 'A silver chignon, a lace collar, a cameo, a jeweller’s loupe on a ribbon.',
          ideology: 'Objects remember what people forget.',
          significantPeople: 'Her late husband, Captain Josiah Prentiss, whose logbooks she still rereads.',
          meaningfulLocations: 'Her shop, Prentiss & Sons, whose shelves creak at night.',
          treasuredPossessions: 'A leather-bound logbook whose last pages are stuck together.',
          traits: 'Courteous, shrewd, with a curiosity that knows no age.',
        },
      },
    },
  },
]

export const PREGEN_BY_ID = new Map(PREGENS.map((p) => [p.id, p]))

/** The wizard draft of a pre-generated investigator, its profile in `lang`. */
export function pregenDraft(p: Pregen, lang: Lang): CreationDraft {
  const d = applyOccupation(newDraft(p.occupation), p.occupation)
  return {
    ...d,
    name: p.name,
    age: p.age,
    characteristics: { ...p.characteristics },
    luck: p.luck,
    rolled: false,
    occupationSkills: [...p.skills],
    occupationValues: { ...p.values },
    personalInterests: [...p.interests],
    specialties: { ...d.specialties, ...p.specialties },
    profile: { ...p.text[lang].profile },
  }
}

/** The sheet a keeper's copy gets (the wizard's own toCharacterData). */
export const pregenData = (p: Pregen, lang: Lang): CharacterData => toCharacterData(pregenDraft(p, lang))

/** Specialty labels the pregens use, for the translation completeness test. */
export const pregenSpecialties = (): string[] => [...new Set(PREGENS.flatMap((p) => Object.values(p.specialties ?? {})))]
