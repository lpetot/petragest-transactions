'use strict';
// Données de DÉMONSTRATION (maquette locale uniquement) : biens fictifs, bénéficiaires fictifs,
// illustrations marquées « Photo de démonstration ». Rien de tout cela n'est destiné à la production.
//
// Identifiants de démonstration (valeurs de test, également notées dans README.md) :
//   Direction : direction@demo.petragest.local / Demo-Petra-2026!
//   Catherine : catherine@demo.petragest.local / Demo-Petra-2026!
//   Code visiteur : PETR-AGES-T26X

const fs = require('node:fs');
const path = require('node:path');
const db = require('../../api/_lib/db');
const stockage = require('../../api/_lib/stockage');
const sec = require('../../api/_lib/securite');
const dates = require('../../api/_lib/dates');

const PHOTOS = path.join(__dirname, '..', 'demo', 'photos');
const MDP_DEMO = 'Demo-Petra-2026!';
const CODE_DEMO = 'PETRAGEST26X';

const jours = (n) => new Date(Date.now() - n * 86400000).toISOString();

const ANNONCES = [
  {
    cle: 'hotel', photos: ['hotel-facade', 'hotel-salon', 'hotel-jardin', 'hotel-chambre'],
    legendes: ['Façade sur rue', 'Salon de réception', 'Le jardin clos', 'Chambre principale'],
    statut: 'publiee', publie: 12, mise_en_avant: true,
    type_bien: 'hotel_particulier', titre: 'Hôtel particulier du XVIIIᵉ siècle, cour et jardin',
    description: "Au cœur du centre historique de Rochefort, cet hôtel particulier construit en 1768 a conservé l'essentiel de son décor d'origine : boiseries, parquets à la française, cheminées en marbre et escalier de pierre à rampe en fer forgé.\n\nLe rez-de-chaussée s'ouvre sur une cour pavée et un jardin clos de murs. Il accueille une enfilade de réceptions de plus de 110 m², une salle à manger et une cuisine indépendante. Les étages distribuent six chambres, dont une suite parentale avec bureau, et quatre salles d'eau.\n\nInscrit au titre des monuments historiques, le bien a fait l'objet d'une restauration soignée de ses toitures et façades en 2019. Caves voûtées, dépendance aménageable sur cour.",
    atouts: ['jardin', 'cheminee', 'parquet', 'moulures', 'hauteur_plafond', 'cave', 'centre_ville', 'calme'],
    protection: 'inscrit_mh', epoque: 'xviiie', annee_construction: 1768, etat: 'bon_etat',
    adresse: 'Rue de la République', code_postal: '17300', ville: 'Rochefort', code_insee: '17299', quartier: 'Centre historique',
    lat: 45.936299, lng: -0.961157, affichage_adresse: 'zone',
    surface_habitable: 412, surface_terrain: 680, nb_pieces: 12, nb_chambres: 6, nb_sdb: 4, nb_niveaux: 3, nb_parkings: 2,
    exposition: 'sud', chauffage_type: 'individuel', chauffage_energie: 'gaz', taxe_fonciere: 4850,
    prix_fai: 1290000, honoraires_charge: 'acquereur', honoraires_ttc: 60000, copropriete: false,
    dpe_statut: 'realise', dpe_classe: 'D', ges_classe: 'D', dpe_conso: 198, ges_emission: 41,
    dpe_depenses_min: 5900, dpe_depenses_max: 8100, dpe_annee_prix: 2023, dpe_date: '2024-03-12',
    reference_interne: 'PG-T-2026-014', note_interne: 'Vendeurs disponibles le samedi matin pour les visites.',
  },
  {
    cle: 'arsenal', photos: ['arsenal-sejour', 'arsenal-vue', 'arsenal-facade'],
    legendes: ['Le séjour', 'Vue sur la Charente', 'La résidence'],
    statut: 'publiee', publie: 5,
    type_bien: 'appartement', titre: 'Appartement dans une résidence classée, vue sur la Charente',
    description: "Dans l'un des bâtiments historiques de l'arsenal, classé monument historique, cet appartement traversant de 96 m² offre une vue dégagée sur la Charente.\n\nIl se compose d'une entrée, d'un séjour de 38 m² sous 3,60 m de hauteur, d'une cuisine ouverte équipée, de deux chambres et d'une salle d'eau. Parquet de chêne, menuiseries restaurées dans le respect des prescriptions de l'architecte des bâtiments de France.\n\nRésidence sécurisée avec ascenseur, cave et place de stationnement privative.",
    atouts: ['vue_degagee', 'parquet', 'hauteur_plafond', 'cave', 'centre_ville'],
    protection: 'classe_mh', epoque: 'xviie', annee_construction: 1690, etat: 'renove',
    adresse: 'Quai de la Louisiane', code_postal: '17300', ville: 'Rochefort', code_insee: '17299', quartier: 'Arsenal',
    lat: 45.945677, lng: -0.958346, affichage_adresse: 'zone',
    surface_habitable: 96.4, surface_carrez: 94.2, nb_pieces: 4, nb_chambres: 2, nb_sdb: 1, etage: 2, nb_etages_immeuble: 3,
    ascenseur: true, nb_parkings: 1, exposition: 'traversant', chauffage_type: 'individuel', chauffage_energie: 'pompe_chaleur', taxe_fonciere: 1620,
    prix_fai: 385000, honoraires_charge: 'vendeur', copropriete: true, copro_nb_lots: 48, copro_charges_annuelles: 2400,
    dpe_statut: 'realise', dpe_classe: 'C', ges_classe: 'A', dpe_conso: 142, ges_emission: 4,
    dpe_depenses_min: 1050, dpe_depenses_max: 1480, dpe_annee_prix: 2023, dpe_date: '2025-06-02',
    reference_interne: 'PG-T-2026-017',
  },
  {
    cle: 'demeure', photos: ['demeure-facade', 'demeure-parc', 'demeure-salon'],
    legendes: ['La demeure', 'Le parc et la piscine', 'Le salon'],
    statut: 'publiee', publie: 20,
    type_bien: 'demeure', titre: 'Demeure de maître, parc et dépendances',
    description: "À l'entrée de Surgères, cette demeure de maître de 1872 se dresse au milieu d'un parc arboré de plus de 5 000 m², clos de murs.\n\nLa maison principale offre de beaux volumes : salon et salle à manger en enfilade, bibliothèque, cuisine avec office et cinq chambres. Les dépendances (ancienne écurie, chai et maison de gardien à rénover) ouvrent de nombreuses possibilités.\n\nPiscine chauffée, garage pour quatre voitures. Gare à 5 minutes.",
    atouts: ['parc', 'piscine', 'dependances', 'cheminee', 'parquet', 'calme', 'garage'],
    protection: 'aucune', epoque: 'xixe', annee_construction: 1872, etat: 'bon_etat',
    adresse: 'Rue Gambetta', code_postal: '17700', ville: 'Surgères', code_insee: '17434',
    lat: 46.108699, lng: -0.750859, affichage_adresse: 'commune',
    surface_habitable: 318, surface_terrain: 5200, nb_pieces: 9, nb_chambres: 5, nb_sdb: 3, nb_niveaux: 2, nb_parkings: 4,
    exposition: 'sud_ouest', chauffage_type: 'individuel', chauffage_energie: 'fioul', taxe_fonciere: 3100,
    prix_fai: 745000, honoraires_charge: 'acquereur', honoraires_ttc: 35000, copropriete: false,
    dpe_statut: 'realise', dpe_classe: 'E', ges_classe: 'F', dpe_conso: 285, ges_emission: 78,
    dpe_depenses_min: 7400, dpe_depenses_max: 10100, dpe_annee_prix: 2023, dpe_date: '2024-11-20',
    reference_interne: 'PG-T-2026-009',
  },
  {
    cle: 'rochelle', photos: ['rochelle-facade', 'rochelle-sejour', 'rochelle-patio'],
    legendes: ['Façade', 'Séjour', 'Le patio'],
    statut: 'sous_offre', publie: 30,
    type_bien: 'maison', titre: 'Maison de ville rénovée avec patio, près du Vieux-Port',
    description: "Entre le Vieux-Port et l'hôtel de ville, cette maison du XVIIIᵉ siècle a été entièrement rénovée par un architecte en 2022.\n\nSur trois niveaux, elle réunit un séjour ouvert sur un patio fleuri, une cuisine contemporaine, quatre chambres et deux salles de bains. Terrasse au dernier étage avec vue sur les toits et les tours.\n\nMatériaux nobles, pierre apparente et parquet ancien restauré. Un bien rare au cœur du site patrimonial remarquable.",
    atouts: ['terrasse', 'parquet', 'centre_ville', 'commerces', 'double_vitrage'],
    protection: 'spr', epoque: 'xviiie', etat: 'renove',
    adresse: 'Rue du Palais', code_postal: '17000', ville: 'La Rochelle', code_insee: '17300', quartier: 'Vieux-Port',
    lat: 46.159324, lng: -1.153698, affichage_adresse: 'zone',
    surface_habitable: 142, surface_terrain: 60, nb_pieces: 6, nb_chambres: 4, nb_sdb: 2, nb_niveaux: 3,
    exposition: 'sud', chauffage_type: 'individuel', chauffage_energie: 'gaz', taxe_fonciere: 2350,
    prix_fai: 890000, honoraires_charge: 'vendeur', copropriete: false,
    dpe_statut: 'realise', dpe_classe: 'B', ges_classe: 'B', dpe_conso: 88, ges_emission: 12,
    dpe_depenses_min: 1300, dpe_depenses_max: 1800, dpe_annee_prix: 2023, dpe_date: '2025-02-14',
    reference_interne: 'PG-T-2026-011',
  },
  {
    cle: 'logis', photos: ['logis-facade', 'logis-terrain'],
    legendes: ['Le logis', 'Le terrain'],
    statut: 'publiee', publie: 3,
    type_bien: 'maison', titre: 'Logis charentais du XVIIᵉ siècle à restaurer',
    description: "Sur un terrain de près de 1,2 hectare, ce logis charentais du XVIIᵉ siècle attend un projet de restauration à la hauteur de son caractère.\n\nLa maison de 246 m² conserve ses murs en pierre de taille, ses cheminées monumentales et une charpente remarquable. Nombreuses dépendances : grange, pigeonnier et fournil.\n\nUn cadre calme, à dix minutes de Rochefort. Travaux importants à prévoir, idéal pour un projet familial ou de chambres d'hôtes.",
    atouts: ['dependances', 'grenier', 'cheminee', 'calme', 'jardin'],
    protection: 'aucune', epoque: 'xviie', etat: 'a_renover',
    adresse: 'Rue de la Charre', code_postal: '17430', ville: 'Tonnay-Charente', code_insee: '17449',
    lat: 45.94397, lng: -0.889875, affichage_adresse: 'zone',
    surface_habitable: 246, surface_terrain: 11800, nb_pieces: 8, nb_chambres: 4, nb_sdb: 1, nb_niveaux: 2, nb_parkings: 3,
    exposition: 'sud_est', chauffage_type: 'individuel', chauffage_energie: 'bois', taxe_fonciere: 1480,
    prix_fai: 420000, honoraires_charge: 'acquereur', honoraires_ttc: 25000, copropriete: false,
    dpe_statut: 'realise', dpe_classe: 'F', ges_classe: 'F', dpe_conso: 372, ges_emission: 88,
    dpe_depenses_min: 6900, dpe_depenses_max: 9400, dpe_annee_prix: 2023, dpe_date: '2025-09-01',
    reference_interne: 'PG-T-2026-021',
  },
  {
    cle: 'bourgeois', photos: ['bourgeois-salon', 'bourgeois-facade'],
    legendes: ['Double séjour', "L'immeuble"],
    statut: 'vendue', publie: 50, vendu: 9,
    type_bien: 'appartement', titre: 'Appartement bourgeois, parquet et moulures',
    description: "Au premier étage d'un immeuble bourgeois du XIXᵉ siècle, appartement de 128 m² aux volumes généreux : parquet en point de Hongrie, moulures, cheminées d'époque.\n\nDouble séjour, cuisine indépendante, trois chambres et une salle de bains. Cave. Proche des commerces et du jardin de la Marine.",
    atouts: ['parquet', 'moulures', 'cheminee', 'cave', 'hauteur_plafond', 'centre_ville'],
    protection: 'aucune', epoque: 'xixe', etat: 'bon_etat',
    adresse: 'Rue Pierre Loti', code_postal: '17300', ville: 'Rochefort', code_insee: '17299', quartier: 'Centre-ville',
    lat: 45.936252, lng: -0.9623, affichage_adresse: 'zone',
    surface_habitable: 128, surface_carrez: 124.5, nb_pieces: 5, nb_chambres: 3, nb_sdb: 1, etage: 1, nb_etages_immeuble: 3,
    ascenseur: false, chauffage_type: 'individuel', chauffage_energie: 'gaz', taxe_fonciere: 1900,
    prix_fai: 342000, honoraires_charge: 'vendeur', copropriete: true, copro_nb_lots: 12, copro_charges_annuelles: 1450,
    dpe_statut: 'realise', dpe_classe: 'D', ges_classe: 'E', dpe_conso: 215, ges_emission: 49,
    dpe_depenses_min: 2100, dpe_depenses_max: 2900, dpe_annee_prix: 2023, dpe_date: '2024-05-10',
    reference_interne: 'PG-T-2025-088',
  },
  {
    cle: 'chateau', photos: ['chateau-facade'], legendes: [''],
    statut: 'brouillon',
    type_bien: 'chateau', titre: 'Château du XIXᵉ siècle et son parc de 4 hectares',
    description: 'Château du XIXᵉ siècle au milieu d\'un parc de 4 hectares, près de Saint-Savinien. Texte à compléter après la visite technique.',
    atouts: ['parc', 'dependances'], protection: 'aucune', epoque: 'xixe',
    adresse: 'Impasse du Château', code_postal: '17350', ville: 'Saint-Savinien', code_insee: '17397',
    lat: 45.884088, lng: -0.700426, affichage_adresse: 'commune',
    surface_habitable: 780, surface_terrain: 40000, nb_pieces: 22, nb_chambres: 11,
    prix_fai: 1850000,
    reference_interne: 'PG-T-2026-023', note_interne: 'Attente du DPE (rendez-vous diagnostiqueur le 14).',
  },
];

