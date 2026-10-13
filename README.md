# Espace transaction Petra Gest (transactions.petragest.com)

Un « Leboncoin privé » pour Petra Gest :

- **l'équipe** dépose des annonces de biens à vendre (photos, prix, adresse, DPE...) et crée des **codes d'accès** personnels pour les acquéreurs ;
- **les acquéreurs** saisissent leur code et consultent les annonces ;
- l'équipe voit qui a consulté quoi, et peut couper un accès à tout moment.

Le projet tourne **entièrement en local**, sans aucun compte en ligne, pour la présentation à la direction.
La mise en ligne sur Vercel est décrite dans [DEPLOIEMENT.md](DEPLOIEMENT.md).

## Démonstration client : site vitrine + espace transaction (un seul lien)

Dans l'atelier de Laetitia, ce dossier est rangé à côté de `creations\petra-gest-site` (le site vitrine).

1. **Double-cliquer `demo.cmd`**. La première fois, il installe les modules (une minute, Internet nécessaire).
2. Le navigateur s'ouvre sur **http://localhost:3000** : le site de Laetitia, tel qu'elle l'a fait.
3. Tous les boutons fonctionnent : « Accès transaction » ouvre l'espace transaction (http://localhost:3001),
   « Retour au site » ramène sur la vitrine, « Prestations » mène à la section « Nos prestations » de l'accueil.
4. Pour arrêter : fermer la fenêtre noire de `demo.cmd`.
5. Avant de montrer le site à un client : fermer `demo.cmd`, double-cliquer **`reinitialiser-demo.cmd`**,
   puis relancer `demo.cmd` (efface les essais, repart des données de démonstration).

`demo.cmd` copie le projet dans `%LOCALAPPDATA%\petragest-transactions` (hors de OneDrive : les modules et la base de
démonstration ne sont jamais synchronisés) et lit le site vitrine **sans jamais le modifier**. C'est le serveur local
qui fait les liens entre les deux sites, exactement comme en ligne (petragest.com et transactions.petragest.com).

Le site vitrine se met à jour tout seul : une page modifiée par Laetitia dans `creations\petra-gest-site` apparaît
au prochain rechargement. Si l'espace transaction est modifié dans ce dossier, relancer `demo.cmd` (il recopie).

## Lancer pour développer

Prérequis : **Node.js 20.12 ou plus récent** (vérifier avec `node -v` ; sinon installer la version LTS depuis nodejs.org ou avec `winget install OpenJS.NodeJS.LTS`).

```
npm install
npm run dev
```

