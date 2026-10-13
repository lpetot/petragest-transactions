'use strict';
// Dates à l'heure de Paris. Les fonctions tournent en UTC : sans ces outils,
// un code « valable jusqu'au 25 décembre » expirerait à 1 h du matin le 25.

const FUSEAU = 'Europe/Paris';

// Décalage (en minutes) de Paris par rapport à UTC à un instant donné.
function decalageParis(instant) {
  const parties = new Intl.DateTimeFormat('en-GB', {
    timeZone: FUSEAU, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant);
  const v = Object.fromEntries(parties.map((p) => [p.type, p.value]));
  const commeUtc = Date.UTC(+v.year, +v.month - 1, +v.day, +v.hour, +v.minute, +v.second);
  return Math.round((commeUtc - instant.getTime()) / 60000);
}

// 23:59:59 à Paris le jour AAAA-MM-JJ, renvoyé comme instant (Date).
function finDeJourneeParis(jour) {
  const [a, m, j] = jour.split('-').map(Number);
  const approx = new Date(Date.UTC(a, m - 1, j, 23, 59, 59));
  return new Date(approx.getTime() - decalageParis(approx) * 60000);
}

// Jour (AAAA-MM-JJ) à Paris pour un instant donné.
function jourParis(instant) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU }).format(instant);
}

// Aujourd'hui à Paris + n mois (fin de journée).
function dansMoisParis(n, depuis) {
  const [a, m, j] = jourParis(depuis || new Date()).split('-').map(Number);
  const cible = new Date(Date.UTC(a, m - 1 + n, 1));
  const dernierJour = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  const jour = `${cible.getUTCFullYear()}-${String(cible.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(j, dernierJour)).padStart(2, '0')}`;
  return finDeJourneeParis(jour);
}

function formaterJour(instant) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(instant)).replace(/^1 /, '1er ');
}

module.exports = { finDeJourneeParis, jourParis, dansMoisParis, formaterJour };
