-- Lot 3 (réunion du 28/10/2026, modèles de fiches de Catherine reçus le 29/10/2026) : fiche technique du bien.
-- Pièce par pièce, bâtiment, travaux, situation locative et dossier interne (vendeur, mandat, plus et moins),
-- en un seul champ JSON validé par api/_lib/fiche.js. Jamais montré aux acquéreurs par l'API publique :
-- il sert aux documents imprimés depuis l'espace de gestion (fiche technique, bon de visite, dossier interne).
alter table annonces add column if not exists fiche jsonb;
