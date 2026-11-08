# Grimoire dans les annuaires ChatGPT et Claude

But : qu'un gardien ajoute Grimoire à ChatGPT ou à Claude **en un clic** depuis leur annuaire, sans coller
d'adresse ni activer le mode développeur. Ce dossier contient tout ce qu'il faut pour soumettre le
connecteur MCP (`supabase/functions/mcp`) aux deux annuaires.

En attendant l'annuaire :
- **Claude** : déjà presque en un clic. Le bouton « Ajouter à Claude » (Réglages → ChatGPT et Claude, et la page /aide)
  utilise le [lien d'installation documenté](https://claude.com/docs/connectors/building/directory-vs-custom) qui ouvre
  la fenêtre « Ajouter un connecteur personnalisé » de claude.ai déjà remplie (`claudeAddLink` dans
  `src/settings/connectorUrl.ts`). Le gardien confirme, puis se connecte à Grimoire. Tous les abonnements, Free compris
  (un seul connecteur personnalisé sur Free). La doc ne dit rien des applications de bureau et mobile.
- **ChatGPT** : aucun lien prérempli documenté. Le bouton « Ouvrir ChatGPT » mène à chatgpt.com/plugins, où le gardien
  colle l'adresse ([connecter un serveur MCP](https://developers.openai.com/plugins/deploy/connect-chatgpt.md)).
  L'annuaire reste le seul moyen d'avoir un vrai clic.

Exigences relevées le 6 novembre 2026 sur les pages officielles :
[soumission Claude](https://claude.com/docs/connectors/building/submission),
[critères de relecture Claude](https://claude.com/docs/connectors/building/review-criteria),
[politique de l'annuaire Anthropic](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy),
[soumission ChatGPT](https://developers.openai.com/plugins/deploy/submission),
[règles des plugins ChatGPT](https://developers.openai.com/apps-sdk/app-submission-guidelines),
[authentification ChatGPT](https://developers.openai.com/plugins/build/auth).
Relis-les au moment de soumettre : elles bougent (OpenAI a renommé les « apps » en « plugins »).

## Déjà prêt dans le code

| Exigence | Où |
|---|---|
| Politique de confidentialité publique (FR + EN) | `/confidentialite`, `/privacy` (`src/legal/privacy.ts`) |
| Conditions d'utilisation + mentions légales | `/conditions`, `/terms` (`src/legal/terms.ts`) |
| Documentation publique du connecteur + contact support | `/aide`, `/help` (`src/legal/help.ts`) |
| Liens vers ces pages sur la connexion, l'app et l'écran d'autorisation | `LegalLinks` |
| Serveur MCP distant, Streamable HTTP, OAuth 2.1 + PKCE S256, inscription dynamique (DCR) | `supabase/functions/mcp` |
| `title` sur chaque outil, `readOnlyHint` / `destructiveHint` / `openWorldHint` en booléens explicites | `story-mcp.ts` (vérifié par `story-mcp.test.ts`) |
| Outils séparés lecture / écriture, pas d'outil « fourre-tout » | idem |
| Paquet ChatGPT : `plugin.json`, `mcp.json`, logo, 5 cas positifs + 3 négatifs, traduction FR | `directory/chatgpt/` |
| Icône 512 × 512 pour Claude | `directory/claude-icon.png` |
| Vérification des limites et création du zip | `pnpm directory:package` |
| « Ajouter à Claude » (lien prérempli) et « Ouvrir ChatGPT » dans Réglages ; ils mènent aux fiches d'annuaire dès que leurs liens existent | `ChatConnectors.tsx`, `DIRECTORY_LISTING` dans `src/legal/info.ts` |

## À faire par toi, dans l'ordre

1. **Vérifier l'identité et le contact** dans `src/legal/info.ts` : éditeur (`Quentin de Quelen`) et adresse de contact
   (`contact@legrimoire.quest`). **Cette adresse doit recevoir du courrier** : Resend ne fait qu'envoyer. Crée
   une boîte ou une redirection (par exemple ImprovMX ou Cloudflare Email Routing, avec un enregistrement MX dans
   le DNS Vercel), puis envoie-toi un test. Les deux annuaires écrivent à cette adresse.
2. **Fusionner et déployer** cette branche : les pages `/privacy`, `/terms` et `/help` doivent être en ligne avant la
   soumission. Vérifie-les sur https://www.legrimoire.quest/privacy, /terms et /help.
3. **Créer le compte de relecture** (voir plus bas).
4. **Enregistrer la vidéo de démonstration** (voir plus bas), obligatoire pour ChatGPT.
5. **Soumettre à Claude** (voir plus bas).
6. **Soumettre à ChatGPT** (voir plus bas).
7. **Une fois Grimoire accepté**, colle le lien de chaque fiche dans `DIRECTORY_LISTING` (`src/legal/info.ts`) et
   déploie : « Ajouter à Claude » mène alors à la fiche de l'annuaire, et « Ouvrir ChatGPT » devient « Ajouter à ChatGPT ».

## Compte de relecture

Les deux annuaires demandent un compte de test **prêt à l'emploi, avec des données**, qui marche sans code
envoyé par e-mail ou SMS ni double authentification, et qui reste disponible pour les relectures suivantes.

1. Sur https://www.legrimoire.quest, **Créer un compte** avec une adresse que tu contrôles (par exemple
   `review@legrimoire.quest` si tu as une redirection), un mot de passe fort, le nom affiché « Reviewer ».
   Confirme l'adresse une fois (la confirmation n'est demandée qu'à l'inscription : les relecteurs n'en auront pas besoin).
2. Passe la langue en **English** (Réglages).
3. Importe l'histoire d'exemple : zippe `stories/the-silent-light/` (`cd stories && zip -r the-silent-light.zip the-silent-light`),
   ou choisis directement le dossier, dans Histoires → Importer → Packs Grimoire. Elle arrive dans Mes histoires (privée) : c'est « The Silent Light » des cas de test.
4. Connecte une fois Claude et ChatGPT avec ce compte et joue les cas de test : Claude demande de confirmer que tu as
   essayé chaque outil.
5. Ne te connecte pas avec Google sur ce compte : les relecteurs utilisent l'e-mail et le mot de passe.

Identifiants à donner dans les formulaires (jamais dans le zip) :

```
Site: https://www.legrimoire.quest
E-mail: <adresse du compte de relecture>
Password: <mot de passe>
Sample data: the private story "The Silent Light" (Stories → My stories).
Sign in with e-mail and password when the Grimoire consent page opens, then click "Allow".
```

## Vidéo de démonstration (2 à 3 minutes, en anglais)

Enregistre l'écran (QuickTime suffit), mets la vidéo en ligne en non répertorié (YouTube) ou sur un lien de partage
public, et colle l'adresse dans `review.demo_recording_url` de `directory/chatgpt/plugin.json`.

1. Grimoire : Settings → ChatGPT and Claude (adresse du connecteur), puis la page /help.
2. ChatGPT : ajouter le connecteur, page d'autorisation Grimoire, Allow.
3. « Create a short Grimoire story in a fishing village in 1925, for three players. Show me the outline first. »
   Valider le plan, laisser écrire les scènes.
4. Ouvrir le lien : l'histoire dans Mes histoires, une scène ouverte.
5. « In The Silent Light, add a short scene at the end of the last act… » puis montrer la scène ajoutée.
6. Réglages → Applications connectées → Déconnecter.

## Soumettre à Claude

Il faut un compte Claude **Pro, Max, Team ou Enterprise** (pas Free).
Portail : https://claude.ai/directory/manage → **Submit new** → **MCP connector**.

| Étape | À remplir |
|---|---|
| Connection | Server URL `https://www.legrimoire.quest/mcp`, Universal URL |
| Tools | Le portail lit les outils : les 11 ont un titre et leurs annotations |
| Listing → Server name | `Grimoire` |
| Listing → One-liner (200 max) | `Create and revise original investigation and horror tabletop stories, saved in your Grimoire library and ready to play.` |
| Listing → Description (2 000 max) | Le texte ci-dessous |
| Listing → Categories | Entertainment / Creative (ce que propose le portail, 1 à 5) |
| Listing → Slug | `grimoire` (définitif une fois publié) |
| Listing → Icon | `directory/claude-icon.png` |
| Use cases | Les 3 premières demandes d'exemple ci-dessous ; prérequis : un compte Grimoire ; lit et écrit |
| Company | Grimoire, https://www.legrimoire.quest, contact `contact@legrimoire.quest` |
| Authentication | OAuth, inscription dynamique (`oauth_dcr`). Rien d'autre à saisir |
| Data handling | Notre propre API ; pas de données de santé ; pas de contenu sponsorisé |
| Documentation / Privacy | `https://www.legrimoire.quest/help`, `https://www.legrimoire.quest/privacy` |
| Test & launch | Les identifiants du compte de relecture ; coche que chaque outil a été essayé dans Claude |
| Compliance | Les 7 engagements : Grimoire ne déplace pas d'argent, ne génère ni image ni son, ne lit pas la conversation, n'a pas de publicité |

Description pour Claude :

> Grimoire is the keeper's companion for investigation and horror tabletop role-playing games. With this connector,
> Claude writes original stories for your table and Grimoire saves them in your library, ready to play.
>
> Describe the setting, the tone, the mystery and your players. Claude proposes an outline (acts, scenes, non-player
> characters and the secret behind it all), and once you approve it, writes every scene: what the investigators can
> find, the clues, the read-aloud text and the handouts. Grimoire checks the story against its format, refuses names
> taken from protected works, and saves it after every step. You can then ask Claude to revise any of your private
> stories: add or rewrite a scene, change a non-player character, add a handout.
>
> Claude can also help make investigators for your players: it suggests the occupation, characteristics, skills and
> profile, and Grimoire checks every choice against the creation rules and computes the sheet before saving it.
>
> The connector only reaches the private stories and the investigators of the Grimoire account you connect. It
> cannot see your games, and it never deletes a story or an investigator. Requires a Grimoire account.

Demandes d'exemple (la politique Anthropic en exige au moins trois qui marchent) :

1. `Create a short Grimoire story in a fishing village in 1925, for three players. Show me the outline first.`
2. `List my Grimoire stories and summarise The Silent Light.`
3. `In my Grimoire story The Silent Light, add a short scene at the end of the last act where the investigators return to the village at dawn.`
4. `Create a Grimoire investigator for Sam: a curious, stubborn press photographer. Show me the sheet before saving it.`

Contacts Anthropic : `mcp-review@anthropic.com` (relecture), `directory@anthropic.com` (changement d'authentification).
Pas de délai de relecture annoncé ; le connecteur reste utilisable comme connecteur personnalisé en attendant.

## Soumettre à ChatGPT

1. **Vérifier ton identité** (individuelle suffit) : https://platform.openai.com/settings/organization/general.
   Le nom vérifié doit être celui de `developerName` et `author.name` dans `plugin.json` (`Quentin de Quelen`).
2. **Vérifier le domaine** : le portail donne un jeton. Crée `public/.well-known/openai-apps-challenge`
   contenant **uniquement** ce jeton, déploie, puis vérifie :
   `curl https://www.legrimoire.quest/.well-known/openai-apps-challenge` (Vercel sert les fichiers de `public/`
   avant les réécritures de `vercel.json`).
3. **Compléter le paquet** : colle le lien de la vidéo dans `review.demo_recording_url`, relis la catégorie
   (`Entertainment` : change-la si le portail ne la propose pas) puis lance `pnpm directory:package`. Le script
   refuse de zipper tant qu'un champ obligatoire manque ou dépasse sa limite, puis écrit `directory/grimoire-chatgpt.zip`.
4. Portail : https://platform.openai.com/plugins → **Upload new or existing plugin** → le zip →
   **Connect MCP server** (OAuth) → **Review details** : les identifiants du compte de relecture → attestations →
   **Submit for review**.
5. Pays : `publication.countries` est absent du paquet ; choisis la diffusion dans le portail si elle est demandée.

## Points à surveiller

- **Audience du jeton (ChatGPT)** : OpenAI demande que le jeton soit émis pour l'adresse du connecteur (paramètre
  `resource`, audience `aud`). L'OAuth de Supabase ne gère pas encore les indicateurs de ressource (RFC 8707) : le
  jeton est un jeton de session Grimoire ordinaire. Le connecteur marche déjà en mode développeur ; si la relecture
  le signale, c'est le point à reprendre.
- **Adresse de retour ChatGPT** : sans le paramètre `iss` (RFC 9207) dans la réponse d'autorisation, ChatGPT utilise une
  adresse de retour propre à chaque connexion (`https://chatgpt.com/connector/oauth/{callback_id}`). Avec l'inscription
  dynamique, ChatGPT la déclare lui-même : rien à configurer.
- **Contenu** : les deux annuaires visent un public général (13 ans et plus chez OpenAI). Les histoires restent de
  l'horreur d'ambiance ; les règles de création (`_shared/create-prompt.ts`) gèrent déjà les lignes et voiles.
- **Changements après publication** : prévenir Anthropic de tout changement d'outils, de données ou d'adresse.
  Chez OpenAI, un nouvel outil reste invisible jusqu'à sa validation : soumets une nouvelle version du paquet.
- Le connecteur appelle seulement l'API de Grimoire (Supabase), dont tu contrôles le domaine : la règle « propriétaire
  de l'API » des deux annuaires est respectée.
