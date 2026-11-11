import type { Bilingual } from './doc'

// Keep both versions in step, and LEGAL.updated (info.ts) current.
export const TERMS: Bilingual = {
  fr: {
    title: 'Conditions d’utilisation',
    intro: [
      'Ces conditions s’appliquent à l’utilisation de Grimoire ({site}), y compris le compagnon des joueurs, l’écran d’ambiance et le connecteur pour ChatGPT et Claude. Créer un compte ou utiliser Grimoire vaut acceptation de ces conditions.',
    ],
    sections: [
      {
        title: 'Le service',
        blocks: [
          'Grimoire aide le gardien à préparer et mener des parties de jeux d’enquête et d’horreur sur table : bibliothèque d’histoires, investigateurs, écran de jeu, compagnon sur le téléphone des joueurs, écran d’ambiance et fonctions d’IA. Grimoire est gratuit à ce jour. Ses fonctions et ses limites d’utilisation peuvent évoluer.',
        ],
      },
      {
        title: 'Ton compte',
        blocks: [
          'Seul le gardien a un compte. Tu es responsable de ce qui se fait avec ton compte et de la confidentialité de ton mot de passe. Les liens de table et d’écran que tu partages donnent accès à ta partie à ceux qui les détiennent : révoque-les quand tu n’en as plus besoin.',
        ],
      },
      {
        title: 'Ton contenu',
        blocks: [
          'Ce que tu crées ou importes reste à toi. Tu accordes à Grimoire le droit de le stocker, de le traiter et de l’afficher dans le seul but de te fournir le service.',
          'N’importe que ce que tu as le droit d’utiliser. Une histoire importée depuis un livre que tu possèdes reste privée : elle n’est visible que par toi et ne peut pas être publiée dans la bibliothèque commune, qui est choisie par l’éditeur de Grimoire.',
        ],
      },
      {
        title: 'Fonctions d’IA',
        blocks: [
          'Les textes et les plans produits par l’IA (import, création d’histoires, narrateur, suggestions de profil, plans, ainsi que ce qu’écrivent ChatGPT ou Claude avec le connecteur) peuvent être inexacts ou incomplets. Relis-les avant de les utiliser à ta table. Les fonctions d’IA ont des limites mensuelles par compte.',
          'ChatGPT et Claude sont des services d’OpenAI et d’Anthropic, soumis à leurs propres conditions. Grimoire ne voit pas tes conversations.',
        ],
      },
      {
        title: 'Utilisation acceptable',
        blocks: [
          'Tu t’engages à ne pas :',
          [
            'publier ou stocker un contenu illégal, ou qui porte atteinte aux droits d’autrui ;',
            'contourner les limites d’utilisation, les contrôles d’accès ou la sécurité du service ;',
            'surcharger le service, l’utiliser de façon automatisée en dehors du connecteur prévu, ou accéder aux données d’un autre compte.',
          ],
          'En cas d’abus, l’accès peut être suspendu.',
        ],
      },
      {
        title: 'Responsabilité',
        blocks: [
          'Grimoire est fourni tel quel, sans garantie de disponibilité continue. Garde une copie de ce qui compte pour toi (chaque histoire se télécharge en pack .zip). Dans les limites permises par la loi, l’éditeur n’est pas responsable des pertes de données ni des dommages indirects liés à l’utilisation du service. Rien dans ces conditions ne limite les droits que la loi garantit aux consommateurs.',
        ],
      },
      {
        title: 'Fin d’utilisation',
        blocks: [
          'Tu peux arrêter d’utiliser Grimoire à tout moment et demander la suppression de ton compte à {contact}. Ses données sont alors effacées comme décrit dans la [politique de confidentialité](/confidentialite).',
        ],
      },
      {
        title: 'Changements et droit applicable',
        blocks: [
          'Si ces conditions changent, la date en haut de la page change aussi ; un changement important est annoncé dans l’application. Ces conditions sont soumises au droit français.',
        ],
      },
      {
        title: 'Mentions légales',
        blocks: [
          [
            'Éditeur : {publisher}. Contact : {contact}.',
            'Hébergement du site : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.',
          ],
        ],
      },
    ],
  },
  en: {
    title: 'Terms of use',
    intro: [
      'These terms apply to your use of Grimoire ({site}), including the player companion, the ambiance screen and the connector for ChatGPT and Claude. By creating an account or using Grimoire, you accept these terms.',
    ],
    sections: [
      {
        title: 'The service',
        blocks: [
          'Grimoire helps the keeper prepare and run investigation and horror tabletop games: a story library, investigators, a game screen, a companion on the players’ phones, an ambiance screen and AI features. Grimoire is free at the moment. Its features and usage limits may change.',
        ],
      },
      {
        title: 'Your account',
        blocks: [
          'Only the keeper has an account. You are responsible for what is done with your account and for keeping your password secret. The table and screen links you share give access to your game to anyone who holds them: revoke them when you no longer need them.',
        ],
      },
      {
        title: 'Your content',
        blocks: [
          'What you create or import remains yours. You grant Grimoire the right to store, process and display it for the sole purpose of providing the service to you.',
          'Only import what you have the right to use. A story imported from a book you own stays private: only you can see it, and it cannot be published in the shared library, which is curated by Grimoire’s publisher.',
        ],
      },
      {
        title: 'AI features',
        blocks: [
          'Text and maps produced by AI (import, story creation, narrator, profile suggestions, maps, and what ChatGPT or Claude write through the connector) may be inaccurate or incomplete. Read it before using it at your table. AI features have monthly limits per account.',
          'ChatGPT and Claude are services of OpenAI and Anthropic, subject to their own terms. Grimoire does not see your conversations.',
        ],
      },
      {
        title: 'Acceptable use',
        blocks: [
          'You agree not to:',
          [
            'publish or store content that is illegal or infringes the rights of others;',
            'get around the usage limits, access controls or security of the service;',
            'overload the service, use it in an automated way outside the connector provided, or access another account’s data.',
          ],
          'In case of abuse, access may be suspended.',
        ],
      },
      {
        title: 'Liability',
        blocks: [
          'Grimoire is provided as is, with no guarantee of continuous availability. Keep a copy of what matters to you (each story can be downloaded as a .zip pack). To the extent permitted by law, the publisher is not liable for data loss or indirect damage arising from use of the service. Nothing in these terms limits the rights the law guarantees to consumers.',
        ],
      },
      {
        title: 'Ending your use',
        blocks: [
          'You can stop using Grimoire at any time and ask for your account to be deleted at {contact}. Its data is then erased as described in the [privacy policy](/privacy).',
        ],
      },
      {
        title: 'Changes and governing law',
        blocks: [
          'If these terms change, the date at the top of the page changes too; significant changes are announced in the app. These terms are governed by French law.',
        ],
      },
      {
        title: 'Legal notice',
        blocks: [
          [
            'Publisher: {publisher}. Contact: {contact}.',
            'Website hosting: Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, United States.',
          ],
        ],
      },
    ],
  },
}
