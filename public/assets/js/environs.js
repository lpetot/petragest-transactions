/*
  « Découvrir les environs » : les lieux utiles autour d'un bien (transports, écoles, commerces et services,
  santé), d'après OpenStreetMap (service public Overpass). Demande de Catherine, réunion du 28/10/2026.

  Partagé par l'espace de gestion (qui interroge Overpass), le serveur (qui classe et enregistre) et
  scripts/environs.js (rattrapage des annonces existantes) : même requête, même classement.
  Les acquéreurs ne lisent que le résultat enregistré : ils n'attendent jamais Overpass, qui peut mettre
  une minute à répondre aux heures chargées (mesuré le 28/10/2026 au soir : 45 à 50 secondes).

  Durées indicatives : distance à vol d'oiseau majorée de 30 % pour les détours ; à pied (4,5 km/h)
  jusqu'à 20 minutes, sinon en voiture (30 km/h de moyenne, plus 2 minutes). Arrondies aux 5 minutes
  supérieures, ce qui évite aussi de trahir l'adresse exacte d'un bien affiché en « zone approximative ».
  Médecins et dentistes : jamais de nom de personne, seulement le type.
*/
(function (racine, fabrique) {
  'use strict';
  var r = fabrique();
  if (typeof module === 'object' && module.exports) module.exports = r;
  else racine.ENVIRONS = r;
})(this, function () {
  'use strict';

  // Le premier serveur est le service de référence ; le second sert de secours.
  var SERVEURS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

  var CATEGORIES = [
    ['transports', 'Transports'],
    ['education', 'Éducation'],
    ['services', 'Commerces et services'],
    ['sante', 'Santé'],
  ];

  // Sous-types retenus : catégorie, libellé, nombre de lieux gardés, nom affiché ou non.
  var TYPES = {
    gare: { cat: 'transports', libelle: 'Gare', max: 1 },
    bus: { cat: 'transports', libelle: 'Arrêt de bus', max: 2 },
    creche: { cat: 'education', libelle: 'Crèche', max: 1 },
    maternelle: { cat: 'education', libelle: 'École maternelle', max: 1 },
    ecole: { cat: 'education', libelle: 'École élémentaire', max: 1 },
    college: { cat: 'education', libelle: 'Collège', max: 1 },
    lycee: { cat: 'education', libelle: 'Lycée', max: 1 },
    superieur: { cat: 'education', libelle: 'Enseignement supérieur', max: 1 },
    mairie: { cat: 'services', libelle: 'Mairie', max: 1 },
    boulangerie: { cat: 'services', libelle: 'Boulangerie', max: 1 },
    supermarche: { cat: 'services', libelle: 'Supermarché', max: 1 },
    epicerie: { cat: 'services', libelle: 'Épicerie', max: 1 },
    marche: { cat: 'services', libelle: 'Marché', max: 1 },
    poste: { cat: 'services', libelle: 'Bureau de poste', max: 1 },
    banque: { cat: 'services', libelle: 'Banque', max: 1 },
    pharmacie: { cat: 'sante', libelle: 'Pharmacie', max: 1 },
    medecin: { cat: 'sante', libelle: 'Médecin', max: 1, anonyme: true },
    dentiste: { cat: 'sante', libelle: 'Dentiste', max: 1, anonyme: true },
    hopital: { cat: 'sante', libelle: 'Hôpital', max: 1 },
    clinique: { cat: 'sante', libelle: 'Clinique ou centre de santé', max: 1 },
  };

  var TAGS_UTILES = ['name', 'amenity', 'shop', 'railway', 'highway', 'school:FR'];
  var MAX_ELEMENTS = 4000;
  var MINUTES_MAX = 30;   // au-delà, le lieu n'est pas « dans les environs »

  function requete(lat, lng) {
    var p = function (rayon) { return '(around:' + rayon + ',' + lat + ',' + lng + ')'; };
    return '[out:json][timeout:90];\n(\n'
      + '  nwr' + p(10000) + '[railway=station];\n'
      + '  node' + p(600) + '[highway=bus_stop];\n'
      + '  nwr' + p(3000) + '[amenity~"^(school|kindergarten|childcare)$"];\n'
      + '  nwr' + p(15000) + '[amenity=school]["school:FR"~"^(college|lycee)$"];\n'
      + '  nwr' + p(10000) + '[amenity~"^(college|university)$"];\n'
      + '  nwr' + p(3000) + '[shop~"^(convenience|bakery)$"];\n'
      + '  nwr' + p(8000) + '[shop=supermarket];\n'
      + '  nwr' + p(3000) + '[amenity~"^(post_office|bank|marketplace|pharmacy|doctors|dentist|clinic)$"];\n'
      + '  nwr' + p(15000) + '[amenity=hospital];\n'
      + '  nwr' + p(8000) + '[amenity=townhall];\n'
      + ');\nout center tags;';
  }

  // Ne garde que la position et les quelques étiquettes utiles (le reste ne quitte pas le navigateur).
  function nettoyer(elements) {
    var sortie = [];
    if (!Array.isArray(elements)) return sortie;
    for (var i = 0; i < elements.length && sortie.length < MAX_ELEMENTS; i++) {
      var e = elements[i];
      if (!e || typeof e !== 'object') continue;
      var lat = typeof e.lat === 'number' ? e.lat : e.center && e.center.lat;
      var lng = typeof e.lon === 'number' ? e.lon : typeof e.lng === 'number' ? e.lng : e.center && e.center.lon;
      if (typeof lat !== 'number' || typeof lng !== 'number' || !isFinite(lat) || !isFinite(lng)
        || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
      var tags = {};
      var source = e.tags && typeof e.tags === 'object' ? e.tags : {};
      for (var k = 0; k < TAGS_UTILES.length; k++) {
        var v = source[TAGS_UTILES[k]];
        if (typeof v === 'string' && v.trim()) tags[TAGS_UTILES[k]] = v.trim().slice(0, 120);
      }
      sortie.push({ lat: lat, lng: lng, tags: tags });
    }
    return sortie;
  }

  function distance(lat1, lng1, lat2, lng2) {
    var rad = Math.PI / 180;
    var dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * 6371000 * Math.asin(Math.sqrt(x));
  }

  var cinq = function (m) { return Math.max(5, Math.ceil(m / 5) * 5); };
  function duree(metres) {
    var parcours = metres * 1.3;
    var aPied = parcours / 75;            // 4,5 km/h
    if (aPied <= 20) return { minutes: cinq(aPied), mode: 'pied' };
    return { minutes: cinq(parcours / 500 + 2), mode: 'voiture' };   // 30 km/h
  }

  // Comparaison sans accents ni majuscules.
  function simple(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }

  function sousType(t) {
    var nom = simple(t.name);
    var fr = simple(t['school:FR']);
    if (t.railway === 'station') return 'gare';
    if (t.highway === 'bus_stop') return 'bus';
    if (t.amenity === 'childcare' || /creche|multi-accueil|halte-garderie|micro-creche/.test(nom)) {
      return t.amenity === 'childcare' || t.amenity === 'kindergarten' || t.amenity === 'school' ? 'creche' : null;
    }
    if (t.amenity === 'kindergarten' || (t.amenity === 'school' && (fr === 'maternelle' || /maternelle/.test(nom)))) return 'maternelle';
    if (t.amenity === 'school') {
      if (fr === 'lycee' || /lycee/.test(nom)) return 'lycee';
      if (fr === 'college' || /college/.test(nom)) return 'college';
      if (fr === 'elementaire' || fr === 'primaire' || /elementaire|primaire|groupe scolaire|^ecole/.test(nom)) return 'ecole';
      return null;   // institut de formation, établissement spécialisé... : pas pour un acquéreur
    }
    if (t.amenity === 'college' || t.amenity === 'university') return 'superieur';
    if (t.amenity === 'townhall') return 'mairie';
    if (t.shop === 'bakery') return 'boulangerie';
    if (t.shop === 'supermarket') return 'supermarche';
    if (t.shop === 'convenience') return 'epicerie';
    if (t.amenity === 'marketplace') return 'marche';
    if (t.amenity === 'post_office') return 'poste';
    if (t.amenity === 'bank') return 'banque';
    if (t.amenity === 'pharmacy') return 'pharmacie';
    if (t.amenity === 'doctors') return 'medecin';
    if (t.amenity === 'dentist') return 'dentiste';
    if (t.amenity === 'hospital') return 'hopital';
    if (t.amenity === 'clinic') return /travail|psych/.test(nom) ? null : 'clinique';
    return null;
  }

  // Nom affiché : jamais pour un médecin ou un dentiste ; pas quand il répète la commune (« Rochefort » pour la poste).
  function nomAffiche(code, t, ville) {
    var nom = t.name || '';
    if (!nom || TYPES[code].anonyme) return null;
    if (code === 'gare') return /^gare\b/i.test(nom) ? nom : 'Gare de ' + nom;
    if (ville && simple(nom) === simple(ville)) return null;
    if (code === 'bus') return nom;
    if (simple(nom) === simple(TYPES[code].libelle)) return null;
    return nom;
  }

  // Classe les lieux bruts autour de (lat, lng). Renvoie { categories: [{ code, libelle, lieux: [...] }] }.
  function construire(elements, lat, lng, ville) {
    var candidats = {};
    var propres = nettoyer(elements);
    for (var i = 0; i < propres.length; i++) {
      var e = propres[i];
      var code = sousType(e.tags);
      if (!code) continue;
      var metres = distance(lat, lng, e.lat, e.lng);
      (candidats[code] = candidats[code] || []).push({ e: e, metres: metres });
    }
    var lieux = [];
    Object.keys(candidats).forEach(function (code) {
      var liste = candidats[code].sort(function (x, y) { return x.metres - y.metres; });
      // La mairie de la commune du bien plutôt que celle d'à côté, si elle est dans le rayon.
      if (code === 'mairie' && ville) {
        var sienne = liste.filter(function (x) { return simple(x.e.tags.name).indexOf(simple(ville)) >= 0; });
        if (sienne.length) liste = sienne;
      }
      var vus = {};
      var gardes = 0;
      for (var j = 0; j < liste.length && gardes < TYPES[code].max; j++) {
        var x = liste[j];
        var nom = nomAffiche(code, x.e.tags, ville);
        var cle = simple(nom || '');
        if (cle && vus[cle]) continue;   // l'arrêt de bus des deux côtés de la rue
        var d = duree(x.metres);
        if (d.minutes > MINUTES_MAX) break;
        // « Marché » est souvent mal renseigné (une ferme, un marché de producteurs saisonnier) : à pied seulement.
        if (code === 'marche' && d.mode !== 'pied') break;
        vus[cle] = true;
        gardes++;
        var type = code === 'ecole' && /primaire/.test(simple(x.e.tags.name) + ' ' + simple(x.e.tags['school:FR']))
          ? 'École primaire' : TYPES[code].libelle;
        lieux.push({
          categorie: TYPES[code].cat, type: type, nom: nom, minutes: d.minutes, mode: d.mode,
          lat: Math.round(x.e.lat * 1e5) / 1e5, lng: Math.round(x.e.lng * 1e5) / 1e5, metres: x.metres,
        });
      }
    });
    lieux.sort(function (x, y) { return x.metres - y.metres; });
    var categories = [];
    CATEGORIES.forEach(function (c) {
      var siens = lieux.filter(function (l) { return l.categorie === c[0]; }).map(function (l) {
        return { type: l.type, nom: l.nom, minutes: l.minutes, mode: l.mode, lat: l.lat, lng: l.lng };
      });
      if (siens.length) categories.push({ code: c[0], libelle: c[1], lieux: siens });
    });
    return { categories: categories };
  }

  function texteDuree(l) { return l.minutes + ' min ' + (l.mode === 'pied' ? 'à pied' : 'en voiture'); }

  return {
    SERVEURS: SERVEURS, CATEGORIES: CATEGORIES, TYPES: TYPES,
    requete: requete, nettoyer: nettoyer, construire: construire, duree: duree, distance: distance, texteDuree: texteDuree,
  };
});
