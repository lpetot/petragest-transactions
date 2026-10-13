'use strict';
// Applique les fichiers sql/NNN_*.sql pas encore passés, dans l'ordre.
// Utilisé par scripts/migrer.js (base Neon) et scripts/dev.js (base locale).

const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');

const DOSSIER = path.join(__dirname, '..', '..', 'sql');

function instructions(texte) {
  return texte
    .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
    .split(/;\s*$/m).map((s) => s.trim()).filter(Boolean);
}

async function migrer(journal) {
  const log = journal || (() => {});
  await db.requete(`create table if not exists migrations (
    nom text primary key, appliquee_le timestamptz not null default now())`);
  const faites = new Set((await db.requete('select nom from migrations')).map((r) => r.nom));
  const fichiers = fs.readdirSync(DOSSIER).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
  let n = 0;
  for (const f of fichiers) {
    if (faites.has(f)) continue;
    for (const instr of instructions(fs.readFileSync(path.join(DOSSIER, f), 'utf8'))) {
      await db.requete(instr);
    }
    await db.requete('insert into migrations (nom) values ($1)', [f]);
    log(`Migration appliquée : ${f}`);
    n++;
  }
  return n;
}

module.exports = { migrer };
