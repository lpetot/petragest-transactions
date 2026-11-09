/* Carte d'un bien (photo, faits, prix) : partagée par le catalogue et « Les autres biens de l'agence » de la fiche. */
(function () {
  'use strict';
  var P = window.P;
  var R = window.REFERENTIEL;
  var h = P.h;

  function faits(b) {
    var f = [];
    if (b.type_bien === 'terrain') {
      if (b.surface_terrain) f.push(['terrain', P.hectares(b.surface_terrain)]);
    } else {
      if (b.surface_habitable) f.push(['surface', P.surface(b.surface_habitable)]);
      if (b.nb_pieces) f.push(['pieces', P.pluriel(b.nb_pieces, 'pièce', 'pièces')]);
      if (b.nb_chambres) f.push(['lit', P.pluriel(b.nb_chambres, 'chambre', 'chambres')]);
      if (b.surface_terrain) f.push(['terrain', P.hectares(b.surface_terrain)]);
    }
    return f.map(function (x) { return h('span', null, P.icone(x[0]), x[1]); });
  }

  // Ce que l'agence a choisi de dire d'un bien vendu : ['Vendu en novembre 2026', 'En 3 semaines', 'Prix affiché : 342 000 €'].
  function detailsVente(b) {
    var v = b.vendu || {};
    var lignes = [];
    if (v.mois) {
      var d = new Date(v.mois + '-15T12:00:00Z');
      lignes.push('Vendu en ' + new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d));
    } else lignes.push('Vendu');
    if (v.delai_jours) {
      var j = v.delai_jours;
      var duree = j < 14 ? P.pluriel(j, 'jour', 'jours')
        : j < 60 ? P.pluriel(Math.round(j / 7), 'semaine', 'semaines')
          : Math.round(j / 30.4) + ' mois';
      lignes.push('En ' + duree);
    }
    if (b.prix && b.prix.fai) lignes.push('Prix affiché : ' + P.prix(b.prix.fai));
    return lignes;
  }

  function lignePrix(b) {
    if (b.statut === 'vendue') {
      var d = detailsVente(b);
      var suite = d.slice(1).join(' · ');
      return h('p', { class: 'card__prix' }, d[0], h('small', null, suite || 'Nous consulter pour un bien similaire'));
    }
    if (!b.prix) return h('p', { class: 'card__prix' }, 'Prix sur demande');
    var detail = b.prix.charge === 'acquereur'
      ? (b.prix.pourcentage ? 'Honoraires inclus : ' + P.nombre(b.prix.pourcentage) + ' % TTC à la charge de l’acquéreur' : 'Honoraires inclus')
      : b.prix.charge === 'vendeur' ? 'Honoraires à la charge du vendeur' : '';
    var m2 = P.prixM2(b.prix, b.type_bien);
    return h('p', { class: 'card__prix' }, P.prix(b.prix.fai), m2 ? h('small', { class: 'card__m2' }, m2) : null, detail ? h('small', null, detail) : null);
  }

  function carte(b) {
    var titreType = R.libelle(R.typesBien, b.type_bien);
    var badges = [];
    if (b.statut === 'sous_offre') badges.push(h('span', { class: 'badge badge--sand' }, 'Sous offre'));
    if (b.mise_en_avant && b.statut !== 'vendue') badges.push(h('span', { class: 'badge badge--white' }, P.icone('etoile'), 'Sélection'));
    if ((b.protection === 'inscrit_mh' || b.protection === 'classe_mh') && badges.length < 2) {
      // En toutes lettres : « Inscrit MH » n'est pas compris du grand public. Le niveau (inscrit ou classé) est précisé sur la fiche.
      badges.push(h('span', { class: 'badge badge--white' }, 'Monument historique'));
    }
    var media = h('div', { class: 'card__media' });
    if (b.couverture) {
      media.appendChild(h('img', {
        src: b.couverture.url_mini, alt: '', loading: 'lazy', decoding: 'async',
        width: '800', height: String(Math.round(800 * (b.couverture.hauteur || 533) / (b.couverture.largeur || 800))),
      }));
    }
    if (badges.length) media.appendChild(h('div', { class: 'card__badges' }, badges));
    if (b.nb_photos > 1) media.appendChild(h('span', { class: 'card__photos' }, P.icone('photo'), String(b.nb_photos)));
    if (b.statut === 'vendue') media.appendChild(h('span', { class: 'card__bandeau' }, 'Vendu'));
    // Bien vendu dont l'agence ne montre que la carte : ni bouton ni lien vers la fiche.
    var lien = b.statut !== 'vendue' || (b.vendu && b.vendu.fiche);

    var lieu = [titreType, b.ville].filter(Boolean).join(' · ');
    return h('article', { class: 'card reveal' + (b.statut === 'vendue' ? ' card--vendu' : '') },
      media,
      h('div', { class: 'card__body' },
        h('p', { class: 'card__lieu' }, lieu),
        h('h2', { class: 'card__titre' }, b.titre),
        h('div', { class: 'card__faits' }, faits(b)),
        h('div', { class: 'card__pied' },
          lignePrix(b),
          b.dpe_classe ? P.pastilleDpe(b.dpe_classe) : null),
        lien ? h('span', { class: 'btn btn--solid btn--sm', 'aria-hidden': 'true' }, 'Découvrir le bien', P.icone('fleche')) : null),
      lien ? h('a', { class: 'card__lien', href: '/bien?id=' + encodeURIComponent(b.id), 'aria-label': b.titre + (b.ville ? ', ' + b.ville : '') }) : null);
  }

  P.carteBien = carte;
  P.detailsVente = detailsVente;
})();
