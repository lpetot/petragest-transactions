#!/usr/bin/env node
'use strict';
// Importe en BROUILLON les 3 appartements à vendre du Bâtiment C de l'Arsenal Royal (lots C204, C301, C307),
// repris de petra-immo.fr, de la grille de prix 2026 et des diagnostics de vente (demande de la direction, 22/10/2026).
// Données : scripts/import/batiment-c/donnees.json ; photos : scripts/import/batiment-c/photos (2000 px + vignette 800 px).
//
//   node scripts/importer-batiment-c.js                                   base locale (serveur arrêté)
//   node scripts/importer-batiment-c.js --env .env.production.local       base en ligne (Neon + Blob)
//   ajouter --essai pour seulement contrôler les données, sans rien écrire.
//
// Rejouable : une annonce déjà présente (même référence interne, hors corbeille) n'est pas recréée ; si elle est encore
// en brouillon, ses champs sont remis à jour depuis donnees.json (photos inchangées) ; publiée, elle n'est pas touchée.
// Les annonces restent en brouillon : la publication se fait depuis l'espace de gestion, après les confirmations
// listées dans leur note interne (mandat et prix par Jessica, charges par Carla).

const fs = require('node:fs');
const path = require('node:path');
const { ouvrir } = require('./local/connexion');

const DOSSIER = path.join(__dirname, 'import', 'batiment-c');
const essai = process.argv.includes('--essai');

function brancherBlob() {
  // Même raison que demo-en-ligne.js : hors de Vercel, passer le jeton Blob explicitement.
  const jeton = process.env.BLOB_READ_WRITE_TOKEN;
  if (!jeton) return;
  const blob = require('@vercel/blob');
  globalThis.__PETRA_STOCKAGE_LOCAL__ = {
    async deposer(chemin, octets, type) {
      const r = await blob.put(chemin, octets, { access: 'public', addRandomSuffix: true, contentType: type, cacheControlMaxAge: 31536000, token: jeton });
      return r.url;
    },
    async lister(prefixe) { return (await blob.list({ prefix: prefixe, limit: 1, token: jeton })).blobs; },
  };
}

(async () => {
  const lots = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'donnees.json'), 'utf8'));
  const A = require('../api/_lib/annonces');

  // 1. Contrôle de toutes les données AVANT d'écrire quoi que ce soit.
  const prets = lots.map((lot) => {
    const { photos, ...champs } = lot;
    const { valeurs, erreurs } = A.valider(champs);
    if (erreurs && Object.keys(erreurs).length) throw new Error(`${lot.reference_interne} : ${JSON.stringify(erreurs)}`);
    for (const p of photos) {
      for (const s of ['g', 'm']) {
        const f = path.join(DOSSIER, 'photos', `${p.nom}-${s}.jpg`);
        if (!fs.existsSync(f)) throw new Error(`Photo manquante : ${f}`);
      }
    }
    const manquants = A.manquantsPourPublier(valeurs, photos.length);
    return { lot, valeurs, photos, manquants };
  });
  for (const p of prets) console.log(`${p.lot.reference_interne} : données valides, ${p.photos.length} photos. Manque pour publier : ${p.manquants.join(', ') || 'rien'}.`);
  if (essai) return;

  const connexion = await ouvrir();
  if (connexion.type === 'neon') brancherBlob();
  const db = require('../api/_lib/db');
  const stockage = require('../api/_lib/stockage');
  const sec = require('../api/_lib/securite');
  try {
    await stockage.lister('biens/'); // stockage joignable avant toute écriture en base
    const admin = await db.une('select id from admins where actif order by id limit 1');
    if (!admin) throw new Error('Aucun compte administrateur dans cette base.');

    for (const { lot, valeurs, photos } of prets) {
      const colonnes = Object.keys(valeurs);
      const deja = await db.une('select id, pub_id, statut from annonces where reference_interne = $1 and supprime_le is null', [lot.reference_interne]);
      if (deja && deja.statut !== 'brouillon') {
        console.log(`${lot.reference_interne} : déjà ${deja.statut} (${deja.pub_id}), laissée telle quelle (modifier depuis l'espace de gestion).`);
        continue;
      }
      if (deja) {
        // Brouillon existant : les champs sont remis à jour depuis donnees.json, les photos ne bougent pas.
        const sets = colonnes.map((c, i) => `${c} = ${c === 'atouts' ? `$${i + 1}::jsonb` : `$${i + 1}`}`);
        const vals = colonnes.map((c) => (c === 'atouts' ? JSON.stringify(valeurs[c]) : valeurs[c]));
        const pos = A.positionDecalee(valeurs.lat, valeurs.lng);
        const n = colonnes.length;
        await db.requete(
          `update annonces set ${sets.join(', ')}, lat_pub = $${n + 1}, lng_pub = $${n + 2}, modifie_par = $${n + 3}, modifie_le = now()
            where id = $${n + 4}`,
          vals.concat([pos.lat, pos.lng, admin.id, deja.id]));
        console.log(`${lot.reference_interne} : brouillon mis à jour (${deja.pub_id}).`);
        continue;
      }

      const params = colonnes.map((c) => (c === 'atouts' ? JSON.stringify(valeurs[c]) : valeurs[c]));
      const marques = colonnes.map((c, i) => (c === 'atouts' ? `$${i + 1}::jsonb` : `$${i + 1}`));
      const n = colonnes.length;
      const pos = A.positionDecalee(valeurs.lat, valeurs.lng);
      const a = await db.une(
        `insert into annonces (${colonnes.join(', ')}, pub_id, statut, lat_pub, lng_pub, cree_par, modifie_par)
         values (${marques.join(', ')}, $${n + 1}, 'brouillon', $${n + 2}, $${n + 3}, $${n + 4}, $${n + 4})
         returning id, pub_id`,
        params.concat([sec.identifiantPublic(), pos.lat, pos.lng, admin.id]));

      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        const grande = fs.readFileSync(path.join(DOSSIER, 'photos', `${p.nom}-g.jpg`));
        const mini = fs.readFileSync(path.join(DOSSIER, 'photos', `${p.nom}-m.jpg`));
        const base = `biens/${a.pub_id}/${p.nom}`;
        const url = await stockage.deposer(`${base}-g.jpg`, grande, 'image/jpeg');
        const urlMini = await stockage.deposer(`${base}-m.jpg`, mini, 'image/jpeg');
        await db.requete(
          `insert into photos (annonce_id, position, url, url_mini, largeur, hauteur, octets, legende)
           values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [a.id, i, url, urlMini, p.largeur, p.hauteur, grande.length, p.legende || null]);
      }
      console.log(`${lot.reference_interne} : créée en brouillon (${a.pub_id}), ${photos.length} photos.`);
    }
  } finally {
    await connexion.fermer();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
