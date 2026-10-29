'use strict';
// Règles métier des annonces : champs modifiables, validation, contrôle avant publication
// et, surtout, ce que le visiteur a le droit de voir (versPublic / versCarte).

const crypto = require('node:crypto');
const R = require('../../public/assets/js/referentiel.js');
const config = require('./config');
const { validerSelon } = require('./validation');
const F = require('./fiche');

const codesDe = (liste) => liste.map((x) => x[0]);

// Liste blanche des champs qu'un admin peut modifier. Toute autre clé est ignorée.
// type : texte | entier | reel | bool | enum | liste | date | cp
const CHAMPS = {
  type_bien: { type: 'enum', valeurs: codesDe(R.typesBien) },
  titre: { type: 'texte', max: 140, nonNul: '' },
  description: { type: 'texte', max: 8000, nonNul: '' },
  atouts: { type: 'liste', valeurs: codesDe(R.atouts), nonNul: [] },
  protection: { type: 'enum', valeurs: codesDe(R.protections), nonNul: 'aucune' },
  epoque: { type: 'enum', valeurs: codesDe(R.epoques) },
  annee_construction: { type: 'entier', min: 1000, max: 2100 },
  etat: { type: 'enum', valeurs: codesDe(R.etats) },

  adresse: { type: 'texte', max: 200 },
  code_postal: { type: 'cp' },
  ville: { type: 'texte', max: 100 },
  code_insee: { type: 'texte', max: 10 },
  quartier: { type: 'texte', max: 100 },
  lat: { type: 'reel', min: -90, max: 90 },
  lng: { type: 'reel', min: -180, max: 180 },
  affichage_adresse: { type: 'enum', valeurs: codesDe(R.affichagesAdresse), nonNul: 'zone' },

  surface_habitable: { type: 'reel', min: 0, max: 100000 },
  surface_carrez: { type: 'reel', min: 0, max: 100000 },
  surface_terrain: { type: 'entier', min: 0, max: 100000000 },
  nb_pieces: { type: 'entier', min: 0, max: 500 },
  nb_chambres: { type: 'entier', min: 0, max: 500 },
  nb_sdb: { type: 'entier', min: 0, max: 200 },
  nb_niveaux: { type: 'entier', min: 0, max: 50 },
  etage: { type: 'entier', min: -5, max: 100 },
  nb_etages_immeuble: { type: 'entier', min: 0, max: 100 },
  ascenseur: { type: 'bool' },
  nb_parkings: { type: 'entier', min: 0, max: 500 },
  exposition: { type: 'enum', valeurs: codesDe(R.expositions) },
  chauffage_type: { type: 'enum', valeurs: codesDe(R.chauffageTypes) },
  chauffage_energie: { type: 'enum', valeurs: codesDe(R.chauffageEnergies) },
  taxe_fonciere: { type: 'entier', min: 0, max: 10000000 },

  prix_fai: { type: 'entier', min: 0, max: 1000000000 },
  honoraires_charge: { type: 'enum', valeurs: codesDe(R.honorairesCharge) },
  honoraires_ttc: { type: 'entier', min: 0, max: 1000000000 },

  copropriete: { type: 'bool' },
  copro_nb_lots: { type: 'entier', min: 0, max: 100000 },
  copro_charges_annuelles: { type: 'entier', min: 0, max: 10000000 },
  copro_procedure: { type: 'bool', nonNul: false },
  copro_procedure_detail: { type: 'texte', max: 300 },

  dpe_statut: { type: 'enum', valeurs: codesDe(R.dpeStatuts) },
  dpe_classe: { type: 'enum', valeurs: R.classesDpe },
  ges_classe: { type: 'enum', valeurs: R.classesDpe },
  dpe_conso: { type: 'entier', min: 0, max: 100000 },
  ges_emission: { type: 'entier', min: 0, max: 100000 },
  dpe_depenses_min: { type: 'entier', min: 0, max: 10000000 },
  dpe_depenses_max: { type: 'entier', min: 0, max: 10000000 },
  dpe_annee_prix: { type: 'entier', min: 2015, max: 2100 },
  dpe_date: { type: 'date' },
  mention_georisques: { type: 'bool', nonNul: true },

  numero_mandat: { type: 'texte', max: 40 },
  reference_interne: { type: 'texte', max: 60 },
  note_interne: { type: 'texte', max: 2000 },
  mise_en_avant: { type: 'bool', nonNul: false },

  // Fiche technique (pièce par pièce, bâtiment, travaux, dossier interne) : voir fiche.js.
  // Jamais dans versPublic ni versCarte.
  fiche: { type: 'objet', valider: F.valider },
};

const STATUTS = codesDe(R.statuts);
const STATUTS_EN_LIGNE = ['publiee', 'sous_offre', 'vendue'];

// Le n° de mandat est exigé depuis le 28/10/2026. Les annonces déjà en ligne sans ce numéro restent
// modifiables (sinon on ne pourrait plus corriger leurs charges) : l'éditeur le leur réclame.
const MANQUE_MANDAT = "le numéro de mandat (affiché comme « Référence de l'annonce »)";

