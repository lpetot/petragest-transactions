'use strict';
// /api/acces : connexion d'un visiteur avec son code, état de sa session, déconnexion.

const db = require('./_lib/db');
const config = require('./_lib/config');
const codes = require('./_lib/codes');
const { formaterJour } = require('./_lib/dates');
const { signer } = require('./_lib/securite');
const h = require('./_lib/http');
const s = require('./_lib/sessions');

const MESSAGES = {
  revoque: "Ce code n'est plus actif. Contactez-nous pour obtenir un nouvel accès.",
  inconnu: "Ce code n'est pas reconnu. Vérifiez-le ou contactez-nous.",
};

function profil(v) {
  return { civilite: v.civilite, nom: v.beneficiaire_nom, expire_le: new Date(v.expire_le).toISOString() };
}

module.exports = h.gerer({
  async POST(req, res) {
    h.exigerOrigine(req);
    const corps = await h.lireJson(req, 2000);
    const code = codes.normaliser(corps.code);
    // Format invalide : réponse immédiate, sans interroger la base.
    if (!code) {
      throw new h.ErreurHttp(400, 'format',
        "Ce code ne ressemble pas à un code d'accès : il comporte 12 caractères, par exemple K7QM-4TZP-9HWD.");
    }
    const empreinte = await s.verifierFrein(req, 'visiteur');
    const v = await db.une(
      `select id, civilite, beneficiaire_nom, expire_le, revoque_le
         from vouchers where code = $1 and anonymise_le is null`, [code]);
    if (!v) {
      await s.noterEchec('visiteur', empreinte);
      throw new h.ErreurHttp(401, 'inconnu', MESSAGES.inconnu);
    }
    if (v.revoque_le) {
      await s.noterEchec('visiteur', empreinte);
      throw new h.ErreurHttp(403, 'revoque', MESSAGES.revoque);
    }
    if (new Date(v.expire_le) <= new Date()) {
      await s.noterEchec('visiteur', empreinte);
      throw new h.ErreurHttp(403, 'expire',
        `Ce code a expiré le ${formaterJour(v.expire_le)}. Contactez-nous pour le prolonger.`);
    }
    await db.requete(
      `with maj as (
         update vouchers set nb_connexions = nb_connexions + 1, derniere_utilisation = now(),
                premiere_utilisation = coalesce(premiere_utilisation, now())
          where id = $1 returning id)
       insert into consultations (voucher_id, evenement, ip_empreinte)
       select id, 'connexion', $2 from maj`, [v.id, empreinte]);
    const maintenant = Math.floor(Date.now() / 1000);
    h.poserCookie(req, res, s.COOKIE_VISITEUR, signer({ k: 'v', id: v.id, t: maintenant }),
      config.sessionVisiteurJours * 86400);
    h.envoyerJson(res, 200, profil(v));
  },

  async GET(req, res) {
    // demo : vrai seulement dans la maquette locale (affiche un bandeau « démonstration »).
    const demo = process.env.PETRA_DEMO === '1';
    const session = await s.lireVisiteur(req);
    if (!session) return h.envoyerJson(res, 200, { connecte: false, demo });
    if (!session.valide) {
      h.effacerCookie(req, res, s.COOKIE_VISITEUR);
      return h.envoyerJson(res, 200, { connecte: false, raison: session.raison, demo });
    }
    h.envoyerJson(res, 200, Object.assign({ connecte: true, demo }, profil(session.voucher)));
  },

  async DELETE(req, res) {
    h.exigerOrigine(req);
    h.effacerCookie(req, res, s.COOKIE_VISITEUR);
    h.envoyerVide(res, 204);
  },
});
