'use strict';
// /api/admin/* : tout l'espace de gestion (une seule fonction, aiguillage interne).
// Une seule garde d'accès au même endroit plutôt qu'une par fichier : impossible d'en oublier une.

const crypto = require('node:crypto');
const db = require('./_lib/db');
const config = require('./_lib/config');
const A = require('./_lib/annonces');
const codes = require('./_lib/codes');
const stockage = require('./_lib/stockage');
const dates = require('./_lib/dates');
const sec = require('./_lib/securite');
const h = require('./_lib/http');
const s = require('./_lib/sessions');

const E = h.ErreurHttp;
const MOTIF_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MOTIF_TEL = /^[0-9+().\s-]{6,30}$/;

const iso = (d) => (d instanceof Date ? d.toISOString() : d || null);

function texteOptionnel(v, max, champ) {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') throw new E(422, 'invalide', `${champ} : texte attendu.`);
  const t = v.trim();
  if (t.length > max) throw new E(422, 'invalide', `${champ} : ${max} caractères au maximum.`);
  return t || null;
}

// =====================================================================
// Session admin
// =====================================================================
async function connexion(req, res) {
  const corps = await h.lireJson(req, 2000);
  const email = typeof corps.email === 'string' ? corps.email.trim() : '';
  const mdp = typeof corps.mdp === 'string' ? corps.mdp : '';
  if (!email || !mdp || mdp.length > 200) throw new E(400, 'format', 'Saisissez votre e-mail et votre mot de passe.');
  const empreinte = await s.verifierFrein(req, 'admin');
  const a = await db.une('select * from admins where lower(email) = lower($1)', [email]);
  let ok = false;
  if (a && a.actif) ok = await sec.verifierMotDePasse(mdp, a.mdp_hash);
  else await sec.verifierFactice(mdp);
  if (!ok) {
    await s.noterEchec('admin', empreinte);
    throw new E(401, 'identifiants', 'E-mail ou mot de passe incorrect.');
  }
  await db.requete('update admins set derniere_connexion = now() where id = $1', [a.id]);
  poserSession(req, res, a.id, a.session_version);
  h.envoyerJson(res, 200, { nom: a.nom, email: a.email, doit_changer_mdp: a.doit_changer_mdp });
}

function poserSession(req, res, id, sv) {
  h.poserCookie(req, res, s.COOKIE_ADMIN, sec.signer({ k: 'a', id, sv, t: Math.floor(Date.now() / 1000) }),
    config.sessionAdminJours * 86400);
}

async function moi(req, res, _m, admin) {
  h.envoyerJson(res, 200, { id: admin.id, nom: admin.nom, email: admin.email, doit_changer_mdp: admin.doit_changer_mdp });
}

async function changerMdp(req, res, _m, admin) {
  const { actuel, nouveau } = await h.lireJson(req, 2000);
  if (typeof actuel !== 'string' || typeof nouveau !== 'string') throw new E(400, 'format', 'Requête mal formée.');
  const ligne = await db.une('select mdp_hash from admins where id = $1', [admin.id]);
  if (!(await sec.verifierMotDePasse(actuel, ligne.mdp_hash))) {
    throw new E(422, 'invalide', 'Le mot de passe actuel est incorrect.');
  }
  if (nouveau.length < 12) throw new E(422, 'invalide', 'Le nouveau mot de passe doit comporter au moins 12 caractères.');
  if (nouveau.length > 200) throw new E(422, 'invalide', 'Le nouveau mot de passe est trop long.');
  if (nouveau === actuel) throw new E(422, 'invalide', "Choisissez un mot de passe différent de l'actuel.");
  const hash = await sec.hacherMotDePasse(nouveau);
  const maj = await db.une(
    `update admins set mdp_hash = $1, doit_changer_mdp = false, session_version = session_version + 1
      where id = $2 returning session_version`, [hash, admin.id]);
  poserSession(req, res, admin.id, maj.session_version);
  h.envoyerJson(res, 200, { ok: true });
}

async function deconnexion(req, res) {
  const admin = await s.lireAdmin(req);
  // Déconnecte aussi les autres appareils de cette personne.
  if (admin) await db.requete('update admins set session_version = session_version + 1 where id = $1', [admin.id]);
  h.effacerCookie(req, res, s.COOKIE_ADMIN);
  h.envoyerVide(res, 204);
}

// =====================================================================
// Équipe (comptes admin)
// =====================================================================
function versAdmin(a) {
  return {
    id: a.id, email: a.email, nom: a.nom, actif: a.actif, doit_changer_mdp: a.doit_changer_mdp,
    derniere_connexion: iso(a.derniere_connexion), cree_le: iso(a.cree_le),
  };
}

