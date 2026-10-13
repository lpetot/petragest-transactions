'use strict';
// Sessions visiteur (code d'accès) et admin, et frein aux essais répétés.
// Principe : le cookie signé ne suffit jamais. À chaque appel on relit la base,
// si bien qu'une révocation ou une désactivation prend effet immédiatement.

const db = require('./db');
const config = require('./config');
const { verifier, empreinteIp } = require('./securite');
const { cookies, ip, ErreurHttp } = require('./http');

const COOKIE_VISITEUR = 'pg_acces';
const COOKIE_ADMIN = 'pg_admin';

async function lireVisiteur(req) {
  const jeton = cookies(req)[COOKIE_VISITEUR];
  if (!jeton) return null;
  const charge = verifier(jeton, 'v', config.sessionVisiteurJours * 86400);
  if (!charge || !Number.isInteger(charge.id)) return null;
  const v = await db.une(
    `select id, civilite, beneficiaire_nom, expire_le, revoque_le, anonymise_le
       from vouchers where id = $1`, [charge.id]);
  if (!v) return null;
  let raison = null;
  if (v.anonymise_le) raison = 'inconnu';
  else if (v.revoque_le) raison = 'revoque';
  else if (new Date(v.expire_le) <= new Date()) raison = 'expire';
  return { voucher: v, valide: !raison, raison };
}

async function lireAdmin(req) {
  const jeton = cookies(req)[COOKIE_ADMIN];
  if (!jeton) return null;
  const charge = verifier(jeton, 'a', config.sessionAdminJours * 86400);
  if (!charge || !Number.isInteger(charge.id)) return null;
  const a = await db.une(
    `select id, email, nom, session_version, doit_changer_mdp, actif
       from admins where id = $1`, [charge.id]);
  if (!a || !a.actif || a.session_version !== charge.sv) return null;
  return a;
}

async function exigerAdmin(req, { memeSiMdpAChanger = false } = {}) {
  const a = await lireAdmin(req);
  if (!a) throw new ErreurHttp(401, 'session', 'Votre session a expiré. Reconnectez-vous.');
  if (a.doit_changer_mdp && !memeSiMdpAChanger) {
    throw new ErreurHttp(403, 'changer_mdp', 'Choisissez d\'abord votre mot de passe personnel.');
  }
  return a;
}

// ---------- Essais répétés ----------
async function verifierFrein(req, portail) {
  const empreinte = empreinteIp(ip(req));
  const max = portail === 'admin' ? config.echecsMaxAdmin : config.echecsMaxVisiteur;
  const r = await db.une(
    `select count(*)::int as n from tentatives
      where portail = $1 and ip_empreinte = $2 and not succes
        and cree_le > now() - make_interval(mins => $3::int)`,
    [portail, empreinte, config.fenetreEchecsMinutes]);
  if (r.n >= max) {
    throw new ErreurHttp(429, 'trop_essais',
      `Trop d'essais. Patientez ${config.fenetreEchecsMinutes} minutes avant de réessayer.`,
      { retryAfter: config.fenetreEchecsMinutes * 60 });
  }
  return empreinte;
}

async function noterEchec(portail, empreinte) {
  await db.requete(
    'insert into tentatives (portail, ip_empreinte, succes) values ($1, $2, false)', [portail, empreinte]);
}

module.exports = {
  COOKIE_VISITEUR, COOKIE_ADMIN, lireVisiteur, lireAdmin, exigerAdmin, verifierFrein, noterEchec,
};
