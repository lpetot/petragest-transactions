'use strict';
// Base Postgres embarquée (PGlite) pour travailler en local, sans aucun compte en ligne.
// Les données vivent dans .local/base (ou en mémoire pour les tests).

async function ouvrirBaseLocale(dossier) {
  const { PGlite } = await import('@electric-sql/pglite');
  if (dossier) require('node:fs').mkdirSync(require('node:path').dirname(dossier), { recursive: true });
  const pg = dossier ? new PGlite(dossier) : new PGlite();
  await pg.waitReady;
  // Même fuseau que Neon : les dates sont stockées et comparées en UTC.
  await pg.exec("set timezone to 'UTC'");
  return {
    query: async (texte, params) => (await pg.query(texte, params || [])).rows,
    fermer: () => pg.close(),
  };
}

module.exports = { ouvrirBaseLocale };