async function equipeListe(req, res) {
  const lignes = await db.requete('select * from admins order by actif desc, nom');
  h.envoyerJson(res, 200, { equipe: lignes.map(versAdmin) });
}

async function equipeCreer(req, res) {
  const corps = await h.lireJson(req, 2000);
  const email = typeof corps.email === 'string' ? corps.email.trim().toLowerCase() : '';
  const nom = typeof corps.nom === 'string' ? corps.nom.trim() : '';
  if (!MOTIF_EMAIL.test(email) || email.length > 200) throw new E(422, 'invalide', 'Adresse e-mail invalide.');
  if (!nom || nom.length > 80) throw new E(422, 'invalide', 'Indiquez le prénom et le nom.');
  const existe = await db.une('select id from admins where lower(email) = $1', [email]);
  if (existe) throw new E(409, 'existe', 'Un compte existe déjà avec cet e-mail.');
  const temporaire = sec.motDePasseTemporaire();
  const a = await db.une(
    `insert into admins (email, nom, mdp_hash, doit_changer_mdp) values ($1, $2, $3, true) returning *`,
    [email, nom, await sec.hacherMotDePasse(temporaire)]);
  h.envoyerJson(res, 201, { admin: versAdmin(a), mdp_temporaire: temporaire });
}

async function equipeModifier(req, res, m, admin) {
  const id = Number(m[1]);
  const corps = await h.lireJson(req, 2000);
  const cible = await db.une('select * from admins where id = $1', [id]);
  if (!cible) throw new E(404, 'introuvable', 'Compte introuvable.');
  if (typeof corps.nom === 'string') {
    const nom = corps.nom.trim();
    if (!nom || nom.length > 80) throw new E(422, 'invalide', 'Nom invalide.');
    await db.requete('update admins set nom = $1 where id = $2', [nom, id]);
  }
  if (typeof corps.actif === 'boolean' && corps.actif !== cible.actif) {
    if (id === admin.id) throw new E(409, 'soi_meme', 'Vous ne pouvez pas désactiver votre propre compte.');
    if (!corps.actif) {
      const r = await db.une('select count(*)::int as n from admins where actif and id <> $1', [id]);
      if (r.n < 1) throw new E(409, 'dernier', 'Il doit rester au moins un compte actif.');
    }
    await db.requete('update admins set actif = $1, session_version = session_version + 1 where id = $2', [corps.actif, id]);
  }
  const a = await db.une('select * from admins where id = $1', [id]);
  h.envoyerJson(res, 200, { admin: versAdmin(a) });
}

async function equipeReinitialiser(req, res, m, admin) {
  const id = Number(m[1]);
  if (id === admin.id) throw new E(409, 'soi_meme', 'Pour votre propre compte, utilisez « Changer mon mot de passe ».');
  const cible = await db.une('select id from admins where id = $1', [id]);
  if (!cible) throw new E(404, 'introuvable', 'Compte introuvable.');
  const temporaire = sec.motDePasseTemporaire();
  await db.requete(
    `update admins set mdp_hash = $1, doit_changer_mdp = true, session_version = session_version + 1 where id = $2`,
    [await sec.hacherMotDePasse(temporaire), id]);
  h.envoyerJson(res, 200, { mdp_temporaire: temporaire });
}

// =====================================================================
// Annonces
// =====================================================================
async function trouverAnnonce(pubId) {
  const a = await db.une('select * from annonces where pub_id = $1', [pubId]);
  if (!a) throw new E(404, 'introuvable', 'Annonce introuvable.');
  return a;
}

async function photosDe(annonceId) {
  return db.requete(
    `select id, position, url, url_mini, largeur, hauteur, octets, legende
       from photos where annonce_id = $1 order by position, id`, [annonceId]);
}

function versAnnonceAdmin(a, photos) {
  const sortie = {};
  for (const nom of Object.keys(A.CHAMPS)) sortie[nom] = a[nom] === undefined ? null : a[nom];
  Object.assign(sortie, {
    id: a.pub_id,
    statut: a.statut,
    en_corbeille: Boolean(a.supprime_le),
    supprime_le: iso(a.supprime_le),
    publie_le: iso(a.publie_le),
    vendu_le: iso(a.vendu_le),
    cree_le: iso(a.cree_le),
    modifie_le: iso(a.modifie_le),
    photos: photos.map((p) => ({
      id: p.id, url: p.url, url_mini: p.url_mini, largeur: p.largeur, hauteur: p.hauteur, legende: p.legende || '',
    })),
    manquants: A.manquantsPourPublier(a, photos.length),
    prix_detail: A.prix(a),
  });
  return sortie;
}

