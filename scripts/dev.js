#!/usr/bin/env node
'use strict';
// Serveur local : fait tourner tout l'espace transaction sur ce poste, sans aucun compte en ligne.
// Il reproduit le comportement de Vercel (adresses sans .html, réécriture /api/admin/*,
// en-têtes de sécurité de vercel.json) et branche une base PGlite + un stockage de photos local.
//
//   npm run dev                 → http://localhost:3000 (données de démonstration au premier lancement)
//   npm run dev -- --port 4000  → autre port
//   npm run dev -- --sans-demo  → base vide (il faudra créer un admin : npm run admin)
//   npm run demo                → idem, et ouvre le navigateur
//
// Site vitrine : si le site de Laetitia est trouvé (dossier ../creations/petra-gest-site, ou --vitrine <dossier>),
// il est servi sur le port principal (3000) et l'espace transaction sur le suivant (3001), comme en ligne
// (petragest.com et transactions.petragest.com). Les fichiers du site vitrine ne sont jamais modifiés : c'est ce serveur
// qui relie les deux (bouton « Accès transaction » vers l'espace, « Retour au site » vers la vitrine).

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const RACINE = path.join(__dirname, '..');
const PUBLIC = path.join(RACINE, 'public');
const LOCAL = path.join(RACINE, '.local');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2', '.pdf': 'application/pdf',
};

// ---------- Variables d'environnement locales ----------
function preparerEnv(port) {
  const fichier = path.join(RACINE, '.env.local');
  if (!fs.existsSync(fichier)) {
    const alea = () => crypto.randomBytes(32).toString('base64url');
    fs.writeFileSync(fichier, [
      '# Généré automatiquement par « npm run dev » : secrets locaux, jamais utilisés en ligne.',
      `SESSION_SECRET=${alea()}`,
      `IP_SECRET=${alea()}`,
      `CRON_SECRET=${alea()}`,
      '',
    ].join('\n'));
  }
  process.loadEnvFile(fichier);
  if (!process.env.PUBLIC_ORIGIN) process.env.PUBLIC_ORIGIN = `http://localhost:${port}`;
}

// ---------- En-têtes et réécritures lus dans vercel.json ----------
const vercel = JSON.parse(fs.readFileSync(path.join(RACINE, 'vercel.json'), 'utf8'));
const reglesEntetes = (vercel.headers || []).map((r) => ({ motif: new RegExp(`^${r.source}$`), entetes: r.headers }));

function appliquerEntetes(res, chemin) {
  for (const r of reglesEntetes) {
    if (!r.motif.test(chemin)) continue;
    for (const { key, value } of r.entetes) {
      // En local, pas de HTTPS : on n'annonce pas HSTS.
      if (key === 'Strict-Transport-Security') continue;
      res.setHeader(key, value);
    }
  }
}

function fichierStatique(chemin) {
  const cibles = chemin === '/' ? ['/index.html'] : [chemin, `${chemin}.html`];
  for (const c of cibles) {
    const complet = path.resolve(PUBLIC, '.' + c);
    if (!complet.startsWith(PUBLIC + path.sep)) return null;
    if (fs.existsSync(complet) && fs.statSync(complet).isFile()) return complet;
  }
  return null;
}

function servirFichier(res, fichier, statut, cache, transformerHtml) {
  res.statusCode = statut || 200;
  res.setHeader('Content-Type', TYPES[path.extname(fichier).toLowerCase()] || 'application/octet-stream');
  if (cache) res.setHeader('Cache-Control', cache);
  if (transformerHtml && fichier.endsWith('.html')) {
    let texte;
    try { texte = fs.readFileSync(fichier, 'utf8'); } catch { res.statusCode = 404; return res.end('Page introuvable'); }
    return res.end(transformerHtml(texte));
  }
  const flux = fs.createReadStream(fichier);
  flux.on('error', () => {
    if (!res.headersSent) { res.statusCode = 404; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); }
    res.end('Page introuvable');
  });
  flux.pipe(res);
}

// En démonstration avec le site vitrine, les liens « petragest.com » des pages de l'espace
// pointent vers le site vitrine local.
function versVitrineLocale(liens) {
  return liens && liens.vitrine ? (html) => html.split('https://petragest.com').join(liens.vitrine) : null;
}

