#!/usr/bin/env node
'use strict';
// Sauvegarde hors de Vercel : écrit toute la base dans un fichier JSON local, avec la liste des photos.
// À lancer une fois par mois (MJ Data) :
//   node scripts/sauvegarder.js --env .env.production.local            (base en ligne)
//   node scripts/sauvegarder.js --env .env.production.local --photos   (télécharge aussi les photos)
// Le fichier contient des données personnelles : le ranger dans un endroit sûr, jamais dans le dépôt.

const fs = require('node:fs');
const path = require('node:path');
const { ouvrir, RACINE } = require('./local/connexion');

const TABLES = ['admins', 'annonces', 'photos', 'vouchers', 'consultations'];

(async () => {
  const c = await ouvrir();
  const db = require('../api/_lib/db');
  const jour = new Date().toISOString().slice(0, 10);
  const dossier = path.join(RACINE, 'sauvegardes', `petra-${jour}`);
  fs.mkdirSync(dossier, { recursive: true });
  const contenu = { cree_le: new Date().toISOString(), base: c.type, tables: {} };
  for (const t of TABLES) {
    contenu.tables[t] = await db.requete(`select * from ${t} order by id`);
    console.log(`${t} : ${contenu.tables[t].length} ligne(s)`);
  }
  fs.writeFileSync(path.join(dossier, 'base.json'), JSON.stringify(contenu, null, 1));
  if (process.argv.includes('--photos')) {
    const dossierPhotos = path.join(dossier, 'photos');
    fs.mkdirSync(dossierPhotos, { recursive: true });
    let n = 0;
    for (const p of contenu.tables.photos) {
      for (const url of [p.url, p.url_mini]) {
        if (!/^https:\/\//.test(url)) continue;
        const r = await fetch(url);
        if (!r.ok) { console.warn(`Photo introuvable : ${url}`); continue; }
        fs.writeFileSync(path.join(dossierPhotos, path.basename(new URL(url).pathname)), Buffer.from(await r.arrayBuffer()));
        n++;
      }
    }
    console.log(`${n} fichier(s) photo téléchargé(s).`);
  }
  console.log(`Sauvegarde écrite dans ${dossier}`);
  await c.fermer();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
