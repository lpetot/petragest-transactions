#!/usr/bin/env node
'use strict';
// Fiches complètes des biens de l'Arsenal Royal commercialisés par Didier Cannioux (demande de Matis, 20/11/2026).
//  1. Bâtiment C (C204, C301, C307, déjà en ligne) : complète les champs encore vides à partir des dossiers de
//     diagnostics de vente (Cabinet Agenda, mars 2026) : salles d'eau, exposition, fiche technique pièce par pièce
//     (surfaces Carrez), syndic, cadastre (ERRIAL du 18/03/2026), et joint le DPE en PDF (pages DPE du dossier).
//     Un champ déjà rempli n'est jamais écrasé.
//  2. Bâtiment F (F103, F201, F301, vendus) : crée les annonces « vendues », montrées dans le catalogue avec le
//     bandeau « Vendu » et la fiche consultable, sans prix ni date (inconnus). Textes et photos : petra-immo.fr.
//
//   node scripts/completer-arsenal.js --env .env.production.local [--essai]
//   --diag <dossier> : dossier des PDF de diagnostics (défaut : C:\petra-reprise\...\petra-documents\administratifs)
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { ouvrir } = require('./local/connexion');

const essai = process.argv.includes('--essai');
const arg = (nom, defaut) => { const i = process.argv.indexOf(nom); return i > 0 ? process.argv[i + 1] : defaut; };
const DIAG = arg('--diag', 'C:/petra-reprise/01-extrait/wp-content/wp-content/petra-documents/administratifs');
const DOSSIER_F = path.join(__dirname, 'import', 'batiment-f');
const PYTHON = arg('--python', 'C:/Users/mjdat/.mjdata/html2pdf-venv/Scripts/python.exe');

const CARLA = '06 72 48 20 08';
const COMMUN_C = {
  construction: 'Pierre, monument historique du XVIIe siècle (construit avant 1948)',
  syndic_type: 'professionnel', syndic_nom: 'Petra Gest', syndic_tel: CARLA,
  cadastre: 'Rochefort (17299), section BI n° 38',
  travaux_realises: "Restauration complète de l'appartement et de l'immeuble (monument historique inscrit).",
  loue: false,
};
const piece = (type, nom, surface, niveau) => ({ type, nom, surface, ...(niveau ? { niveau } : {}) });

// Surfaces Carrez des attestations du dossier de diagnostics (pages « Surface privative »).
const C = {
  wd2mq6ai1b: {
    lot: 'C204', pdf: 'Diagnostics-vente-C204.pdf', nb_sdb: 2,
    pieces: [piece('sejour', 'Séjour', 33.56, 'n2'), piece('chambre', 'Chambre 1', 16.6, 'n2'), piece('chambre', 'Chambre 2', 13.42, 'n2'),
      piece('chambre', 'Chambre 3', 13.96, 'n2'), piece('salle_bains', 'Salle de bains', 8.06, 'n2'), piece('cuisine', 'Cuisine', 5.09, 'n2'),
      piece('salle_eau', "Salle d'eau", 6.15, 'n2')],
  },
  ndqguteudt: {
    lot: 'C301', pdf: 'Diagnostics-vente-C301.pdf', nb_sdb: 2, exposition: 'sud_est',
    pieces: [piece('sejour', 'Séjour-cuisine', 40.49), piece('salle_bains', 'Salle de bains', 3.52), piece('wc', 'WC', 1.77),
      piece('chambre', 'Chambre 1', 10.08), piece('chambre', 'Chambre 2', 13.05), piece('autre', 'Débarras', 2.42),
      piece('chambre', 'Chambre 3', 18.91), piece('salle_eau', "Salle d'eau", 3.93)],
  },
  o5rf15o7lm: {
    lot: 'C307', pdf: 'Diagnostics-C307.pdf', nb_sdb: 2, exposition: 'nord_ouest',
    pieces: [piece('entree', 'Entrée', 5.14), piece('chambre', 'Chambre 1', 14.24), piece('wc', 'WC', 1.91), piece('salle_eau', "Salle d'eau 1", 3.6),
      piece('sejour', 'Séjour-cuisine', 35.51), piece('chambre', 'Chambre 2', 11.04), piece('chambre', 'Chambre 3', 23.64),
      piece('salle_eau', "Salle d'eau 2", 3.66)],
  },
};

