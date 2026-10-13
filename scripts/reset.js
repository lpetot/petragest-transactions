#!/usr/bin/env node
'use strict';
// Remet la maquette locale à zéro : efface la base et les photos locales (dossier .local).
// Au prochain « npm run dev », les données de démonstration sont recréées.
// N'agit JAMAIS sur la base en ligne.

const fs = require('node:fs');
const path = require('node:path');

const dossier = path.join(__dirname, '..', '.local');
if (fs.existsSync(dossier)) {
  fs.rmSync(dossier, { recursive: true, force: true });
  console.log('Données locales effacées. Relancez « npm run dev » pour repartir de la démonstration.');
} else {
  console.log('Rien à effacer : aucune donnée locale.');
}
