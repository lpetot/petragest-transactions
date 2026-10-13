'use strict';
// Stockage des photos.
//  - En ligne : Vercel Blob, en accès public mais avec des adresses impossibles à deviner
//    (identifiant aléatoire + suffixe aléatoire ajouté par Blob).
//  - En local : un dossier .local/stockage, branché par scripts/dev.js.

const { lire } = require('./env');

// Les prévisualisations Vercel rangent leurs fichiers à part pour ne pas polluer la production.
function prefixe() {
  if (process.env.VERCEL && process.env.VERCEL_ENV !== 'production') return 'preview/';
  return '';
}

function pilote() {
  const local = globalThis.__PETRA_STOCKAGE_LOCAL__;
  if (local) return local;
  if (!lire('BLOB_READ_WRITE_TOKEN') && !lire('BLOB_STORE_ID')) {
    throw new Error('Aucun stockage de photos : branchez Vercel Blob au projet (ou lancez « npm run dev » en local).');
  }
  const blob = require('@vercel/blob');
  return {
    async deposer(chemin, octets, type) {
      const r = await blob.put(prefixe() + chemin, octets, {
        access: 'public',
        addRandomSuffix: true,
        contentType: type,
        cacheControlMaxAge: 31536000,
      });
      return r.url;
    },
    async supprimer(urls) {
      if (urls.length) await blob.del(urls);
    },
    async lister(sousDossier) {
      const tous = [];
      let cursor;
      do {
        const r = await blob.list({ prefix: prefixe() + sousDossier, cursor, limit: 1000 });
        for (const b of r.blobs) tous.push({ url: b.url, date: new Date(b.uploadedAt) });
        cursor = r.hasMore ? r.cursor : undefined;
      } while (cursor);
      return tous;
    },
  };
}

module.exports = {
  deposer: (chemin, octets, type) => pilote().deposer(chemin, octets, type),
  supprimer: (urls) => pilote().supprimer(urls),
  lister: (sousDossier) => pilote().lister(sousDossier),
};
