'use strict';
// Validation commune : les champs d'une annonce (annonces.js) et ceux de sa fiche technique (fiche.js).
// Un schéma décrit chaque clé admise ; toute autre clé est ignorée.
// type : texte | entier | reel | bool | enum | liste | date | cp | objet (valider(v) -> { valeur } ou { erreur })
// Option « souple » (fiche technique) : une valeur de liste inconnue est écartée au lieu d'être refusée,
// pour qu'un code retiré un jour du référentiel n'empêche pas d'enregistrer le reste de la fiche.

function validerSelon(schema, entree, options) {
  const souple = Boolean(options && options.souple);
  const valeurs = {};
  const erreurs = {};
  for (const [nom, def] of Object.entries(schema)) {
    if (!Object.prototype.hasOwnProperty.call(entree, nom)) continue;
    let v = entree[nom];
    const vide = v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
    if (vide) {
      valeurs[nom] = def.nonNul !== undefined ? def.nonNul : null;
      continue;
    }
    switch (def.type) {
      case 'texte':
        if (typeof v !== 'string') { erreurs[nom] = 'Texte attendu.'; break; }
        v = v.replace(/\r\n?/g, '\n').trim();
        if (v.length > def.max) { erreurs[nom] = `${def.max} caractères au maximum.`; break; }
        valeurs[nom] = v;
        break;
      case 'entier': {
        const n = typeof v === 'string' ? Number(v.replace(/[\s  ]/g, '')) : v;
        if (!Number.isInteger(n)) { erreurs[nom] = 'Nombre entier attendu.'; break; }
        if (n < def.min || n > def.max) { erreurs[nom] = 'Valeur hors limites.'; break; }
        valeurs[nom] = n;
        break;
      }
      case 'reel': {
        const n = typeof v === 'string' ? Number(v.replace(/[\s  ]/g, '').replace(',', '.')) : v;
        if (typeof n !== 'number' || !Number.isFinite(n)) { erreurs[nom] = 'Nombre attendu.'; break; }
        if (n < def.min || n > def.max) { erreurs[nom] = 'Valeur hors limites.'; break; }
        valeurs[nom] = Math.round(n * 1e6) / 1e6;
        break;
      }
      case 'bool':
        if (typeof v !== 'boolean') { erreurs[nom] = 'Oui ou non attendu.'; break; }
        valeurs[nom] = v;
        break;
      case 'enum':
        if (!def.valeurs.includes(v)) {
          if (souple) valeurs[nom] = null; else erreurs[nom] = 'Valeur non reconnue.';
          break;
        }
        valeurs[nom] = v;
        break;
      case 'liste':
        if (!Array.isArray(v)) { erreurs[nom] = 'Liste non reconnue.'; break; }
        if (souple) v = v.filter((x) => def.valeurs.includes(x));
        else if (v.some((x) => !def.valeurs.includes(x))) { erreurs[nom] = 'Liste non reconnue.'; break; }
        valeurs[nom] = Array.from(new Set(v));
        break;
      case 'date':
        if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v + 'T00:00:00Z'))) {
          erreurs[nom] = 'Date attendue (AAAA-MM-JJ).'; break;
        }
        valeurs[nom] = v;
        break;
      case 'cp':
        if (typeof v !== 'string' || !/^\d{5}$/.test(v.trim())) { erreurs[nom] = 'Code postal à 5 chiffres.'; break; }
        valeurs[nom] = v.trim();
        break;
      case 'objet': {
        const r = def.valider(v);
        if (r.erreur) erreurs[nom] = r.erreur; else valeurs[nom] = r.valeur;
        break;
      }
      default:
        break;
    }
  }
  return { valeurs, erreurs };
}

module.exports = { validerSelon };