// Valide un objet partiel envoyé par l'éditeur. Renvoie { valeurs, erreurs }.
function valider(entree) {
  return validerSelon(CHAMPS, entree);
}

// Ce qui manque pour mettre une annonce en ligne (obligations légales comprises).
function manquantsPourPublier(a, nbPhotos) {
  const m = [];
  const terrain = a.type_bien === 'terrain';
  if (!nbPhotos) m.push('au moins une photo');
  if (!a.type_bien) m.push('le type de bien');
  if (!a.titre) m.push('un titre');
  if (!a.description) m.push('une description');
  if (!a.ville) m.push("l'adresse ou la commune");
  if (!(a.prix_fai > 0)) m.push('le prix');
  if (!a.numero_mandat) m.push(MANQUE_MANDAT);
  if (!a.honoraires_charge) m.push('la charge des honoraires (vendeur ou acquéreur)');
  else if (a.honoraires_charge === 'acquereur') {
    if (!(a.honoraires_ttc > 0)) m.push('le montant des honoraires TTC');
    else if (a.prix_fai > 0 && a.honoraires_ttc >= a.prix_fai) m.push('des honoraires inférieurs au prix');
  }
  if (terrain) { if (!(a.surface_terrain > 0)) m.push('la surface du terrain'); }
  else if (!(a.surface_habitable > 0)) m.push('la surface habitable');
  if (a.copropriete === null || a.copropriete === undefined) m.push('la copropriété (oui ou non)');
  else if (a.copropriete === true) {
    if (a.copro_nb_lots === null || a.copro_nb_lots === undefined) m.push('le nombre de lots de la copropriété');
    if (a.copro_charges_annuelles === null || a.copro_charges_annuelles === undefined) m.push('les charges annuelles de copropriété');
  }
  if (!a.dpe_statut) m.push('le diagnostic de performance énergétique (DPE)');
  else if (a.dpe_statut === 'realise') {
    if (!a.dpe_classe) m.push('la classe énergie du DPE');
    if (!a.ges_classe) m.push('la classe climat (GES) du DPE');
    if (a.dpe_depenses_min === null || a.dpe_depenses_min === undefined
      || a.dpe_depenses_max === null || a.dpe_depenses_max === undefined) m.push("l'estimation des dépenses annuelles d'énergie");
    else if (a.dpe_depenses_max < a.dpe_depenses_min) m.push("une estimation des dépenses cohérente (minimum ≤ maximum)");
    if (!a.dpe_annee_prix) m.push("l'année de référence des prix de l'énergie");
    if (!a.dpe_date) m.push('la date du DPE');
    // Les DPE réalisés avant le 1er juillet 2021 ne sont plus valables depuis le 1er janvier 2025.
    else if (a.dpe_date < '2021-07-01') m.push('un DPE réalisé après le 1er juillet 2021 (celui-ci n\'est plus valable)');
  }
  return m;
}

// Décale une position de 150 à 350 m dans une direction aléatoire (une seule fois),
// pour la carte « zone approximative ». Le vrai bien est toujours dans le cercle de 500 m.
function positionDecalee(lat, lng) {
  const distance = 150 + crypto.randomInt(201);
  const angle = (crypto.randomInt(3600) / 3600) * 2 * Math.PI;
  const dLat = (distance * Math.cos(angle)) / 111320;
  const dLng = (distance * Math.sin(angle)) / (111320 * Math.cos((lat * Math.PI) / 180));
  return { lat: Math.round((lat + dLat) * 1e6) / 1e6, lng: Math.round((lng + dLng) * 1e6) / 1e6 };
}

// Prix au format de l'arrêté du 10/01/2017. Aucune division sur les montants stockés :
// quand l'acquéreur paie, prix net = prix honoraires inclus − honoraires.
function prix(a) {
  if (!(a.prix_fai > 0)) return null;
  const p = { fai: a.prix_fai, charge: a.honoraires_charge || null };
  if (a.honoraires_charge === 'acquereur' && a.honoraires_ttc > 0 && a.honoraires_ttc < a.prix_fai) {
    p.honoraires_ttc = a.honoraires_ttc;
    p.net = a.prix_fai - a.honoraires_ttc;
    p.pourcentage = Math.round((a.honoraires_ttc / p.net) * 10000) / 100;
  }
  return p;
}

// Position exacte sous forme de texte : sert à savoir si les « environs » enregistrés valent encore
// pour l'adresse actuelle (sinon ils ne sont plus affichés, en attendant une nouvelle recherche).
function clePosition(a) {
  if (a.lat === null || a.lat === undefined || a.lng === null || a.lng === undefined) return null;
  return Number(a.lat).toFixed(6) + ',' + Number(a.lng).toFixed(6);
}

function environsAJour(a) {
  return Boolean(a.environs && a.environs_pour && a.environs_pour === clePosition(a));
}

// Ce que voit l'acquéreur : rien si l'annonce ne montre que la commune (les lieux trahiraient le quartier).
function environsPublics(a) {
  if (a.affichage_adresse === 'commune' || !environsAJour(a)) return null;
  const c = a.environs && Array.isArray(a.environs.categories) ? a.environs.categories : [];
  return c.length ? c : null;
}

