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
  type_bien: 'maison', titre: 'Maison', description: 'Belle maison', ville: 'Rochefort', prix_fai: 500000,
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
  // Terrain : ni surface habitable ni DPE obligatoires si « non soumis ».
  assert.deepEqual(A.manquantsPourPublier({ ...complete, type_bien: 'terrain', surface_habitable: null, surface_terrain: 2000, dpe_statut: 'non_soumis' }, 1), []);
});

test('prix : pas de centime inventé, pourcentage calculé pour l\'affichage', () => {
  const p = A.prix({ prix_fai: 1260000, honoraires_charge: 'acquereur', honoraires_ttc: 60000 });
  assert.deepEqual(p, { fai: 1260000, charge: 'acquereur', honoraires_ttc: 60000, net: 1200000, pourcentage: 5 });
  assert.deepEqual(A.prix({ prix_fai: 385000, honoraires_charge: 'vendeur' }), { fai: 385000, charge: 'vendeur' });
  assert.equal(A.prix({ prix_fai: null }), null);
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
