'use strict';
// Mode démonstration « site vitrine + espace transaction » du serveur local.
// Utilise un faux site vitrine fabriqué dans un dossier temporaire (jamais les fichiers de Laetitia).
process.env.SESSION_SECRET = 's'.repeat(40);
process.env.IP_SECRET = 'i'.repeat(40);
process.env.CRON_SECRET = 'c'.repeat(40);

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { demarrer } = require('../scripts/dev.js');

let r, vitrine, espace, dossierVitrine;

test.before(async () => {
  dossierVitrine = fs.mkdtempSync(path.join(os.tmpdir(), 'vitrine-'));
  fs.writeFileSync(path.join(dossierVitrine, 'index.html'), '<a href="acces-transaction.html">Accès transaction</a><section id="prestations"></section>');
  fs.writeFileSync(path.join(dossierVitrine, 'contact.html'), '<h1>Contact</h1>');
  fs.writeFileSync(path.join(dossierVitrine, 'acces-transaction.html'), '<p>ancienne page d\'attente</p>');
  r = await demarrer({ port: 0, memoire: true, silencieux: true, vitrine: dossierVitrine,
    dossierStockage: fs.mkdtempSync(path.join(os.tmpdir(), 'petra-test-')) });
  vitrine = `http://localhost:${r.portVitrine}`;
  espace = `http://localhost:${r.port}`;
});
test.after(() => { r.serveur.close(); });

test('le site vitrine est servi tel quel', async () => {
  let res = await fetch(vitrine + '/');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Accès transaction/);
  res = await fetch(vitrine + '/contact.html');
  assert.equal(res.status, 200);
  assert.equal((await fetch(vitrine + '/page-absente.html')).status, 404);
  assert.equal((await fetch(vitrine + '/../package.json')).status, 404);
});

test('« Accès transaction » mène à l\'espace, « Prestations » à la section de l\'accueil', async () => {
  for (const chemin of ['/acces-transaction.html', '/acces-transaction', '/acces-transaction/']) {
    const res = await fetch(vitrine + chemin, { redirect: 'manual' });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), espace + '/');
  }
  const res = await fetch(vitrine + '/prestations.html', { redirect: 'manual' });
  assert.equal(res.headers.get('location'), '/index.html#prestations');
});

test('les liens « petragest.com » de l\'espace pointent vers la vitrine locale', async () => {
  const html = await (await fetch(espace + '/')).text();
  assert.equal(html.includes('https://petragest.com'), false);
  assert.ok(html.includes(`href="${vitrine}"`));
  // L'espace fonctionne normalement.
  const acces = await fetch(espace + '/api/acces', { method: 'POST', headers: { origin: espace, 'content-type': 'application/json' }, body: JSON.stringify({ code: 'PETRAGEST26X' }) });
  assert.equal(acces.status, 200);
});

test('déploiement de démonstration : VITRINE_URL remplace les liens « petragest.com », sinon rien', () => {
  const { remplacerLiens, vitrineValide } = require('../scripts/liens-vitrine.js');
  const v = vitrineValide('https://petragest-vitrine.vercel.app/');
  assert.equal(v, 'https://petragest-vitrine.vercel.app');
  assert.equal(remplacerLiens('<a href="https://petragest.com">Site</a> direction@petragest.com', v),
    '<a href="https://petragest-vitrine.vercel.app">Site</a> direction@petragest.com');
  assert.equal(vitrineValide('javascript:alert(1)'), null);
  assert.equal(vitrineValide('http://exemple.fr'), null);
});

test('démonstration : le lien du barème (pages et script de la fiche) mène à la page Honoraires de la vitrine', () => {
  const { appliquer } = require('../scripts/liens-vitrine.js');
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'liens-'));
  try {
    fs.cpSync(path.join(__dirname, '..', 'public'), dossier, { recursive: true });
    appliquer(dossier, 'https://petragest-vitrine.vercel.app');
    const bien = fs.readFileSync(path.join(dossier, 'assets', 'js', 'bien.js'), 'utf8');
    assert.match(bien, /'https:\/\/petragest-vitrine\.vercel\.app\/honoraires\/'/);
    const catalogue = fs.readFileSync(path.join(dossier, 'biens.html'), 'utf8');
    assert.match(catalogue, /href="https:\/\/petragest-vitrine\.vercel\.app\/honoraires\/"/);
  } finally { fs.rmSync(dossier, { recursive: true, force: true }); }
});

test('scripts du navigateur : syntaxe valide (un script cassé vide la page sans erreur serveur)', () => {
  const { execFileSync } = require('node:child_process');
  const dossier = path.join(__dirname, '..', 'public', 'assets', 'js');
  for (const f of fs.readdirSync(dossier).filter((x) => x.endsWith('.js'))) {
    execFileSync(process.execPath, ['--check', path.join(dossier, f)], { stdio: 'pipe' });
  }
});