async function annoncesListe(req, res) {
  const lignes = await db.requete(
    `select a.pub_id, a.statut, a.titre, a.type_bien, a.ville, a.prix_fai, a.supprime_le, a.modifie_le,
            a.publie_le, a.vendu_le, a.mise_en_avant, a.reference_interne,
       (select p.url_mini from photos p where p.annonce_id = a.id order by p.position limit 1) as couverture,
       (select count(*)::int from photos p where p.annonce_id = a.id) as nb_photos,
       (select count(*)::int from consultations c
         where c.annonce_id = a.id and c.evenement = 'fiche' and c.cree_le > now() - interval '30 days') as vues_30j,
       (select count(distinct c.voucher_id)::int from consultations c
         where c.annonce_id = a.id and c.evenement = 'fiche') as visiteurs
     from annonces a order by a.modifie_le desc`);
  h.envoyerJson(res, 200, {
    annonces: lignes.map((a) => ({
      id: a.pub_id, statut: a.statut, titre: a.titre, type_bien: a.type_bien, ville: a.ville, prix_fai: a.prix_fai,
      en_corbeille: Boolean(a.supprime_le), supprime_le: iso(a.supprime_le), modifie_le: iso(a.modifie_le),
      publie_le: iso(a.publie_le), vendu_le: iso(a.vendu_le), mise_en_avant: a.mise_en_avant,
      reference_interne: a.reference_interne, couverture: a.couverture, nb_photos: a.nb_photos,
      vues_30j: a.vues_30j, visiteurs: a.visiteurs,
    })),
  });
}

async function nouvelIdentifiant() {
  for (let i = 0; i < 5; i++) {
    const id = sec.identifiantPublic();
    if (!(await db.une('select 1 from annonces where pub_id = $1', [id]))) return id;
  }
  throw new Error('Impossible de générer un identifiant unique.');
}

async function annonceCreer(req, res, _m, admin) {
  const a = await db.une(
    `insert into annonces (pub_id, cree_par, modifie_par) values ($1, $2, $2) returning *`,
    [await nouvelIdentifiant(), admin.id]);
  h.envoyerJson(res, 201, { annonce: versAnnonceAdmin(a, []) });
}

async function annonceLire(req, res, m) {
  const a = await trouverAnnonce(m[1]);
  const photos = await photosDe(a.id);
  const visiteurs = await db.requete(
    `select v.id, v.civilite, v.beneficiaire_nom as nom, count(*)::int as vues, max(c.cree_le) as derniere
       from consultations c join vouchers v on v.id = c.voucher_id
      where c.annonce_id = $1 and c.evenement = 'fiche'
      group by v.id, v.civilite, v.beneficiaire_nom order by derniere desc limit 50`, [a.id]);
  h.envoyerJson(res, 200, {
    annonce: versAnnonceAdmin(a, photos),
    visiteurs: visiteurs.map((v) => ({ id: v.id, civilite: v.civilite, nom: v.nom, vues: v.vues, derniere: iso(v.derniere) })),
  });
}

async function annonceModifier(req, res, m, admin) {
  const a = await trouverAnnonce(m[1]);
  if (a.supprime_le) throw new E(409, 'corbeille', "Cette annonce est dans la corbeille : restaurez-la d'abord.");
  const corps = await h.lireJson(req, 60000);
  const { valeurs, erreurs } = A.valider(corps);
  if (Object.keys(erreurs).length) {
    throw new E(422, 'invalide', 'Certains champs sont à corriger.', { corps: { champs: erreurs } });
  }
  const maj = Object.assign({}, valeurs);
  if (corps.statut !== undefined) {
    if (!A.STATUTS.includes(corps.statut)) throw new E(422, 'invalide', 'Statut non reconnu.');
    maj.statut = corps.statut;
  }
  const fusion = Object.assign({}, a, maj);

  // Coordonnées : les deux ou aucune ; la position « zone » est recalculée si le point change.
  if ('lat' in valeurs || 'lng' in valeurs) {
    const aLat = fusion.lat !== null && fusion.lat !== undefined;
    const aLng = fusion.lng !== null && fusion.lng !== undefined;
    if (aLat !== aLng) throw new E(422, 'invalide', 'Coordonnées incomplètes.');
    if (!aLat) { maj.lat_pub = null; maj.lng_pub = null; }
    else if (fusion.lat !== a.lat || fusion.lng !== a.lng || a.lat_pub === null) {
      const p = A.positionDecalee(fusion.lat, fusion.lng);
      maj.lat_pub = p.lat; maj.lng_pub = p.lng;
    }
  }

  const nbPhotos = (await db.une('select count(*)::int as n from photos where annonce_id = $1', [a.id])).n;
  if (A.STATUTS_EN_LIGNE.includes(fusion.statut)) {
    const manquants = A.manquantsPourPublier(fusion, nbPhotos);
    if (manquants.length) {
      throw new E(422, 'incomplet',
        a.statut === fusion.statut
          ? "Cette annonce est en ligne : elle doit rester complète. Il manque : " + manquants.join(', ') + '.'
          : 'Pour mettre en ligne, il manque : ' + manquants.join(', ') + '.',
        { corps: { manquants } });
    }
  }
  if (maj.statut && maj.statut !== a.statut) {
    if (A.STATUTS_EN_LIGNE.includes(maj.statut) && !a.publie_le) maj.publie_le = new Date().toISOString();
    if (maj.statut === 'vendue') maj.vendu_le = new Date().toISOString();
    else if (a.statut === 'vendue') maj.vendu_le = null;
  }

  const colonnes = Object.keys(maj);
  if (colonnes.length) {
    const sets = [];
    const params = [];
    for (const col of colonnes) {
      params.push(col === 'atouts' ? JSON.stringify(maj[col]) : maj[col]);
      sets.push(col === 'atouts' ? `${col} = $${params.length}::jsonb` : `${col} = $${params.length}`);
    }
    params.push(admin.id, a.id);
    await db.requete(
      `update annonces set ${sets.join(', ')}, modifie_le = now(), modifie_par = $${params.length - 1}
        where id = $${params.length}`, params);
  }
  const apres = await db.une('select * from annonces where id = $1', [a.id]);
  h.envoyerJson(res, 200, { annonce: versAnnonceAdmin(apres, await photosDe(a.id)) });
}

