'use strict';
// Jetons de session signés, mots de passe, empreinte des adresses IP.

const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { secret } = require('./env');

const scrypt = promisify(crypto.scrypt);

// ---------- Jetons signés (cookie) ----------
// Format : base64url(JSON) + "." + HMAC-SHA256. Le champ k distingue visiteur ("v") et admin ("a").

function hmac(texte) {
  return crypto.createHmac('sha256', secret('SESSION_SECRET')).update(texte).digest('base64url');
}

function signer(charge) {
  const corps = Buffer.from(JSON.stringify(charge)).toString('base64url');
  return `${corps}.${hmac(corps)}`;
}

function verifier(jeton, type, ageMaxSec) {
  if (typeof jeton !== 'string' || jeton.length > 600) return null;
  const i = jeton.indexOf('.');
  if (i < 1) return null;
  const corps = jeton.slice(0, i);
  const sig = Buffer.from(jeton.slice(i + 1));
  const attendu = Buffer.from(hmac(corps));
  if (sig.length !== attendu.length || !crypto.timingSafeEqual(sig, attendu)) return null;
  let charge;
  try { charge = JSON.parse(Buffer.from(corps, 'base64url').toString('utf8')); } catch { return null; }
  if (!charge || charge.k !== type || typeof charge.t !== 'number') return null;
  const maintenant = Math.floor(Date.now() / 1000);
  if (charge.t > maintenant + 60 || maintenant - charge.t > ageMaxSec) return null;
  return charge;
}

// ---------- Mots de passe (scrypt) ----------
const N = 32768, R = 8, P = 1, LONGUEUR = 64, MAXMEM = 64 * 1024 * 1024;

async function hacherMotDePasse(mdp) {
  const sel = crypto.randomBytes(16);
  const cle = await scrypt(String(mdp).normalize('NFC'), sel, LONGUEUR, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${sel.toString('base64')}$${cle.toString('base64')}`;
}

async function verifierMotDePasse(mdp, empreinte) {
  const morceaux = String(empreinte || '').split('$');
  if (morceaux.length !== 6 || morceaux[0] !== 'scrypt') return false;
  const [, n, r, p, selB64, cleB64] = morceaux;
  const attendu = Buffer.from(cleB64, 'base64');
  const cle = await scrypt(String(mdp).normalize('NFC'), Buffer.from(selB64, 'base64'), attendu.length,
    { N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM });
  return crypto.timingSafeEqual(cle, attendu);
}

// Empreinte factice : on calcule quand même un scrypt quand l'e-mail est inconnu,
// pour que la durée de réponse ne révèle pas quels comptes existent.
let empreinteFactice = null;
async function verifierFactice(mdp) {
  if (!empreinteFactice) empreinteFactice = await hacherMotDePasse('compte-inexistant-' + crypto.randomUUID());
  await verifierMotDePasse(mdp, empreinteFactice);
  return false;
}

// Mot de passe temporaire lisible : 4 groupes de 4 caractères, sans caractères ambigus.
function motDePasseTemporaire() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const groupes = [];
  for (let g = 0; g < 4; g++) {
    let s = '';
    for (let i = 0; i < 4; i++) s += alphabet[crypto.randomInt(alphabet.length)];
    groupes.push(s);
  }
  return groupes.join('-');
}

// ---------- IP ----------
// On ne stocke jamais l'adresse IP en clair : seulement une empreinte tronquée,
// suffisante pour compter les appareils distincts et freiner les essais répétés.
function empreinteIp(ip) {
  return crypto.createHmac('sha256', secret('IP_SECRET')).update(String(ip)).digest('hex').slice(0, 16);
}

function identifiantPublic() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += alphabet[crypto.randomInt(alphabet.length)];
  return s;
}

module.exports = {
  signer, verifier, hacherMotDePasse, verifierMotDePasse, verifierFactice,
  motDePasseTemporaire, empreinteIp, identifiantPublic,
};
