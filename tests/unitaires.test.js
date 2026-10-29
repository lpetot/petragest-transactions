'use strict';
// Tests unitaires des règles sensibles : codes, jetons, mots de passe, champs publics, prix, dates, export CSV.
process.env.SESSION_SECRET = 's'.repeat(40);
process.env.IP_SECRET = 'i'.repeat(40);

const test = require('node:test');
const assert = require('node:assert/strict');
const codes = require('../api/_lib/codes');
const sec = require('../api/_lib/securite');
const A = require('../api/_lib/annonces');
const dates = require('../api/_lib/dates');

test('codes : 1 000 codes uniques, 12 caractères, sans caractère ambigu', () => {
  const vus = new Set();
  for (let i = 0; i < 1000; i++) {
    const c = codes.generer();
    assert.match(c, /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{12}$/);
    assert.doesNotMatch(c, /[01ILOU]/);
    vus.add(c);
  }
  assert.equal(vus.size, 1000);
});

test('codes : la saisie tolère minuscules, espaces et tirets ; le reste est refusé', () => {
  assert.equal(codes.normaliser('petr-ages t26x'), 'PETRAGEST26X');
  assert.equal(codes.normaliser('PETRAGEST26X'), 'PETRAGEST26X');
  assert.equal(codes.normaliser('PETRAGEST26'), null);
  assert.equal(codes.normaliser('PETRAGEST26O'), null); // O interdit
  assert.equal(codes.normaliser(12), null);
  assert.equal(codes.normaliser('x'.repeat(100)), null);
  assert.equal(codes.formater('PETRAGEST26X'), 'PETR-AGES-T26X');
});

test('jetons : signature vérifiée, falsification et expiration refusées', () => {
  const t = Math.floor(Date.now() / 1000);
  const j = sec.signer({ k: 'v', id: 3, t });
  assert.deepEqual(sec.verifier(j, 'v', 3600), { k: 'v', id: 3, t });
  assert.equal(sec.verifier(j, 'a', 3600), null, 'un jeton visiteur ne vaut pas jeton admin');
  const [corps, sig] = j.split('.');
  const faux = Buffer.from(JSON.stringify({ k: 'v', id: 4, t })).toString('base64url') + '.' + sig;
  assert.equal(sec.verifier(faux, 'v', 3600), null, 'identifiant modifié');
  assert.equal(sec.verifier(corps + '.' + sig.slice(0, -2) + 'AA', 'v', 3600), null, 'signature modifiée');
  assert.equal(sec.verifier(sec.signer({ k: 'v', id: 3, t: t - 7200 }), 'v', 3600), null, 'expiré');
  assert.equal(sec.verifier('nimportequoi', 'v', 3600), null);
  assert.equal(sec.verifier(undefined, 'v', 3600), null);
});

test('mots de passe : scrypt, vérification exacte, sel différent à chaque fois', async () => {
  const h1 = await sec.hacherMotDePasse('La maison bleue de Rochefort');
  const h2 = await sec.hacherMotDePasse('La maison bleue de Rochefort');
  assert.notEqual(h1, h2);
  assert.ok(h1.startsWith('scrypt$32768$8$1$'));
  assert.equal(await sec.verifierMotDePasse('La maison bleue de Rochefort', h1), true);
  assert.equal(await sec.verifierMotDePasse('la maison bleue de rochefort', h1), false);
  assert.equal(await sec.verifierMotDePasse('x', 'pas-un-hash'), false);
  assert.match(sec.motDePasseTemporaire(), /^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/);
});

