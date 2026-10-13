#!/usr/bin/env node
'use strict';
// Charge les données de DÉMONSTRATION (biens, codes et personnes fictifs) dans une base EN LIGNE,
// pour présenter l'espace sur son adresse Vercel de développement (*.vercel.app).
// À ne JAMAIS lancer sur la base de production réelle : le script refuse si un compte existe déjà.
//
//   vercel env pull .env.production.local --environment=production
//   node scripts/demo-en-ligne.js --env .env.production.local
//
// Les deux comptes de démonstration reçoivent un mot de passe tiré au hasard, affiché UNE fois
// (celui du README ne sert qu'en local). Le code visiteur reste celui du README.
// Pour afficher le bandeau « Maquette de démonstration », ajouter PETRA_DEMO=1 dans les variables Vercel.

const { ouvrir } = require('./local/connexion');

(async () => {
  const c = await ouvrir({ neonObligatoire: true });
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
    throw new Error('Stockage Blob introuvable dans le fichier --env : reliez Vercel Blob au projet puis refaites « vercel env pull ».');
  }
  const { migrer } = require('../api/_lib/migrations');
  await migrer(console.log);
  const sec = require('../api/_lib/securite');
  const { peuplerSiVide, CODE_DEMO } = require('./local/demo');
  const mdp = sec.motDePasseTemporaire();
  const fait = await peuplerSiVide(console.log, { mdp });
  if (!fait) {
    console.log('Refusé : la base contient déjà des comptes. Ce script ne s\'applique qu\'à une base vide.');
  } else {
    console.log('');
    console.log('Comptes de gestion (/espace-gestion) :');
    console.log('  direction@demo.petragest.local');
    console.log('  catherine@demo.petragest.local');
    console.log(`  Mot de passe (le même pour les deux, affiché une seule fois) : ${mdp}`);
    console.log(`Code visiteur : ${CODE_DEMO}`);
  }
  await c.fermer();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
