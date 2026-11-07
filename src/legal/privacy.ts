import type { Bilingual } from './doc'

// Keep both versions in step, and LEGAL.updated (info.ts) current, whenever what Grimoire collects
// or who processes it changes (a new table, a new provider, a new AI feature).
export const PRIVACY: Bilingual = {
  fr: {
    title: 'Politique de confidentialité',
    intro: [
      'Grimoire est le compagnon du gardien pour les jeux d’enquête et d’horreur sur table. Cette page dit quelles données Grimoire garde, pourquoi, qui les traite et combien de temps. Grimoire n’affiche aucune publicité, ne vend aucune donnée et n’utilise aucun outil de mesure d’audience ni cookie de suivi.',
      'Responsable du traitement : {publisher}. Contact : {contact}.',
    ],
    sections: [
      {
        title: 'Ce que Grimoire garde',
        blocks: [
          [
            '**Ton compte** : adresse e-mail, mot de passe (stocké chiffré par notre fournisseur d’authentification, jamais lisible), nom affiché et langue. Si tu te connectes avec Google : ton nom et ton adresse e-mail Google, rien d’autre.',
            '**Ce que tu crées** : histoires privées et leurs fichiers (textes, images, sons), investigateurs et leur photo, joueurs (prénoms), parties et leur état, images envoyées à l’écran d’ambiance.',
            '**Ce que les joueurs saisissent sur leur téléphone** depuis un lien de table : prénom, fiche d’investigateur, photo de l’investigateur, points de vie et autres points, notes du carnet, jets de dés. Les joueurs n’ont pas de compte : ces données appartiennent au compte du gardien qui a partagé le lien. Une photo est réduite à une petite image carrée dans le navigateur avant l’envoi ; tous ceux qui ont un lien de la partie la voient, et le gardien ou le joueur peut la retirer à tout moment.',
            '**Compteurs d’utilisation** des fonctions d’IA (nombre d’appels par mois), pour appliquer les limites mensuelles.',
            '**Connexion à ChatGPT ou Claude** : le nom de l’application autorisée et la date de l’autorisation, et les plans, scènes et images que l’application envoie à Grimoire pour créer ou modifier une histoire.',
          ],
          'Grimoire ne demande ni ne garde aucune donnée de paiement, de santé, d’identité officielle ni de localisation.',
        ],
      },
      {
        title: 'Pourquoi',
        blocks: [
          [
            'Fournir le service que tu demandes : ton compte, ta bibliothèque, tes parties, le compagnon des joueurs, l’écran d’ambiance et les fonctions d’IA (exécution du contrat).',
            'Protéger le service : limites d’utilisation, prévention des abus, journaux techniques de sécurité (intérêt légitime).',
            'T’envoyer les e-mails nécessaires au compte : confirmation d’adresse, réinitialisation du mot de passe. Aucune lettre d’information, aucun e-mail commercial.',
          ],
        ],
      },
      {
        title: 'Fonctions d’IA',
        blocks: [
          'Quand tu utilises l’import d’une histoire, le créateur d’histoires, le narrateur ou les suggestions de profil, le contenu nécessaire (pages à importer, réponses au questionnaire, contexte de la scène, fiche de l’investigateur) est envoyé à **Anthropic** (API Claude) pour produire la réponse. Selon ses conditions commerciales, Anthropic n’utilise pas ces données pour entraîner ses modèles. Les pages envoyées pour un import sont effacées de nos serveurs après chaque appel, que l’import réussisse ou non.',
          'Avec le connecteur ChatGPT ou Claude, c’est l’application de discussion qui écrit : elle n’envoie à Grimoire que les appels d’outils (plan, scènes, modifications, images), jamais la conversation. La conversation elle-même relève de la politique de confidentialité d’OpenAI ou d’Anthropic. Tu peux déconnecter une application à tout moment dans Réglages → ChatGPT et Claude.',
        ],
      },
      {
        title: 'Qui traite les données',
        blocks: [
          'Grimoire s’appuie sur ces prestataires, chacun pour son seul rôle :',
          [
            '**Supabase** : base de données, authentification, stockage des fichiers, fonctions serveur.',
            '**Vercel** : hébergement du site (journaux techniques des requêtes, dont l’adresse IP).',
            '**Anthropic** : fonctions d’IA décrites ci-dessus.',
            '**Resend** : envoi des e-mails du compte.',
            '**Google** : connexion avec Google, seulement si tu la choisis.',
          ],
          'Certains de ces prestataires sont situés aux États-Unis. Les transferts reposent sur les garanties prévues par le RGPD (cadre de protection des données UE–États-Unis ou clauses contractuelles types). Aucune donnée n’est vendue ni partagée à des fins publicitaires.',
          'Tes histoires privées ne sont visibles que par toi. Les liens de table et d’écran que tu partages donnent accès à ce qu’ils montrent à quiconque les détient, jusqu’à ce que tu les révoques.',
        ],
      },
      {
        title: 'Combien de temps',
        blocks: [
          [
            'Les données du compte et tout ce que tu as créé : tant que le compte existe.',
            'Les pages envoyées pour un import : effacées après chaque appel.',
            'Les jets de dés : les 100 derniers par partie.',
            'Les compteurs d’utilisation : le mois en cours et l’historique utile au contrôle des limites.',
            'Après la suppression d’un compte, ses données sont effacées sous 30 jours, sauvegardes techniques comprises.',
          ],
        ],
      },
      {
        title: 'Sur ton appareil',
        blocks: [
          'Grimoire garde dans ton navigateur ta session de connexion, ton thème, ta langue, une copie de secours des parties en cours et l’avancement du créateur d’histoires. Ce sont des réglages nécessaires au fonctionnement : pas de cookie publicitaire ni de mesure d’audience.',
        ],
      },
      {
        title: 'Tes droits',
        blocks: [
          'Tu peux accéder à tes données, les corriger, les effacer, en demander une copie (chaque histoire se télécharge aussi en pack .zip depuis sa page), t’opposer à un traitement ou en demander la limitation. Pour supprimer ton compte ou exercer un de ces droits, écris à {contact} depuis l’adresse du compte : la réponse arrive sous un mois.',
          'Si tu penses que tes droits ne sont pas respectés, tu peux saisir la CNIL ([cnil.fr](https://www.cnil.fr)).',
        ],
      },
      {
        title: 'Âge',
        blocks: ['Un compte Grimoire est réservé aux personnes de 15 ans et plus, ou plus jeunes avec l’accord d’un parent.'],
      },
      {
        title: 'Changements',
        blocks: ['Si cette politique change, la date en haut de la page change aussi. Un changement important est annoncé dans l’application.'],
      },
    ],
  },
  en: {
    title: 'Privacy policy',
    intro: [
      'Grimoire is the keeper’s companion for investigation and horror tabletop games. This page explains what data Grimoire keeps, why, who processes it and for how long. Grimoire shows no advertising, sells no data and uses no analytics or tracking cookies.',
      'Data controller: {publisher}. Contact: {contact}.',
    ],
    sections: [
      {
        title: 'What Grimoire keeps',
        blocks: [
          [
            '**Your account**: e-mail address, password (stored hashed by our authentication provider, never readable), display name and language. If you sign in with Google: your Google name and e-mail address, nothing else.',
            '**What you create**: private stories and their files (texts, images, sounds), investigators and their photo, players (first names), games and their state, pictures sent to the ambiance screen.',
            '**What players enter on their phones** from a table link: first name, investigator sheet, investigator photo, hit points and other points, notebook notes, dice rolls. Players have no account: this data belongs to the account of the keeper who shared the link. A photo is shrunk to a small square picture in the browser before it is sent; everyone with a link to the game sees it, and the keeper or the player can remove it at any time.',
            '**Usage counters** for the AI features (number of calls per month), to apply the monthly limits.',
            '**Connection to ChatGPT or Claude**: the name of the authorised app and the date you authorised it, and the outlines, scenes and pictures the app sends to Grimoire to create or change a story.',
          ],
          'Grimoire neither asks for nor keeps any payment, health, government identity or location data.',
        ],
      },
      {
        title: 'Why',
        blocks: [
          [
            'To provide the service you ask for: your account, your library, your games, the player companion, the ambiance screen and the AI features (performance of a contract).',
            'To protect the service: usage limits, abuse prevention, technical security logs (legitimate interest).',
            'To send the e-mails your account needs: address confirmation, password reset. No newsletter, no marketing e-mail.',
          ],
        ],
      },
      {
        title: 'AI features',
        blocks: [
          'When you use story import, the story creator, the narrator or profile suggestions, the content needed (pages to import, questionnaire answers, scene context, investigator sheet) is sent to **Anthropic** (Claude API) to produce the answer. Under its commercial terms, Anthropic does not use this data to train its models. Pages sent for an import are deleted from our servers after every call, whether the import succeeds or not.',
          'With the ChatGPT or Claude connector, the chat app does the writing: it sends Grimoire only tool calls (outline, scenes, edits, pictures), never the conversation. The conversation itself is covered by OpenAI’s or Anthropic’s privacy policy. You can disconnect an app at any time in Settings → ChatGPT and Claude.',
        ],
      },
      {
        title: 'Who processes the data',
        blocks: [
          'Grimoire relies on these providers, each for its own role only:',
          [
            '**Supabase**: database, authentication, file storage, server functions.',
            '**Vercel**: website hosting (technical request logs, including IP addresses).',
            '**Anthropic**: the AI features described above.',
            '**Resend**: sending account e-mails.',
            '**Google**: sign-in with Google, only if you choose it.',
          ],
          'Some of these providers are located in the United States. Transfers rely on the safeguards provided by the GDPR (EU–US Data Privacy Framework or standard contractual clauses). No data is sold or shared for advertising.',
          'Your private stories are visible to you only. The table and screen links you share give access to what they show to anyone who holds them, until you revoke them.',
        ],
      },
      {
        title: 'How long',
        blocks: [
          [
            'Account data and everything you created: as long as the account exists.',
            'Pages sent for an import: deleted after every call.',
            'Dice rolls: the latest 100 per game.',
            'Usage counters: the current month and the history needed to enforce the limits.',
            'After an account is deleted, its data is erased within 30 days, technical backups included.',
          ],
        ],
      },
      {
        title: 'On your device',
        blocks: [
          'Grimoire keeps in your browser your sign-in session, your theme, your language, a backup copy of games in progress and the story creator’s progress. These are settings the app needs to work: no advertising cookie and no analytics.',
        ],
      },
      {
        title: 'Your rights',
        blocks: [
          'You can access your data, correct it, erase it, ask for a copy (each story can also be downloaded as a .zip pack from its page), object to processing or ask for it to be restricted. To delete your account or exercise any of these rights, write to {contact} from the account’s address: you will get an answer within one month.',
          'If you believe your rights are not respected, you can lodge a complaint with the CNIL ([cnil.fr](https://www.cnil.fr)) or your local data protection authority.',
        ],
      },
      {
        title: 'Age',
        blocks: ['A Grimoire account is for people aged 15 and over, or younger with a parent’s consent.'],
      },
      {
        title: 'Changes',
        blocks: ['If this policy changes, the date at the top of the page changes too. Significant changes are announced in the app.'],
      },
    ],
  },
}