test('annonces : validation des champs (liste blanche, types, bornes)', () => {
  const { valeurs, erreurs } = A.valider({
    titre: '  Maison  ', prix_fai: '1 250 000', surface_habitable: '96,4', code_postal: '17300',
    atouts: ['jardin', 'jardin', 'cave'], ascenseur: true, inconnu: 'ignoré', dpe_date: '2025-02-30x',
  });
  assert.equal(valeurs.titre, 'Maison');
  assert.equal(valeurs.prix_fai, 1250000);
  assert.equal(valeurs.surface_habitable, 96.4);
  assert.deepEqual(valeurs.atouts, ['jardin', 'cave']);
  assert.equal('inconnu' in valeurs, false);
  assert.ok(erreurs.dpe_date);
  const r2 = A.valider({ code_postal: '173', type_bien: 'yacht', prix_fai: -5, atouts: ['licorne'], titre: 'x'.repeat(141) });
  assert.deepEqual(Object.keys(r2.erreurs).sort(), ['atouts', 'code_postal', 'prix_fai', 'titre', 'type_bien']);
  assert.deepEqual(A.valider({ titre: '', protection: null }).valeurs, { titre: '', protection: 'aucune' });
});

const complete = {
  type_bien: 'maison', titre: 'Maison', description: 'Belle maison', ville: 'Rochefort', prix_fai: 500000, numero_mandat: '2026-001',
  honoraires_charge: 'vendeur', surface_habitable: 120, copropriete: false,
  dpe_statut: 'realise', dpe_classe: 'C', ges_classe: 'B', dpe_depenses_min: 1000, dpe_depenses_max: 1400,
  dpe_annee_prix: 2023, dpe_date: '2024-05-01',
};

test('publication : une annonce complète passe, chaque oubli légal est signalé', () => {
  assert.deepEqual(A.manquantsPourPublier(complete, 1), []);
  assert.ok(A.manquantsPourPublier(complete, 0).some((m) => m.includes('photo')));
  assert.ok(A.manquantsPourPublier({ ...complete, dpe_statut: null }, 1).some((m) => m.includes('DPE')));
  assert.ok(A.manquantsPourPublier({ ...complete, dpe_date: '2021-03-01' }, 1).some((m) => m.includes('plus valable')), 'DPE périmé');
  assert.ok(A.manquantsPourPublier({ ...complete, copropriete: true }, 1).some((m) => m.includes('lots')));
  assert.ok(A.manquantsPourPublier({ ...complete, honoraires_charge: 'acquereur' }, 1).some((m) => m.includes('honoraires')));
  assert.ok(A.manquantsPourPublier({ ...complete, honoraires_charge: 'acquereur', honoraires_ttc: 600000 }, 1).some((m) => m.includes('inférieurs')));
  assert.ok(A.manquantsPourPublier({ ...complete, copropriete: null }, 1).some((m) => m.includes('copropriété')));
  assert.ok(A.manquantsPourPublier({ ...complete, numero_mandat: null }, 1).includes(A.MANQUE_MANDAT), 'n° de mandat');
  // Terrain : ni surface habitable ni DPE obligatoires si « non soumis ».
  assert.deepEqual(A.manquantsPourPublier({ ...complete, type_bien: 'terrain', surface_habitable: null, surface_terrain: 2000, dpe_statut: 'non_soumis' }, 1), []);
});

test('prix : pas de centime inventé, pourcentage calculé pour l\'affichage', () => {
  const p = A.prix({ prix_fai: 1260000, honoraires_charge: 'acquereur', honoraires_ttc: 60000 });
  assert.deepEqual(p, { fai: 1260000, charge: 'acquereur', honoraires_ttc: 60000, net: 1200000, pourcentage: 5 });
  assert.deepEqual(A.prix({ prix_fai: 385000, honoraires_charge: 'vendeur' }), { fai: 385000, charge: 'vendeur' });
  assert.equal(A.prix({ prix_fai: null }), null);
});

