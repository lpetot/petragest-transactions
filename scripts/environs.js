#!/usr/bin/env node
'use strict';
// « Découvrir les environs » pour les annonces qui ne l'ont pas encore (ou plus : adresse changée).
// L'espace de gestion le fait tout seul à chaque nouvelle adresse ; ce script sert au rattrapage.
//   En ligne : node scripts/environs.js --env .env.production.local
//   En local : node scripts/environs.js            (serveur local arrêté : la base est verrouillée)
//   --tout   : recalcule aussi les annonces déjà à jour.
// Interroge OpenStreetMap (Overpass) une seule fois par position, avec une pause entre deux appels.

const { ouvrir } = require('./local/connexion');
const ENVIRONS = require('../public/assets/js/environs.js');

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(lat, lng) {
  const requete = ENVIRONS.requete(lat, lng);
  let derniere;
  for (const serveur of ENVIRONS.SERVEURS) {
    try {
      const r = await fetch(serveur, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'petragest-transactions (MJ Data)' },
        body: 'data=' + encodeURIComponent(requete),
        signal: AbortSignal.timeout(120000),
      });
      if (!r.ok) throw new Error(`${serveur} : HTTP ${r.status}`);
      return (await r.json()).elements;
    } catch (e) {
      derniere = e;
      console.warn(`  ${e.message}, essai du serveur suivant...`);
    }
  }
  throw derniere;
}

(async () => {
  const c = await ouvrir();
  const db = require('../api/_lib/db');
  const A = require('../api/_lib/annonces');
  const tout = process.argv.includes('--tout');
  console.log(`Base : ${c.type === 'neon' ? 'Neon (en ligne)' : 'locale (.local/base)'}`);
  const annonces = (await db.requete(
    'select * from annonces where supprime_le is null and lat is not null and lng is not null order by id'))
    .filter((a) => tout || !A.environsAJour(a));
  console.log(`${annonces.length} annonce(s) à traiter.`);
  const deja = new Map();
  for (const a of annonces) {
    const cle = A.clePosition(a);
    try {
      if (!deja.has(cle)) {
        if (deja.size) await pause(3000);
        const t0 = Date.now();
        deja.set(cle, await overpass(a.lat, a.lng));
        console.log(`  OpenStreetMap : ${deja.get(cle).length} lieux bruts en ${Math.round((Date.now() - t0) / 1000)} s`);
      }
      const environs = ENVIRONS.construire(ENVIRONS.nettoyer(deja.get(cle)), a.lat, a.lng, a.ville);
      await db.requete('update annonces set environs = $1::jsonb, environs_le = now(), environs_pour = $2 where id = $3',
        [JSON.stringify(environs), cle, a.id]);
      const resume = environs.categories.map((x) => `${x.libelle.toLowerCase()} ${x.lieux.length}`).join(', ');
      console.log(`${a.pub_id} (${a.statut}) ${a.titre || 'sans titre'} : ${resume || 'aucun lieu'}`);
    } catch (e) {
      console.error(`${a.pub_id} : échec (${e.message}). Relancez le script plus tard.`);
    }
  }
  await c.fermer();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