function position(a) {
  if (a.affichage_adresse === 'exacte' && a.lat !== null && a.lng !== null) return { lat: a.lat, lng: a.lng, precision: 'exacte' };
  if (a.affichage_adresse === 'zone' && a.lat_pub !== null && a.lng_pub !== null) return { lat: a.lat_pub, lng: a.lng_pub, precision: 'zone' };
  return null;
}

const iso = (d) => (d instanceof Date ? d.toISOString() : d || null);

// Fiche complète vue par un visiteur. Liste blanche STRICTE : jamais d'identifiant interne,
// de référence interne, de note interne ni de coordonnées exactes (sauf choix « adresse exacte »).
// La référence publique est le n° de mandat.
function versPublic(a, photos) {
  return {
    id: a.pub_id,
    reference: a.numero_mandat || null,
    statut: a.statut,
    type_bien: a.type_bien,
    titre: a.titre,
    description: a.description,
    atouts: a.atouts || [],
    protection: a.protection,
    epoque: a.epoque,
    annee_construction: a.annee_construction,
    etat: a.etat,
    localisation: {
      ville: a.ville,
      code_postal: a.code_postal,
      quartier: a.quartier,
      adresse: a.affichage_adresse === 'exacte' ? a.adresse : null,
      affichage: a.affichage_adresse,
      position: position(a),
      environs: environsPublics(a),
    },
    surface_habitable: a.surface_habitable,
    surface_carrez: a.surface_carrez,
    surface_terrain: a.surface_terrain,
    nb_pieces: a.nb_pieces,
    nb_chambres: a.nb_chambres,
    nb_sdb: a.nb_sdb,
    nb_niveaux: a.nb_niveaux,
    etage: a.etage,
    nb_etages_immeuble: a.nb_etages_immeuble,
    ascenseur: a.ascenseur,
    nb_parkings: a.nb_parkings,
    exposition: a.exposition,
    chauffage_type: a.chauffage_type,
    chauffage_energie: a.chauffage_energie,
    taxe_fonciere: a.taxe_fonciere,
    prix: prix(a),
    copropriete: a.copropriete === true ? {
      nb_lots: a.copro_nb_lots,
      charges_annuelles: a.copro_charges_annuelles,
      procedure: a.copro_procedure,
      procedure_detail: a.copro_procedure ? a.copro_procedure_detail : null,
    } : null,
    dpe: {
      statut: a.dpe_statut,
      classe: a.dpe_classe,
      ges: a.ges_classe,
      conso: a.dpe_conso,
      emission: a.ges_emission,
      depenses_min: a.dpe_depenses_min,
      depenses_max: a.dpe_depenses_max,
      annee_prix: a.dpe_annee_prix,
      fichier: a.dpe_pdf_url ? { url: a.dpe_pdf_url, octets: a.dpe_pdf_octets } : null,
    },
    mention_georisques: a.mention_georisques,
    publie_le: iso(a.publie_le),
    photos: (photos || []).map((p) => ({
      url: p.url, url_mini: p.url_mini, largeur: p.largeur, hauteur: p.hauteur, legende: p.legende || '',
    })),
    contact: contactPublic(),
  };
}

// L'interlocutrice affichée sur la fiche, avec sa mention RSAC si elle est renseignée.
function contactPublic() {
  const c = config.contact;
  const rsac = c.rsac && c.rsac.greffe && c.rsac.numero ? `RSAC de ${c.rsac.greffe} n° ${c.rsac.numero}` : null;
  return {
    nom: c.nom, role: c.role, qualite: c.qualite || null, rsac,
    tel: c.tel, telLien: c.telLien, email: c.email, photo: c.photo,
  };
}

// Version courte pour la grille du catalogue.
function versCarte(a) {
  return {
    id: a.pub_id,
    statut: a.statut,
    type_bien: a.type_bien,
    titre: a.titre,
    ville: a.ville,
    code_postal: a.code_postal,
    quartier: a.quartier,
    surface_habitable: a.surface_habitable,
    surface_terrain: a.surface_terrain,
    nb_pieces: a.nb_pieces,
    nb_chambres: a.nb_chambres,
    prix: prix(a),
    dpe_classe: a.dpe_statut === 'realise' ? a.dpe_classe : null,
    protection: a.protection,
    mise_en_avant: a.mise_en_avant,
    publie_le: iso(a.publie_le),
    couverture: a.couverture || null,
    nb_photos: a.nb_photos || 0,
  };
}

// Condition SQL « visible par un visiteur » (paramètre : nombre de jours d'affichage des biens vendus).
const SQL_VISIBLE = `a.supprime_le is null and (a.statut in ('publiee','sous_offre')
  or (a.statut = 'vendue' and a.vendu_le > now() - make_interval(days => $1::int)))`;

module.exports = {
  CHAMPS, STATUTS, STATUTS_EN_LIGNE, SQL_VISIBLE, MANQUE_MANDAT,
  valider, manquantsPourPublier, positionDecalee, prix, versPublic, versCarte, clePosition, environsAJour, contactPublic,
};