test('prix au m² : prix honoraires inclus sur la surface habitable (terrain pour un terrain), arrondi à l\'euro', () => {
  // Bâtiment C, lot C204 : 511 980 € pour 96,84 m².
  assert.equal(A.prix({ prix_fai: 511980, surface_habitable: 96.84, type_bien: 'appartement' }).m2, 5287);
  assert.equal(A.prix({ prix_fai: 90000, surface_terrain: 1200, surface_habitable: null, type_bien: 'terrain' }).m2, 75);
  assert.equal('m2' in A.prix({ prix_fai: 200000, surface_habitable: null }), false, 'pas de surface : pas de prix au m²');
  assert.equal('m2' in A.prix({ prix_fai: 200000, surface_habitable: 0 }), false);
  const pub = A.versPublic({ ...complete, statut: 'publiee', atouts: [], prix_fai: 511980, surface_habitable: 96.84 }, []);
  assert.equal(pub.prix.m2, 5287);
});

test('visiteur : aucune donnée interne ni coordonnée exacte dans la fiche publique', () => {
  const a = {
    ...complete, id: 42, pub_id: 'abcdefghij', statut: 'publiee', atouts: [], adresse: '12 rue Secrète',
    lat: 45.9363, lng: -0.9611, lat_pub: 45.938, lng_pub: -0.958, affichage_adresse: 'zone',
    reference_interne: 'PG-SECRET', note_interne: 'Vendeur pressé', cree_par: 1,
  };
  const pub = A.versPublic(a, []);
  const texte = JSON.stringify(pub);
  for (const interdit of ['PG-SECRET', 'Vendeur pressé', '12 rue Secrète', '45.9363', '-0.9611', 'reference_interne', 'note_interne', 'cree_par', '"42"']) {
    assert.equal(texte.includes(interdit), false, `fuite : ${interdit}`);
  }
  assert.deepEqual(pub.localisation.position, { lat: 45.938, lng: -0.958, precision: 'zone' });
  assert.equal(A.versPublic({ ...a, affichage_adresse: 'commune' }, []).localisation.position, null);
  const exacte = A.versPublic({ ...a, affichage_adresse: 'exacte' }, []);
  assert.equal(exacte.localisation.adresse, '12 rue Secrète');
  assert.equal(exacte.localisation.position.lat, 45.9363);
  const carte = JSON.stringify(A.versCarte(a));
  assert.equal(carte.includes('PG-SECRET') || carte.includes('45.9363'), false);
});

test('position décalée : entre 150 et 350 m du point réel', () => {
  for (let i = 0; i < 200; i++) {
    const p = A.positionDecalee(45.9363, -0.9611);
    const dy = (p.lat - 45.9363) * 111320;
    const dx = (p.lng + 0.9611) * 111320 * Math.cos(45.9363 * Math.PI / 180);
    const d = Math.hypot(dx, dy);
    assert.ok(d >= 145 && d <= 355, `distance ${d}`);
  }
});

test('dates : fin de journée à l\'heure de Paris, été comme hiver', () => {
  assert.equal(dates.finDeJourneeParis('2026-12-25').toISOString(), '2026-12-25T22:59:59.000Z');
  assert.equal(dates.finDeJourneeParis('2026-07-14').toISOString(), '2026-07-14T21:59:59.000Z');
  assert.equal(dates.jourParis(new Date('2026-10-01T22:30:00Z')), '2026-10-02');
  // 31 janvier + 1 mois → dernier jour de février
  assert.equal(dates.dansMoisParis(1, new Date('2027-01-31T10:00:00Z')).toISOString(), '2027-02-28T22:59:59.000Z');
  assert.equal(dates.formaterJour('2027-04-01T10:00:00Z'), '1er avril 2027');
});

