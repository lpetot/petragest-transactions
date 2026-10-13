'use strict';
// /api/biens : catalogue et fiches, pour un visiteur muni d'un code valide
// (ou un admin connecté, pour l'aperçu).

const db = require('./_lib/db');
const config = require('./_lib/config');
const A = require('./_lib/annonces');
const { empreinteIp } = require('./_lib/securite');
const h = require('./_lib/http');
const s = require('./_lib/sessions');

const MOTIF_ID = /^[a-z0-9]{10}$/;

// Renvoie { visiteur } ou { admin }, sinon lève 401 avec la raison.
async function exigerLecteur(req) {
  const session = await s.lireVisiteur(req);
  if (session && session.valide) return { visiteur: session.voucher };
  const admin = await s.lireAdmin(req);
  if (admin && !admin.doit_changer_mdp) return { admin };
  throw new h.ErreurHttp(401, 'session', 'Votre accès a pris fin. Saisissez de nouveau votre code.',
    { corps: { raison: session ? session.raison : 'absent' } });
}

async function liste(req, res) {
  await exigerLecteur(req);
  const lignes = await db.requete(
    `select a.*,
       (select json_build_object('url', p.url, 'url_mini', p.url_mini, 'largeur', p.largeur, 'hauteur', p.hauteur)
          from photos p where p.annonce_id = a.id order by p.position limit 1) as couverture,
       (select count(*)::int from photos p where p.annonce_id = a.id) as nb_photos
     from annonces a
     where ${A.SQL_VISIBLE}
     order by a.mise_en_avant desc, (a.statut = 'vendue') asc, a.publie_le desc nulls last, a.id desc`,
    [config.vendusVisiblesJours]);
  h.envoyerJson(res, 200, { biens: lignes.map(A.versCarte) });
}

async function fiche(req, res, pubId) {
  const lecteur = await exigerLecteur(req);
  if (!MOTIF_ID.test(pubId)) throw new h.ErreurHttp(404, 'introuvable', "Ce bien n'est plus proposé.");
  const apercu = Boolean(lecteur.admin);
  const a = apercu
    ? await db.une('select a.* from annonces a where a.pub_id = $1', [pubId])
    : await db.une(`select a.* from annonces a where a.pub_id = $2 and ${A.SQL_VISIBLE}`,
      [config.vendusVisiblesJours, pubId]);
  if (!a) throw new h.ErreurHttp(404, 'introuvable', "Ce bien n'est plus proposé.");
  const photos = await db.requete(
    'select url, url_mini, largeur, hauteur, legende from photos where annonce_id = $1 order by position', [a.id]);
  if (lecteur.visiteur) {
    const v = lecteur.visiteur;
    // Une seule ligne « fiche » par visiteur, par bien et par demi-heure.
    await db.requete(
      `insert into consultations (voucher_id, annonce_id, evenement, ip_empreinte)
       select $1, $2, 'fiche', $3
        where not exists (select 1 from consultations
                           where voucher_id = $1 and annonce_id = $2 and evenement = 'fiche'
                             and cree_le > now() - interval '30 minutes')`,
      [v.id, a.id, empreinteIp(h.ip(req))]);
    await db.requete('update vouchers set derniere_utilisation = now() where id = $1', [v.id]);
  }
  const bien = A.versPublic(a, photos);
  if (apercu) bien.apercu = { statut: a.statut, en_corbeille: Boolean(a.supprime_le) };
  h.envoyerJson(res, 200, { bien });
}

module.exports = h.gerer({
  async GET(req, res) {
    const id = h.parametres(req).get('id');
    if (id === null) return liste(req, res);
    return fiche(req, res, id);
  },

  // Journalise un clic sur « Appeler » ou « Écrire » depuis une fiche.
  async POST(req, res) {
    h.exigerOrigine(req);
    const session = await s.lireVisiteur(req);
    if (!session || !session.valide) return h.envoyerVide(res, 204);
    const id = h.parametres(req).get('id') || '';
    const corps = await h.lireJson(req, 500);
    if (!MOTIF_ID.test(id) || !['contact_tel', 'contact_mail'].includes(corps.evenement)) {
      throw new h.ErreurHttp(400, 'format', 'Requête mal formée.');
    }
    await db.requete(
      `insert into consultations (voucher_id, annonce_id, evenement, ip_empreinte)
       select $1, a.id, $3, $4 from annonces a where a.pub_id = $2`,
      [session.voucher.id, id, corps.evenement, empreinteIp(h.ip(req))]);
    h.envoyerVide(res, 204);
  },
});
