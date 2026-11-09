-- Biens vendus dans le catalogue (demande de Catherine, 09/11/2026) : c'est l'agence qui décide, bien par bien,
-- d'afficher un bien vendu dans le fil avec le bandeau « Vendu » (case dans la rubrique « Vendues »), et quelles
-- informations l'accompagnent (vendu_affichage, validé par api/_lib/annonces.js ; clé absente = choix par défaut).
-- Avant : tout bien vendu restait affiché 60 jours. Les biens vendus depuis moins de 60 jours gardent leur affichage.
alter table annonces add column if not exists vendu_vitrine boolean not null default false;
alter table annonces add column if not exists vendu_affichage jsonb;
update annonces set vendu_vitrine = true where statut = 'vendue' and vendu_le > now() - interval '60 days';
