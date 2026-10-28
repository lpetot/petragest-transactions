-- Lot 2 de la réunion avec Catherine Badet (28/10/2026) : « Découvrir les environs ».
--  - environs : lieux utiles autour du bien (OpenStreetMap), classés par public/assets/js/environs.js.
--  - environs_le : date de la recherche.
--  - environs_pour : position (« lat,lng ») utilisée ; si l'adresse change, l'ancien résultat n'est plus affiché.

alter table annonces add column if not exists environs jsonb;

alter table annonces add column if not exists environs_le timestamptz;

alter table annonces add column if not exists environs_pour text;
