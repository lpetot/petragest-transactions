'use strict';
// Test de bout en bout de l'API, contre le vrai serveur local (base PGlite en mémoire, données de démonstration).
process.env.SESSION_SECRET = 's'.repeat(40);
process.env.IP_SECRET = 'i'.repeat(40);
process.env.CRON_SECRET = 'c'.repeat(40);

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { demarrer } = require('../scripts/dev.js');

let base, serveur, stockage, db;
let ipCompteur = 1;
const ADMIN = { email: 'direction@demo.petragest.local', mdp: 'Demo-Petra-2026!' };

// Petit client HTTP : chaque « session » garde ses cookies et une adresse IP distincte.
function session() {
  const jar = {};
  const ip = `10.0.0.${ipCompteur++}`;
  async function appel(methode, chemin, corps, options = {}) {
    const entetes = { 'x-forwarded-for': ip, cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') };
    if (options.origine !== false) entetes.origin = base;
    let body;
    if (options.binaire) { body = options.binaire; entetes['content-type'] = 'application/octet-stream'; Object.assign(entetes, options.entetes || {}); }
    else if (corps !== undefined) { body = JSON.stringify(corps); entetes['content-type'] = 'application/json'; }
    const r = await fetch(base + chemin, { method: methode, headers: entetes, body, redirect: 'manual' });
    for (const c of r.headers.getSetCookie()) {
      const [paire] = c.split(';');
      const i = paire.indexOf('=');
      const nom = paire.slice(0, i); const val = paire.slice(i + 1);
      if (/Max-Age=0/.test(c)) delete jar[nom]; else jar[nom] = val;
    }
    const texte = await r.text();
    let json = null;
    try { json = texte ? JSON.parse(texte) : null; } catch { json = texte; }
    return { statut: r.status, json, entetes: r.headers, setCookie: r.headers.getSetCookie() };
  }
  return { appel, jar, ip };
}

async function connecterAdmin(s, id = ADMIN) {
  const r = await s.appel('POST', '/api/admin/session', { email: id.email, mdp: id.mdp });
  assert.equal(r.statut, 200, JSON.stringify(r.json));
  return r;
}

const JPEG = (n) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(n)]);
async function ajouterPhoto(s, id) {
  const grande = JPEG(500); const mini = JPEG(200);
  return s.appel('POST', `/api/admin/annonces/${id}/photos`, undefined, {
    binaire: Buffer.concat([grande, mini]),
    entetes: { 'x-taille-grande': String(grande.length), 'x-largeur': '1600', 'x-hauteur': '1067' },
  });
}

const COMPLETE = {
  type_bien: 'maison', titre: 'Maison de test', description: 'Description de test.', adresse: '1 rue du Test',
  code_postal: '17300', ville: 'Rochefort', lat: 45.94, lng: -0.96, prix_fai: 500000, honoraires_charge: 'acquereur',
  honoraires_ttc: 25000, surface_habitable: 120, copropriete: false, dpe_statut: 'realise', dpe_classe: 'C', ges_classe: 'B',
  dpe_depenses_min: 1000, dpe_depenses_max: 1400, dpe_annee_prix: 2023, dpe_date: '2025-01-15',
  numero_mandat: '2026-T01', reference_interne: 'REF-INTERNE-XYZ', note_interne: 'NOTE-INTERNE-XYZ',
};

test.before(async () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'petra-test-'));
  const r = await demarrer({ port: 0, memoire: true, silencieux: true, dossierStockage: dossier });
  serveur = r.serveur; stockage = r.stockage;
  base = `http://localhost:${r.port}`;
  db = require('../api/_lib/db');
});
test.after(() => { serveur.close(); });

