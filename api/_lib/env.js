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

// ACCES_LIBRE=1 : le catalogue et les fiches se consultent sans code (décision de Catherine et Laetitia, 22/10/2026,
// « pour l'instant »). Les codes déjà remis continuent de fonctionner ; retirer la variable remet le code obligatoire.
const accesLibre = () => lire('ACCES_LIBRE') === '1';

module.exports = { lire, secret, surVercel, accesLibre };
