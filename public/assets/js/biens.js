/* Catalogue des biens : filtres dans le navigateur, grille de cartes. */
(function () {
  'use strict';
  var P = window.P;
  var R = window.REFERENTIEL;
  var h = P.h;

  var grille = document.getElementById('grille');
  var compte = document.getElementById('compte');
  var tous = [];
  var CLE_FILTRES = 'petra-filtres';
  var filtres = { type: '', ville: '', budget: '', surface: '', tri: 'selection' };
  try { Object.assign(filtres, JSON.parse(sessionStorage.getItem(CLE_FILTRES) || '{}')); } catch (e) { /* stockage indisponible */ }

  function squelettes(n) {
    P.vider(grille);
    for (var i = 0; i < n; i++) {
      grille.appendChild(h('div', { class: 'card card--squelette', 'aria-hidden': 'true' },
        h('div', { class: 'card__media squelette' }),
        h('div', { class: 'card__body' },
          h('div', { class: 'ligne squelette' }), h('div', { class: 'ligne l2 squelette' }), h('div', { class: 'ligne l3 squelette' }))));
    }
  }

  function trier(liste) {
    var copie = liste.slice();
    var prixDe = function (b) { return b.prix ? b.prix.fai : Infinity; };
    switch (filtres.tri) {
      case 'recent': copie.sort(function (a, b) { return String(b.publie_le).localeCompare(String(a.publie_le)); }); break;
      case 'prix_asc': copie.sort(function (a, b) { return prixDe(a) - prixDe(b); }); break;
      case 'prix_desc': copie.sort(function (a, b) { return (b.prix ? b.prix.fai : -1) - (a.prix ? a.prix.fai : -1); }); break;
      case 'surface': copie.sort(function (a, b) { return (b.surface_habitable || 0) - (a.surface_habitable || 0); }); break;
      default: break; // ordre du serveur : sélection, puis plus récents, vendus à la fin
    }
    return copie;
  }

  function filtrer() {
    return tous.filter(function (b) {
      if (filtres.type && b.type_bien !== filtres.type) return false;
      if (filtres.ville && b.ville !== filtres.ville) return false;
      if (filtres.budget && (!b.prix || b.prix.fai > Number(filtres.budget))) return false;
      if (filtres.surface && (b.surface_habitable || 0) < Number(filtres.surface)) return false;
      return true;
    });
  }

  function afficher() {
    try { sessionStorage.setItem(CLE_FILTRES, JSON.stringify(filtres)); } catch (e) { /* ignoré */ }
    var liste = trier(filtrer());
    grille.setAttribute('aria-busy', 'false');
    P.vider(grille);
    var disponibles = liste.filter(function (b) { return b.statut !== 'vendue'; }).length;
    compte.textContent = liste.length
      ? P.pluriel(disponibles, 'bien disponible', 'biens disponibles') + (liste.length > disponibles ? ' · ' + P.pluriel(liste.length - disponibles, 'vendu récemment', 'vendus récemment') : '')
      : '';
    if (!liste.length) {
      grille.appendChild(h('div', { class: 'vide' },
        h('h2', null, tous.length ? 'Aucun bien ne correspond à ces critères' : 'Notre sélection se renouvelle'),
        h('p', null, tous.length
          ? 'Élargissez votre recherche ou contactez Catherine Badet : de nombreux biens sont proposés hors ligne.'
          : 'Aucun bien n\'est présenté pour le moment. Catherine Badet vous tiendra informé des prochaines mises en vente.'),
        tous.length
          ? h('button', { class: 'btn btn--solid', type: 'button', onclick: reinitialiser }, P.icone('rafraichir'), 'Voir tous les biens')
          : h('a', { class: 'btn btn--solid', href: 'mailto:catherine.badet@arsenalroyal.com' }, P.icone('mail'), 'Écrire à Catherine Badet')));
      return;
    }
    liste.forEach(function (b) { grille.appendChild(P.carteBien(b)); });
    P.reveler(grille);
  }

  function reinitialiser() {
    filtres = { type: '', ville: '', budget: '', surface: '', tri: filtres.tri };
    construireFiltres();
    afficher();
  }

  function construireFiltres() {
    var zoneTypes = P.vider(document.getElementById('filtreTypes'));
    var types = {};
    tous.forEach(function (b) { if (b.type_bien) types[b.type_bien] = (types[b.type_bien] || 0) + 1; });
    var boutonType = function (code, libelle) {
      return h('button', {
        class: 'chip', type: 'button', 'aria-pressed': filtres.type === code ? 'true' : 'false',
        onclick: function () { filtres.type = code; construireFiltres(); afficher(); },
      }, libelle);
    };
    zoneTypes.appendChild(boutonType('', 'Tous les biens'));
    R.typesBien.forEach(function (t) { if (types[t[0]]) zoneTypes.appendChild(boutonType(t[0], t[1])); });

    var villes = Array.from(new Set(tous.map(function (b) { return b.ville; }).filter(Boolean))).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
    var sv = P.vider(document.getElementById('filtreVille'));
    sv.appendChild(h('option', { value: '' }, 'Toutes les communes'));
    villes.forEach(function (v) { sv.appendChild(h('option', { value: v }, v)); });
    if (villes.indexOf(filtres.ville) < 0) filtres.ville = '';
    sv.value = filtres.ville;
    document.getElementById('filtreBudget').value = filtres.budget;
    document.getElementById('filtreSurface').value = filtres.surface;
    document.getElementById('filtreTri').value = filtres.tri;
    document.getElementById('filtres').hidden = tous.length < 2;
  }

  [['filtreVille', 'ville'], ['filtreBudget', 'budget'], ['filtreSurface', 'surface'], ['filtreTri', 'tri']].forEach(function (x) {
    document.getElementById(x[0]).addEventListener('change', function (e) { filtres[x[1]] = e.target.value; afficher(); });
  });

  squelettes(6);
  Promise.all([P.visiteur.chargerSession(), P.api('/api/biens')]).then(function (res) {
    var etat = res[0];
    // Accès libre (sans code) : la sélection n'est plus « réservée », on ne le prétend pas.
    if (etat.libre && etat.civilite === undefined) {
      document.getElementById('accrocheType').textContent = 'Sélection Petra Gest';
      document.getElementById('accrocheReserve').hidden = true;
    }
    if (etat.connecte && etat.civilite !== undefined) {
      var nom = P.civilite(etat.civilite, etat.nom);
      document.getElementById('titreAccueil').textContent = '';
      document.getElementById('titreAccueil').append('Bienvenue, ', h('em', null, nom + '.'));
    } else if (!etat.connecte) {
      document.getElementById('enteteNom').textContent = 'Aperçu équipe Petra Gest';
      document.getElementById('enteteValidite').textContent = 'Vous êtes connecté à l\'espace de gestion';
      document.getElementById('enteteUtilisateur').hidden = false;
      document.getElementById('deconnexion').hidden = true;
    }
    tous = res[1].biens;
    construireFiltres();
    afficher();
  }).catch(function (err) {
    if (P.visiteur.gererErreur(err)) return;
    P.vider(grille);
    grille.appendChild(h('div', { class: 'vide' }, h('h2', null, 'Chargement impossible'), h('p', null, err.message),
      h('button', { class: 'btn btn--solid', type: 'button', onclick: function () { location.reload(); } }, P.icone('rafraichir'), 'Réessayer')));
  });
})();
