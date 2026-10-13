#!/usr/bin/env node
'use strict';
// Crée ou met à jour les tables de la base.
//   En ligne : node scripts/migrer.js --env .env.production.local   (après « vercel env pull »)
//   En local : inutile, « npm run dev » le fait tout seul.

const { ouvrir } = require('./local/connexion');

(async () => {
  const c = await ouvrir();
  console.log(`Base : ${c.type === 'neon' ? 'Neon (en ligne)' : 'locale (.local/base)'}`);
  const { migrer } = require('../api/_lib/migrations');
  const n = await migrer(console.log);
  console.log(n ? `${n} migration(s) appliquée(s).` : 'Base déjà à jour.');
  await c.fermer();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
