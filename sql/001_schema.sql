-- Espace transaction Petra Gest : schéma initial.
-- Une instruction par bloc terminé par « ; » en fin de ligne (le script de migration les exécute une par une).

create table if not exists admins (
  id serial primary key,
  email text not null unique,
  nom text not null,
  mdp_hash text not null,
  doit_changer_mdp boolean not null default true,
  session_version integer not null default 1,
  actif boolean not null default true,
  derniere_connexion timestamptz,
  cree_le timestamptz not null default now()
);

create table if not exists annonces (
  id serial primary key,
  pub_id text not null unique,
  statut text not null default 'brouillon'
    check (statut in ('brouillon','publiee','sous_offre','vendue','archivee')),
  supprime_le timestamptz,

  type_bien text check (type_bien in ('maison','appartement','demeure','chateau','hotel_particulier','immeuble','terrain','local','autre')),
  titre text not null default '',
  description text not null default '',
  atouts jsonb not null default '[]'::jsonb,
  protection text not null default 'aucune'
    check (protection in ('aucune','inscrit_mh','classe_mh','spr','label_fdp')),
  epoque text,
  annee_construction integer,
  etat text check (etat in ('a_renover','a_rafraichir','bon_etat','renove','neuf')),

  adresse text,
  code_postal text,
  ville text,
  code_insee text,
  quartier text,
  lat double precision,
  lng double precision,
  lat_pub double precision,
  lng_pub double precision,
  affichage_adresse text not null default 'zone' check (affichage_adresse in ('commune','zone','exacte')),

  surface_habitable double precision,
  surface_carrez double precision,
  surface_terrain integer,
  nb_pieces integer,
  nb_chambres integer,
  nb_sdb integer,
  nb_niveaux integer,
  etage integer,
  nb_etages_immeuble integer,
  ascenseur boolean,
  nb_parkings integer,
  exposition text,
  chauffage_type text,
  chauffage_energie text,
  taxe_fonciere integer,

  prix_fai integer,
  honoraires_charge text check (honoraires_charge in ('vendeur','acquereur')),
  honoraires_ttc integer,

  copropriete boolean,
  copro_nb_lots integer,
  copro_charges_annuelles integer,
  copro_procedure boolean not null default false,
  copro_procedure_detail text,

  dpe_statut text check (dpe_statut in ('realise','vierge','non_soumis')),
  dpe_classe text check (dpe_classe in ('A','B','C','D','E','F','G')),
  ges_classe text check (ges_classe in ('A','B','C','D','E','F','G')),
  dpe_conso integer,
  ges_emission integer,
  dpe_depenses_min integer,
  dpe_depenses_max integer,
  dpe_annee_prix integer,
  dpe_date text,
  mention_georisques boolean not null default true,

  reference_interne text,
  note_interne text,
  mise_en_avant boolean not null default false,
  publie_le timestamptz,
  vendu_le timestamptz,
  cree_par integer references admins(id) on delete set null,
  modifie_par integer references admins(id) on delete set null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

create table if not exists photos (
  id serial primary key,
  annonce_id integer not null references annonces(id) on delete cascade,
  position integer not null,
  url text not null,
  url_mini text not null,
  largeur integer not null,
  hauteur integer not null,
  octets integer not null,
  legende text,
  cree_le timestamptz not null default now()
);

create index if not exists photos_annonce_idx on photos (annonce_id, position);

create table if not exists vouchers (
  id serial primary key,
  code text not null unique,
  civilite text check (civilite in ('monsieur','madame')),
  beneficiaire_nom text not null,
  beneficiaire_email text,
  beneficiaire_tel text,
  note text,
  expire_le timestamptz not null,
  revoque_le timestamptz,
  revoque_par integer references admins(id) on delete set null,
  motif_revocation text,
  premiere_utilisation timestamptz,
  derniere_utilisation timestamptz,
  nb_connexions integer not null default 0,
  anonymise_le timestamptz,
  cree_par integer references admins(id) on delete set null,
  cree_le timestamptz not null default now()
);

create table if not exists consultations (
  id serial primary key,
  voucher_id integer not null references vouchers(id) on delete cascade,
  annonce_id integer references annonces(id) on delete set null,
  evenement text not null check (evenement in ('connexion','fiche','contact_tel','contact_mail')),
  ip_empreinte text,
  cree_le timestamptz not null default now()
);

create index if not exists consultations_voucher_idx on consultations (voucher_id, cree_le desc);

create index if not exists consultations_annonce_idx on consultations (annonce_id, cree_le desc);

create table if not exists tentatives (
  id serial primary key,
  portail text not null check (portail in ('visiteur','admin')),
  ip_empreinte text not null,
  succes boolean not null,
  cree_le timestamptz not null default now()
);

create index if not exists tentatives_idx on tentatives (portail, ip_empreinte, cree_le);
