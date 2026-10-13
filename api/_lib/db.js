'use strict';
// Accès à la base Postgres.
//  - En ligne (Vercel) : Neon, par son pilote HTTP (aucune connexion à gérer).
//  - En local : PGlite (Postgres embarqué), branché par scripts/dev.js via une variable globale.
//    Le code des fonctions ne sait pas lequel des deux il utilise.
// Règle : toutes les fonctions renvoient des lignes (tableau d'objets).

const { lire, surVercel } = require('./env');

let neonSql = null;

function pilote() {
  const local = globalThis.__PETRA_DB_LOCALE__;
  if (local) return local;
  const url = lire('DATABASE_URL');
  if (!url) {
    throw new Error(surVercel()
      ? 'DATABASE_URL absente : branchez Neon au projet Vercel.'
      : 'Aucune base de données : lancez le site avec « npm run dev ».');
  }
  if (!neonSql) {
    const { neon } = require('@neondatabase/serverless');
    neonSql = neon(url);
  }
  return { query: (texte, params) => neonSql.query(texte, params) };
}

async function requete(texte, params) {
  return pilote().query(texte, params || []);
}

async function une(texte, params) {
  const lignes = await requete(texte, params);
  return lignes[0] || null;
}

module.exports = { requete, une };