const CODES = [
  { code: CODE_DEMO, civilite: 'monsieur', nom: 'Jean Dupont', email: 'jean.dupont@exemple.fr', tel: '06 12 34 56 78',
    note: 'Recherche une maison de caractère, budget 1,3 M€.', mois: 3, cree: 8, par: 1 },
  { civilite: 'madame', nom: 'Hélène Martin', email: 'helene.martin@exemple.fr', mois: 3, cree: 4, par: 2,
    note: 'Rencontrée au salon du patrimoine.' },
  { civilite: 'monsieur', nom: 'Pierre Garnier', tel: '06 98 76 54 32', mois: 1, cree: 1, par: 2 },
  { civilite: 'madame', nom: 'Sophie Leroy', email: 'sophie.leroy@exemple.fr', expire: 10, cree: 70, par: 1 },
  { civilite: 'monsieur', nom: 'Marc Bernard', mois: 3, cree: 25, par: 1, revoque: 15, motif: 'Projet abandonné' },
];

// [code (index), événement, bien (clé ou null), il y a (jours), appareil]
const HISTORIQUE = [
  [0, 'connexion', null, 6.2, 'a'], [0, 'fiche', 'hotel', 6.19, 'a'], [0, 'fiche', 'arsenal', 6.18, 'a'],
  [0, 'connexion', null, 2.1, 'b'], [0, 'fiche', 'hotel', 2.09, 'b'], [0, 'contact_tel', 'hotel', 2.08, 'b'],
  [0, 'fiche', 'demeure', 0.9, 'a'],
  [1, 'connexion', null, 3.3, 'c'], [1, 'fiche', 'rochelle', 3.29, 'c'], [1, 'fiche', 'logis', 3.27, 'c'],
  [1, 'contact_mail', 'logis', 3.26, 'c'],
  [3, 'connexion', null, 40, 'd'], [3, 'fiche', 'bourgeois', 39.9, 'd'],
  [4, 'connexion', null, 20, 'e'], [4, 'fiche', 'hotel', 19.9, 'e'],
];

