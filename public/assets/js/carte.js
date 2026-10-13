/*
  Petite carte statique à partir des tuiles Plan IGN (Géoplateforme, gratuites, sans clé).
  Aucune bibliothèque : une mosaïque de tuiles centrée sur le point, plus un cercle
  (zone approximative de 500 m) ou un repère (adresse exacte).
*/
(function () {
  'use strict';
  var P = window.P;
  var URL_TUILE = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0'
    + '&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png';

  P.carte = function (conteneur, lat, lng, precision) {
    P.vider(conteneur);
    conteneur.classList.add('carte');
    var z = precision === 'exacte' ? 16 : 14;
    var n = Math.pow(2, z);
    var latRad = lat * Math.PI / 180;
    var x = (lng + 180) / 360 * n;
    var y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
    var tx = Math.floor(x), ty = Math.floor(y);
    var decX = (x - tx) * 256, decY = (y - ty) * 256;

    var tuiles = P.h('div', { class: 'carte__tuiles' });
    for (var i = -3; i <= 3; i++) {
      for (var j = -2; j <= 2; j++) {
        var img = P.h('img', {
          src: URL_TUILE + '&TILEMATRIX=' + z + '&TILEROW=' + (ty + j) + '&TILECOL=' + (tx + i),
          alt: '', width: '256', height: '256', loading: 'lazy', draggable: 'false',
        });
        img.style.left = (i * 256 - decX) + 'px';
        img.style.top = (j * 256 - decY) + 'px';
        tuiles.appendChild(img);
      }
    }
    conteneur.appendChild(tuiles);
    if (precision === 'exacte') {
      conteneur.appendChild(P.h('span', { class: 'carte__point', 'aria-hidden': 'true' }));
    } else {
      var metresParPixel = 156543.03392 * Math.cos(latRad) / n;
      var diametre = Math.round((500 / metresParPixel) * 2);
      var cercle = P.h('span', { class: 'carte__cercle', 'aria-hidden': 'true' });
      cercle.style.width = diametre + 'px';
      cercle.style.height = diametre + 'px';
      conteneur.appendChild(cercle);
    }
    conteneur.appendChild(P.h('span', { class: 'carte__credit' }, '© IGN, Plan IGN'));
    conteneur.setAttribute('role', 'img');
    conteneur.setAttribute('aria-label', precision === 'exacte' ? 'Carte : emplacement du bien' : 'Carte : zone approximative du bien, dans un rayon de 500 mètres');
  };
})();