// Pages du DPE dans le dossier de diagnostics (« Page 1/11 » à « Page 11/11 ») : extraites en un PDF à part.
function extraireDpe(pdf) {
  const sortie = path.join(require('node:os').tmpdir(), `dpe-${path.basename(pdf)}`);
  const code = [
    'import pymupdf,sys,re',
    'd=pymupdf.open(sys.argv[1])',
    'deb=next(i for i,p in enumerate(d) if re.search(r"Page 1/(\\d+)",p.get_text()))',
    'n=int(re.search(r"Page 1/(\\d+)",d[deb].get_text()).group(1))',
    'o=pymupdf.open();o.insert_pdf(d,from_page=deb,to_page=deb+n-1);o.save(sys.argv[2],garbage=4,deflate=True)',
    'print(deb+1,deb+n)',
  ].join('\n');
  const pages = execFileSync(PYTHON, ['-I', '-W', 'ignore', '-c', code, pdf, sortie], { encoding: 'utf8' }).trim();
  const octets = fs.readFileSync(sortie);
  fs.rmSync(sortie);
  if (octets.subarray(0, 5).toString() !== '%PDF-' || octets.length > 4 * 1024 * 1024) throw new Error(`DPE de ${pdf} invalide ou > 4 Mo`);
  return { octets, pages };
}

function brancherBlob() {
  const jeton = process.env.BLOB_READ_WRITE_TOKEN;
  if (!jeton) return;
  const blob = require('@vercel/blob');
  globalThis.__PETRA_STOCKAGE_LOCAL__ = {
    async deposer(chemin, octets, type) {
      const r = await blob.put(chemin, octets, { access: 'public', addRandomSuffix: true, contentType: type, cacheControlMaxAge: 31536000, token: jeton });
      return r.url;
    },
    async lister(prefixe) { return (await blob.list({ prefix: prefixe, limit: 1, token: jeton })).blobs; },
  };
}

