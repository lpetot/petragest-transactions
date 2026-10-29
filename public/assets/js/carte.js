/*
  Petite carte statique à partir des tuiles Plan IGN (Géoplateforme, gratuites, sans clé).
  Aucune bibliothèque : une mosaïque de tuiles centrée sur le point, plus un cercle
  (zone approximative de 500 m) ou un repère (adresse exacte).
  « Découvrir les environs » y pose des repères numérotés ; la carte prend alors le zoom le plus
  proche qui les montre tous (le centre ne bouge jamais : c'est le bien, ou sa zone).
*/
(function () {
  'use strict';
  var P = window.P;
  var URL_TUILE = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0'
    + '&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png';
  var Z_MIN = 10;          // environ 15 km de part et d'autre : assez pour 30 minutes de voiture
  var MARGE = 18;          // pixels gardés entre un repère et le bord de la carte
  var CERCLE_MIN = 14;     // diamètre minimal du cercle de zone quand on dézoome beaucoup

  // Position d'un point en « unités de tuile » au zoom donné (projection Web Mercator).
  function projeter(lat, lng, n) {
    var r = lat * Math.PI / 180;
    return { x: (lng + 180) / 360 * n, y: (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n };
  }

  P.carte = function (conteneur, lat, lng, precision) {
    P.vider(conteneur);
    conteneur.classList.add('carte');
    var zBase = precision === 'exacte' ? 16 : 14;
    var latRad = lat * Math.PI / 180;
    var vue = null;        // { z, n, x, y, couche }
    var reperes = [];      // { lat, lng, el }

    var marque;
    if (precision === 'exacte') {
      marque = P.h('span', { class: 'carte__point', 'aria-hidden': 'true' });
    } else {
      marque = P.h('span', { class: 'carte__cercle', 'aria-hidden': 'true' });
    }
    var credit = P.h('span', { class: 'carte__credit' }, '© IGN, Plan IGN');
    conteneur.appendChild(marque);
    conteneur.appendChild(credit);
    conteneur.setAttribute('role', 'img');
    conteneur.setAttribute('aria-label', precision === 'exacte' ? 'Carte : emplacement du bien' : 'Carte : zone approximative du bien, dans un rayon de 500 mètres');

    // Écart en pixels entre un point et le centre de la carte, au zoom z.
    function ecart(latL, lngL, z) {
      var n = Math.pow(2, z);
      var c = projeter(lat, lng, n), p = projeter(latL, lngL, n);
      return { x: (p.x - c.x) * 256, y: (p.y - c.y) * 256 };
    }

    function poser(r) {
      var e = ecart(r.lat, r.lng, vue.z);
      r.el.style.left = 'calc(50% + ' + Math.round(e.x) + 'px)';
      r.el.style.top = 'calc(50% + ' + Math.round(e.y) + 'px)';
    }

    // Dessine le fond au zoom z. Au changement de zoom, la nouvelle mosaïque apparaît en fondu
    // par-dessus l'ancienne (pas de carte blanche le temps du chargement).
    function fond(z) {
      var n = Math.pow(2, z);
      var c = projeter(lat, lng, n);
      var tx = Math.floor(c.x), ty = Math.floor(c.y);
      var decX = (c.x - tx) * 256, decY = (c.y - ty) * 256;
      var ancienne = vue && vue.couche;
      var couche = P.h('div', { class: 'carte__tuiles' + (ancienne ? ' carte__tuiles--neuve' : '') });
      var centrale = null;
      for (var i = -3; i <= 3; i++) {
        for (var j = -2; j <= 2; j++) {
          var img = P.h('img', {
            src: URL_TUILE + '&TILEMATRIX=' + z + '&TILEROW=' + (ty + j) + '&TILECOL=' + (tx + i),
            alt: '', width: '256', height: '256', loading: ancienne ? 'eager' : 'lazy', draggable: 'false',
          });
          img.style.left = (i * 256 - decX) + 'px';
          img.style.top = (j * 256 - decY) + 'px';
          if (i === 0 && j === 0) centrale = img;
          couche.appendChild(img);
        }
      }
      if (ancienne) {
        conteneur.insertBefore(couche, ancienne.nextSibling);
        var fait = false;
        var montrer = function () {
          if (fait) return;
          fait = true;
          couche.classList.remove('carte__tuiles--neuve');
          setTimeout(function () { ancienne.remove(); }, 400);
        };
        centrale.addEventListener('load', montrer);
        centrale.addEventListener('error', montrer);
        setTimeout(montrer, 1500);
      } else {
        conteneur.insertBefore(couche, marque);
      }
      vue = { z: z, n: n, couche: couche };
      if (precision !== 'exacte') {
        var metresParPixel = 156543.03392 * Math.cos(latRad) / n;
        var diametre = Math.max(CERCLE_MIN, Math.round((500 / metresParPixel) * 2));
        marque.style.width = diametre + 'px';
        marque.style.height = diametre + 'px';
      }
      reperes.forEach(poser);
    }

    // Le zoom le plus proche (jamais plus que le zoom de départ) où tous les repères tiennent dans le cadre.
    function cadrer() {
      var demiL = conteneur.clientWidth / 2 - MARGE, demiH = conteneur.clientHeight / 2 - MARGE;
      if (demiL <= 0 || demiH <= 0) return;   // pas encore affichée : l'observateur rappellera
      var z = zBase;
      while (z > Z_MIN && !reperes.every(function (r) {
        var e = ecart(r.lat, r.lng, z);
        return Math.abs(e.x) <= demiL && Math.abs(e.y) <= demiH;
      })) z--;
      if (z !== vue.z) fond(z);
    }

    fond(zBase);
    // Recadre quand la carte apparaît à l'écran ou change de taille (rotation d'un téléphone).
    if (window.ResizeObserver) new ResizeObserver(function () { cadrer(); }).observe(conteneur);

    return {
      placer: function (latL, lngL, texte) {
        var r = { lat: latL, lng: lngL, el: P.h('span', { class: 'carte__lieu', 'aria-hidden': 'true' }, texte) };
        conteneur.insertBefore(r.el, credit);
        reperes.push(r);
        poser(r);
      },
      effacer: function () { reperes.forEach(function (r) { r.el.remove(); }); reperes = []; },
      cadrer: cadrer,
      credit: function (texte) { credit.textContent = texte; },
    };
  };
})();