Ne pas lancer `npm install` directement dans un dossier synchronisé par OneDrive : travailler sur une copie locale
(c'est ce que fait `demo.cmd`).

| Situation | Site vitrine | Espace des acquéreurs | Espace de gestion (équipe) |
|---|---|---|---|
| Site vitrine trouvé (dossier `../creations/petra-gest-site`, ou `--vitrine "chemin"`) | http://localhost:3000 | http://localhost:3001 | http://localhost:3001/espace-gestion |
| Espace seul (`npm run dev -- --sans-vitrine`) | | http://localhost:3000 | http://localhost:3000/espace-gestion |

Au premier lancement, des **données de démonstration** sont créées : 7 biens fictifs autour de Rochefort
(dont un brouillon incomplet), 5 bénéficiaires fictifs, des illustrations marquées « Photo de démonstration ».
Un bandeau « Maquette de démonstration » s'affiche en haut des pages de l'espace.

### Identifiants de démonstration (valeurs de test, maquette locale uniquement)

| Rôle | Identifiant | Mot de passe |
|---|---|---|
| Direction | direction@demo.petragest.local | Demo-Petra-2026! |
| Catherine Badet | catherine@demo.petragest.local | Demo-Petra-2026! |
| Connexion rapide (démo uniquement) | admin | admin |
| Acquéreur (code d'accès) | PETR-AGES-T26X | |

Astuce : ajouter `#PETR-AGES-T26X` à l'adresse de l'espace des acquéreurs préremplit le code, comme le lien envoyé par SMS.

## Commandes

| Commande | Rôle |
|---|---|
| `demo.cmd` (double-clic) | Démonstration complète, site vitrine compris, navigateur ouvert |
| `reinitialiser-demo.cmd` (double-clic) | Remet la démonstration à neuf (fermer `demo.cmd` avant) |
| `npm run dev` | Lance le site en local (autre port : `npm run dev -- --port 3100`) |
| `npm run demo` | Idem, et ouvre le navigateur |
| `npm run reset` | Efface les données locales (arrêter le serveur avant) ; la démo est recréée au lancement suivant |
| `npm test` | Lance les 25 tests automatiques (règles métier, sécurité, parcours complets, mode démonstration) |
| `npm run admin -- "email" "Prénom Nom"` | Crée un compte de gestion (mot de passe provisoire affiché une fois) |
| `npm run entretien` | Lance à la main l'entretien hebdomadaire (purges RGPD, corbeille) |
| `npm run sauvegarder` | Sauvegarde la base dans un fichier local |

Pour une base vide, sans démonstration : `npm run reset`, puis `npm run dev -- --sans-demo`, puis
(serveur arrêté) `npm run admin -- "vous@petragest.com" "Votre Nom"`.

## Les images de la charte

Les logos (`pg-logo-sable.png`, `pg-logo-navy.png`, `pg-embleme-navy.png`) et le portrait de Catherine
(`personne-catherine.jpg`) sont **les vrais**, copiés depuis `creations\petra-gest-site\petra-gest-assets`.
Si Laetitia les change, les recopier avec :

```
powershell -ExecutionPolicy Bypass -File scripts\importer-charte.ps1
```

Le script cherche le dossier d'images Petra Gest aux emplacements habituels (ou `-Source "chemin"`) et ne remplace
une image qu'une fois la copie réussie. OneDrive doit être lancé si le dossier est synchronisé.

## Ce que fait le site

**Acquéreur**
- saisie du code (12 caractères, sans caractère ambigu), ou lien qui le préremplit ;
- catalogue avec filtres (type, commune, budget, surface, tri) ;
- fiche complète : galerie plein écran, chiffres clés, description, atouts, caractéristiques, étiquettes énergie et climat
  réglementaires, copropriété, carte IGN (zone approximative de 500 m par défaut), prix au format légal, contact ;
- déconnexion ; accès coupé immédiatement si le code est révoqué ou expiré.

**Équipe**
- tableau de bord : chiffres clés et dernières consultations ;
- annonces : dépôt de photos par glisser-déposer (compression automatique, suppression du GPS), autocomplétion
  d'adresse IGN, contrôle des mentions obligatoires avant publication, enregistrement automatique des brouillons,
  sous offre / vendu / archivé, aperçu, duplication, corbeille (30 jours) ;
- codes d'accès : création, envoi par SMS / e-mail / copier-coller, historique par personne, prolongation,
  révocation, suppression (droit à l'effacement), export Excel ;
- équipe : comptes nominatifs, mot de passe provisoire à changer, réinitialisation, désactivation.

## Organisation des fichiers

```
A-LIRE-EN-PREMIER.md   Note d'accueil pour Laetitia et son Claude
demo.cmd               Démonstration complète en double-clic (site vitrine + espace)
reinitialiser-demo.cmd Remet la démonstration à neuf
public/            Pages et fichiers servis tels quels (HTML, CSS, JS, images)
  index.html         saisie du code          biens.html   catalogue
  bien.html          fiche d'un bien         espace-gestion.html   gestion (application)
  honoraires.html, mentions-legales.html, confidentialite.html, 404.html
  assets/css/        petra.css (charte, pages visiteurs), gestion.css (espace de gestion)
  assets/js/         commun.js, referentiel.js (listes partagées avec le serveur), acces.js, biens.js,
                     bien.js, visiteur.js, carte.js, photos.js, gestion.js
api/               Fonctions serveur (Vercel) : acces.js, biens.js, admin.js, cron.js
  _lib/              règles métier et outils (annonces, codes, sessions, sécurité, base, stockage...)
sql/               Schéma de la base
scripts/           Serveur local (dev.js), démonstration, outils en ligne de commande
tests/             Tests automatiques
reference/         Gabarit et BRIEF de la charte, copiés de l'atelier (lecture seule)
```

## Sécurité, en bref

- Codes d'accès et sessions vérifiés **côté serveur à chaque appel** : une révocation prend effet immédiatement.
- Cookies `HttpOnly`, `SameSite=Strict`, signés ; mots de passe hachés (scrypt) ; aucune adresse IP stockée en clair.
- Les acquéreurs ne reçoivent **jamais** l'adresse exacte (sauf choix contraire), les coordonnées réelles,
  la référence ni la note internes.
- Aucune donnée n'est insérée en HTML dans les pages ; politique de sécurité du contenu stricte.
- Toutes les pages sont exclues des moteurs de recherche.

## À compléter avant la mise en ligne

- **Barème des honoraires** (page publique obligatoire) : `public/honoraires.html`.
- **Mentions légales** : capital, RCS, SIRET, TVA, directeur de publication (`public/mentions-legales.html`).
- **Adresse e-mail de Catherine Badet** : en @arsenalroyal.com, à confirmer (`api/_lib/config.js` et le pied des pages).
