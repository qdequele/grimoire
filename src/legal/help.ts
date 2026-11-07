import type { Bilingual } from './doc'

// Public documentation of the ChatGPT and Claude connector (the directories ask for one) and the
// support contact. Keep it in step with the tools (supabase/functions/_shared/story-mcp.ts), their
// limits (MCP_STORIES_MONTHLY_LIMIT, MCP_EDITS_DAILY_LIMIT) and Réglages → ChatGPT et Claude.
export const HELP: Bilingual = {
  fr: {
    title: 'Grimoire dans ChatGPT et Claude',
    intro: [
      'Le connecteur Grimoire permet de créer et de réviser tes histoires en discutant avec ChatGPT ou Claude. L’application de discussion écrit ; Grimoire la guide, vérifie l’histoire, la convertit au format des histoires Grimoire et la range dans ta bibliothèque, prête à jouer.',
    ],
    sections: [
      {
        title: 'Avant de commencer',
        blocks: [
          'Il te faut un compte Grimoire (gratuit, sur {site}) et un compte ChatGPT ou Claude qui accepte les connecteurs. Adresse du connecteur : **{mcp}**',
        ],
      },
      {
        title: 'Connecter Claude',
        blocks: [
          [
            'Le plus simple : [ajouter Grimoire à Claude]({claudeAdd}). Claude s’ouvre avec le nom et l’adresse déjà remplis : vérifie-les, puis clique sur Ajouter. Le même bouton est dans Grimoire, Réglages → ChatGPT et Claude.',
            'Sans ce lien : dans Claude, Personnaliser → Connecteurs → Ajouter un connecteur personnalisé, puis colle l’adresse du connecteur.',
            'Clique sur Connecter : Grimoire s’ouvre, connecte-toi et autorise Claude.',
          ],
          'Sur l’abonnement gratuit de Claude, un seul connecteur personnalisé est possible à la fois.',
          'Sur Claude Team ou Enterprise, seul un propriétaire de l’organisation peut ajouter un connecteur personnalisé : demande-lui d’ajouter Grimoire, puis clique sur Connecter avec ton propre compte. Pour les autres membres, le lien d’ajout peut n’ouvrir que la liste des connecteurs.',
          'Facultatif : la compétence « grimoire-story », à télécharger dans Grimoire (Réglages → ChatGPT et Claude), aide Claude à suivre la méthode.',
        ],
      },
      {
        title: 'Connecter ChatGPT',
        blocks: [
          [
            'Ouvre [chatgpt.com/plugins](https://chatgpt.com/plugins), clique sur +, puis ajoute un serveur MCP personnalisé.',
            'Nomme-le Grimoire, colle l’adresse du connecteur et choisis OAuth comme authentification. Accepte l’avertissement, puis crée-le.',
            'Grimoire s’ouvre : connecte-toi et autorise ChatGPT.',
          ],
          'ChatGPT ne propose pas encore de lien d’ajout prérempli : l’adresse se colle à la main.',
        ],
      },
      {
        title: 'Exemples de demandes',
        blocks: [
          [
            '« Crée-moi une histoire Grimoire dans un village de pêcheurs en 1925, pour trois joueurs. »',
            '« Liste mes histoires Grimoire. »',
            '« Dans mon histoire du phare, ajoute une scène où les investigateurs fouillent la cabane du gardien. »',
            '« Rends le PNJ du médecin plus inquiétant et donne-lui un secret. »',
          ],
        ],
      },
      {
        title: 'Ce que fait le connecteur',
        blocks: [
          [
            '**grimoire_guide** : la méthode, les règles d’originalité et le format des histoires (lecture seule).',
            '**save_outline** : enregistre le plan que tu as validé (cadre, actes, scènes, PNJ).',
            '**write_scenes** : écrit les scènes du plan quelques-unes à la fois ; l’histoire est enregistrée après chaque appel.',
            '**list_my_stories** et **get_story** : lisent tes histoires privées (lecture seule).',
            '**edit_story** : modifie une de tes histoires privées (ajouter, remplacer ou retirer une scène, un acte, un PNJ, une aide de jeu). Tout ou rien, et refusé si l’histoire a changé entre-temps.',
            '**save_image** : enregistre une image que ChatGPT ou Claude dessine (au format SVG) dans une de tes histoires privées, comme fond d’une scène sur l’écran d’ambiance ou comme image d’une aide de jeu (lettre, carte, plan) ; la remplace ou la retire. L’image est vérifiée strictement : rien d’actif, aucun lien vers l’extérieur.',
          ],
          'Le connecteur n’accède qu’à tes histoires privées : ni aux histoires de la bibliothèque commune, ni à tes parties, investigateurs ou joueurs. Il ne supprime jamais une histoire entière. Il refuse les noms tirés d’œuvres protégées : les histoires créées doivent être originales.',
        ],
      },
      {
        title: 'Limites',
        blocks: [
          [
            '30 nouvelles histoires par mois et par compte avec le connecteur.',
            '500 modifications par jour (chaque image enregistrée compte aussi comme une modification), dont 100 images.',
            'Une histoire peut peser jusqu’à 2 Mo, une modification compter jusqu’à 20 opérations, une image peser 300 Ko et une histoire garder 40 images.',
          ],
          'Le connecteur n’appelle aucune IA de son côté : c’est ChatGPT ou Claude qui écrit, selon ton abonnement chez eux.',
        ],
      },
      {
        title: 'Déconnecter une application',
        blocks: [
          'Dans Grimoire : Réglages → ChatGPT et Claude → Applications connectées → Déconnecter. Tu peux aussi retirer le connecteur dans les réglages de ChatGPT ou de Claude.',
        ],
      },
      {
        title: 'En cas de problème',
        blocks: [
          [
            '**La connexion échoue** : vérifie l’adresse du connecteur, puis reconnecte-toi à Grimoire dans la fenêtre qui s’ouvre.',
            '**L’histoire n’apparaît pas** : elle est dans Histoires → Mes histoires, avec le badge « Création privée ». Demande à l’application de continuer l’écriture si des scènes manquent.',
            '**« Limite atteinte »** : la limite mensuelle ou quotidienne est atteinte ; elle se renouvelle au mois ou au jour suivant.',
          ],
        ],
      },
      {
        title: 'Aide et contact',
        blocks: [
          'Une question, un problème, une demande sur tes données : écris à {contact}. Voir aussi la [politique de confidentialité](/confidentialite) et les [conditions d’utilisation](/conditions).',
        ],
      },
    ],
  },
  en: {
    title: 'Grimoire in ChatGPT and Claude',
    intro: [
      'The Grimoire connector lets you create and revise your stories by chatting with ChatGPT or Claude. The chat app does the writing; Grimoire guides it, checks the story, converts it to the Grimoire story format and puts it in your library, ready to play.',
    ],
    sections: [
      {
        title: 'Before you start',
        blocks: [
          'You need a Grimoire account (free, at {site}) and a ChatGPT or Claude account that supports connectors. Connector address: **{mcp}**',
        ],
      },
      {
        title: 'Connect Claude',
        blocks: [
          [
            'The easiest way: [add Grimoire to Claude]({claudeAdd}). Claude opens with the name and address already filled in: check them, then click Add. The same button is in Grimoire, Settings → ChatGPT and Claude.',
            'Without this link: in Claude, Customize → Connectors → Add custom connector, then paste the connector address.',
            'Click Connect: Grimoire opens, sign in and authorise Claude.',
          ],
          'On Claude’s free plan, only one custom connector is possible at a time.',
          'On Claude Team or Enterprise, only an Owner of the organization can add a custom connector: ask them to add Grimoire, then click Connect with your own account. For other members, the add link may only open the list of connectors.',
          'Optional: the “grimoire-story” skill, downloaded from Grimoire (Settings → ChatGPT and Claude), helps Claude follow the method.',
        ],
      },
      {
        title: 'Connect ChatGPT',
        blocks: [
          [
            'Open [chatgpt.com/plugins](https://chatgpt.com/plugins), click +, then add a custom MCP server.',
            'Name it Grimoire, paste the connector address and choose OAuth as authentication. Accept the warning, then create it.',
            'Grimoire opens: sign in and authorise ChatGPT.',
          ],
          'ChatGPT does not offer a prefilled add link yet: the address is pasted by hand.',
        ],
      },
      {
        title: 'Example requests',
        blocks: [
          [
            '“Create a Grimoire story in a fishing village in 1925, for three players.”',
            '“List my Grimoire stories.”',
            '“In my lighthouse story, add a scene where the investigators search the keeper’s hut.”',
            '“Make the doctor NPC more unsettling and give him a secret.”',
          ],
        ],
      },
      {
        title: 'What the connector does',
        blocks: [
          [
            '**grimoire_guide**: the method, the originality rules and the story format (read-only).',
            '**save_outline**: saves the outline you approved (setting, acts, scenes, NPCs).',
            '**write_scenes**: writes the outline’s scenes a few at a time; the story is saved after every call.',
            '**list_my_stories** and **get_story**: read your private stories (read-only).',
            '**edit_story**: changes one of your private stories (add, replace or remove a scene, an act, an NPC, a handout). All or nothing, and refused if the story changed in the meantime.',
            '**save_image**: stores a picture ChatGPT or Claude draws (as SVG) in one of your private stories, as a scene’s background on the ambiance screen or as a handout’s picture (letter, map, floor plan); replaces or removes it. The picture is strictly checked: nothing active, no link to the outside.',
          ],
          'The connector only reaches your private stories: not the shared library, nor your games, investigators or players. It never deletes a whole story. It refuses names taken from protected works: created stories must be original.',
        ],
      },
      {
        title: 'Limits',
        blocks: [
          [
            '30 new stories per month per account through the connector.',
            '500 edits per day (each picture saved also counts as an edit), 100 of them pictures.',
            'A story can be up to 2 MB, one edit can hold up to 20 operations, a picture can be up to 300 KB and a story can hold 40 pictures.',
          ],
          'The connector calls no AI on its side: ChatGPT or Claude does the writing, under your plan with them.',
        ],
      },
      {
        title: 'Disconnect an app',
        blocks: [
          'In Grimoire: Settings → ChatGPT and Claude → Connected apps → Disconnect. You can also remove the connector in ChatGPT’s or Claude’s settings.',
        ],
      },
      {
        title: 'Troubleshooting',
        blocks: [
          [
            '**Connecting fails**: check the connector address, then sign in to Grimoire again in the window that opens.',
            '**The story does not show up**: it is in Stories → My stories, with the “Private creation” badge. Ask the app to keep writing if scenes are missing.',
            '**“Limit reached”**: the monthly or daily limit is reached; it renews the next month or day.',
          ],
        ],
      },
      {
        title: 'Help and contact',
        blocks: [
          'A question, a problem, a request about your data: write to {contact}. See also the [privacy policy](/privacy) and the [terms of use](/terms).',
        ],
      },
    ],
  },
}