async function insererAnnonce(def, adminId) {
  const colonnes = Object.keys(def).filter((k) =>
    !['cle', 'photos', 'legendes', 'publie', 'vendu', 'statut'].includes(k));
  const valeurs = colonnes.map((c) => (c === 'atouts' ? JSON.stringify(def[c]) : def[c]));
  const marques = colonnes.map((c, i) => (c === 'atouts' ? `$${i + 1}::jsonb` : `$${i + 1}`));
  const n = colonnes.length;
  const pub = sec.identifiantPublic();
  // Position « zone » décalée une fois, comme le fait l'éditeur.
  const { positionDecalee } = require('../../api/_lib/annonces');
  const p = positionDecalee(def.lat, def.lng);
  const a = await db.une(
    `insert into annonces (${colonnes.join(', ')}, pub_id, statut, publie_le, vendu_le, lat_pub, lng_pub, cree_par, modifie_par, cree_le, modifie_le)
     values (${marques.join(', ')}, $${n + 1}, $${n + 2}, $${n + 3}, $${n + 4}, $${n + 5}, $${n + 6}, $${n + 7}, $${n + 7}, $${n + 8}, $${n + 9})
     returning id, pub_id`,
    valeurs.concat([pub, def.statut, def.publie ? jours(def.publie) : null, def.vendu ? jours(def.vendu) : null,
      p.lat, p.lng, adminId, jours((def.publie || 1) + 2), jours(def.vendu || def.publie || 0.2)]));
  for (let i = 0; i < def.photos.length; i++) {
    const nom = def.photos[i];
    const grande = fs.readFileSync(path.join(PHOTOS, `${nom}-g.jpg`));
    const mini = fs.readFileSync(path.join(PHOTOS, `${nom}-m.jpg`));
    const base = `biens/${a.pub_id}/${nom}`;
    const url = await stockage.deposer(`${base}-g.jpg`, grande, 'image/jpeg');
    const urlMini = await stockage.deposer(`${base}-m.jpg`, mini, 'image/jpeg');
    await db.requete(
      `insert into photos (annonce_id, position, url, url_mini, largeur, hauteur, octets, legende)
       values ($1, $2, $3, $4, 1600, 1067, $5, $6)`, [a.id, i, url, urlMini, grande.length, def.legendes[i] || null]);
  }
  return a;
}

