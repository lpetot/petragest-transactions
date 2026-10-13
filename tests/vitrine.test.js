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
