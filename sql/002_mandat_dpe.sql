-- Lot 1 de la réunion avec Catherine Badet (28/10/2026) : obligations légales des annonces.
--  - numero_mandat : n° du mandat de vente, affiché aux acquéreurs comme « Référence de l'annonce ».
--    La référence interne reste privée.
--  - dpe_pdf_url / dpe_pdf_octets : le diagnostic de performance énergétique complet, joint en PDF.

alter table annonces add column if not exists numero_mandat text;

alter table annonces add column if not exists dpe_pdf_url text;

alter table annonces add column if not exists dpe_pdf_octets integer;