(async () => {
  const F = require('../api/_lib/fiche');
  const A = require('../api/_lib/annonces');
  const lotsF = JSON.parse(fs.readFileSync(path.join(DOSSIER_F, 'donnees.json'), 'utf8'));

  // Contrôles avant toute écriture : fiches valides, DPE extractibles, photos présentes.
  const dpe = {};
  for (const [pub, c] of Object.entries(C)) {
    const v = F.valider({ ...COMMUN_C, pieces: c.pieces });
    if (v.erreur) throw new Error(`${c.lot} fiche : ${v.erreur}`);
    dpe[pub] = extraireDpe(path.join(DIAG, c.pdf));
    console.log(`${c.lot} : fiche valide, DPE pages ${dpe[pub].pages} (${Math.round(dpe[pub].octets.length / 1024)} Ko)`);
  }
  for (const l of lotsF) for (const p of l.photos) for (const s of ['g', 'm']) {
    if (!fs.existsSync(path.join(DOSSIER_F, 'photos', `${p}-${s}.jpg`))) throw new Error(`Photo manquante : ${p}-${s}`);
  }
  if (essai) return console.log('Essai : rien écrit.');

  const connexion = await ouvrir();
  if (connexion.type === 'neon') brancherBlob();
  const db = require('../api/_lib/db');
  const stockage = require('../api/_lib/stockage');
  const fichiers = require('../api/_lib/fichiers');
  const sec = require('../api/_lib/securite');
  try {
    await stockage.lister('biens/');
    const admin = await db.une('select id from admins where actif order by id limit 1');

    // 1. Bâtiment C : seulement les champs vides.
    for (const [pub, c] of Object.entries(C)) {
      const a = await db.une("select * from annonces where pub_id = $1 and supprime_le is null", [pub]);
      if (!a) { console.log(`${c.lot} : introuvable, ignoré`); continue; }
      const fiche = a.fiche ? { ...a.fiche } : {};
      for (const [k, v] of Object.entries({ ...COMMUN_C, pieces: c.pieces })) {
        if (fiche[k] === undefined || fiche[k] === null || fiche[k] === '' || (Array.isArray(fiche[k]) && !fiche[k].length)) fiche[k] = v;
      }
      const vf = F.valider(fiche);
      if (vf.erreur) throw new Error(`${c.lot} fiche : ${vf.erreur}`);
      const valeurs = vf.valeur;
      await db.requete(
        `update annonces set fiche = $1::jsonb, nb_sdb = coalesce(nb_sdb, $2), exposition = coalesce(exposition, $3),
                nb_niveaux = coalesce(nb_niveaux, $4), modifie_le = now(), modifie_par = $5 where id = $6`,
        [JSON.stringify(valeurs), c.nb_sdb, c.exposition || null, null, admin.id, a.id]);
      if (!a.dpe_pdf_url) {
        const url = await stockage.deposer(`biens/${pub}/dpe-${require('node:crypto').randomUUID()}.pdf`, dpe[pub].octets, 'application/pdf');
        await db.requete('update annonces set dpe_pdf_url = $1, dpe_pdf_octets = $2 where id = $3', [url, dpe[pub].octets.length, a.id]);
      }
      console.log(`${c.lot} (${pub}) : complétée${a.dpe_pdf_url ? ' (DPE déjà joint)' : ', DPE joint'}.`);
    }

    // 2. Bâtiment F : annonces vendues. Base commune reprise du C204 (adresse, copropriété, protection, carte).
    const base = await db.une("select * from annonces where pub_id = 'wd2mq6ai1b'");
    const communs = await db.requete(
      `select url, url_mini, largeur, hauteur, octets, legende from photos
        where annonce_id = $1 and url like '%arsenal-commun%' order by position`, [base.id]);
    for (const l of lotsF) {
      const deja = await db.une('select pub_id from annonces where reference_interne = $1 and supprime_le is null', [l.reference_interne]);
      if (deja) { console.log(`${l.reference_interne} : déjà là (${deja.pub_id}), laissée telle quelle.`); continue; }
      const champs = {
        type_bien: 'appartement', protection: base.protection, epoque: base.epoque, etat: 'renove',
        adresse: base.adresse, code_postal: base.code_postal, ville: base.ville, code_insee: base.code_insee, quartier: base.quartier,
        lat: base.lat, lng: base.lng, affichage_adresse: 'zone', nb_parkings: 1, copropriete: true, copro_nb_lots: base.copro_nb_lots,
        atouts: ['parquet'], mention_georisques: true,
        titre: l.titre, description: l.description, surface_habitable: l.surface_habitable, surface_carrez: l.surface_habitable,
        nb_pieces: l.nb_pieces, nb_chambres: l.nb_chambres, etage: l.etage, nb_niveaux: l.nb_niveaux,
        reference_interne: l.reference_interne,
        note_interne: 'Bien vendu, commercialisé par Didier Cannioux (petra-immo.fr, page Bâtiment F). Textes, surfaces et photos repris '
          + 'de petra-immo.fr le 20/11/2026. Prix exact et date de vente non connus (fourchette du programme : 480 000 à 590 000 €) : '
          + 'ni prix ni date affichés. Étage déduit du numéro du lot.',
      };
      const { valeurs, erreurs } = A.valider(champs);
      if (erreurs && Object.keys(erreurs).length) throw new Error(`${l.reference_interne} : ${JSON.stringify(erreurs)}`);
      const cols = Object.keys(valeurs);
      const marques = cols.map((c, i) => (c === 'atouts' ? `$${i + 1}::jsonb` : `$${i + 1}`));
      const params = cols.map((c) => (c === 'atouts' ? JSON.stringify(valeurs[c]) : valeurs[c]));
      const pos = A.positionDecalee(valeurs.lat, valeurs.lng);
      const n = cols.length;
      const a = await db.une(
        `insert into annonces (${cols.join(', ')}, pub_id, statut, publie_le, vendu_vitrine, vendu_affichage, lat_pub, lng_pub, cree_par, modifie_par)
         values (${marques.join(', ')}, $${n + 1}, 'vendue', now(), true, $${n + 2}::jsonb, $${n + 3}, $${n + 4}, $${n + 5}, $${n + 5})
         returning id, pub_id`,
        params.concat([sec.identifiantPublic(), JSON.stringify({ lieu: true, surfaces: true, date: false, delai: false, prix: false, fiche: true }),
          pos.lat, pos.lng, admin.id]));
      let i = 0;
      for (const p of l.photos) {
        const grande = fs.readFileSync(path.join(DOSSIER_F, 'photos', `${p}-g.jpg`));
        const mini = fs.readFileSync(path.join(DOSSIER_F, 'photos', `${p}-m.jpg`));
        const url = await stockage.deposer(`biens/${a.pub_id}/${p}-g.jpg`, grande, 'image/jpeg');
        const urlMini = await stockage.deposer(`biens/${a.pub_id}/${p}-m.jpg`, mini, 'image/jpeg');
        const dims = l.reference_interne.endsWith('F301') ? [1067, 1600] : [1000, 1500];
        await db.requete(`insert into photos (annonce_id, position, url, url_mini, largeur, hauteur, octets, legende)
                          values ($1, $2, $3, $4, $5, $6, $7, null)`, [a.id, i++, url, urlMini, dims[0], dims[1], grande.length]);
      }
      // Parties communes : mêmes fichiers que le C204 (partagés, protégés par la règle « fichier encore utilisé »).
      for (const p of communs) {
        await db.requete(`insert into photos (annonce_id, position, url, url_mini, largeur, hauteur, octets, legende)
                          values ($1, $2, $3, $4, $5, $6, $7, $8)`, [a.id, i++, p.url, p.url_mini, p.largeur, p.hauteur, p.octets, p.legende]);
      }
      console.log(`${l.reference_interne} : créée vendue (${a.pub_id}), ${i} photos.`);
    }
    void fichiers;
  } finally {
    await connexion.fermer();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
