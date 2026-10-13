# Mise en ligne sur Vercel (après validation de la direction)

Durée estimée : une demi-journée. À faire par MJ Data. Rien de ceci n'a encore été fait.

## Avant la validation : démonstration sur l'adresse de développement

Pour présenter l'espace à la direction sur son adresse Vercel (`<projet>.vercel.app`), sans domaine ni données réelles :

1. Étapes 1 à 3 ci-dessous (dépôt, projet Vercel, Neon, Blob, variables). `PUBLIC_ORIGIN` peut rester
   `https://transactions.petragest.com` : l'adresse `*.vercel.app` du projet est acceptée d'office.
   Ajouter en plus la variable `PETRA_DEMO` = `1` (bandeau « Maquette de démonstration » sur toutes les pages).
   Ne **pas** activer la Deployment Protection sur la production, sinon la direction devra se connecter à Vercel.
2. Charger les biens fictifs dans la base en ligne (base vide uniquement) :
   ```
   vercel link
   vercel env pull .env.production.local --environment=production
   node scripts/demo-en-ligne.js --env .env.production.local
   ```
   Le mot de passe des deux comptes de démonstration s'affiche une seule fois : le noter. Code visiteur : voir README.
3. Redéployer (Deployments > Redeploy) pour que `PETRA_DEMO` soit pris en compte.
4. Après validation, **avant la vraie mise en ligne** : supprimer cette base de démonstration et en créer une neuve
   (Neon et Blob), retirer `PETRA_DEMO`, puis suivre la procédure complète ci-dessous.

## 0. Décisions et accès à réunir avant de commencer

- **Équipe Vercel Pro (20 $ HT par mois)** : l'offre gratuite Hobby interdit l'usage commercial. Qui paie ?
  Petra Gest en direct (préférable pour la propriété des données) ou MJ Data avec refacturation.
  **Un seul membre qui déploie** : chaque membre supplémentaire qui déploie coûte 20 $ par mois.
  Laetitia peut être ajoutée en lecture seule (gratuit).
- **Accès DNS chez IONOS** (via Com'Horizon) pour créer `transactions.petragest.com`. Les e-mails @petragest.com ne sont pas touchés.
- **Barème des honoraires**, **mentions légales complètes**, **e-mail de Catherine** validé (voir README).
- **Liste des comptes de gestion** (noms et e-mails).
- Contrat de sous-traitance RGPD (article 28) Petra Gest / MJ Data, et une ligne dans le registre des traitements.

## 1. Dépôt et projet Vercel

1. Créer un dépôt GitHub privé et y pousser ce dossier (`.gitignore` exclut déjà `.local`, `.env*`, `node_modules`, `sauvegardes`).
2. Vercel > Add New > Project > importer le dépôt, dans l'équipe Pro.
   - Framework Preset : **Other**. Build Command : vide. Output Directory : laisser vide (`vercel.json` indique `public`).
   - Settings > General > **Node.js Version : 24.x**.
   - Région des fonctions : déjà fixée à Francfort (`fra1` dans `vercel.json`), au plus près de la base Neon.
3. Settings > Deployment Protection : **activer pour les prévisualisations** (Vercel Authentication).

## 2. Base de données (Neon) et photos (Blob)

1. Onglet Storage > **Neon** (Marketplace) > créer une base, région **AWS Europe Central 1 (Francfort)**, offre gratuite.
   - **Désactiver la création d'une branche par prévisualisation** (l'offre gratuite est limitée à 10 branches).
   - `DATABASE_URL` est ajoutée automatiquement au projet.
2. Onglet Storage > **Blob** > créer un magasin en accès **public**, relié au projet. `BLOB_READ_WRITE_TOKEN` est ajoutée.
   - Dans le magasin : activer le pare-feu si proposé, et déposer un `robots.txt` contenant `User-agent: *` / `Disallow: /`.

## 3. Variables d'environnement (Settings > Environment Variables, Production et Preview)