// Supprime des fichiers du stockage seulement s'ils ne sont plus référencés nulle part
// (protection contre la perte de photos partagées entre deux annonces).
async function supprimerFichiersOrphelins(urls) {
  const aSupprimer = [];
  for (const url of urls) {
    const r = await db.une('select count(*)::int as n from photos where url = $1 or url_mini = $1', [url]);
    if (r.n === 0) aSupprimer.push(url);
  }
  if (aSupprimer.length) await stockage.supprimer(aSupprimer);
}

async function purgerAnnonce(a) {
  const photos = await photosDe(a.id);
  await db.requete('delete from annonces where id = $1', [a.id]);
  await supprimerFichiersOrphelins(photos.flatMap((p) => [p.url, p.url_mini]));
}

async function annonceSupprimer(req, res, m) {
  const a = await trouverAnnonce(m[1]);
  const definitif = h.parametres(req).get('definitif') === '1';
  if (definitif) {
    if (!a.supprime_le) throw new E(409, 'pas_corbeille', "Placez d'abord l'annonce dans la corbeille.");
    await purgerAnnonce(a);
    return h.envoyerVide(res, 204);
  }
  await db.requete('update annonces set supprime_le = now() where id = $1 and supprime_le is null', [a.id]);
  h.envoyerVide(res, 204);
}

async function annonceRestaurer(req, res, m) {
  const a = await trouverAnnonce(m[1]);
  await db.requete('update annonces set supprime_le = null, modifie_le = now() where id = $1', [a.id]);
  h.envoyerJson(res, 200, { annonce: versAnnonceAdmin(await trouverAnnonce(m[1]), await photosDe(a.id)) });
}

// Duplique les champs seulement, jamais les photos : supprimer la copie ne peut pas
// effacer les photos de l'original.
async function annonceDupliquer(req, res, m, admin) {
  const a = await trouverAnnonce(m[1]);
  const cols = Object.keys(A.CHAMPS).filter((c) => c !== 'titre').concat(['lat_pub', 'lng_pub']);
  const copie = await db.une(
    `insert into annonces (pub_id, statut, cree_par, modifie_par, titre, ${cols.join(', ')})
     select $1, 'brouillon', $2, $2, left(titre || ' (copie)', 140), ${cols.join(', ')}
       from annonces where id = $3 returning *`,
    [await nouvelIdentifiant(), admin.id, a.id]);
  h.envoyerJson(res, 201, { annonce: versAnnonceAdmin(copie, []) });
}