function creerServeur({ stockage, journal, liens }) {
  return http.createServer(async (req, res) => {
    const debut = Date.now();
    res.on('finish', () => {
      if (journal) journal(`${req.method} ${req.url} → ${res.statusCode} (${Date.now() - debut} ms)`);
    });
    try {
      const url = new URL(req.url, 'http://localhost');
      let chemin;
      try { chemin = decodeURIComponent(url.pathname); } catch { res.statusCode = 400; return res.end(); }
      appliquerEntetes(res, chemin);

      // Fonctions serveur
      if (chemin.startsWith('/api/')) {
        const admin = chemin.match(/^\/api\/admin\/(.+)$/);
        if (admin) {
          url.searchParams.set('chemin', admin[1]);
          req.url = `/api/admin?${url.searchParams.toString()}`;
        }
        const nom = chemin.slice(5).split('/')[0];
        const fichier = path.join(RACINE, 'api', `${nom}.js`);
        if (!/^[a-z]+$/.test(nom) || !fs.existsSync(fichier)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          return res.end(JSON.stringify({ erreur: 'introuvable', message: 'Adresse inconnue.' }));
        }
        return await require(fichier)(req, res);
      }

      // Photos du stockage local
      if (chemin.startsWith('/_stockage/')) {
        const f = stockage.cheminDe(chemin);
        if (f && fs.existsSync(f)) return servirFichier(res, f, 200, 'public, max-age=31536000, immutable');
        res.statusCode = 404; return res.end();
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; return res.end(); }

      // Comportement « cleanUrls » et « trailingSlash: false » de Vercel
      if (chemin.length > 1 && chemin.endsWith('/')) {
        res.statusCode = 308; res.setHeader('Location', chemin.replace(/\/+$/, '') + url.search); return res.end();
      }
      if (chemin.endsWith('.html')) {
        const propre = chemin === '/index.html' ? '/' : chemin.slice(0, -5);
        res.statusCode = 308; res.setHeader('Location', propre + url.search); return res.end();
      }
      const fichier = fichierStatique(chemin);
      if (fichier) return servirFichier(res, fichier, 200, null, versVitrineLocale(liens));
      return servirFichier(res, path.join(PUBLIC, '404.html'), 404, null, versVitrineLocale(liens));
    } catch (e) {
      console.error(e);
      if (!res.headersSent) { res.statusCode = 500; res.end('Erreur serveur'); }
    }
  });
}

// Serveur du site vitrine : fichiers de Laetitia servis tels quels, en lecture seule.
function creerServeurVitrine({ dossier, liens, journal }) {
  const racine = path.resolve(dossier);
  return http.createServer((req, res) => {
    const debut = Date.now();
    res.on('finish', () => { if (journal) journal(`[vitrine] ${req.method} ${req.url} → ${res.statusCode} (${Date.now() - debut} ms)`); });
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; return res.end(); }
    const url = new URL(req.url, 'http://localhost');
    let chemin;
    try { chemin = decodeURIComponent(url.pathname); } catch { res.statusCode = 400; return res.end(); }
    // Bouton « Accès transaction » du site : direction l'espace transaction.
    if (/^\/acces-transaction(\.html)?\/?$/.test(chemin)) {
      res.statusCode = 302; res.setHeader('Location', liens.espace + '/'); return res.end();
    }
    // Lien « Prestations » du menu (la page n'existe pas encore) : section « Nos prestations » de l'accueil.
    if (/^\/prestations(\.html)?\/?$/.test(chemin)) {
      res.statusCode = 302; res.setHeader('Location', '/index.html#prestations'); return res.end();
    }
    const cible = chemin === '/' ? '/index.html' : chemin;
    const candidats = cible.endsWith('.html') ? [cible] : [cible, `${cible}.html`];
    for (const c of candidats) {
      const complet = path.resolve(racine, '.' + c);
      if (!complet.startsWith(racine + path.sep)) break;
      if (fs.existsSync(complet) && fs.statSync(complet).isFile()) {
        res.setHeader('Cache-Control', 'no-cache');
        return servirFichier(res, complet);
      }
    }
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!DOCTYPE html><meta charset="utf-8"><title>Page introuvable</title>'
      + '<p style="font-family:sans-serif;padding:2rem">Cette page n\'existe pas encore dans le site. '
      + '<a href="/">Retour à l\'accueil</a></p>');
  });
}

function ecouter(serveur, port) {
  return new Promise((resolve, reject) => {
    serveur.once('error', reject);
    serveur.listen(port, '127.0.0.1', resolve);
  });
}

// Dossier du site vitrine : --vitrine, sinon ../creations/petra-gest-site (emplacement dans l'atelier).
function trouverVitrine(explicite) {
  const candidats = explicite ? [explicite] : [path.join(RACINE, '..', 'creations', 'petra-gest-site')];
  for (const d of candidats) if (d && fs.existsSync(path.join(d, 'index.html'))) return path.resolve(d);
  if (explicite) throw new Error(`Site vitrine introuvable : ${explicite} (il doit contenir index.html).`);
  return null;
}