test('accès visiteur : format, code inconnu, origine, code valide et cookie', async () => {
  const s = session();
  assert.deepEqual((await s.appel('GET', '/api/acces')).json.connecte, false);
  let r = await s.appel('POST', '/api/acces', { code: 'abc' });
  assert.equal(r.statut, 400); assert.equal(r.json.erreur, 'format');
  r = await s.appel('POST', '/api/acces', { code: '2222-2222-2222' });
  assert.equal(r.statut, 401); assert.equal(r.json.erreur, 'inconnu');
  r = await s.appel('POST', '/api/acces', { code: 'PETRAGEST26X' }, { origine: false });
  assert.equal(r.statut, 403, 'une écriture sans en-tête Origin est refusée');
  r = await s.appel('POST', '/api/acces', { code: 'petr-ages-t26x' });
  assert.equal(r.statut, 200);
  assert.equal(r.json.nom, 'Jean Dupont');
  const c = r.setCookie.find((x) => x.startsWith('pg_acces='));
  assert.match(c, /HttpOnly/); assert.match(c, /SameSite=Strict/); assert.match(c, /Path=\//);
  assert.equal((await s.appel('GET', '/api/acces')).json.connecte, true);
});

test('frein aux essais répétés : 429 après 8 échecs depuis la même adresse', async () => {
  const s = session();
  for (let i = 0; i < 8; i++) {
    const r = await s.appel('POST', '/api/acces', { code: `2222-2222-22${String(i).padStart(2, '3').replace(/[01]/g, '3')}` });
    assert.equal(r.statut, 401);
  }
  const r = await s.appel('POST', '/api/acces', { code: 'PETRAGEST26X' });
  assert.equal(r.statut, 429);
  assert.equal(r.entetes.get('retry-after'), '900');
  // Une autre adresse n'est pas bloquée.
  assert.equal((await session().appel('POST', '/api/acces', { code: 'PETRAGEST26X' })).statut, 200);
});

test('catalogue : visible avec un code, sans données internes ; refusé sans code', async () => {
  assert.equal((await session().appel('GET', '/api/biens')).statut, 401);
  const s = session();
  await s.appel('POST', '/api/acces', { code: 'PETRAGEST26X' });
  const r = await s.appel('GET', '/api/biens');
  assert.equal(r.statut, 200);
  assert.equal(r.json.biens.length, 6, '5 en ligne ou sous offre + 1 vendu récent ; le brouillon est exclu');
  const texte = JSON.stringify(r.json);
  for (const interdit of ['reference_interne', 'note_interne', 'PG-T-2026', '"lat"', 'adresse']) assert.equal(texte.includes(interdit), false, interdit);
  const fiche = await s.appel('GET', '/api/biens?id=' + r.json.biens[0].id);
  assert.equal(fiche.statut, 200);
  const t2 = JSON.stringify(fiche.json);
  assert.equal(t2.includes('PG-T-2026') || t2.includes('Vendeurs disponibles'), false);
  assert.equal((await s.appel('GET', '/api/biens?id=zzzzzzzzzz')).statut, 404);
  assert.equal((await s.appel('GET', '/api/biens?id=../../etc')).statut, 404);
});

test('admin : connexion, mauvaise saisie, déconnexion qui invalide le cookie', async () => {
  const s = session();
  assert.equal((await s.appel('POST', '/api/admin/session', { email: ADMIN.email, mdp: 'faux-mot-de-passe' })).statut, 401);
  assert.equal((await s.appel('POST', '/api/admin/session', { email: 'inconnu@x.fr', mdp: 'faux-mot-de-passe' })).statut, 401);
  await connecterAdmin(s);
  const cookieAvant = s.jar.pg_admin;
  assert.equal((await s.appel('GET', '/api/admin/session')).json.email, ADMIN.email);
  assert.equal((await s.appel('DELETE', '/api/admin/session')).statut, 204);
  s.jar.pg_admin = cookieAvant; // on réutilise l'ancien cookie volé
  assert.equal((await s.appel('GET', '/api/admin/annonces')).statut, 401);
  assert.equal((await session().appel('GET', '/api/admin/annonces')).statut, 401);
  const s2 = session(); await connecterAdmin(s2);
  assert.equal((await s2.appel('GET', '/api/admin/nimporte')).statut, 404);
  assert.equal((await s2.appel('DELETE', '/api/admin/activite')).statut, 405);
});

test('annonce : validation, contrôle avant publication, photos, publication, visibilité', async () => {
  const s = session(); await connecterAdmin(s);
  const cree = await s.appel('POST', '/api/admin/annonces', {});
  assert.equal(cree.statut, 201);
  const id = cree.json.annonce.id;
  assert.match(id, /^[a-z0-9]{10}$/);

  let r = await s.appel('PATCH', `/api/admin/annonces/${id}`, { code_postal: '173', prix_fai: 'beaucoup' });
  assert.equal(r.statut, 422); assert.ok(r.json.champs.code_postal); assert.ok(r.json.champs.prix_fai);

  r = await s.appel('PATCH', `/api/admin/annonces/${id}`, { statut: 'publiee' });
  assert.equal(r.statut, 422); assert.equal(r.json.erreur, 'incomplet'); assert.ok(r.json.manquants.length > 5);

  r = await s.appel('PATCH', `/api/admin/annonces/${id}`, COMPLETE);
  assert.equal(r.statut, 200);
  assert.deepEqual(r.json.annonce.manquants, ['au moins une photo']);

  // Photo : un faux JPEG est refusé, un JPEG est accepté.
  const refus = await s.appel('POST', `/api/admin/annonces/${id}/photos`, undefined, {
    binaire: Buffer.alloc(900), entetes: { 'x-taille-grande': '600', 'x-largeur': '1600', 'x-hauteur': '1067' } });
  assert.equal(refus.statut, 400);
  const p1 = await ajouterPhoto(s, id); assert.equal(p1.statut, 201);
  const p2 = await ajouterPhoto(s, id); assert.equal(p2.statut, 201);
  assert.ok(fs.existsSync(stockage.cheminDe(p1.json.photo.url)), 'le fichier est bien stocké');

  // Ordre : liste incohérente refusée, ordre correct accepté.
  assert.equal((await s.appel('PUT', `/api/admin/annonces/${id}/photos/ordre`, { ordre: [p1.json.photo.id] })).statut, 409);
  r = await s.appel('PUT', `/api/admin/annonces/${id}/photos/ordre`, { ordre: [p2.json.photo.id, p1.json.photo.id] });
  assert.deepEqual(r.json.photos.map((p) => p.id), [p2.json.photo.id, p1.json.photo.id]);

  r = await s.appel('PATCH', `/api/admin/annonces/${id}`, { statut: 'publiee' });
  assert.equal(r.statut, 200); assert.equal(r.json.annonce.statut, 'publiee'); assert.ok(r.json.annonce.publie_le);

  // Une annonce en ligne doit rester complète.
  r = await s.appel('PATCH', `/api/admin/annonces/${id}`, { dpe_statut: null });
  assert.equal(r.statut, 422); assert.equal(r.json.erreur, 'incomplet');

  // Visible par un visiteur, position décalée, sans référence interne.
  const v = session(); await v.appel('POST', '/api/acces', { code: 'PETRAGEST26X' });
  const fiche = await v.appel('GET', '/api/biens?id=' + id);
  assert.equal(fiche.statut, 200);
  assert.notEqual(fiche.json.bien.localisation.position.lat, 45.94);
  assert.equal(fiche.json.bien.prix.net, 475000);
  assert.equal(JSON.stringify(fiche.json).includes('INTERNE-XYZ'), false);
  assert.equal(fiche.json.bien.reference, '2026-T01', 'le n° de mandat sert de référence publique');

  // La dernière photo d'une annonce en ligne ne peut pas être supprimée.
  assert.equal((await s.appel('DELETE', `/api/admin/photos/${p1.json.photo.id}`)).statut, 204);
  assert.equal((await s.appel('DELETE', `/api/admin/photos/${p2.json.photo.id}`)).statut, 409);

  // Vendu : visible avec la date de vente ; brouillon : invisible.
  r = await s.appel('PATCH', `/api/admin/annonces/${id}`, { statut: 'vendue' });
  assert.ok(r.json.annonce.vendu_le);
  r = await s.appel('PATCH', `/api/admin/annonces/${id}`, { statut: 'brouillon' });
  assert.equal(r.json.annonce.vendu_le, null);
  assert.equal((await v.appel('GET', '/api/biens?id=' + id)).statut, 404);
  // L'admin garde l'aperçu.
  const apercu = await s.appel('GET', '/api/biens?id=' + id);
  assert.equal(apercu.statut, 200); assert.equal(apercu.json.bien.apercu.statut, 'brouillon');
});

test('dupliquer puis supprimer la copie ne touche pas aux photos de l\'original', async () => {
  const s = session(); await connecterAdmin(s);
  const id = (await s.appel('POST', '/api/admin/annonces', {})).json.annonce.id;
  await s.appel('PATCH', `/api/admin/annonces/${id}`, COMPLETE);
  const photo = (await ajouterPhoto(s, id)).json.photo;
  const copie = await s.appel('POST', `/api/admin/annonces/${id}/dupliquer`, {});
  assert.equal(copie.statut, 201);
  assert.equal(copie.json.annonce.photos.length, 0);
  assert.equal(copie.json.annonce.titre, 'Maison de test (copie)');
  assert.equal(copie.json.annonce.statut, 'brouillon');
  const cid = copie.json.annonce.id;
  assert.equal((await s.appel('DELETE', `/api/admin/annonces/${cid}?definitif=1`)).statut, 409, 'corbeille d\'abord');
  assert.equal((await s.appel('DELETE', `/api/admin/annonces/${cid}`)).statut, 204);
  assert.equal((await s.appel('DELETE', `/api/admin/annonces/${cid}?definitif=1`)).statut, 204);
  assert.ok(fs.existsSync(stockage.cheminDe(photo.url)));
  // Corbeille puis restauration.
  await s.appel('DELETE', `/api/admin/annonces/${id}`);
  assert.equal((await s.appel('PATCH', `/api/admin/annonces/${id}`, { titre: 'x' })).statut, 409);
  assert.equal((await s.appel('POST', `/api/admin/annonces/${id}/restaurer`, {})).statut, 200);
  // Purge définitive : les fichiers disparaissent.
  await s.appel('DELETE', `/api/admin/annonces/${id}`);
  await s.appel('DELETE', `/api/admin/annonces/${id}?definitif=1`);
  assert.equal(fs.existsSync(stockage.cheminDe(photo.url)), false);
});

test('codes : création, révocation immédiate, expiration, suppression', async () => {
  const s = session(); await connecterAdmin(s);
  const cree = await s.appel('POST', '/api/admin/codes', { civilite: 'madame', nom: 'Test Révocation', email: 'test@exemple.fr', duree_mois: 1 });
  assert.equal(cree.statut, 201);
  const code = cree.json.code;
  assert.match(code.code_formate, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal((await s.appel('POST', '/api/admin/codes', { nom: '' })).statut, 422);
  assert.equal((await s.appel('POST', '/api/admin/codes', { nom: 'X', email: 'pas-un-mail' })).statut, 422);
  assert.equal((await s.appel('POST', '/api/admin/codes', { nom: 'X', duree_mois: 7 })).statut, 422);
  assert.equal((await s.appel('POST', '/api/admin/codes', { nom: 'X', expire_le: '2020-01-01' })).statut, 422);

  const v = session();
  assert.equal((await v.appel('POST', '/api/acces', { code: code.code })).statut, 200);
  assert.equal((await v.appel('GET', '/api/biens')).statut, 200);
  const rev = await s.appel('PATCH', `/api/admin/codes/${code.id}`, { revoquer: { motif: 'Test' } });
  assert.equal(rev.json.code.statut, 'revoque');
  const coupe = await v.appel('GET', '/api/biens');
  assert.equal(coupe.statut, 401); assert.equal(coupe.json.raison, 'revoque');
  assert.equal((await session().appel('POST', '/api/acces', { code: code.code })).json.erreur, 'revoque');
  await s.appel('PATCH', `/api/admin/codes/${code.id}`, { retablir: true });
  assert.equal((await session().appel('POST', '/api/acces', { code: code.code })).statut, 200);

  // Expiration réelle : on avance la date dans la base.
  await db.requete("update vouchers set expire_le = now() - interval '1 minute' where id = $1", [code.id]);
  const exp = await session().appel('POST', '/api/acces', { code: code.code });
  assert.equal(exp.statut, 403); assert.equal(exp.json.erreur, 'expire'); assert.match(exp.json.message, /a expiré le/);
  const pro = await s.appel('PATCH', `/api/admin/codes/${code.id}`, { prolonger_mois: 3 });
  assert.equal(pro.json.code.statut, 'actif');

  const detail = await s.appel('GET', `/api/admin/codes/${code.id}`);
  assert.ok(detail.json.historique.some((e) => e.evenement === 'connexion'));
  assert.equal((await s.appel('DELETE', `/api/admin/codes/${code.id}`)).statut, 204);
  assert.equal((await s.appel('GET', `/api/admin/codes/${code.id}`)).statut, 404);
});

test('export CSV des codes', async () => {
  const s = session(); await connecterAdmin(s);
  await s.appel('POST', '/api/admin/codes', { nom: 'Formule Piège', note: '=HYPERLINK("http://x")', duree_mois: 1 });
  const r = await s.appel('GET', '/api/admin/codes/export');
  assert.equal(r.statut, 200);
  assert.match(r.entetes.get('content-type'), /text\/csv/);
  assert.match(r.entetes.get('content-disposition'), /attachment; filename="codes-acces-\d{4}-\d{2}-\d{2}\.csv"/);
  assert.ok(r.json.includes('"\'=HYPERLINK(""http://x"")"'));
  // text() retire le BOM : on vérifie les octets bruts (EF BB BF), indispensables pour les accents dans Excel.
  const brut = Buffer.from(await (await fetch(base + '/api/admin/codes/export', {
    headers: { cookie: 'pg_admin=' + s.jar.pg_admin, 'x-forwarded-for': s.ip } })).arrayBuffer());
  assert.deepEqual([...brut.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
});

test('équipe : mot de passe provisoire à changer, garde-fous', async () => {
  const s = session(); await connecterAdmin(s);
  const r = await s.appel('POST', '/api/admin/equipe', { nom: 'Nouvelle Collègue', email: 'nouvelle@demo.petragest.local' });
  assert.equal(r.statut, 201);
  assert.equal((await s.appel('POST', '/api/admin/equipe', { nom: 'Doublon', email: 'NOUVELLE@demo.petragest.local' })).statut, 409);
  const moi = (await s.appel('GET', '/api/admin/session')).json;
  assert.equal((await s.appel('PATCH', `/api/admin/equipe/${moi.id}`, { actif: false })).statut, 409, 'pas de désactivation de soi-même');

  const n = session();
  const c = await connecterAdmin(n, { email: 'nouvelle@demo.petragest.local', mdp: r.json.mdp_temporaire });
  assert.equal(c.json.doit_changer_mdp, true);
  const bloque = await n.appel('GET', '/api/admin/annonces');
  assert.equal(bloque.statut, 403); assert.equal(bloque.json.erreur, 'changer_mdp');
  assert.equal((await n.appel('PATCH', '/api/admin/session', { actuel: r.json.mdp_temporaire, nouveau: 'court' })).statut, 422);
  assert.equal((await n.appel('PATCH', '/api/admin/session', { actuel: 'faux', nouveau: 'Un mot de passe assez long' })).statut, 422);
  assert.equal((await n.appel('PATCH', '/api/admin/session', { actuel: r.json.mdp_temporaire, nouveau: 'Un mot de passe assez long' })).statut, 200);
  assert.equal((await n.appel('GET', '/api/admin/annonces')).statut, 200);

  // Désactivation : l'accès est coupé aussitôt.
  assert.equal((await s.appel('PATCH', `/api/admin/equipe/${r.json.admin.id}`, { actif: false })).statut, 200);
  assert.equal((await n.appel('GET', '/api/admin/annonces')).statut, 401);
});

test('entretien planifié : protégé par secret, purge ce qui doit l\'être', async () => {
  assert.equal((await session().appel('GET', '/api/cron')).statut, 401);
  const r = await fetch(base + '/api/cron', { headers: { authorization: 'Bearer ' + 'c'.repeat(40) } });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.ok('annonces_purgees' in j.bilan && 'codes_anonymises' in j.bilan);
});

test('pages : adresses propres, en-têtes de sécurité, 404', async () => {
  let r = await fetch(base + '/biens.html', { redirect: 'manual' });
  assert.equal(r.status, 308); assert.equal(r.headers.get('location'), '/biens');
  r = await fetch(base + '/biens/', { redirect: 'manual' });
  assert.equal(r.status, 308);
  r = await fetch(base + '/biens');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(r.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  r = await fetch(base + '/page-qui-nexiste-pas');
  assert.equal(r.status, 404);
  r = await fetch(base + '/api/biens');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  // Aucun script ni style en ligne dans les pages (CSP stricte sans 'unsafe-inline').
  for (const f of fs.readdirSync(path.join(__dirname, '..', 'public')).filter((x) => x.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
    assert.equal(/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), false, `script en ligne dans ${f}`);
    assert.equal(/<style/i.test(html) || /\sstyle="/i.test(html), false, `style en ligne dans ${f}`);
  }
});

test('accès libre (ACCES_LIBRE=1) : catalogue et fiches sans code, codes toujours acceptés ; coupé, le code redevient obligatoire', async () => {
  process.env.ACCES_LIBRE = '1';
  try {
    const anonyme = session();
    const etat = (await anonyme.appel('GET', '/api/acces')).json;
    assert.equal(etat.connecte, true);
    assert.equal(etat.libre, true);
    assert.equal(etat.nom, undefined, 'aucun profil nominatif sans code');
    const r = await anonyme.appel('GET', '/api/biens');
    assert.equal(r.statut, 200);
    assert.equal(r.json.biens.length, 6, 'mêmes biens qu\'avec un code ; le brouillon reste exclu');
    const texte = JSON.stringify(r.json);
    for (const interdit of ['reference_interne', 'note_interne', '"lat"', 'adresse']) assert.equal(texte.includes(interdit), false, interdit);
    const fiche = await anonyme.appel('GET', '/api/biens?id=' + r.json.biens[0].id);
    assert.equal(fiche.statut, 200);
    assert.equal(fiche.json.bien.apercu, undefined);
    // Un détenteur de code garde son accès nominatif.
    const avecCode = session();
    assert.equal((await avecCode.appel('POST', '/api/acces', { code: 'PETRAGEST26X' })).statut, 200);
    assert.equal((await avecCode.appel('GET', '/api/acces')).json.nom, 'Jean Dupont');
  } finally {
    delete process.env.ACCES_LIBRE;
  }
  assert.equal((await session().appel('GET', '/api/biens')).statut, 401);
  assert.equal((await session().appel('GET', '/api/acces')).json.connecte, false);
});

test('pages : police servie par le site, plus aucun appel à Google ; barème renvoyé vers le site Petra Gest', async () => {
  const dossier = path.join(__dirname, '..', 'public');
  for (const nom of fs.readdirSync(dossier).filter((f) => f.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(dossier, nom), 'utf8');
    assert.equal(/fonts\.(googleapis|gstatic)\.com/.test(html), false, nom);
    assert.equal(html.includes('href="/honoraires"'), false, nom);
  }
  const csp = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8')).headers[0].headers
    .find((x) => x.key === 'Content-Security-Policy').value;
  assert.match(csp, /font-src 'self'/);
  assert.equal(/google/.test(csp), false);
  const bien = fs.readFileSync(path.join(dossier, 'assets', 'js', 'bien.js'), 'utf8');
  assert.match(bien, /'Consulter nos honoraires'/);
  assert.match(bien, /https:\/\/petragest\.com\/honoraires\//);
});

// ---------------------------------------------------------------------
// Lot 1 de la réunion avec Catherine (28/10/2026) : n° de mandat, DPE en PDF, mention RSAC.
// ---------------------------------------------------------------------
async function annonceEnLigne(s, champs) {
  const id = (await s.appel('POST', '/api/admin/annonces', {})).json.annonce.id;
  assert.equal((await s.appel('PATCH', `/api/admin/annonces/${id}`, Object.assign({}, COMPLETE, champs))).statut, 200);
  assert.equal((await ajouterPhoto(s, id)).statut, 201);
  return id;
}

test('n° de mandat : exigé pour mettre en ligne, toléré sur une annonce déjà en ligne, ni effaçable ni recopié', async () => {
  const s = session(); await connecterAdmin(s);
  const id = await annonceEnLigne(s, { numero_mandat: null });
  const A = require('../api/_lib/annonces');

  // Sans n° de mandat, la mise en ligne est refusée.
  let r = await s.appel('PATCH', `/api/admin/annonces/${id}`, { statut: 'publiee' });
  assert.equal(r.statut, 422); assert.deepEqual(r.json.manquants, [A.MANQUE_MANDAT]);

  // Annonce mise en ligne avant la règle (cas des 3 lots du Bâtiment C) : elle reste modifiable,
  // l'éditeur et l'accueil réclament le numéro.
  await db.requete("update annonces set statut = 'publiee', publie_le = now() where pub_id = $1", [id]);
  r = await s.appel('PATCH', `/api/admin/annonces/${id}`, { copro_charges_annuelles: null, titre: 'Titre corrigé' });
  assert.equal(r.statut, 200, JSON.stringify(r.json));
  assert.deepEqual(r.json.annonce.manquants, [A.MANQUE_MANDAT]);
  const accueil = await s.appel('GET', '/api/admin/activite');
  assert.ok(accueil.json.avertissements.some((t) => /numéro de mandat/.test(t)), JSON.stringify(accueil.json.avertissements));
  // Mais les autres obligations restent bloquantes.
  assert.equal((await s.appel('PATCH', `/api/admin/annonces/${id}`, { dpe_statut: null })).statut, 422);

  // Une fois saisi, il devient la référence publique et ne peut plus être effacé tant que l'annonce est en ligne.
  r = await s.appel('PATCH', `/api/admin/annonces/${id}`, { numero_mandat: '  2026-099 ' });
  assert.equal(r.statut, 200); assert.equal(r.json.annonce.numero_mandat, '2026-099'); assert.deepEqual(r.json.annonce.manquants, []);
  assert.equal((await s.appel('PATCH', `/api/admin/annonces/${id}`, { numero_mandat: '' })).statut, 422);
  const liste = await s.appel('GET', '/api/admin/annonces');
  assert.equal(liste.json.annonces.find((x) => x.id === id).numero_mandat, '2026-099');
  const v = session(); await v.appel('POST', '/api/acces', { code: 'PETRAGEST26X' });
  const fiche = await v.appel('GET', '/api/biens?id=' + id);
  assert.equal(fiche.json.bien.reference, '2026-099');
  assert.equal(JSON.stringify(fiche.json).includes('REF-INTERNE-XYZ'), false, 'la référence interne reste privée');

  // Un autre bien a son propre mandat : la copie ne le reprend pas.
  const copie = await s.appel('POST', `/api/admin/annonces/${id}/dupliquer`);
  assert.equal(copie.statut, 201); assert.equal(copie.json.annonce.numero_mandat, null);
  assert.ok(copie.json.annonce.manquants.includes(A.MANQUE_MANDAT));
});

test('DPE en PDF : contrôle du fichier, ajout, remplacement, visible des acquéreurs, épargné par l\'entretien, retrait', async () => {
  const s = session(); await connecterAdmin(s);
  const id = await annonceEnLigne(s, {});
  assert.equal((await s.appel('PATCH', `/api/admin/annonces/${id}`, { statut: 'publiee' })).statut, 200);
  const pdf = (n) => Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(n)]);
  const joindre = (octets) => s.appel('POST', `/api/admin/annonces/${id}/dpe`, undefined, { binaire: octets });

  let r = await joindre(Buffer.from('Ceci est une photo, pas un PDF.'));
  assert.equal(r.statut, 400); assert.match(r.json.message, /pas un PDF/);
  r = await joindre(pdf(4 * 1024 * 1024 + 10));
  assert.equal(r.statut, 413); assert.match(r.json.message, /4 Mo/);

  r = await joindre(pdf(2000));
  assert.equal(r.statut, 201);
  const premier = r.json.dpe_pdf.url;
  assert.match(premier, /\.pdf$/); assert.equal(r.json.dpe_pdf.octets, 2009);
  assert.ok(fs.existsSync(stockage.cheminDe(premier)));
  const servi = await fetch(base + premier);
  assert.equal(servi.status, 200); assert.match(servi.headers.get('content-type'), /application\/pdf/);

  const v = session(); await v.appel('POST', '/api/acces', { code: 'PETRAGEST26X' });
  assert.deepEqual((await v.appel('GET', '/api/biens?id=' + id)).json.bien.dpe.fichier, { url: premier, octets: 2009 });

  // Remplacement : le nouveau prend la place, l'ancien fichier est effacé.
  r = await joindre(pdf(3000));
  const second = r.json.dpe_pdf.url;
  assert.notEqual(second, premier);
  assert.equal(fs.existsSync(stockage.cheminDe(premier)), false);
  assert.equal((await s.appel('GET', `/api/admin/annonces/${id}`)).json.annonce.dpe_pdf.url, second);

  // L'entretien hebdomadaire efface les fichiers orphelins de plus de 24 h, jamais un DPE joint.
  const orphelin = await stockage.deposer(`biens/${id}/orphelin.pdf`, pdf(10), 'application/pdf');
  const vieux = new Date(Date.now() - 3 * 86400000);
  for (const u of [second, orphelin]) fs.utimesSync(stockage.cheminDe(u), vieux, vieux);
  const cron = await fetch(base + '/api/cron', { headers: { authorization: 'Bearer ' + 'c'.repeat(40) } });
  assert.equal(cron.status, 200);
  assert.ok(fs.existsSync(stockage.cheminDe(second)), 'le DPE joint est conservé');
  assert.equal(fs.existsSync(stockage.cheminDe(orphelin)), false, 'le fichier orphelin est effacé');

  // Retrait.
  assert.equal((await s.appel('DELETE', `/api/admin/annonces/${id}/dpe`)).statut, 204);
  assert.equal(fs.existsSync(stockage.cheminDe(second)), false);
  assert.equal((await v.appel('GET', '/api/biens?id=' + id)).json.bien.dpe.fichier, null);
});

test('mention RSAC : affichée sous le nom de l\'agent commercial une fois renseignée, réclamée sur l\'accueil sinon', async () => {
  const config = require('../api/_lib/config');
  const avant = config.contact.rsac;
  const s = session(); await connecterAdmin(s);
  const v = session(); await v.appel('POST', '/api/acces', { code: 'PETRAGEST26X' });
  const unBien = async () => {
    const id = (await v.appel('GET', '/api/biens')).json.biens[0].id;
    return (await v.appel('GET', '/api/biens?id=' + id)).json.bien;
  };
  try {
    config.contact.rsac = { greffe: '', numero: '' };
    let b = await unBien();
    assert.equal(b.contact.qualite, 'Agent commercial'); assert.equal(b.contact.rsac, null);
    assert.ok((await s.appel('GET', '/api/admin/activite')).json.avertissements.some((t) => /RSAC/.test(t)));

    config.contact.rsac = { greffe: 'La Rochelle', numero: '123 456 789' };
    b = await unBien();
    assert.equal(b.contact.rsac, 'RSAC de La Rochelle n° 123 456 789');
    assert.equal((await s.appel('GET', '/api/admin/activite')).json.avertissements.some((t) => /RSAC/.test(t)), false);
  } finally {
    config.contact.rsac = avant;
  }
});

test('environs : enregistrés pour la position actuelle seulement, visibles sur la fiche, effacés de la vue si l\'adresse change', async () => {
  const s = session(); await connecterAdmin(s);
  const id = await annonceEnLigne(s, {});
  assert.equal((await s.appel('PATCH', `/api/admin/annonces/${id}`, { statut: 'publiee' })).statut, 200);
  const { elements } = require('./donnees/overpass-rochefort.json');
  const envoyer = (pour) => s.appel('POST', `/api/admin/annonces/${id}/environs`, { pour, elements });

  let r = await envoyer('45.000000,-1.000000');
  assert.equal(r.statut, 409); assert.equal(r.json.erreur, 'position');
  r = await envoyer('45.940000,-0.960000');   // lat et lng de COMPLETE
  assert.equal(r.statut, 200, JSON.stringify(r.json));
  assert.equal(r.json.annonce.environs.a_jour, true);
  assert.ok(r.json.annonce.environs.categories.length >= 3);

  const v = session(); await v.appel('POST', '/api/acces', { code: 'PETRAGEST26X' });
  let bien = (await v.appel('GET', '/api/biens?id=' + id)).json.bien;
  assert.ok(bien.localisation.environs.some((c) => c.code === 'transports'));
  assert.equal(JSON.stringify(bien).includes('Docteur Exemple'), false);

  // Adresse déplacée : les anciens environs disparaissent de la fiche et l'éditeur sait qu'il faut relancer.
  r = await s.appel('PATCH', `/api/admin/annonces/${id}`, { lat: 45.95, lng: -0.97 });
  assert.equal(r.json.annonce.environs.a_jour, false);
  bien = (await v.appel('GET', '/api/biens?id=' + id)).json.bien;
  assert.equal(bien.localisation.environs, null);
});

test('fiche technique : enregistrée, jamais montrée aux acquéreurs, servie aux documents, recopiée sans le dossier interne', async () => {
  const s = session(); await connecterAdmin(s);
  const id = await annonceEnLigne(s, {});
  assert.equal((await s.appel('PATCH', `/api/admin/annonces/${id}`, { statut: 'publiee' })).statut, 200);
  const fiche = {
    pieces: [{ type: 'sejour', nom: 'Séjour', surface: 32.5, orientations: ['S'], sol: 'parquet', details: ['cheminee'] },
      { type: 'cuisine', surface: 11, details: ['equipee'] }],
    facade: 'Pierre', cadastre: 'Lot 417', mandat_type: 'exclusif',
    vendeur_noms: 'VENDEUR-SECRET', vendeur_email: 'vendeur@exemple.fr', plus: 'PLUS-SECRET', moins: 'MOINS-SECRET',
  };
  let r = await s.appel('PATCH', `/api/admin/annonces/${id}`, { fiche });
  assert.equal(r.statut, 200, JSON.stringify(r.json));
  assert.equal(r.json.annonce.fiche.pieces.length, 2);
  assert.equal(r.json.annonce.fiche.vendeur_noms, 'VENDEUR-SECRET');
  r = await s.appel('PATCH', `/api/admin/annonces/${id}`, { fiche: { pieces: [{ type: 'salon', surface: 'beaucoup' }] } });
  assert.equal(r.statut, 422); assert.match(r.json.champs.fiche, /Pièce 1/);

  // Côté acquéreur : rien de la fiche, ni dans la fiche du bien ni dans le catalogue.
  const v = session(); await v.appel('POST', '/api/acces', { code: 'PETRAGEST26X' });
  const vus = JSON.stringify((await v.appel('GET', '/api/biens?id=' + id)).json) + JSON.stringify((await v.appel('GET', '/api/biens')).json);
  for (const secret of ['VENDEUR-SECRET', 'PLUS-SECRET', 'MOINS-SECRET', 'Lot 417', 'vendeur@exemple.fr']) {
    assert.equal(vus.includes(secret), false, `${secret} visible des acquéreurs`);
  }

  // Documents : réservés à l'équipe ; l'annonce y est complète, avec l'agence et l'interlocutrice.
  assert.equal((await v.appel('GET', '/api/admin/documents?annonce=' + id)).statut, 401);
  r = await s.appel('GET', '/api/admin/documents?annonce=' + id);
  assert.equal(r.statut, 200);
  assert.equal(r.json.annonce.fiche.plus, 'PLUS-SECRET');
  assert.equal(r.json.agence.nom, 'Petra Gest');
  assert.match(r.json.contact.rsac, /^RSAC de /);
  assert.ok(r.json.textes.bonDeVisite.length >= 3);
  r = await s.appel('GET', '/api/admin/documents');
  assert.equal(r.statut, 200); assert.equal(r.json.annonce, null);
  assert.equal((await s.appel('GET', '/api/admin/documents?annonce=../../x')).statut, 404);
  assert.equal((await s.appel('GET', '/api/admin/documents?annonce=zzzzzzzzzz')).statut, 404);
  const page = await fetch(base + '/document');
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('x-robots-tag'), 'noindex, nofollow');

  // « Dupliquer » : pièces et bâtiment repris, mais ni vendeur, ni mandat, ni lot cadastral.
  const copie = (await s.appel('POST', `/api/admin/annonces/${id}/dupliquer`)).json.annonce;
  assert.equal(copie.fiche.pieces.length, 2);
  assert.equal(copie.fiche.facade, 'Pierre');
  for (const k of ['vendeur_noms', 'vendeur_email', 'mandat_type', 'cadastre', 'plus', 'moins']) assert.equal(k in copie.fiche, false, k);

  // Vidée, la fiche redevient un vrai NULL en base.
  r = await s.appel('PATCH', `/api/admin/annonces/${copie.id}`, { fiche: null });
  assert.equal(r.statut, 200); assert.equal(r.json.annonce.fiche, null);
  assert.equal((await db.une('select fiche is null as vide from annonces where pub_id = $1', [copie.id])).vide, true);
});

test('fiche technique et entretien : un brouillon commencé par sa fiche est gardé ; les coordonnées du vendeur s\'effacent 3 ans après la vente', async () => {
  const s = session(); await connecterAdmin(s);
  const { entretien } = require('../api/cron.js');
  // Brouillon dont seule la fiche est remplie (visite technique avant la rédaction de l'annonce).
  const brouillon = (await s.appel('POST', '/api/admin/annonces', {})).json.annonce.id;
  await s.appel('PATCH', `/api/admin/annonces/${brouillon}`, { fiche: { pieces: [{ type: 'sejour', surface: 20 }] } });
  await db.requete("update annonces set modifie_le = now() - interval '30 days' where pub_id = $1", [brouillon]);
  // Bien vendu il y a plus de 3 ans, avec un vendeur renseigné.
  const vendu = await annonceEnLigne(s, {});
  await s.appel('PATCH', `/api/admin/annonces/${vendu}`, { fiche: { facade: 'Pierre', vendeur_noms: 'ANCIEN-VENDEUR', vendeur_tel: '06 00 00 00 00' } });
  await db.requete("update annonces set statut = 'vendue', vendu_le = now() - interval '4 years', modifie_le = now() - interval '4 years' where pub_id = $1", [vendu]);
  const bilan = await entretien();
  assert.ok(bilan.vendeurs_effaces >= 1);
  assert.ok(await db.une('select 1 from annonces where pub_id = $1', [brouillon]), 'brouillon avec fiche supprimé à tort');
  const apres = await db.une('select fiche from annonces where pub_id = $1', [vendu]);
  assert.deepEqual(apres.fiche, { facade: 'Pierre' });
});
