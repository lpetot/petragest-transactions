'use strict';
// Fichiers du stockage (photos et DPE en PDF) : on n'en efface un que si plus rien ne s'en sert.
// Utilisé par l'espace de gestion (suppression d'une photo, d'une annonce, remplacement du DPE)
// et par l'entretien planifié (fichiers orphelins). Un seul endroit pour ne jamais oublier un type de fichier.

const db = require('./db');
const stockage = require('./stockage');

async function estUtilise(url) {
  const r = await db.une(
    `select (select count(*)::int from photos where url = $1 or url_mini = $1)
          + (select count(*)::int from annonces where dpe_pdf_url = $1) as n`, [url]);
  return Number(r.n) > 0;
}

// Supprime ceux des fichiers qui ne sont plus référencés. Renvoie le nombre de fichiers effacés.
async function supprimerOrphelins(urls) {
  const aSupprimer = [];
  for (const url of new Set(urls.filter(Boolean))) {
    if (!(await estUtilise(url))) aSupprimer.push(url);
  }
  if (aSupprimer.length) await stockage.supprimer(aSupprimer);
  return aSupprimer.length;
}

module.exports = { estUtilise, supprimerOrphelins };