// =====================================================================
// Photos
// =====================================================================
const JPEG = (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

async function photoAjouter(req, res, m) {
  const a = await trouverAnnonce(m[1]);
  if (a.supprime_le) throw new E(409, 'corbeille', 'Cette annonce est dans la corbeille.');
  if (!String(req.headers['content-type'] || '').startsWith('application/octet-stream')) {
    throw new E(415, 'format', 'Envoi de photo mal formé.');
  }
  const tailleGrande = Number(req.headers['x-taille-grande']);
  const largeur = Number(req.headers['x-largeur']);
  const hauteur = Number(req.headers['x-hauteur']);
  if (!Number.isInteger(tailleGrande) || tailleGrande < 100 || tailleGrande > 3800000
    || !Number.isInteger(largeur) || largeur < 50 || largeur > 10000
    || !Number.isInteger(hauteur) || hauteur < 50 || hauteur > 10000) {
    throw new E(400, 'format', 'Envoi de photo mal formé.');
  }
  const nb = (await db.une('select count(*)::int as n from photos where annonce_id = $1', [a.id])).n;
  if (nb >= config.maxPhotosParAnnonce) {
    throw new E(409, 'trop_photos', `${config.maxPhotosParAnnonce} photos au maximum par annonce.`);
  }
  const corps = await h.lireCorps(req, 4300000);
  const grande = corps.subarray(0, tailleGrande);
  const mini = corps.subarray(tailleGrande);
  if (grande.length !== tailleGrande || mini.length < 100 || mini.length > 600000 || !JPEG(grande) || !JPEG(mini)) {
    throw new E(400, 'format', "Ce fichier n'est pas une photo JPEG valide.");
  }
  const base = `biens/${a.pub_id}/${crypto.randomUUID()}`;
  const [url, urlMini] = await Promise.all([
    stockage.deposer(`${base}-g.jpg`, grande, 'image/jpeg'),
    stockage.deposer(`${base}-m.jpg`, mini, 'image/jpeg'),
  ]);
  let photo;
  try {
    photo = await db.une(
      `insert into photos (annonce_id, position, url, url_mini, largeur, hauteur, octets)
       values ($1, (select coalesce(max(position) + 1, 0) from photos where annonce_id = $1), $2, $3, $4, $5, $6)
       returning id, position, url, url_mini, largeur, hauteur, legende`,
      [a.id, url, urlMini, largeur, hauteur, grande.length]);
  } catch (e) {
    await stockage.supprimer([url, urlMini]).catch(() => {});
    throw e;
  }
  await db.requete('update annonces set modifie_le = now() where id = $1', [a.id]);
  h.envoyerJson(res, 201, { photo: Object.assign(photo, { legende: photo.legende || '' }) });
}

async function renumeroter(annonceId) {
  await db.requete(
    `update photos p set position = s.rang - 1
       from (select id, row_number() over (order by position, id) as rang from photos where annonce_id = $1) s
      where p.id = s.id`, [annonceId]);
}

async function photosOrdre(req, res, m) {
  const a = await trouverAnnonce(m[1]);
  const { ordre } = await h.lireJson(req, 20000);
  const actuelles = await photosDe(a.id);
  const ids = new Set(actuelles.map((p) => p.id));
  if (!Array.isArray(ordre) || ordre.length !== ids.size || new Set(ordre).size !== ordre.length
    || ordre.some((id) => !ids.has(id))) {
    throw new E(409, 'ordre', 'La liste des photos a changé entre-temps. Rechargez la page.');
  }
  await db.requete(
    `update photos p set position = o.rang - 1
       from jsonb_array_elements_text($1::jsonb) with ordinality as o(id, rang)
      where p.id = o.id::int and p.annonce_id = $2`, [JSON.stringify(ordre), a.id]);
  await db.requete('update annonces set modifie_le = now() where id = $1', [a.id]);
  h.envoyerJson(res, 200, { photos: (await photosDe(a.id)).map((p) => Object.assign(p, { legende: p.legende || '' })) });
}

async function photoModifier(req, res, m) {
  const id = Number(m[1]);
  const { legende } = await h.lireJson(req, 2000);
  const texte = texteOptionnel(legende, 200, 'Légende');
  const p = await db.une('update photos set legende = $1 where id = $2 returning id', [texte, id]);
  if (!p) throw new E(404, 'introuvable', 'Photo introuvable.');
  h.envoyerJson(res, 200, { ok: true });
}

async function photoSupprimer(req, res, m) {
  const id = Number(m[1]);
  const p = await db.une(
    `select p.*, a.statut, (select count(*)::int from photos q where q.annonce_id = p.annonce_id) as nb
       from photos p join annonces a on a.id = p.annonce_id where p.id = $1`, [id]);
  if (!p) throw new E(404, 'introuvable', 'Photo introuvable.');
  if (A.STATUTS_EN_LIGNE.includes(p.statut) && p.nb <= 1) {
    throw new E(409, 'derniere_photo', 'Une annonce en ligne doit garder au moins une photo.');
  }
  await db.requete('delete from photos where id = $1', [id]);
  await renumeroter(p.annonce_id);
  await db.requete('update annonces set modifie_le = now() where id = $1', [p.annonce_id]);
  await supprimerFichiersOrphelins([p.url, p.url_mini]);
  h.envoyerVide(res, 204);
}

// =====================================================================
// Codes d'accès
// =====================================================================
function statutCode(v) {
  if (v.revoque_le) return 'revoque';
  if (new Date(v.expire_le) <= new Date()) return 'expire';
  return 'actif';
}

function versCode(v) {
  return {
    id: v.id,
    code: v.code,
    code_formate: codes.formater(v.code),
    civilite: v.civilite,
    nom: v.beneficiaire_nom,
    email: v.beneficiaire_email,
    tel: v.beneficiaire_tel,
    note: v.note,
    expire_le: iso(v.expire_le),
    revoque_le: iso(v.revoque_le),
    motif_revocation: v.motif_revocation,
    premiere_utilisation: iso(v.premiere_utilisation),
    derniere_utilisation: iso(v.derniere_utilisation),
    nb_connexions: v.nb_connexions,
    appareils: v.appareils || 0,
    fiches: v.fiches || 0,
    cree_par_nom: v.cree_par_nom || null,
    cree_le: iso(v.cree_le),
    statut: statutCode(v),
  };
}

const SQL_CODES = `select v.*, ad.nom as cree_par_nom,
    (select count(distinct c.ip_empreinte)::int from consultations c where c.voucher_id = v.id) as appareils,
    (select count(*)::int from consultations c where c.voucher_id = v.id and c.evenement = 'fiche') as fiches
  from vouchers v left join admins ad on ad.id = v.cree_par
  where v.anonymise_le is null`;

async function lireCode(id) {
  const v = await db.une(`${SQL_CODES} and v.id = $1`, [id]);
  if (!v) throw new E(404, 'introuvable', 'Code introuvable.');
  return v;
}

function champsBeneficiaire(corps, obligatoire) {
  const out = {};
  if (corps.nom !== undefined || obligatoire) {
    const nom = typeof corps.nom === 'string' ? corps.nom.trim() : '';
    if (!nom) throw new E(422, 'invalide', 'Indiquez le nom du bénéficiaire.');
    if (nom.length > 120) throw new E(422, 'invalide', 'Nom trop long.');
    out.beneficiaire_nom = nom;
  }
  if (corps.civilite !== undefined) {
    if (corps.civilite !== null && corps.civilite !== '' && !['monsieur', 'madame'].includes(corps.civilite)) {
      throw new E(422, 'invalide', 'Civilité non reconnue.');
    }
    out.civilite = corps.civilite || null;
  }
  if (corps.email !== undefined) {
    const email = texteOptionnel(corps.email, 200, 'E-mail');
    if (email && !MOTIF_EMAIL.test(email)) throw new E(422, 'invalide', 'Adresse e-mail invalide.');
    out.beneficiaire_email = email;
  }
  if (corps.tel !== undefined) {
    const tel = texteOptionnel(corps.tel, 30, 'Téléphone');
    if (tel && !MOTIF_TEL.test(tel)) throw new E(422, 'invalide', 'Numéro de téléphone invalide.');
    out.beneficiaire_tel = tel;
  }
  if (corps.note !== undefined) out.note = texteOptionnel(corps.note, 500, 'Note');
  return out;
}

function dateExpiration(corps, base) {
  if (corps.expire_le) {
    if (typeof corps.expire_le !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(corps.expire_le)) {
      throw new E(422, 'invalide', 'Date de fin invalide.');
    }
    const d = dates.finDeJourneeParis(corps.expire_le);
    if (Number.isNaN(d.getTime()) || d <= new Date()) throw new E(422, 'invalide', 'La date de fin doit être dans le futur.');
    if (d > dates.dansMoisParis(24)) throw new E(422, 'invalide', 'Deux ans de validité au maximum.');
    return d;
  }
  const mois = corps.duree_mois === undefined ? config.dureeCodeMoisDefaut : Number(corps.duree_mois);
  if (!config.dureesCodeMois.includes(mois)) throw new E(422, 'invalide', 'Durée non reconnue.');
  return dates.dansMoisParis(mois, base);
}

async function codesListe(req, res) {
  const lignes = await db.requete(`${SQL_CODES} order by v.cree_le desc`);
  h.envoyerJson(res, 200, { codes: lignes.map(versCode) });
}

async function codeCreer(req, res, _m, admin) {
  const corps = await h.lireJson(req, 5000);
  const b = champsBeneficiaire(corps, true);
  const expire = dateExpiration(corps);
  for (let essai = 0; essai < 5; essai++) {
    const code = codes.generer();
    if (await db.une('select 1 from vouchers where code = $1', [code])) continue;
    const v = await db.une(
      `insert into vouchers (code, civilite, beneficiaire_nom, beneficiaire_email, beneficiaire_tel, note, expire_le, cree_par)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [code, b.civilite || null, b.beneficiaire_nom, b.beneficiaire_email || null, b.beneficiaire_tel || null,
        b.note || null, expire.toISOString(), admin.id]);
    return h.envoyerJson(res, 201, { code: versCode(await lireCode(v.id)) });
  }
  throw new Error('Impossible de générer un code unique.');
}

async function codeLire(req, res, m) {
  const v = await lireCode(Number(m[1]));
  const historique = await db.requete(
    `select c.evenement, c.cree_le, a.pub_id, a.titre
       from consultations c left join annonces a on a.id = c.annonce_id
      where c.voucher_id = $1 order by c.cree_le desc limit 200`, [v.id]);
  h.envoyerJson(res, 200, {
    code: versCode(v),
    historique: historique.map((e) => ({ evenement: e.evenement, le: iso(e.cree_le), bien: e.pub_id ? { id: e.pub_id, titre: e.titre } : null })),
  });
}

async function codeModifier(req, res, m, admin) {
  const v = await lireCode(Number(m[1]));
  const corps = await h.lireJson(req, 5000);
  const maj = champsBeneficiaire(corps, false);
  if (corps.expire_le) maj.expire_le = dateExpiration({ expire_le: corps.expire_le }).toISOString();
  if (corps.prolonger_mois !== undefined) {
    const base = new Date(v.expire_le) > new Date() ? new Date(v.expire_le) : new Date();
    maj.expire_le = dateExpiration({ duree_mois: corps.prolonger_mois }, base).toISOString();
  }
  if (corps.revoquer) {
    maj.revoque_le = new Date().toISOString();
    maj.revoque_par = admin.id;
    maj.motif_revocation = texteOptionnel(corps.revoquer.motif, 300, 'Motif');
  }
  if (corps.retablir === true) {
    maj.revoque_le = null; maj.revoque_par = null; maj.motif_revocation = null;
  }
  const cols = Object.keys(maj);
  if (cols.length) {
    const params = cols.map((c) => maj[c]);
    params.push(v.id);
    await db.requete(
      `update vouchers set ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')} where id = $${params.length}`, params);
  }
  h.envoyerJson(res, 200, { code: versCode(await lireCode(v.id)) });
}

async function codeSupprimer(req, res, m) {
  const v = await lireCode(Number(m[1]));
  await db.requete('delete from vouchers where id = $1', [v.id]);
  h.envoyerVide(res, 204);
}

// Export pour Excel en français : séparateur « ; », BOM UTF-8, et neutralisation des cellules
// qui commencent par = + - @ (sinon Excel les exécuterait comme des formules).
function celluleCsv(valeur) {
  let t = valeur === null || valeur === undefined ? '' : String(valeur);
  if (/^\+33\s?[1-9]/.test(t)) t = '0' + t.replace(/^\+33\s?/, '');
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return '"' + t.replace(/"/g, '""') + '"';
}

const LIBELLES_STATUT = { actif: 'Actif', expire: 'Expiré', revoque: 'Révoqué' };

function codesCsv(lignes) {
  const jour = (d) => (d ? dates.jourParis(new Date(d)).split('-').reverse().join('/') : '');
  const entete = ['Bénéficiaire', 'Civilité', 'E-mail', 'Téléphone', 'Code', 'Créé le', 'Créé par', 'Valable jusqu\'au',
    'Statut', 'Première visite', 'Dernière visite', 'Connexions', 'Fiches consultées', 'Note'];
  const rangs = lignes.map((v) => {
    const c = versCode(v);
    return [c.nom, c.civilite === 'monsieur' ? 'M.' : c.civilite === 'madame' ? 'Mme' : '', c.email, c.tel,
      c.code_formate, jour(c.cree_le), c.cree_par_nom, jour(c.expire_le), LIBELLES_STATUT[c.statut],
      jour(c.premiere_utilisation), jour(c.derniere_utilisation), c.nb_connexions, c.fiches, c.note];
  });
  return '﻿' + [entete].concat(rangs).map((r) => r.map(celluleCsv).join(';')).join('\r\n') + '\r\n';
}

async function codesExport(req, res) {
  const lignes = await db.requete(`${SQL_CODES} order by v.cree_le desc`);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="codes-acces-${dates.jourParis(new Date())}.csv"`);
  res.setHeader('Cache-Control', 'no-store');
  res.end(codesCsv(lignes));
}

// =====================================================================
// Activité (tableau de bord)
// =====================================================================
async function activite(req, res) {
  const chiffres = await db.une(`select
      (select count(*)::int from annonces where supprime_le is null and statut in ('publiee','sous_offre')) as en_ligne,
      (select count(*)::int from annonces where supprime_le is null and statut = 'brouillon') as brouillons,
      (select count(*)::int from vouchers where anonymise_le is null and revoque_le is null and expire_le > now()) as codes_actifs,
      (select count(*)::int from consultations where evenement = 'connexion' and cree_le > now() - interval '30 days') as connexions_30j,
      (select count(*)::int from consultations where evenement = 'fiche' and cree_le > now() - interval '30 days') as fiches_30j,
      (select count(*)::int from consultations where evenement in ('contact_tel','contact_mail') and cree_le > now() - interval '30 days') as contacts_30j`);
  const evenements = await db.requete(
    `select c.evenement, c.cree_le, v.id as code_id, v.civilite, v.beneficiaire_nom, a.pub_id, a.titre
       from consultations c join vouchers v on v.id = c.voucher_id left join annonces a on a.id = c.annonce_id
      where v.anonymise_le is null
      order by c.cree_le desc limit 25`);
  h.envoyerJson(res, 200, {
    chiffres,
    evenements: evenements.map((e) => ({
      evenement: e.evenement, le: iso(e.cree_le),
      personne: { code_id: e.code_id, civilite: e.civilite, nom: e.beneficiaire_nom },
      bien: e.pub_id ? { id: e.pub_id, titre: e.titre } : null,
    })),
  });
}

// =====================================================================
// Aiguillage
// =====================================================================
const ID = '([a-z0-9]{10})';
const ROUTES = [
  ['POST', /^session$/, connexion, { public: true }],
  ['GET', /^session$/, moi, { mdp: true }],
  ['PATCH', /^session$/, changerMdp, { mdp: true }],
  ['DELETE', /^session$/, deconnexion, { public: true }],
  ['GET', /^equipe$/, equipeListe],
  ['POST', /^equipe$/, equipeCreer],
  ['PATCH', /^equipe\/(\d{1,9})$/, equipeModifier],
  ['POST', /^equipe\/(\d{1,9})\/reinitialiser$/, equipeReinitialiser],
  ['GET', /^annonces$/, annoncesListe],
  ['POST', /^annonces$/, annonceCreer],
  ['GET', new RegExp(`^annonces/${ID}$`), annonceLire],
  ['PATCH', new RegExp(`^annonces/${ID}$`), annonceModifier],
  ['DELETE', new RegExp(`^annonces/${ID}$`), annonceSupprimer],
  ['POST', new RegExp(`^annonces/${ID}/restaurer$`), annonceRestaurer],
  ['POST', new RegExp(`^annonces/${ID}/dupliquer$`), annonceDupliquer],
  ['POST', new RegExp(`^annonces/${ID}/photos$`), photoAjouter],
  ['PUT', new RegExp(`^annonces/${ID}/photos/ordre$`), photosOrdre],
  ['PATCH', /^photos\/(\d{1,9})$/, photoModifier],
  ['DELETE', /^photos\/(\d{1,9})$/, photoSupprimer],
  ['GET', /^codes$/, codesListe],
  ['POST', /^codes$/, codeCreer],
  ['GET', /^codes\/export$/, codesExport],
  ['GET', /^codes\/(\d{1,9})$/, codeLire],
  ['PATCH', /^codes\/(\d{1,9})$/, codeModifier],
  ['DELETE', /^codes\/(\d{1,9})$/, codeSupprimer],
  ['GET', /^activite$/, activite],
];

function chemin(req) {
  const p = h.parametres(req).get('chemin');
  if (p !== null) return p.replace(/^\/+|\/+$/g, '');
  const brut = new URL(req.url, 'http://localhost').pathname;
  return brut.replace(/^\/api\/admin\/?/, '').replace(/\/+$/, '');
}

async function aiguiller(req, res) {
  const c = chemin(req);
  let trouveeAutreMethode = false;
  for (const [methode, motif, fn, opts = {}] of ROUTES) {
    const m = c.match(motif);
    if (!m) continue;
    if (methode !== req.method) { trouveeAutreMethode = true; continue; }
    if (req.method !== 'GET') h.exigerOrigine(req);
    const admin = opts.public ? null : await s.exigerAdmin(req, { memeSiMdpAChanger: Boolean(opts.mdp) });
    return fn(req, res, m, admin);
  }
  if (trouveeAutreMethode) throw new E(405, 'methode', 'Méthode non autorisée.');
  throw new E(404, 'introuvable', 'Adresse inconnue.');
}

const tout = { GET: aiguiller, POST: aiguiller, PATCH: aiguiller, PUT: aiguiller, DELETE: aiguiller };
module.exports = h.gerer(tout);
module.exports._test = { celluleCsv, codesCsv };
