'use strict';
// /api/cron : entretien hebdomadaire (planifié dans vercel.json), protégé par CRON_SECRET.
// Vercel envoie automatiquement « Authorization: Bearer <CRON_SECRET> ».
// Rôle : durées de conservation RGPD, corbeille, fichiers orphelins, brouillons abandonnés.

const crypto = require('node:crypto');
const db = require('./_lib/db');
const config = require('./_lib/config');
const stockage = require('./_lib/stockage');
const { lire } = require('./_lib/env');
const h = require('./_lib/http');

function autorise(req) {
  const attendu = lire('CRON_SECRET');
  if (!attendu || attendu.length < 16) return false;
  const recu = Buffer.from(String(req.headers.authorization || ''));
  const ref = Buffer.from(`Bearer ${attendu}`);
  return recu.length === ref.length && crypto.timingSafeEqual(recu, ref);
}

async function supprimerSiOrphelins(urls) {
  const aSupprimer = [];
  for (const url of urls) {
    const r = await db.une('select count(*)::int as n from photos where url = $1 or url_mini = $1', [url]);
    if (r.n === 0) aSupprimer.push(url);
  }
  if (aSupprimer.length) await stockage.supprimer(aSupprimer);
  return aSupprimer.length;
}

async function entretien() {
  const bilan = {};

  // 1. Corbeille : purge définitive après le délai, photos comprises.
  const perimees = await db.requete(
    `select id from annonces where supprime_le is not null
       and supprime_le < now() - make_interval(days => $1::int)`, [config.corbeilleJours]);
  let fichiers = 0;
  for (const a of perimees) {
    const photos = await db.requete('select url, url_mini from photos where annonce_id = $1', [a.id]);
    await db.requete('delete from annonces where id = $1', [a.id]);
    fichiers += await supprimerSiOrphelins(photos.flatMap((p) => [p.url, p.url_mini]));
  }
  bilan.annonces_purgees = perimees.length;

  // 2. Brouillons vides abandonnés (aucune saisie, aucune photo).
  const vides = await db.requete(
    `delete from annonces a where a.statut = 'brouillon' and a.titre = '' and a.description = ''
        and a.prix_fai is null and a.ville is null
        and not exists (select 1 from photos p where p.annonce_id = a.id)
        and a.modifie_le < now() - make_interval(days => $1::int) returning a.id`, [config.brouillonsVidesJours]);
  bilan.brouillons_vides_supprimes = vides.length;

  // 3. Historique des consultations : 12 mois.
  const consultations = await db.requete(
    `delete from consultations where cree_le < now() - make_interval(months => $1::int) returning id`,
    [config.consultationsMois]);
  bilan.consultations_supprimees = consultations.length;

  // 4. Journal des essais de connexion : 30 jours.
  const tentatives = await db.requete(
    `delete from tentatives where cree_le < now() - make_interval(days => $1::int) returning id`,
    [config.tentativesJours]);
  bilan.tentatives_supprimees = tentatives.length;

  // 5. Codes expirés ou révoqués depuis longtemps : on efface les données personnelles.
  const anonymises = await db.requete(
    `update vouchers set beneficiaire_nom = 'Anonymisé', beneficiaire_email = null, beneficiaire_tel = null,
            note = null, civilite = null, anonymise_le = now()
      where anonymise_le is null
        and (revoque_le is not null or expire_le < now())
        and coalesce(derniere_utilisation, cree_le) < now() - make_interval(years => $1::int)
        and coalesce(revoque_le, expire_le) < now() - make_interval(years => $1::int)
      returning id`, [config.anonymisationAnnees]);
  bilan.codes_anonymises = anonymises.length;

  // 6. Fichiers déposés mais jamais rattachés à une photo (envoi interrompu), plus de 24 h.
  const limite = Date.now() - 24 * 3600 * 1000;
  const candidats = (await stockage.lister('biens/')).filter((b) => b.date.getTime() < limite).map((b) => b.url);
  fichiers += await supprimerSiOrphelins(candidats);
  bilan.fichiers_supprimes = fichiers;

  return bilan;
}

module.exports = h.gerer({
  async GET(req, res) {
    if (!autorise(req)) throw new h.ErreurHttp(401, 'non_autorise', 'Accès refusé.');
    const bilan = await entretien();
    console.log('[entretien]', JSON.stringify(bilan));
    h.envoyerJson(res, 200, { ok: true, bilan });
  },
});
module.exports.entretien = entretien;
