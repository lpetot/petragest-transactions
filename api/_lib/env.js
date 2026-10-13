'use strict';
// Lecture des variables d'environnement. Toujours nettoyées (trim) : un retour à la
// ligne collé dans le tableau de bord Vercel a déjà cassé un envoi de mail sur un autre projet.

function lire(nom) {
  const v = process.env[nom];
  return typeof v === 'string' ? v.trim() : undefined;
}

function secret(nom) {
  const v = lire(nom);
  if (!v || v.length < 32) {
    throw new Error(`Variable ${nom} absente ou trop courte (32 caractères minimum).`);
  }
  return v;
}

const surVercel = () => Boolean(process.env.VERCEL);

module.exports = { lire, secret, surVercel };
