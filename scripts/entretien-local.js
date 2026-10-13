#!/usr/bin/env node
'use strict';
// Lance à la main l'entretien hebdomadaire (purges RGPD, corbeille, fichiers orphelins)
// sur la base locale, ou sur la base en ligne avec --env. En ligne, Vercel le fait tout seul chaque lundi.

const { ouvrir } = require('./local/connexion');

(async () => {
  const c = await ouvrir();
  const { entretien } = require('../api/cron');
  const bilan = await entretien();
  console.log(`Entretien terminé (${c.type === 'neon' ? 'base en ligne' : 'base locale'}) :`);
  console.table(bilan);
  await c.fermer();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
