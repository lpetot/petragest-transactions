/*
  Préparation des photos dans le navigateur, avant l'envoi :
  - orientation respectée (photos de téléphone prises en portrait) ;
  - redimensionnement : 2000 px (grande) et 800 px (miniature) sur le plus grand côté ;
  - recompression JPEG : une photo de 8 Mo tombe sous 1 Mo, bien en dessous de la limite de Vercel ;
  - la recompression supprime les métadonnées EXIF, dont la position GPS (qui trahirait l'adresse).
*/
(function () {
  'use strict';
  var P = window.P;

  function erreur(message) { var e = new Error(message); e.utilisateur = true; return e; }

  function charger(fichier) {
    // createImageBitmap applique l'orientation EXIF ; repli sur <img> pour les navigateurs plus anciens.
    if (window.createImageBitmap) {
      return createImageBitmap(fichier, { imageOrientation: 'from-image' }).catch(function () { return chargerImg(fichier); });
    }
    return chargerImg(fichier);
  }
  function chargerImg(fichier) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(fichier);
      var img = new Image();
      img.onload = function () { resolve(img); setTimeout(function () { URL.revokeObjectURL(url); }, 1000); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(erreur('Impossible de lire cette image.')); };
      img.src = url;
    });
  }

  function versJpeg(source, largeurSrc, hauteurSrc, cote, qualite) {
    var echelle = Math.min(1, cote / Math.max(largeurSrc, hauteurSrc));
    var l = Math.round(largeurSrc * echelle), hh = Math.round(hauteurSrc * echelle);
    var canvas = document.createElement('canvas');
    canvas.width = l; canvas.height = hh;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // fond blanc pour les PNG transparents
    ctx.fillRect(0, 0, l, hh);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, l, hh);
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        canvas.width = 0; canvas.height = 0; // libère la mémoire (important sur iPhone)
        if (!blob) reject(erreur('Conversion de la photo impossible.'));
        else resolve({ blob: blob, largeur: l, hauteur: hh });
      }, 'image/jpeg', qualite);
    });
  }

  function preparer(fichier) {
    var nom = (fichier.name || '').toLowerCase();
    if (/\.(heic|heif)$/.test(nom) || /heic|heif/.test(fichier.type)) {
      return Promise.reject(erreur('Format HEIC (iPhone) non lisible sur cet ordinateur : exportez la photo en JPEG, ou envoyez-la depuis le téléphone.'));
    }
    if (fichier.type && fichier.type.indexOf('image/') !== 0) return Promise.reject(erreur("Ce fichier n'est pas une image."));
    if (fichier.size > 40 * 1024 * 1024) return Promise.reject(erreur('Image trop lourde (plus de 40 Mo).'));
    return charger(fichier).then(function (src) {
      var l = src.width || src.naturalWidth, hh = src.height || src.naturalHeight;
      if (l < 400 || hh < 300) throw erreur('Image trop petite : au moins 400 × 300 pixels.');
      return versJpeg(src, l, hh, 2000, 0.84).then(function (grande) {
        return versJpeg(src, l, hh, 800, 0.8).then(function (mini) {
          if (src.close) src.close();
          if (grande.blob.size > 3700000) throw erreur('Image trop détaillée après compression.');
          return { grande: grande.blob, mini: mini.blob, largeur: grande.largeur, hauteur: grande.hauteur, apercu: URL.createObjectURL(mini.blob) };
        });
      });
    });
  }

  // Envoi : les deux versions dans un seul corps binaire (grande puis miniature).
  function envoyer(idAnnonce, prep, progression) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/admin/annonces/' + encodeURIComponent(idAnnonce) + '/photos');
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('X-Taille-Grande', String(prep.grande.size));
      xhr.setRequestHeader('X-Largeur', String(prep.largeur));
      xhr.setRequestHeader('X-Hauteur', String(prep.hauteur));
      xhr.upload.onprogress = function (e) { if (e.lengthComputable && progression) progression(e.loaded / e.total); };
      xhr.onload = function () {
        var corps = null;
        try { corps = JSON.parse(xhr.responseText); } catch (e) { corps = null; }
        if (xhr.status >= 200 && xhr.status < 300) resolve(corps.photo);
        else reject(new P.ErreurApi(xhr.status, corps));
      };
      xhr.onerror = function () { reject(new P.ErreurApi(0, null)); };
      xhr.send(new Blob([prep.grande, prep.mini], { type: 'application/octet-stream' }));
    });
  }

  P.photos = { preparer: preparer, envoyer: envoyer };
})();
