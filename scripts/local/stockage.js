'use strict';
// Stockage local des photos : même interface que Vercel Blob, dans le dossier .local/stockage.
// Les fichiers sont servis par scripts/dev.js sous /_stockage/...

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function stockageLocal(dossier) {
  fs.mkdirSync(dossier, { recursive: true });

  const versFichier = (url) => {
    const rel = decodeURIComponent(String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\/_stockage\//, ''));
    const complet = path.resolve(dossier, rel);
    if (!complet.startsWith(path.resolve(dossier) + path.sep)) return null;
    return complet;
  };

  return {
    async deposer(chemin, octets) {
      const ext = path.extname(chemin);
      const base = chemin.slice(0, chemin.length - ext.length);
      // Suffixe aléatoire, comme addRandomSuffix de Vercel Blob.
      const rel = `${base}-${crypto.randomBytes(12).toString('base64url')}${ext}`;
      const complet = path.join(dossier, rel);
      fs.mkdirSync(path.dirname(complet), { recursive: true });
      fs.writeFileSync(complet, octets);
      return '/_stockage/' + rel.split(path.sep).join('/');
    },
    async supprimer(urls) {
      for (const url of urls) {
        const f = versFichier(url);
        if (f && fs.existsSync(f)) fs.unlinkSync(f);
      }
    },
    async lister(sousDossier) {
      const racine = path.join(dossier, sousDossier);
      const out = [];
      const parcourir = (d) => {
        if (!fs.existsSync(d)) return;
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, e.name);
          if (e.isDirectory()) parcourir(p);
          else out.push({ url: '/_stockage/' + path.relative(dossier, p).split(path.sep).join('/'), date: fs.statSync(p).mtime });
        }
      };
      parcourir(racine);
      return out;
    },
    cheminDe: versFichier,
  };
}

module.exports = { stockageLocal };
