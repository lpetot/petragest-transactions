'use strict';
// Fiche technique d'une annonce (lot 3, modèles de fiches transmis par Catherine le 29/10/2026) :
// pièce par pièce, bâtiment, travaux, situation locative et dossier interne (vendeur, mandat, plus et moins).
// Un seul champ JSON (colonne annonces.fiche), validé ici clé par clé. Il ne sort jamais vers les
// acquéreurs par l'API publique : seuls les documents imprimés depuis l'espace de gestion l'utilisent,
// et la fiche remise à l'acquéreur n'en reprend jamais la partie interne (INTERNES).

const R = require('../../public/assets/js/referentiel.js');
const { validerSelon } = require('./validation');

const codes = (liste) => liste.map((x) => x[0]);

const CHAMPS = {
  // Le bâtiment et le confort
  construction: { type: 'texte', max: 120 },
  facade: { type: 'texte', max: 120 },
  toiture: { type: 'texte', max: 120 },
  mitoyennete: { type: 'enum', valeurs: codes(R.mitoyennetes) },
  vitrage: { type: 'enum', valeurs: codes(R.vitrages) },
  menuiseries: { type: 'enum', valeurs: codes(R.menuiseries) },
  assainissement: { type: 'enum', valeurs: codes(R.assainissements) },
  lotissement: { type: 'bool' },
  frais_notaire_reduits: { type: 'bool' },
  equipements: { type: 'liste', valeurs: codes(R.equipementsFiche) },
  // Travaux, cadastre, syndic
  travaux_realises: { type: 'texte', max: 1000 },
  garantie_decennale: { type: 'bool' },
  travaux_a_prevoir: { type: 'texte', max: 1000 },
  travaux_votes: { type: 'texte', max: 1000 },
  cadastre: { type: 'texte', max: 200 },
  syndic_type: { type: 'enum', valeurs: codes(R.syndics) },
  syndic_nom: { type: 'texte', max: 120 },
  syndic_tel: { type: 'texte', max: 40 },
  // Situation locative
  loue: { type: 'bool' },
  bail_type: { type: 'enum', valeurs: codes(R.typesBail) },
  loyer_hc: { type: 'entier', min: 0, max: 1000000 },
  bail_debut: { type: 'date' },
  bail_fin: { type: 'date' },
  // Dossier interne : jamais sur la fiche remise à l'acquéreur
  mandat_type: { type: 'enum', valeurs: codes(R.typesMandat) },
  mandat_date: { type: 'date' },
  apporteur: { type: 'texte', max: 120 },
  vendeur_noms: { type: 'texte', max: 200 },
  vendeur_adresse: { type: 'texte', max: 300 },
  vendeur_tel: { type: 'texte', max: 60 },
  vendeur_email: { type: 'texte', max: 160 },
  notaire: { type: 'texte', max: 200 },
  visites: { type: 'texte', max: 1000 },
  plus: { type: 'texte', max: 1500 },
  moins: { type: 'texte', max: 1500 },
};

const TOUS_DETAILS = Array.from(new Set(Object.keys(R.detailsPieces)
  .flatMap((g) => R.detailsPieces[g].map((x) => x[0]))));

const CHAMPS_PIECE = {
  type: { type: 'enum', valeurs: codes(R.pieces) },
  nom: { type: 'texte', max: 60 },
  niveau: { type: 'enum', valeurs: codes(R.niveaux) },
  surface: { type: 'reel', min: 0, max: 100000 },
  orientations: { type: 'liste', valeurs: codes(R.orientations) },
  sol: { type: 'enum', valeurs: codes(R.sols) },
  details: { type: 'liste', valeurs: TOUS_DETAILS },
  commentaire: { type: 'texte', max: 300 },
};
const MAX_PIECES = 60;

// Parties de la fiche qui ne sortent jamais du dossier interne.
const VENDEUR = ['vendeur_noms', 'vendeur_adresse', 'vendeur_tel', 'vendeur_email'];
const INTERNES = ['mandat_type', 'mandat_date', 'apporteur', ...VENDEUR, 'notaire', 'visites', 'plus', 'moins'];
// Pas recopiés par « Dupliquer » : un autre bien a son propre mandat, son lot cadastral et sa location.
const NON_RECOPIES = [...INTERNES, 'cadastre', 'loue', 'bail_type', 'loyer_hc', 'bail_debut', 'bail_fin'];

