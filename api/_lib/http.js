'use strict';
// Outils HTTP communs aux fonctions. Aucune dépendance aux « helpers » Vercel
// (req.body, res.json...) : le même code tourne sur Vercel et dans scripts/dev.js.
// Sur Vercel, régler NODEJS_HELPERS=0 pour que le corps brut reste lisible.

const { lire, surVercel } = require('./env');

class ErreurHttp extends Error {
  constructor(statut, code, message, extra) {
    super(message);
    this.statut = statut;
    this.code = code;
    this.extra = extra || null;
  }
}

function envoyerJson(res, statut, donnees) {
  const corps = JSON.stringify(donnees);
  res.statusCode = statut;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(corps);
}

function envoyerVide(res, statut) {
  res.statusCode = statut || 204;
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

function lireCorps(req, max) {
  return new Promise((resolve, reject) => {
    const morceaux = [];
    let taille = 0;
    let fini = false;
    req.on('data', (m) => {
      if (fini) return;
      taille += m.length;
      if (taille > max) {
        fini = true;
        reject(new ErreurHttp(413, 'trop_gros', 'Le fichier envoyé est trop lourd.'));
        req.resume();
        return;
      }
      morceaux.push(m);
    });
    req.on('end', () => { if (!fini) { fini = true; resolve(Buffer.concat(morceaux)); } });
    req.on('error', (e) => { if (!fini) { fini = true; reject(e); } });
  });
}

async function lireJson(req, max) {
  const type = String(req.headers['content-type'] || '');
  if (!type.startsWith('application/json')) {
    throw new ErreurHttp(415, 'format', 'Requête mal formée.');
  }
  const brut = await lireCorps(req, max || 100000);
  if (!brut.length) return {};
  let obj;
  try { obj = JSON.parse(brut.toString('utf8')); } catch {
    throw new ErreurHttp(400, 'format', 'Requête mal formée.');
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new ErreurHttp(400, 'format', 'Requête mal formée.');
  }
  return obj;
}

function parametres(req) {
  return new URL(req.url, 'http://localhost').searchParams;
}

function ip(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || String(req.headers['x-real-ip'] || '') || (req.socket && req.socket.remoteAddress) || 'inconnue';
}

function cookies(req) {
  const out = {};
  const brut = String(req.headers.cookie || '');
  for (const morceau of brut.split(';')) {
    const i = morceau.indexOf('=');
    if (i < 0) continue;
    const nom = morceau.slice(0, i).trim();
    if (!nom) continue;
    try { out[nom] = decodeURIComponent(morceau.slice(i + 1).trim()); } catch { /* cookie illisible ignoré */ }
  }
  return out;
}

function estSecurise(req) {
  return surVercel() || String(req.headers['x-forwarded-proto'] || '') === 'https';
}

function ajouterSetCookie(res, valeur) {
  const actuel = res.getHeader('Set-Cookie');
  if (!actuel) res.setHeader('Set-Cookie', [valeur]);
  else res.setHeader('Set-Cookie', [].concat(actuel, valeur));
}

function poserCookie(req, res, nom, valeur, maxAgeSec) {
  const morceaux = [
    `${nom}=${encodeURIComponent(valeur)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSec}`,
  ];
  if (estSecurise(req)) morceaux.push('Secure');
  ajouterSetCookie(res, morceaux.join('; '));
}

function effacerCookie(req, res, nom) {
  const morceaux = [`${nom}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (estSecurise(req)) morceaux.push('Secure');
  ajouterSetCookie(res, morceaux.join('; '));
}

// Protection contre les requêtes forgées depuis un autre site : toute écriture doit venir
// de notre propre origine. En local, toute adresse localhost est acceptée.
function origineAutorisee(req) {
  const origine = String(req.headers.origin || '');
  if (!origine) return false;
  const autorisees = new Set();
  const publique = lire('PUBLIC_ORIGIN');
  if (publique) autorisees.add(publique.replace(/\/$/, ''));
  if (process.env.VERCEL_URL) autorisees.add(`https://${process.env.VERCEL_URL}`);
  if (process.env.VERCEL_BRANCH_URL) autorisees.add(`https://${process.env.VERCEL_BRANCH_URL}`);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) autorisees.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  if (autorisees.has(origine)) return true;
  if (!surVercel() && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origine)) return true;
  return false;
}

function exigerOrigine(req) {
  if (!origineAutorisee(req)) {
    throw new ErreurHttp(403, 'origine', 'Requête refusée.');
  }
}

// Enveloppe une fonction : aiguillage par méthode HTTP et gestion uniforme des erreurs.
// Aucune erreur n'est avalée en silence : tout ce qui n'est pas prévu est journalisé.
function gerer(methodes) {
  return async function handler(req, res) {
    try {
      const fn = methodes[req.method];
      if (!fn) {
        res.setHeader('Allow', Object.keys(methodes).join(', '));
        throw new ErreurHttp(405, 'methode', 'Méthode non autorisée.');
      }
      await fn(req, res);
    } catch (e) {
      if (res.headersSent) { console.error(e); res.end(); return; }
      if (e instanceof ErreurHttp) {
        if (e.statut === 429 && e.extra && e.extra.retryAfter) res.setHeader('Retry-After', String(e.extra.retryAfter));
        envoyerJson(res, e.statut, Object.assign({ erreur: e.code, message: e.message }, e.extra && e.extra.corps));
        return;
      }
      console.error('[erreur serveur]', e);
      envoyerJson(res, 500, { erreur: 'serveur', message: 'Une erreur est survenue. Réessayez dans un instant.' });
    }
  };
}

module.exports = {
  ErreurHttp, envoyerJson, envoyerVide, lireCorps, lireJson, parametres, ip, cookies,
  poserCookie, effacerCookie, origineAutorisee, exigerOrigine, gerer,
};
