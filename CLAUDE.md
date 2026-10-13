# Consignes pour Claude : espace transaction Petra Gest

Projet : `transactions.petragest.com`, l'espace privé où Petra Gest publie des biens à vendre pour des acquéreurs munis
d'un code d'accès. Démarré par MJ Data (Matis) pendant les vacances de Laetitia, à reprendre et tester par Laetitia.
Lire d'abord `README.md`.

## Où est ce projet, et comment il s'articule avec le site vitrine

- Dans l'atelier, ce dossier `petragest-transactions` est rangé à la racine, à côté de `RAR`. Le site vitrine de Laetitia
  est dans `creations\petra-gest-site`. **Ce projet ne modifie jamais le site vitrine** : il le lit pour la démo.
- En ligne (plus tard) : vitrine sur petragest.com, espace sur transactions.petragest.com. En local, le serveur reproduit
  ça : vitrine sur http://localhost:3000, espace sur http://localhost:3001. Il fait lui-même les liens entre les deux :
  `acces-transaction.html` de la vitrine redirige vers l'espace, `prestations.html` (page pas encore créée) vers
  `index.html#prestations`, et les liens `https://petragest.com` de l'espace pointent vers la vitrine locale.
- Le jour où la vitrine passe sur Vercel, il faudra ajouter dans son `vercel.json` une redirection de
  `/acces-transaction` vers `https://transactions.petragest.com` (voir `DEPLOIEMENT.md`, étape 6). Pas avant.

## Démonstration client (le plus simple)

- Double-clic sur `demo.cmd` : copie le projet dans `%LOCALAPPDATA%\petragest-transactions` (hors OneDrive), installe les
  modules la première fois, lance les deux sites, ouvre http://localhost:3000. Fermer la fenêtre pour arrêter.
- `reinitialiser-demo.cmd` (fenêtre de `demo.cmd` fermée) remet les données de démonstration à neuf.
- Ne jamais lancer `npm install` ni `npm run dev` directement dans ce dossier OneDrive : `node_modules` et `.local`
  (la base de démonstration) seraient synchronisés. Travailler dans la copie locale, ou passer par `demo.cmd`.
- Si un client va voir la démo : la faire reinitialiser juste avant, vérifier le parcours « Accès transaction »,
  code acquéreur, fiche d'un bien, puis l'espace de gestion. Identifiants de démonstration : voir README.

## Démarrer pour développer

- Copier ce dossier hors de OneDrive (ou travailler dans `%LOCALAPPDATA%\petragest-transactions` créé par `demo.cmd`),
  puis `npm install` et `npm run dev -- --vitrine "<chemin de creations\petra-gest-site>"` (ou `--sans-vitrine`).
  Tout tourne en local (base PGlite dans `.local/base`, photos dans `.local/stockage`), sans compte en ligne.
- Une modification faite dans la copie locale doit être recopiée ici (dans l'atelier) pour être conservée et partagée.
- Si `npm` ou `node` est introuvable : Node.js 20.12+ est nécessaire (`winget install OpenJS.NodeJS.LTS`).
  Si l'installation est impossible sur le poste, le signaler à Matis plutôt que de contourner.
- Si le port 3000 est pris : `npm run dev -- --port 3100` (la vitrine prend ce port, l'espace le suivant).
- `npm run reset` efface les données locales : **toujours arrêter le serveur avant** (la base locale est verrouillée
  par le serveur en cours).

## Vérifier son travail

- `npm test` doit rester à 25/25 (ajouter un test pour toute nouvelle règle).
- Vérification visuelle : lancer le serveur local et ouvrir les pages dans le navigateur habituel, en 1440 px et en
  390 px. Aucune page ne doit défiler horizontalement.
- **Ne jamais lancer Chrome en série avec un profil temporaire neuf** (`--user-data-dir` jetable, captures
  automatisées) : à chaque lancement, Chrome fait une tentative d'ouverture de session Windows qui échoue ; au 10e
  échec en 10 minutes, Windows verrouille le compte de l'utilisatrice. C'est arrivé le 01/10/2026 sur le poste de Matis.
- Avant de livrer un texte : aucun tiret long ni demi-cadratin dans les textes affichés
  (`grep -rn "—\|–" public api/_lib/config.js scripts/local/demo.js` ne doit rien renvoyer).

## Règles du projet (différences avec l'atelier)

- Ce projet est une **application**, pas une créa : les pages partagent `public/assets/css/*.css` et
  `public/assets/js/*.js` au lieu d'un fichier unique par page. Raison : la politique de sécurité (CSP) interdit
  tout script et tout style **en ligne**. Ne jamais ajouter de `<script>` sans `src`, de `<style>` ni d'attribut
  `style="..."` dans le HTML (un test le vérifie). Pour un style calculé, passer par `element.style` en JavaScript.
- **Jamais d'`innerHTML` avec des données** : toujours `P.h()` (voir `commun.js`), qui pose le texte avec `textContent`.
- La charte reste celle de Petra Gest (voir `reference/BRIEF-petra-gest.md`) : bleu `#001B5C`, sable `#E6CDB7`,
  Georgia pour les titres, Nunito Sans pour le texte, boutons toujours pleins, pas de texte collé à un filet,
  pas de vert ni de Cinzel (Petra Immo). Seule exception : les couleurs officielles des étiquettes DPE.
- Les listes (types de bien, atouts, époques...) sont dans `public/assets/js/referentiel.js`, partagé par le
  navigateur et le serveur : modifier là et nulle part ailleurs.
- Ce que voit un acquéreur est défini par `versPublic()` et `versCarte()` dans `api/_lib/annonces.js`
  (liste blanche). Ne jamais y ajouter de champ interne.

## Où est quoi

| Besoin | Fichier |
|---|---|
| Textes et mise en page des pages acquéreurs | `public/*.html`, `public/assets/css/petra.css` |
| Catalogue / fiche | `public/assets/js/biens.js`, `bien.js` |
| Espace de gestion (toute l'interface) | `public/assets/js/gestion.js`, `public/assets/css/gestion.css` |
| Contact affiché, durées, réglages | `api/_lib/config.js` |
| Règles de publication (mentions obligatoires) | `api/_lib/annonces.js` (`manquantsPourPublier`) |
| Données de démonstration | `scripts/local/demo.js`, illustrations `scripts/demo/photos/` |

## Ce qu'il ne faut pas faire

- Ne jamais modifier `creations\petra-gest-site` depuis ce projet ; les 4 images de la charte s'importent avec
  `scripts/importer-charte.ps1` (copie dans `public/assets`).
- Ne pas mettre en ligne, ne pas créer de compte Vercel ou Neon, ne pas pousser sur un dépôt distant :
  la mise en ligne est faite par Matis après validation de la direction (voir `DEPLOIEMENT.md`).
- Ne pas utiliser de vraies photos de biens ou de personnes dans la démonstration sans accord.
- Scripts PowerShell (Windows PowerShell 5.1) : les enregistrer en UTF-8 avec BOM, sinon les accents sont cassés.
