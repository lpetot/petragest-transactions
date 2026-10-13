#!/usr/bin/env node
'use strict';
// Exécuté par Vercel à chaque déploiement (buildCommand de vercel.json).
// Si la variable VITRINE_URL est définie (démonstration : vitrine refaite publiée à part), les liens
// « https://petragest.com » des pages pointent vers elle, comme le fait « npm run dev » en local.
// Sans VITRINE_URL (vraie mise en ligne), rien n'est modifié.

const fs = require('node:fs');
const path = require('node:path');

const SITE = 'https://petragest.com';

function remplacerLiens(html, vitrine) {
  return html.split(SITE).join(vitrine);
}

function vitrineValide(valeur) {
  const v = String(valeur || '').trim().replace(/\/+$/, '');
  return /^https:\/\/[a-z0-9.-]+$/i.test(v) ? v : null;
}

function appliquer(dossier, vitrine) {
  let n = 0;
  for (const nom of fs.readdirSync(dossier)) {
    if (!nom.endsWith('.html')) continue;
    const fichier = path.join(dossier, nom);
    const avant = fs.readFileSync(fichier, 'utf8');
    const apres = remplacerLiens(avant, vitrine);
    if (apres !== avant) { fs.writeFileSync(fichier, apres); n++; }
  }
  return n;
}

if (require.main === module) {
  const brut = process.env.VITRINE_URL;
  if (!brut) {
    console.log('VITRINE_URL absente : liens vers petragest.com conservés.');
  } else {
    const vitrine = vitrineValide(brut);
    if (!vitrine) { console.error(`VITRINE_URL invalide : ${brut}`); process.exit(1); }
    const n = appliquer(path.join(__dirname, '..', 'public'), vitrine);
    console.log(`Liens « petragest.com » redirigés vers ${vitrine} dans ${n} page(s).`);
  }
}

module.exports = { remplacerLiens, vitrineValide };