// Démarre tout. Utilisé par « npm run dev » et par les tests (options memoire / port 0).
async function demarrer(options = {}) {
  const port = options.port === undefined ? Number(process.env.PORT || 3000) : options.port;
  if (!options.memoire) preparerEnv(port);
  const log = options.silencieux ? () => {} : (m) => console.log(m);

  const { stockageLocal } = require('./local/stockage');
  const stockage = stockageLocal(options.dossierStockage || path.join(LOCAL, 'stockage'));

  let base = null;
  if (process.env.DATABASE_URL && !options.memoire) {
    log('Base : Neon (DATABASE_URL trouvée dans .env.local).');
  } else {
    const { ouvrirBaseLocale } = require('./local/base');
    base = await ouvrirBaseLocale(options.memoire ? null : path.join(LOCAL, 'base'));
    globalThis.__PETRA_DB_LOCALE__ = base;
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN || options.memoire) globalThis.__PETRA_STOCKAGE_LOCAL__ = stockage;

  const { migrer } = require('../api/_lib/migrations');
  await migrer(log);

  if (options.demo !== false) {
    const { peuplerSiVide, assurerCompteRapide } = require('./local/demo');
    await peuplerSiVide(log);
    await assurerCompteRapide(log);
  }
  // Bandeau « maquette de démonstration » seulement si la base contient les comptes fictifs.
  const db = require('../api/_lib/db');
  const demo = await db.une("select 1 as oui from admins where email like '%@demo.petragest.local' limit 1");
  if (demo) process.env.PETRA_DEMO = '1'; else delete process.env.PETRA_DEMO;

  const journal = options.journal ? log : null;
  const liens = { vitrine: null, espace: null };
  let serveurVitrine = null;
  let portVitrine = null;
  if (options.vitrine) {
    serveurVitrine = creerServeurVitrine({ dossier: options.vitrine, liens, journal });
    await ecouter(serveurVitrine, port);
    portVitrine = serveurVitrine.address().port;
    liens.vitrine = `http://localhost:${portVitrine}`;
  }
  const serveur = creerServeur({ stockage, journal, liens });
  await ecouter(serveur, options.vitrine ? (port === 0 ? 0 : port + 1) : port);
  liens.espace = `http://localhost:${serveur.address().port}`;
  if (options.vitrine) process.env.PUBLIC_ORIGIN = liens.espace;
  serveur.on('close', () => {
    if (serveurVitrine) serveurVitrine.close();
    if (base) base.fermer().catch(() => {});
  });
  return { serveur, port: serveur.address().port, stockage, serveurVitrine, portVitrine };
}

function ouvrirNavigateur(url) {
  const { exec } = require('node:child_process');
  if (process.platform === 'win32') exec(`start "" "${url}"`);
  else if (process.platform === 'darwin') exec(`open "${url}"`);
  else exec(`xdg-open "${url}"`);
}

module.exports = { demarrer };

if (require.main === module) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--port');
  const port = i >= 0 ? Number(args[i + 1]) : undefined;
  const j = args.indexOf('--vitrine');
  let vitrine = null;
  try { vitrine = args.includes('--sans-vitrine') ? null : trouverVitrine(j >= 0 ? args[j + 1] : null); } catch (e) { console.error(e.message); process.exit(1); }
  demarrer({ port, vitrine, demo: !args.includes('--sans-demo'), journal: args.includes('--journal') })
    .then(({ port: p, portVitrine }) => {
      console.log('');
      if (portVitrine) {
        console.log('  Site Petra Gest et espace transaction, en local');
        console.log(`  Site vitrine (lien à ouvrir) : http://localhost:${portVitrine}`);
        console.log(`  Espace transaction           : http://localhost:${p}`);
        console.log(`  Gestion (équipe)             : http://localhost:${p}/espace-gestion`);
        console.log(`  Fichiers du site vitrine     : ${vitrine}`);
      } else {
        console.log('  Espace transaction Petra Gest, en local');
        console.log(`  Visiteurs  : http://localhost:${p}`);
        console.log(`  Gestion    : http://localhost:${p}/espace-gestion`);
      }
      console.log('  Identifiants de démonstration : voir README.md');
      console.log('  Arrêter : Ctrl + C');
      console.log('');
      if (args.includes('--ouvrir')) ouvrirNavigateur(`http://localhost:${portVitrine || p}`);
    })
    .catch((e) => {
      if (e && e.code === 'EADDRINUSE') console.error('Le port est déjà utilisé (un autre serveur tourne ?). Essayez : npm run dev -- --port 3100');
      else console.error(e);
      process.exit(1);
    });
}
