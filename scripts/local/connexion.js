'use strict';
// Ouvre la base pour les scripts en ligne de commande :
//  - Neon si DATABASE_URL est définie (fichier passé par --env, ou .env.local) ;
//  - sinon la base locale PGlite (.local/base). Le serveur « npm run dev » doit alors être arrêté.

const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..', '..');

function chargerEnv() {
  const i = process.argv.indexOf('--env');
  const fichier = i >= 0 ? path.resolve(process.argv[i + 1]) : path.join(RACINE, '.env.local');
  if (fs.existsSync(fichier)) process.loadEnvFile(fichier);
  return fichier;
}

async function ouvrir({ neonObligatoire = false } = {}) {
  chargerEnv();
  if (process.env.DATABASE_URL) return { type: 'neon', fermer: async () => {} };
  if (neonObligatoire) {
    throw new Error('DATABASE_URL introuvable. Récupérez les variables de Vercel : vercel env pull .env.production.local, puis relancez avec --env .env.production.local');
  }
  const { ouvrirBaseLocale } = require('./base');
  const base = await ouvrirBaseLocale(path.join(RACINE, '.local', 'base'));
  globalThis.__PETRA_DB_LOCALE__ = base;
  const { stockageLocal } = require('./stockage');
  globalThis.__PETRA_STOCKAGE_LOCAL__ = stockageLocal(path.join(RACINE, '.local', 'stockage'));
  return { type: 'locale', fermer: () => base.fermer() };
}

module.exports = { ouvrir, RACINE };
