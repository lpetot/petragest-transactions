'use strict';
// Codes d'accès visiteur (« vouchers »).
// 12 caractères tirés d'un alphabet de 30 symboles sans ambiguïté à l'oral ou à l'écrit
// (ni 0/O, ni 1/I/L, ni U/V) : environ 59 bits d'aléa, impossible à deviner.

const crypto = require('node:crypto');

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const LONGUEUR = 12;
const MOTIF = new RegExp(`^[${ALPHABET}]{${LONGUEUR}}$`);

function generer() {
  let s = '';
  for (let i = 0; i < LONGUEUR; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return s;
}

// Tolère minuscules, espaces et tirets. Renvoie null si ce n'est pas un code valide :
// dans ce cas on répond sans même interroger la base.
function normaliser(saisie) {
  if (typeof saisie !== 'string' || saisie.length > 40) return null;
  const s = saisie.toUpperCase().replace(/[\s\-_.]/g, '');
  return MOTIF.test(s) ? s : null;
}

function formater(code) {
  return String(code).replace(/(.{4})(?=.)/g, '$1-');
}

module.exports = { ALPHABET, LONGUEUR, generer, normaliser, formater };