| Variable | Valeur |
|---|---|
| `SESSION_SECRET` | 32 caractères aléatoires ou plus |
| `IP_SECRET` | 32 caractères aléatoires ou plus (différent) |
| `CRON_SECRET` | 32 caractères aléatoires ou plus (différent) |
| `PUBLIC_ORIGIN` | `https://transactions.petragest.com` |
| `NODEJS_HELPERS` | `0` |

Générer un secret : `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
Garder une copie des secrets dans un coffre, hors de Vercel. Changer `SESSION_SECRET` déconnecte tout le monde ;
changer `IP_SECRET` remet à zéro le comptage des appareils (sans autre effet).

## 4. Initialiser la base et créer les comptes

```
npm i -g vercel
vercel link
vercel env pull .env.production.local --environment=production
node scripts/migrer.js --env .env.production.local
node scripts/creer-admin.js "prenom.nom@petragest.com" "Prénom Nom" --env .env.production.local
```

Chaque compte reçoit un mot de passe provisoire, affiché une fois, à transmettre de vive voix ; il est changé à la
première connexion. **La production ne contient aucune donnée de démonstration** (elles ne sont créées que par `npm run dev`).
Supprimer `.env.production.local` du poste après usage.

## 5. Protections du pare-feu Vercel (Firewall > Rules)

Les règles ne sont pas versionnées dans le dépôt : les recréer à l'identique.

| Règle | Condition | Action |
|---|---|---|
| Codes d'accès | Chemin égal à `/api/acces`, méthode POST | Rate limit : 10 requêtes par 10 minutes, par IP |
| Connexion équipe | Chemin égal à `/api/admin/session`, méthode POST | Rate limit : 5 requêtes par 10 minutes, par IP |

Le code applique déjà un frein en base (8 et 5 échecs par 15 minutes) : le pare-feu bloque avant d'atteindre
la base et évite de consommer le quota gratuit de Neon.

Settings > Billing > Spend Management : **alerte à 25 $**.

## 6. Domaine

1. Vercel > Settings > Domains > ajouter `transactions.petragest.com`.
2. Chez IONOS : enregistrement **CNAME** `transactions` vers `cname.vercel-dns.com` (valeur exacte affichée par Vercel).
3. Attendre le certificat HTTPS (quelques minutes).
4. Côté vitrine (le jour où petragest.com passe sur Vercel) : ajouter dans son `vercel.json` une redirection
   de `/acces-transaction` vers `https://transactions.petragest.com`. Les 36 liens « Accès transaction » du site
   n'ont alors pas à être modifiés.

## 7. Vérifications après mise en ligne

- `https://transactions.petragest.com` s'affiche, `/biens` sans code renvoie vers la saisie du code.
- Connexion à `/espace-gestion` avec un compte réel ; changement du mot de passe provisoire.
- Déposer une annonce de test avec 2 photos depuis un téléphone (photo prise en portrait : bon sens d'affichage).
- Créer un code, l'envoyer par SMS à son propre téléphone, ouvrir le lien : le code est prérempli.
- Révoquer le code : la page suivante renvoie vers la saisie avec « Votre code n'est plus actif ».
- 11 codes faux d'affilée : blocage (429).
- Vercel > Cron Jobs : `/api/cron` planifié le lundi à 3 h ; le déclencher une fois à la main (Run).
- Supprimer l'annonce et le code de test (corbeille puis suppression définitive).

## 8. Ensuite

- Sauvegarde mensuelle hors de Vercel : `node scripts/sauvegarder.js --env .env.production.local --photos`
  (le dossier produit contient des données personnelles : le ranger en lieu sûr).
- Neon garde un historique de restauration de 6 heures (offre gratuite) : en cas d'erreur, agir vite.
- Retour arrière d'une version : Vercel > Deployments > Promote sur le déploiement précédent.
- Surveiller dans la console Neon la consommation mensuelle (100 heures de calcul par mois incluses).
