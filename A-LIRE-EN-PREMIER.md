# À lire en premier : espace transaction Petra Gest

Note de Matis (MJ Data), 1er octobre 2026, pour Laetitia et son Claude.

Pendant vos vacances, j'ai construit **l'espace transaction** que demandait la direction : le bouton
« Accès transaction » de votre site mène maintenant à un vrai « Leboncoin privé ».
- L'équipe y dépose des annonces de biens à vendre et crée des codes d'accès personnels pour les acquéreurs.
- Les acquéreurs saisissent leur code et consultent les annonces ; l'équipe voit qui a consulté quoi.

**Votre site n'a pas été modifié.** Ce dossier est nouveau ; il lit votre site (`creations\petra-gest-site`)
pour la démonstration, sans y toucher.

## Montrer le tout à un client, en 30 secondes

1. Double-cliquez **`demo.cmd`** (dans ce dossier). La première fois, une minute d'installation (Internet nécessaire).
2. Le navigateur s'ouvre sur **votre site**, à l'adresse http://localhost:3000.
3. Cliquez sur **« Accès transaction »** : l'espace transaction s'ouvre. Tous les boutons fonctionnent dans les deux sens.
4. Les identifiants de démonstration (équipe et code acquéreur) sont dans `README.md`, rubrique
   « Identifiants de démonstration ».
5. Avant un rendez-vous client : fermez la fenêtre noire, double-cliquez **`reinitialiser-demo.cmd`**, relancez `demo.cmd`.

Si `demo.cmd` indique que Node.js est introuvable : il faut l'installer (version LTS sur nodejs.org), ou demander à Matis.

## Parcours conseillé pour la démonstration

1. Votre page d'accueil, puis « Accès transaction ».
2. Côté acquéreur : saisir le code de démonstration, parcourir les biens, ouvrir une fiche (photos plein écran,
   étiquettes énergie, carte, contact de Catherine).
3. Côté équipe (`/espace-gestion`, lien en bas de ce document) : déposer une annonce avec des photos, créer un code
   d'accès et montrer le message tout prêt à envoyer par SMS ou e-mail, puis révoquer le code et montrer que l'accès
   est coupé aussitôt.

Espace de gestion pendant la démo : http://localhost:3001/espace-gestion

## Ce qui est fictif ou à compléter

- Les biens, les acquéreurs et les photos sont **fictifs** (illustrations marquées « Photo de démonstration ») ;
  un bandeau « Maquette de démonstration » l'indique en haut des pages de l'espace.
- Les logos et le portrait de Catherine sont les vrais, repris de votre dossier `petra-gest-assets`.
- À fournir par Petra Gest avant la mise en ligne : barème des honoraires (page publique obligatoire), mentions
  légales complètes (RCS, SIRET...), confirmation de l'e-mail de Catherine en @arsenalroyal.com.
- Votre lien de menu « Prestations » pointe vers `prestations.html`, qui n'existe pas encore : pendant la démo,
  il mène à la section « Nos prestations » de l'accueil. À créer, ou à faire pointer vers `index.html#prestations`.

## Pour votre Claude

- Les consignes du projet sont dans `CLAUDE.md` (ce dossier) : à lire avant toute modification.
- Ne pas lancer `npm install` ni `npm run dev` directement dans ce dossier OneDrive (modules et base de démonstration
  seraient synchronisés) : `demo.cmd` travaille dans une copie locale, `%LOCALAPPDATA%\petragest-transactions`.
- Rien n'est en ligne. La mise en ligne (Vercel, sous-domaine transactions.petragest.com) se fera avec Matis, après validation
  de la direction : voir `DEPLOIEMENT.md`. Ne rien publier, ne créer aucun compte en ligne.
- Une fiche d'utilisation d'une page pour la directrice : `GUIDE-UTILISATION.md`.