async function peuplerSiVide(log, options = {}) {
  const r = await db.une('select count(*)::int as n from admins');
  if (r.n > 0) return false;
  log('Première ouverture : création des données de démonstration...');
  const hash = await sec.hacherMotDePasse(options.mdp || MDP_DEMO);
  const direction = await db.une(
    `insert into admins (email, nom, mdp_hash, doit_changer_mdp, derniere_connexion) values ($1, $2, $3, false, $4) returning id`,
    ['direction@demo.petragest.local', 'Direction Petra Gest', hash, jours(1)]);
  const catherine = await db.une(
    `insert into admins (email, nom, mdp_hash, doit_changer_mdp, derniere_connexion) values ($1, $2, $3, false, $4) returning id`,
    ['catherine@demo.petragest.local', 'Catherine Badet', hash, jours(2)]);
  const admins = { 1: direction.id, 2: catherine.id };

  const annonces = {};
  for (const def of ANNONCES) annonces[def.cle] = await insererAnnonce(def, def.cle === 'arsenal' ? catherine.id : direction.id);

  const codes = [];
  for (const c of CODES) {
    const expire = c.expire ? dates.finDeJourneeParis(dates.jourParis(new Date(Date.now() - c.expire * 86400000)))
      : dates.dansMoisParis(c.mois, new Date(Date.now() - c.cree * 86400000));
    let code = c.code;
    if (!code) { const { generer } = require('../../api/_lib/codes'); code = generer(); }
    const v = await db.une(
      `insert into vouchers (code, civilite, beneficiaire_nom, beneficiaire_email, beneficiaire_tel, note, expire_le,
                             revoque_le, revoque_par, motif_revocation, cree_par, cree_le)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id`,
      [code, c.civilite, c.nom, c.email || null, c.tel || null, c.note || null, expire.toISOString(),
        c.revoque ? jours(c.revoque) : null, c.revoque ? admins[c.par] : null, c.motif || null, admins[c.par], jours(c.cree)]);
    codes.push(v.id);
  }
  for (const [i, evt, cle, il_y_a, appareil] of HISTORIQUE) {
    await db.requete(
      `insert into consultations (voucher_id, annonce_id, evenement, ip_empreinte, cree_le) values ($1, $2, $3, $4, $5)`,
      [codes[i], cle ? annonces[cle].id : null, evt, `demo00000000000${appareil}`, jours(il_y_a)]);
  }
  await db.requete(
    `update vouchers v set nb_connexions = s.n, premiere_utilisation = s.premiere, derniere_utilisation = s.derniere
       from (select voucher_id, count(*) filter (where evenement = 'connexion')::int as n,
                    min(cree_le) as premiere, max(cree_le) as derniere
               from consultations group by voucher_id) s
      where v.id = s.voucher_id`);
  log(`Démonstration prête : ${ANNONCES.length} biens, ${CODES.length} codes d'accès.`);
  return true;
}

// Compte de connexion rapide pour les démonstrations : identifiant « admin », mot de passe « admin ».
// Uniquement dans une base de démonstration locale (présence des comptes @demo.petragest.local) ;
// le serveur local n'écoute que 127.0.0.1. En ligne, ce compte n'existe pas : les vrais comptes passent
// par scripts/creer-admin.js (e-mail obligatoire, mot de passe de 12 caractères minimum).
async function assurerCompteRapide(log) {
  if (process.env.VERCEL) return false;
  const demo = await db.une("select 1 as oui from admins where email like '%@demo.petragest.local' limit 1");
  if (!demo) return false;
  const existe = await db.une("select id from admins where email = 'admin'");
  if (existe) return false;
  await db.requete(
    `insert into admins (email, nom, mdp_hash, doit_changer_mdp) values ('admin', 'Administrateur', $1, false)`,
    [await sec.hacherMotDePasse('admin')]);
  log('Compte de démonstration rapide ajouté (voir README).');
  return true;
}

module.exports = { peuplerSiVide, assurerCompteRapide, CODE_DEMO, MDP_DEMO };
