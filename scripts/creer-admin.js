#!/usr/bin/env node
'use strict';
// Crée un compte de l'espace de gestion (ou réinitialise son mot de passe s'il existe).
// Un mot de passe provisoire est affiché UNE fois ; il devra être changé à la première connexion.
//
//   node scripts/creer-admin.js "prenom.nom@petragest.com" "Prénom Nom"
//   node scripts/creer-admin.js "prenom.nom@petragest.com" "Prénom Nom" --env .env.production.local   (base en ligne)
//
// En local, arrêtez d'abord « npm run dev » (la base locale n'accepte qu'un programme à la fois).

const { ouvrir } = require('./local/connexion');

(async () => {
  const args = process.argv.slice(2).filter((a, i, t) => a !== '--env' && t[i - 1] !== '--env');
  const [email, nom] = args;
  if (!email || !nom || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    console.log('Usage : node scripts/creer-admin.js "prenom.nom@petragest.com" "Prénom Nom" [--env fichier]');
    process.exit(1);
  }
  const c = await ouvrir();
  const { migrer } = require('../api/_lib/migrations');
  await migrer();
  const db = require('../api/_lib/db');
  const sec = require('../api/_lib/securite');
  const temporaire = sec.motDePasseTemporaire();
  const hash = await sec.hacherMotDePasse(temporaire);
  const existant = await db.une('select id from admins where lower(email) = lower($1)', [email]);
  if (existant) {
    await db.requete(`update admins set mdp_hash = $1, doit_changer_mdp = true, actif = true,
      session_version = session_version + 1 where id = $2`, [hash, existant.id]);
    console.log(`Compte existant réinitialisé : ${email}`);
  } else {
    await db.requete('insert into admins (email, nom, mdp_hash, doit_changer_mdp) values ($1, $2, $3, true)',
      [email.toLowerCase(), nom, hash]);
    console.log(`Compte créé : ${nom} <${email}>`);
  }
  console.log(`Mot de passe provisoire (à transmettre de vive voix, affiché une seule fois) : ${temporaire}`);
  console.log(`Base : ${c.type === 'neon' ? 'en ligne (Neon)' : 'locale'}`);
  await c.fermer();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