test('export CSV : Excel français (;, BOM) et formules neutralisées', () => {
  const { celluleCsv, codesCsv } = require('../api/admin.js')._test;
  assert.equal(celluleCsv('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(celluleCsv('@SOMME(A1)'), '"\'@SOMME(A1)"');
  assert.equal(celluleCsv('-2+3'), '"\'-2+3"');
  assert.equal(celluleCsv('+33 6 12 34 56 78'), '"06 12 34 56 78"');
  assert.equal(celluleCsv(null), '""');
  const csv = codesCsv([{ id: 1, code: 'PETRAGEST26X', beneficiaire_nom: 'Jean ; Dupont', civilite: 'monsieur', note: '=cmd',
    expire_le: '2026-12-25T22:59:59Z', cree_le: '2026-09-01T10:00:00Z', nb_connexions: 2 }]);
  assert.ok(csv.startsWith('﻿"Bénéficiaire";'));
  assert.ok(csv.includes('"Jean ; Dupont"'));
  assert.ok(csv.includes('"\'=cmd"'));
  assert.ok(csv.includes('"PETR-AGES-T26X"'));
});

test('import Bâtiment C : données valides pour l\'éditeur, photos présentes, aucun tiret long', () => {
  const fs = require('node:fs'); const path = require('node:path');
  const A = require('../api/_lib/annonces');
  const dossier = path.join(__dirname, '..', 'scripts', 'import', 'batiment-c');
  const brut = fs.readFileSync(path.join(dossier, 'donnees.json'), 'utf8');
  assert.equal(/[–—]/.test(brut), false);
  const lots = JSON.parse(brut);
  assert.deepEqual(lots.map((l) => l.reference_interne.split(' ')[1]), ['C204', 'C301', 'C307']);
  for (const { photos, ...champs } of lots) {
    const { erreurs } = A.valider(champs);
    assert.equal(Object.keys(erreurs || {}).length, 0, JSON.stringify(erreurs));
    assert.equal(photos.length, 14);
    for (const p of photos) for (const s of ['g', 'm']) assert.ok(fs.existsSync(path.join(dossier, 'photos', `${p.nom}-${s}.jpg`)), p.nom);
  }
});

// ---------------------------------------------------------------------
// Lot 2 de la réunion avec Catherine (28/10/2026) : environs, atouts.
// ---------------------------------------------------------------------
test('environs : durées arrondies, à pied jusqu\'à 20 min puis en voiture', () => {
  const E = require('../public/assets/js/environs.js');
  assert.deepEqual(E.duree(100), { minutes: 5, mode: 'pied' });
  assert.deepEqual(E.duree(1150), { minutes: 20, mode: 'pied' });
  assert.deepEqual(E.duree(1200), { minutes: 10, mode: 'voiture' });
  assert.equal(E.texteDuree({ minutes: 15, mode: 'pied' }), '15 min à pied');
});

test('environs : classement d\'une vraie réponse OpenStreetMap (Arsenal Royal, Rochefort)', () => {
  const E = require('../public/assets/js/environs.js');
  const { elements } = require('./donnees/overpass-rochefort.json');
  const r = E.construire(elements, 45.942539, -0.957208, 'Rochefort');
  assert.deepEqual(r.categories.map((c) => c.code), ['transports', 'education', 'services', 'sante']);
  const tous = r.categories.flatMap((c) => c.lieux);
  const texte = JSON.stringify(r);
  assert.equal(texte.includes('Docteur Exemple'), false, 'jamais de nom de médecin ni de dentiste');
  assert.equal(texte.includes('metres'), false, 'pas de distance exacte (elle trahirait l\'adresse)');
  for (const l of tous) {
    assert.equal(l.minutes % 5, 0); assert.ok(l.minutes <= 30); assert.ok(['pied', 'voiture'].includes(l.mode));
  }
  const de = (code) => r.categories.find((c) => c.code === code).lieux;
  assert.ok(de('transports').some((l) => l.nom === 'Gare de Rochefort' && l.mode === 'pied'));
  const bus = de('transports').filter((l) => l.type === 'Arrêt de bus');
  assert.equal(bus.length, 2); assert.notEqual(bus[0].nom, bus[1].nom, 'un arrêt des deux côtés de la rue ne compte qu\'une fois');
  assert.ok(de('education').some((l) => l.type === 'Lycée'));
  assert.ok(de('services').some((l) => l.type === 'Mairie' && l.nom === 'Mairie de Rochefort'));
  assert.ok(de('services').some((l) => l.type === 'Bureau de poste' && l.nom === null), 'la poste « Rochefort » ne répète pas la commune');
  assert.equal(de('services').some((l) => l.type === 'Marché' && l.mode === 'voiture'), false);
  assert.ok(de('sante').some((l) => l.type === 'Médecin' && l.nom === null));
  assert.ok(de('sante').some((l) => l.type === 'Hôpital' && l.mode === 'voiture'));
  // Données reçues du navigateur : seules la position et quelques étiquettes passent.
  const propre = E.nettoyer([{ lat: 1, lon: 2, tags: { name: 'X', amenity: 'bank', phone: '0102030405' } }, { lat: 'a' }, null, { center: { lat: 3, lon: 4 } }]);
  assert.deepEqual(propre, [{ lat: 1, lng: 2, tags: { name: 'X', amenity: 'bank' } }, { lat: 3, lng: 4, tags: {} }]);
});

test('environs : visibles seulement pour l\'adresse enregistrée, jamais quand l\'annonce ne montre que la commune', () => {
  const a = {
    ...complete, pub_id: 'abcdefghij', statut: 'publiee', atouts: [], lat: 45.942539, lng: -0.957208, lat_pub: 45.94, lng_pub: -0.95,
    affichage_adresse: 'zone', environs: { categories: [{ code: 'sante', libelle: 'Santé', lieux: [{ type: 'Pharmacie', nom: 'P', minutes: 5, mode: 'pied', lat: 45.94, lng: -0.95 }] }] },
    environs_pour: '45.942539,-0.957208',
  };
  assert.equal(A.clePosition(a), '45.942539,-0.957208');
  assert.equal(A.versPublic(a, []).localisation.environs.length, 1);
  assert.equal(A.versPublic({ ...a, affichage_adresse: 'commune' }, []).localisation.environs, null);
  assert.equal(A.versPublic({ ...a, lat: 45.95 }, []).localisation.environs, null, 'adresse changée : on n\'affiche plus les anciens environs');
  assert.equal(A.versPublic({ ...a, environs: null }, []).localisation.environs, null);
});

test('atouts : chacun a sa tournure pour la phrase de la description, aucun tiret long', () => {
  const R = require('../public/assets/js/referentiel.js');
  for (const [code] of R.atouts) assert.ok(R.phrasesAtouts[code], `tournure manquante : ${code}`);
  assert.equal(/[–—]/.test(JSON.stringify(R.phrasesAtouts) + JSON.stringify(R.atouts)), false);
  assert.deepEqual(R.baremeVente.map((x) => x[0]), [6, 5]);
});

test('fiche technique : liste blanche, pièces normalisées, détails propres à chaque pièce, vide = NULL', () => {
  const F = require('../api/_lib/fiche');
  let r = F.valider({
    facade: '  Pierre  ', inconnu: 'x', mitoyennete: 'code_retire', equipements: ['alarme', 'disparu'],
    pieces: [
      { type: 'cuisine', nom: 'Cuisine', surface: '12,5', orientations: ['S', 'Z'], sol: 'parquet', details: ['equipee', 'baignoire', 'cheminee'], pirate: 1 },
      { type: 'type_retire', surface: 10 },
      { type: 'balcon', surface: 6, details: ['double_vitrage', 'clos'] },
    ],
  });
  assert.equal(r.erreur, undefined);
  assert.deepEqual(r.valeur, {
    facade: 'Pierre', equipements: ['alarme'],
    pieces: [
      { type: 'cuisine', nom: 'Cuisine', surface: 12.5, orientations: ['S'], sol: 'parquet', details: ['equipee', 'cheminee'] },
      { type: 'balcon', surface: 6, details: ['clos'] },
    ],
  });
  // Erreurs claires, avec le nom du champ ou le rang de la pièce.
  assert.match(F.valider({ plus: 'x'.repeat(1501) }).erreur, /^Les plus : 1500 caractères/);
  assert.match(F.valider({ pieces: [{ type: 'salon', surface: 'beaucoup' }] }).erreur, /^Pièce 1, surface/);
  assert.match(F.valider({ pieces: Array.from({ length: 61 }, () => ({ type: 'chambre' })) }).erreur, /60 pièces/);
  assert.match(F.valider({ bail_debut: '31/12/2026' }).erreur, /Date attendue/);
  assert.equal(F.valider('texte').erreur, 'Fiche technique illisible.');
  // Une fiche entièrement vidée redevient NULL.
  assert.deepEqual(F.valider({ facade: '', pieces: [] }), { valeur: null });
  assert.deepEqual(F.valider(null), { valeur: null });
  // Passe par la validation de l'annonce.
  const v = A.valider({ fiche: { toiture: 'Ardoise' } });
  assert.deepEqual(v.valeurs.fiche, { toiture: 'Ardoise' });
  assert.ok(A.valider({ fiche: { loyer_hc: -5 } }).erreurs.fiche);
});

test('fiche technique : jamais dans la fiche publique ; « Dupliquer » ne recopie ni vendeur, ni mandat, ni lot, ni location', () => {
  const F = require('../api/_lib/fiche');
  const fiche = {
    pieces: [{ type: 'sejour', surface: 30 }, { type: 'cave', surface: 12 }, { type: 'chambre', surface: 11.25 }],
    facade: 'Pierre', cadastre: 'AB 12, lot 417', loue: true, loyer_hc: 900,
    mandat_type: 'exclusif', vendeur_noms: 'VENDEUR-SECRET', vendeur_tel: '06 00 00 00 00', plus: 'PLUS-SECRET', moins: 'MOINS-SECRET',
  };
  const pub = JSON.stringify(A.versPublic({ fiche, statut: 'publiee', affichage_adresse: 'zone' }, []));
  for (const secret of ['VENDEUR-SECRET', 'PLUS-SECRET', 'MOINS-SECRET', 'lot 417', 'fiche', 'pieces']) {
    assert.equal(pub.includes(secret), false, `${secret} visible des acquéreurs`);
  }
  assert.equal(JSON.stringify(A.versCarte({ fiche })).includes('VENDEUR'), false);
  assert.deepEqual(F.pourDuplication(fiche), { pieces: fiche.pieces, facade: 'Pierre' });
  assert.equal(F.pourDuplication({ vendeur_noms: 'X' }), null);
  for (const k of F.INTERNES) assert.ok(F.NON_RECOPIES.includes(k), `${k} serait recopié`);
  // Surface des pièces : la cave ne compte pas dans l'habitable.
  assert.equal(F.surfacePieces(fiche), 41.25);
});

test('fiche technique : chaque pièce a un groupe de détails connu, libellés sans tiret long', () => {
  const R = require('../public/assets/js/referentiel.js');
  for (const [code, , habitable, groupe] of R.pieces) {
    assert.equal(typeof habitable, 'boolean', code);
    assert.ok(groupe === '' || R.detailsPieces[groupe], `groupe inconnu pour ${code}`);
  }
  assert.deepEqual(R.detailsPour('balcon').map((x) => x[0]), ['clos', 'arbore', 'sans_vis_a_vis', 'abrite']);
  assert.ok(R.detailsPour('salle_bains').some((x) => x[0] === 'baignoire') && R.detailsPour('salle_bains').some((x) => x[0] === 'double_vitrage'));
  const tout = JSON.stringify([R.pieces, R.detailsPieces, R.sols, R.equipementsFiche, R.typesBail, R.typesMandat, R.mitoyennetes]);
  assert.equal(/[–—]/.test(tout), false);
});