const LIBELLES = {
  construction: 'Type de construction', facade: 'Façade', toiture: 'Toiture', equipements: 'Équipements',
  travaux_realises: 'Travaux réalisés', travaux_a_prevoir: 'Travaux à prévoir', travaux_votes: 'Travaux votés',
  cadastre: 'Références cadastrales', syndic_nom: 'Syndic', syndic_tel: 'Téléphone du syndic',
  loyer_hc: 'Loyer hors charges', bail_debut: 'Début du bail', bail_fin: 'Fin du bail', mandat_date: 'Date du mandat',
  apporteur: 'Apporteur', vendeur_noms: 'Vendeur', vendeur_adresse: 'Adresse du vendeur', vendeur_tel: 'Téléphone du vendeur',
  vendeur_email: 'E-mail du vendeur', notaire: 'Notaire', visites: 'Organisation des visites', plus: 'Les plus', moins: 'Les moins',
  nom: 'nom', surface: 'surface', commentaire: 'commentaire',
};

const plein = (v) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length);

function validerPiece(p, rang) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { erreur: `Pièce ${rang} illisible.` };
  const { valeurs, erreurs } = validerSelon(CHAMPS_PIECE, p, { souple: true });
  const e = Object.keys(erreurs)[0];
  if (e) return { erreur: `Pièce ${rang}, ${LIBELLES[e] || e} : ${erreurs[e]}` };
  if (!valeurs.type) return { valeur: null };   // type inconnu (retiré du référentiel) : pièce écartée
  const permis = codes(R.detailsPour(valeurs.type));
  if (valeurs.details) valeurs.details = valeurs.details.filter((d) => permis.includes(d));
  const sortie = {};
  for (const k of Object.keys(CHAMPS_PIECE)) if (plein(valeurs[k])) sortie[k] = valeurs[k];
  return { valeur: sortie };
}

// Valide la fiche entière envoyée par l'éditeur. Renvoie { valeur } (null si vide) ou { erreur }.
function valider(v) {
  if (v === null) return { valeur: null };
  if (typeof v !== 'object' || Array.isArray(v)) return { erreur: 'Fiche technique illisible.' };
  const { valeurs, erreurs } = validerSelon(CHAMPS, v, { souple: true });
  const e = Object.keys(erreurs)[0];
  if (e) return { erreur: `${LIBELLES[e] || e} : ${erreurs[e]}` };
  const sortie = {};
  for (const k of Object.keys(CHAMPS)) if (plein(valeurs[k])) sortie[k] = valeurs[k];
  if (v.pieces !== undefined && v.pieces !== null) {
    if (!Array.isArray(v.pieces)) return { erreur: 'Liste des pièces illisible.' };
    if (v.pieces.length > MAX_PIECES) return { erreur: `${MAX_PIECES} pièces au maximum.` };
    const pieces = [];
    for (let i = 0; i < v.pieces.length; i++) {
      const r = validerPiece(v.pieces[i], i + 1);
      if (r.erreur) return { erreur: r.erreur };
      if (r.valeur) pieces.push(r.valeur);
    }
    if (pieces.length) sortie.pieces = pieces;
  }
  return { valeur: Object.keys(sortie).length ? sortie : null };
}

// Copie pour « Dupliquer » : la description du bâtiment et les pièces, sans ce qui est propre au mandat.
function pourDuplication(f) {
  if (!f) return null;
  const copie = {};
  for (const [k, v] of Object.entries(f)) if (!NON_RECOPIES.includes(k)) copie[k] = v;
  return Object.keys(copie).length ? copie : null;
}

// Total des pièces comptées dans la surface habitable (indicatif : la surface officielle reste celle du diagnostic).
function surfacePieces(f) {
  if (!f || !Array.isArray(f.pieces)) return null;
  let total = 0; let compte = 0;
  for (const p of f.pieces) {
    const def = R.pieceDe(p.type);
    if (def && def[2] && p.surface > 0) { total += p.surface; compte += 1; }
  }
  return compte ? Math.round(total * 100) / 100 : null;
}

module.exports = { CHAMPS, CHAMPS_PIECE, INTERNES, VENDEUR, NON_RECOPIES, MAX_PIECES, valider, pourDuplication, surfacePieces };
