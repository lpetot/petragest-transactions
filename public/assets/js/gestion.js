/*
  Espace de gestion Petra Gest (application d'une seule page, vues par l'adresse #).
  Toutes les données passent par textContent (P.h) : jamais de HTML construit à partir de saisies.
*/
(function () {
  'use strict';
  var P = window.P;
  var R = window.REFERENTIEL;
  var h = P.h;
  var app = document.getElementById('app');
  var moi = null;
  var garde = null;       // fonction : vrai s'il reste des modifications non enregistrées
  var aQuitter = [];      // nettoyages à faire en quittant une vue
  var ACCUEIL_TEL = '05 64 72 07 81';

  // =====================================================================
  // Outils
  // =====================================================================
  function api(chemin, options) {
    return P.api('/api/admin/' + chemin, options).catch(function (err) {
      if (err.statut === 401 && chemin !== 'session') { err.gere = true; ecranConnexion('Votre session a expiré. Reconnectez-vous.'); }
      else if (err.code === 'changer_mdp') { err.gere = true; ecranMotDePasse(true); }
      throw err;
    });
  }
  function signaler(err) { if (!err || err.gere) return; P.toast(err.message || 'Une erreur est survenue.', 'erreur'); }

  function copier(texte) {
    var repli = function () {
      var t = h('textarea', { class: 'sr-only' }); t.value = texte; document.body.appendChild(t); t.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      t.remove(); return ok;
    };
    var fini = function (ok) { P.toast(ok ? 'Copié. Vous pouvez le coller où vous voulez.' : 'Copie impossible : sélectionnez le texte à la main.', ok ? null : 'erreur'); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(texte).then(function () { fini(true); }, function () { fini(repli()); });
    else fini(repli());
  }

  function bouton(libelle, classe, icone, action, attrs) {
    var b = h('button', Object.assign({ type: 'button', class: 'btn ' + (classe || 'btn--solid'), onclick: action }, attrs || {}), icone ? P.icone(icone) : null, libelle);
    return b;
  }
  function occupe(btn, oui) { btn.classList.toggle('is-busy', Boolean(oui)); btn.disabled = Boolean(oui); }

  function modale(o) {
    var avant = document.activeElement;
    var fermer = function () { fond.remove(); document.removeEventListener('keydown', clavier); if (avant && avant.focus) avant.focus(); };
    var clavier = function (e) { if (e.key === 'Escape' && o.fermable !== false) fermer(); };
    var pied = h('div', { class: 'g-modale__pied' });
    (o.actions || []).forEach(function (a) {
      var b = bouton(a.libelle, a.classe || 'btn--solid', a.icone, function () { a.action(fermer, b); });
      pied.appendChild(b);
    });
    var boite = h('div', { class: 'g-modale__boite', role: 'dialog', 'aria-modal': 'true', 'aria-label': o.titre },
      h('div', { class: 'g-modale__tete' }, h('h2', null, o.titre),
        o.fermable === false ? null : h('button', { type: 'button', class: 'g-modale__fermer', 'aria-label': 'Fermer', onclick: fermer }, P.icone('croix'))),
      h('div', { class: 'g-modale__corps' }, o.corps),
      (o.actions || []).length ? pied : null);
    var fond = h('div', { class: 'g-modale', onclick: function (e) { if (e.target === fond && o.fermable !== false) fermer(); } }, boite);
    document.body.appendChild(fond);
    document.addEventListener('keydown', clavier);
    var premier = boite.querySelector('input, textarea, select, .g-modale__pied .btn');
    if (premier) premier.focus();
    return { fermer: fermer, boite: boite };
  }
  function confirmer(titre, texte, libelle, danger) {
    return new Promise(function (resolve) {
      var m = modale({
        titre: titre, corps: h('p', null, texte),
        actions: [
          { libelle: 'Annuler', classe: 'btn--light', action: function (f) { f(); resolve(false); } },
          { libelle: libelle, classe: danger ? 'btn--danger' : 'btn--solid', action: function (f) { f(); resolve(true); } },
        ],
      });
      return m;
    });
  }

  function champ(libelle, controle, aide, id) {
    if (id && controle.id === '') controle.id = id;
    return h('div', { class: 'g-champ' }, h('label', { for: controle.id || null }, libelle), controle, aide ? h('small', null, aide) : null);
  }
  var compteurId = 0;
  function nouvelId() { compteurId += 1; return 'c' + compteurId; }

  function initiales(nom) {
    return String(nom || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (m) { return m[0].toUpperCase(); }).join('');
  }
  function libelleStatut(a) {
    if (a.en_corbeille) return ['corbeille', 'Corbeille'];
    return [a.statut, R.libelle(R.statuts, a.statut)];
  }
  function badgeStatut(code, texte) { return h('span', { class: 'g-statut g-statut--' + code }, texte); }

  // =====================================================================
  // Aiguillage
  // =====================================================================
  var ignorer = false;
  var hashPrecedent = location.hash;
  window.addEventListener('hashchange', function () {
    if (ignorer) { ignorer = false; return; }
    if (garde && garde() && !window.confirm('Des modifications ne sont pas enregistrées. Quitter quand même ?')) {
      ignorer = true; location.hash = hashPrecedent; return;
    }
    hashPrecedent = location.hash;
    afficherRoute();
  });
  window.addEventListener('beforeunload', function (e) { if (garde && garde()) { e.preventDefault(); e.returnValue = ''; } });

  function aller(chemin) { location.hash = '#/' + chemin; }

  function afficherRoute() {
    if (!moi) return;
    aQuitter.forEach(function (f) { try { f(); } catch (e) { /* ignoré */ } });
    aQuitter = [];
    garde = null;
    var morceaux = location.hash.replace(/^#\/?/, '').split('/');
    var section = morceaux[0] || 'accueil';
    window.scrollTo(0, 0);
    if (section === 'annonces' && morceaux[1]) return vueEditeur(coquille('annonces'), morceaux[1]);
    if (section === 'annonces') return vueAnnonces(coquille('annonces'));
    if (section === 'codes' && morceaux[1] === 'nouveau') return vueNouveauCode(coquille('codes'));
    if (section === 'codes' && morceaux[1]) return vueCode(coquille('codes'), Number(morceaux[1]), morceaux[2] === 'envoyer');
    if (section === 'codes') return vueCodes(coquille('codes'));
    if (section === 'equipe') return vueEquipe(coquille('equipe'));
    if (section === 'compte') return vueCompte(coquille(''));
    return vueAccueil(coquille('accueil'));
  }

  function coquille(actif) {
    P.vider(app);
    var liens = [['accueil', 'Accueil', 'maison'], ['annonces', 'Annonces', 'feuille'], ['codes', "Codes d'accès", 'cle'], ['equipe', 'Équipe', 'equipe']];
    var menu = h('div', { class: 'g-moi__menu', hidden: true },
      h('a', { href: '#/compte' }, P.icone('cadenas'), 'Changer mon mot de passe'),
      h('a', { href: '/biens', target: '_blank', rel: 'noopener' }, P.icone('oeil'), 'Voir le site des visiteurs'),
      h('hr'),
      h('button', { type: 'button', onclick: deconnexion }, P.icone('sortie'), 'Se déconnecter'));
    var boutonMoi = h('button', { type: 'button', class: 'g-moi__bouton', 'aria-haspopup': 'true', 'aria-expanded': 'false', onclick: function (e) {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      boutonMoi.setAttribute('aria-expanded', String(!menu.hidden));
    } }, h('span', { class: 'g-moi__initiales' }, initiales(moi.nom)), h('span', { class: 'g-moi__nom' }, moi.nom));
    var fermerMenu = function () { menu.hidden = true; boutonMoi.setAttribute('aria-expanded', 'false'); };
    document.addEventListener('click', fermerMenu);
    aQuitter.push(function () { document.removeEventListener('click', fermerMenu); });
    var barre = h('header', { class: 'g-barre' },
      h('div', { class: 'g-barre__haut' },
        h('a', { class: 'g-barre__marque', href: '#/accueil', 'aria-label': 'Accueil de la gestion' },
          h('img', { src: '/assets/pg-logo-sable.png', alt: 'Petra Gest', width: '900', height: '909' }), h('span', null, 'Gestion')),
        h('nav', { class: 'g-nav', 'aria-label': 'Sections' }, liens.map(function (l) {
          return h('a', { href: '#/' + l[0], class: l[0] === actif ? 'is-actif' : '', 'aria-current': l[0] === actif ? 'page' : null }, P.icone(l[2]), l[1]);
        })),
        h('div', { class: 'g-moi' }, boutonMoi, menu)));
    var page = h('main', { class: 'g-page' });
    app.appendChild(barre);
    app.appendChild(page);
    return page;
  }

  function entete(titre, sousTitre, actions, retour) {
    return h('div', null,
      retour ? h('a', { class: 'g-retour', href: retour[0] }, P.icone('retour'), retour[1]) : null,
      h('div', { class: 'g-entete' },
        h('div', null, h('h1', null, titre), sousTitre ? h('p', null, sousTitre) : null),
        actions && actions.length ? h('div', { class: 'g-entete__actions' }, actions) : null));
  }

  function deconnexion() {
    api('session', { method: 'DELETE' }).catch(function () {}).then(function () {
      moi = null; garde = null;
      ecranConnexion('Vous êtes déconnecté.', true);
    });
  }

  // =====================================================================
  // Connexion et mot de passe
  // =====================================================================
  function ecranConnexion(message, succes) {
    moi = null;
    P.vider(app);
    var email = h('input', { class: 'g-input', type: 'email', id: 'email', autocomplete: 'username', required: true });
    var mdp = h('input', { class: 'g-input', type: 'password', id: 'mdp', autocomplete: 'current-password', required: true });
    var retour = h('div', { 'aria-live': 'polite' }, message ? P.message(succes ? 'succes' : 'info', message) : null);
    var envoyer = h('button', { type: 'submit', class: 'btn btn--solid' }, P.icone('cle'), 'Se connecter');
    var form = h('form', { class: 'g-grille', novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      P.vider(retour);
      if (!email.value.trim() || !mdp.value) { retour.appendChild(P.message('erreur', 'Saisissez votre e-mail et votre mot de passe.')); return; }
      occupe(envoyer, true);
      P.api('/api/admin/session', { method: 'POST', corps: { email: email.value.trim(), mdp: mdp.value } }).then(function (r) {
        return demarrer(r.doit_changer_mdp);
      }).catch(function (err) {
        occupe(envoyer, false);
        retour.appendChild(P.message('erreur', err.message));
        mdp.select();
      });
    } },
    champ('Adresse e-mail', email), champ('Mot de passe', mdp), retour, envoyer);
    app.appendChild(h('main', { class: 'g-connexion' },
      h('div', { class: 'g-connexion__boite' },
        h('img', { class: 'g-connexion__logo', src: '/assets/pg-logo-navy.png', alt: 'Petra Gest', width: '900', height: '909' }),
        h('h1', null, 'Espace de gestion'),
        h('p', { class: 'g-connexion__sous' }, 'Annonces et codes d\'accès de l\'espace transaction'),
        form)));
    email.focus();
  }

  function ecranMotDePasse(premiereFois) {
    P.vider(app);
    var actuel = h('input', { class: 'g-input', type: 'password', id: 'actuel', autocomplete: 'current-password' });
    var nouveau = h('input', { class: 'g-input', type: 'password', id: 'nouveau', autocomplete: 'new-password' });
    var confirmation = h('input', { class: 'g-input', type: 'password', id: 'confirmation', autocomplete: 'new-password' });
    var retour = h('div', { 'aria-live': 'polite' });
    var envoyer = h('button', { type: 'submit', class: 'btn btn--solid' }, P.icone('coche'), 'Enregistrer mon mot de passe');
    var form = h('form', { class: 'g-grille', novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      P.vider(retour);
      if (nouveau.value.length < 12) { retour.appendChild(P.message('erreur', 'Au moins 12 caractères. Astuce : une courte phrase facile à retenir.')); return; }
      if (nouveau.value !== confirmation.value) { retour.appendChild(P.message('erreur', 'Les deux saisies ne sont pas identiques.')); return; }
      occupe(envoyer, true);
      P.api('/api/admin/session', { method: 'PATCH', corps: { actuel: actuel.value, nouveau: nouveau.value } }).then(function () {
        P.toast('Mot de passe enregistré.');
        return demarrer(false);
      }).catch(function (err) { occupe(envoyer, false); retour.appendChild(P.message('erreur', err.message)); });
    } },
    champ(premiereFois ? 'Mot de passe provisoire reçu' : 'Mot de passe actuel', actuel),
    champ('Nouveau mot de passe', nouveau, '12 caractères au minimum. Une courte phrase est idéale, par exemple « La maison bleue de Rochefort ».'),
    champ('Confirmez le nouveau mot de passe', confirmation), retour, envoyer);
    app.appendChild(h('main', { class: 'g-connexion' },
      h('div', { class: 'g-connexion__boite' },
        h('img', { class: 'g-connexion__logo', src: '/assets/pg-logo-navy.png', alt: 'Petra Gest', width: '900', height: '909' }),
        h('h1', null, 'Choisissez votre mot de passe'),
        h('p', { class: 'g-connexion__sous' }, 'Pour votre sécurité, remplacez le mot de passe provisoire par un mot de passe personnel.'),
        form,
        h('p', { class: 'g-connexion__sous' }, h('button', { type: 'button', class: 'g-retour', onclick: deconnexion }, P.icone('sortie'), 'Se déconnecter')))));
    actuel.focus();
  }

  function demarrer(doitChanger) {
    if (doitChanger) { ecranMotDePasse(true); return Promise.resolve(); }
    return P.api('/api/admin/session').then(function (r) {
      if (r.doit_changer_mdp) { ecranMotDePasse(true); return; }
      moi = r;
      if (!location.hash || location.hash === '#' || location.hash === '#/') { history.replaceState(null, '', '#/accueil'); }
      hashPrecedent = location.hash;
      afficherRoute();
    });
  }

  // =====================================================================
  // Accueil
  // =====================================================================
  function deposerAnnonce(btn) {
    if (btn) occupe(btn, true);
    api('annonces', { method: 'POST', corps: {} }).then(function (r) { aller('annonces/' + r.annonce.id); })
      .catch(function (err) { if (btn) occupe(btn, false); signaler(err); });
  }

  var ICONES_EVT = { connexion: 'cle', fiche: 'oeil', contact_tel: 'tel', contact_mail: 'mail' };
  function phraseEvenement(e) {
    var qui = h('a', { href: '#/codes/' + e.personne.code_id }, P.civilite(e.personne.civilite, e.personne.nom));
    var bien = e.bien ? h('a', { href: '#/annonces/' + e.bien.id }, e.bien.titre || 'Annonce sans titre') : 'un bien retiré';
    switch (e.evenement) {
      case 'connexion': return [qui, " s'est connecté à l'espace"];
      case 'fiche': return [qui, ' a consulté ', bien];
      case 'contact_tel': return [qui, ' a cliqué sur « Appeler » depuis ', bien];
      case 'contact_mail': return [qui, ' a cliqué sur « Écrire » depuis ', bien];
      default: return [qui];
    }
  }

  function vueAccueil(page) {
    var prenom = moi.nom;
    var btnDeposer = h('button', { type: 'button', class: 'g-tuile', onclick: function () { deposerAnnonce(btnDeposer); } },
      h('span', { class: 'g-tuile__ico' }, P.icone('plus')), h('strong', null, 'Déposer une annonce'), h('span', null, 'Photos, prix, adresse : en quelques minutes.'));
    page.appendChild(entete('Bonjour, ' + prenom, "Voici l'activité de votre espace transaction."));
    page.appendChild(h('div', { class: 'g-tuiles' },
      btnDeposer,
      h('a', { class: 'g-tuile', href: '#/codes/nouveau' }, h('span', { class: 'g-tuile__ico' }, P.icone('cle')), h('strong', null, "Créer un code d'accès"), h('span', null, 'Pour un acquéreur : à envoyer par SMS ou e-mail.')),
      h('a', { class: 'g-tuile g-tuile--claire', href: '#/annonces' }, h('span', { class: 'g-tuile__ico' }, P.icone('feuille')), h('strong', null, 'Mes annonces'), h('span', null, 'Modifier, mettre sous offre, marquer vendu.'))));
    // Documents vierges : à imprimer pour un rendez-vous, avant même que l'annonce existe.
    var vierge = function (doc, titre, texte) {
      return h('a', { class: 'g-document', href: '/document?doc=' + doc, target: '_blank', rel: 'noopener' },
        h('span', { class: 'g-document__ico' }, P.icone('imprimer')), h('strong', null, titre), h('span', null, texte));
    };
    var documentsVierges = (h('section', { class: 'g-carte g-documents' }, h('h2', null, 'Documents vierges à imprimer'),
      h('p', { class: 'g-documents__aide' }, 'À remplir à la main lors d\'un rendez-vous. Pour un document prérempli, ouvrez l\'annonce : rubrique « Documents à imprimer ».'),
      h('div', { class: 'g-documents__liste' },
        vierge('decouverte', 'Fiche découverte', 'Rendez-vous d\'estimation chez le propriétaire.'),
        vierge('interne', 'Fiche de rentrée', 'Prise de mandat : vendeur, bien, pièce par pièce.'),
        vierge('visite', 'Bon de visite', 'À faire signer par le visiteur.'))));
    var zone = h('div', null, h('p', { class: 'g-chargement' }, 'Chargement...'));
    page.appendChild(zone);
    page.appendChild(documentsVierges);
    api('activite').then(function (r) {
      var c = r.chiffres;
      P.vider(zone);
      if (r.avertissements && r.avertissements.length) {
        zone.appendChild(h('div', { class: 'g-manquants g-accueil__alerte' }, h('strong', null, 'Mentions légales à compléter'),
          h('ul', null, r.avertissements.map(function (t) { return h('li', null, t); }))));
      }
      zone.appendChild(h('div', { class: 'g-chiffres' },
        [[c.en_ligne, c.en_ligne > 1 ? 'Annonces en ligne' : 'Annonce en ligne'], [c.codes_actifs, c.codes_actifs > 1 ? "Codes d'accès actifs" : "Code d'accès actif"],
          [c.fiches_30j, 'Consultations (30 jours)'], [c.contacts_30j, 'Demandes de contact (30 jours)']].map(function (x) {
          return h('div', { class: 'g-chiffre' }, h('strong', null, String(x[0])), h('span', null, x[1]));
        })));
      var liste = h('ul', { class: 'g-activite' });
      r.evenements.slice(0, 12).forEach(function (e) {
        liste.appendChild(h('li', null, h('span', { class: 'g-activite__ico' }, P.icone(ICONES_EVT[e.evenement] || 'info')),
          h('p', null, phraseEvenement(e), h('small', null, P.ilYa(e.le)))));
      });
      zone.appendChild(h('section', { class: 'g-carte' }, h('h2', null, 'Dernières consultations'),
        r.evenements.length ? liste : h('p', { class: 'lede' }, "Aucune consultation pour l'instant. Créez un code d'accès et envoyez-le à un acquéreur.")));
    }).catch(function (err) { P.vider(zone); signaler(err); });
  }

  // =====================================================================
  // Liste des annonces
  // =====================================================================
  var ONGLETS = [['brouillon', 'Brouillons'], ['en_ligne', 'En ligne'], ['sous_offre', 'Sous offre'], ['vendue', 'Vendues'], ['archivee', 'Archivées'], ['corbeille', 'Corbeille']];
  var ongletAnnonces = 'en_ligne';
  function dansOnglet(a, o) {
    if (o === 'corbeille') return a.en_corbeille;
    if (a.en_corbeille) return false;
    if (o === 'en_ligne') return a.statut === 'publiee';
    return a.statut === o;
  }

  // Case « Dans le catalogue » d'un bien vendu (rubrique Vendues) : enregistrée tout de suite.
  function caseCatalogue(a) {
    var c = h('input', { type: 'checkbox' });
    c.checked = Boolean(a.vendu_vitrine);
    c.addEventListener('change', function () {
      var oui = c.checked;
      c.disabled = true;
      api('annonces/' + a.id, { method: 'PATCH', corps: { vendu_vitrine: oui } }).then(function () {
        a.vendu_vitrine = oui;
        P.toast(oui ? 'Affiché dans le catalogue, avec le bandeau « Vendu ».' : 'Retiré du catalogue.');
      }).catch(function (err) { c.checked = !oui; signaler(err); })
        .then(function () { c.disabled = false; });
    });
    var stop = function (e) { e.stopPropagation(); };
    return h('label', { class: 'g-bascule g-bascule--petite', onclick: stop, onkeydown: stop }, c, 'Dans le catalogue');
  }

  function vueAnnonces(page) {
    var btn = bouton('Déposer une annonce', 'btn--solid', 'plus', function () { deposerAnnonce(btn); });
    page.appendChild(entete('Annonces', 'Toutes les annonces de l\'espace transaction, en ligne ou en préparation.', [btn]));
    var onglets = h('div', { class: 'g-onglets', role: 'tablist' });
    var liste = h('div', null, h('p', { class: 'g-chargement' }, 'Chargement...'));
    page.appendChild(onglets);
    page.appendChild(liste);
    api('annonces').then(function (r) {
      var toutes = r.annonces;
      if (!toutes.some(function (a) { return dansOnglet(a, ongletAnnonces); })) {
        var premier = ONGLETS.filter(function (o) { return toutes.some(function (a) { return dansOnglet(a, o[0]); }); })[0];
        if (premier) ongletAnnonces = premier[0];
      }
      var dessiner = function () {
        P.vider(onglets);
        ONGLETS.forEach(function (o) {
          var n = toutes.filter(function (a) { return dansOnglet(a, o[0]); }).length;
          if (!n && (o[0] === 'corbeille' || o[0] === 'archivee') && ongletAnnonces !== o[0]) return;
          onglets.appendChild(h('button', { type: 'button', class: 'g-onglet', role: 'tab', 'aria-selected': String(o[0] === ongletAnnonces),
            onclick: function () { ongletAnnonces = o[0]; dessiner(); } }, o[1], h('em', null, String(n))));
        });
        P.vider(liste);
        var choix = toutes.filter(function (a) { return dansOnglet(a, ongletAnnonces); });
        if (!choix.length) {
          liste.appendChild(h('div', { class: 'g-liste' }, h('div', { class: 'g-vide' }, P.icone('feuille'),
            h('h3', null, toutes.length ? 'Rien dans cette rubrique' : 'Aucune annonce pour l\'instant'),
            h('p', null, toutes.length ? 'Choisissez une autre rubrique ci-dessus.' : 'Déposez votre première annonce : il suffit de quelques photos et des informations essentielles.'),
            toutes.length ? null : bouton('Déposer une annonce', 'btn--solid', 'plus', function (e) { deposerAnnonce(e.currentTarget); }))));
          return;
        }
        if (ongletAnnonces === 'vendue') {
          liste.appendChild(h('p', { class: 'g-aide-liste' }, P.icone('info'),
            'Cochez « Dans le catalogue » pour montrer un bien vendu dans le fil des annonces, avec le bandeau « Vendu ». '
            + 'Les informations affichées se choisissent dans l\'annonce.'));
        }
        var conteneur = h('div', { class: 'g-liste' });
        choix.forEach(function (a) {
          var st = libelleStatut(a);
          var meta = [];
          if (a.type_bien) meta.push(h('span', null, R.libelle(R.typesBien, a.type_bien)));
          if (a.ville) meta.push(h('span', null, P.icone('lieu'), a.ville));
          if (a.numero_mandat) meta.push(h('span', null, P.icone('feuille'), 'Mandat ' + a.numero_mandat));
          meta.push(h('span', null, P.icone('photo'), P.pluriel(a.nb_photos, 'photo', 'photos')));
          if (a.statut !== 'brouillon') meta.push(h('span', null, P.icone('oeil'), P.pluriel(a.vues_30j, 'vue', 'vues') + ' en 30 jours'));
          meta.push(h('span', null, P.icone('horloge'), 'Modifiée ' + P.ilYa(a.modifie_le)));
          conteneur.appendChild(h('div', { class: 'g-ligne', role: 'link', tabindex: '0',
            onclick: function () { aller('annonces/' + a.id); },
            onkeydown: function (e) { if (e.key === 'Enter') aller('annonces/' + a.id); } },
          h('div', { class: 'g-ligne__vignette' }, a.couverture ? h('img', { src: a.couverture, alt: '', loading: 'lazy' }) : P.icone('photo')),
          h('div', null,
            h('span', { class: 'g-ligne__titre' + (a.titre ? '' : ' sans-titre') }, a.titre || 'Annonce sans titre'),
            h('div', { class: 'g-ligne__meta' }, meta)),
          h('div', { class: 'g-ligne__droite' },
            a.statut === 'vendue' && !a.en_corbeille ? caseCatalogue(a) : null,
            a.prix_fai ? h('span', { class: 'g-ligne__prix' }, P.prix(a.prix_fai)) : null,
            badgeStatut(st[0], st[1]))));
        });
        liste.appendChild(conteneur);
      };
      dessiner();
    }).catch(function (err) { P.vider(liste); signaler(err); });
  }

  // =====================================================================
  // Éditeur d'annonce
  // =====================================================================
  function vueEditeur(page, id) {
    page.appendChild(h('p', { class: 'g-chargement' }, "Ouverture de l'annonce..."));
    api('annonces/' + id).then(function (r) { editeur(page, r.annonce, r.visiteurs); })
      .catch(function (err) {
        P.vider(page);
        if (err.gere) return;
        page.appendChild(entete('Annonce introuvable', err.message, null, ['#/annonces', 'Toutes les annonces']));
      });
  }

  function nombreDepuisSaisie(v, reel) {
    var t = String(v || '').replace(/[\s  ]/g, '').replace(/€|m²|m2/gi, '');
    if (!t) return null;
    if (reel) t = t.replace(',', '.');
    var n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  }
  function formaterMilliers(n) { return n === null || n === undefined || Number.isNaN(n) ? '' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n); }

  function editeur(page, a, visiteurs) {
    var modifs = {};
    var enregistrement = null;   // promesse en cours
    var relancer = false;
    var minuteur = null;
    var derniereSauvegarde = null;
    var erreursChamps = {};

    garde = function () { return Object.keys(modifs).length > 0 && a.statut !== 'brouillon'; };
    aQuitter.push(function () {
      clearTimeout(minuteur);
      if (Object.keys(modifs).length && a.statut === 'brouillon') enregistrer();
    });

    // ---------- Enregistrement ----------
    function changer(nom, valeur) {
      a[nom] = valeur;
      modifs[nom] = valeur;
      if (nom === 'titre') { var t = page.querySelector('.g-entete h1'); if (t) t.textContent = valeur || 'Nouvelle annonce'; }
      if (erreursChamps[nom]) { delete erreursChamps[nom]; var e = page.querySelector('[data-erreur="' + nom + '"]'); if (e) e.remove(); }
      if (a.statut === 'brouillon') { clearTimeout(minuteur); minuteur = setTimeout(enregistrer, 1200); }
      majBarre();
    }

    function enregistrer(extra) {
      if (enregistrement) { relancer = true; return enregistrement; }
      var envoi = Object.assign({}, modifs, extra || {});
      if (!Object.keys(envoi).length) return Promise.resolve(true);
      var envoyes = Object.assign({}, modifs);
      etatSauvegarde('enCours');
      enregistrement = api('annonces/' + a.id, { method: 'PATCH', corps: envoi }).then(function (r) {
        Object.keys(envoyes).forEach(function (k) { if (modifs[k] === envoyes[k]) delete modifs[k]; });
        var saisies = Object.assign({}, modifs);
        Object.assign(a, r.annonce, saisies);
        derniereSauvegarde = new Date();
        etatSauvegarde('ok');
        majManquants();
        majApercuCarte();
        majBarre();
        verifierEnvirons();
        return true;
      }).catch(function (err) {
        etatSauvegarde('erreur');
        if (err.code === 'invalide' && err.corps.champs) {
          erreursChamps = err.corps.champs;
          Object.keys(erreursChamps).forEach(function (k) {
            var z = page.querySelector('[data-champ="' + k + '"]');
            if (z && !z.querySelector('[data-erreur]')) z.appendChild(h('small', { class: 'g-erreur', 'data-erreur': k }, erreursChamps[k]));
          });
          P.toast('Certains champs sont à corriger (en rouge).', 'erreur');
        } else if (err.code === 'incomplet') {
          // Rien n'est perdu : seules les modifications demandées sont refusées.
          etatSauvegarde(Object.keys(modifs).length && a.statut !== 'brouillon' ? 'erreur' : 'ok');
          // Brouillon : les saisies envoyées avec la demande de publication sont réenregistrées seules.
          if (a.statut === 'brouillon' && Object.keys(modifs).length) relancer = true;
          afficherManquants(err.corps.manquants || [], extra && extra.statut);
        } else signaler(err);
        return false;
      }).then(function (ok) {
        enregistrement = null;
        if (relancer) { relancer = false; if (a.statut === 'brouillon') enregistrer(); }
        return ok;
      });
      return enregistrement;
    }

    function afficherManquants(liste, statutVise) {
      modale({
        titre: statutVise && statutVise !== a.statut ? 'Encore quelques informations' : 'Cette annonce doit rester complète',
        corps: [h('p', null, statutVise && statutVise !== a.statut
          ? 'Pour mettre l\'annonce en ligne, il manque :'
          : 'Une annonce visible des acquéreurs doit contenir toutes les mentions obligatoires. Il manque :'),
        h('div', { class: 'g-manquants' }, h('ul', null, liste.map(function (m) { return h('li', null, capitaliser(m)); })))],
        actions: [{ libelle: 'Compléter', classe: 'btn--solid', action: function (f) { f(); } }],
      });
    }
    function capitaliser(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

    function changerStatut(statut, message, btn) {
      if (btn) occupe(btn, true);
      var avant = a.statut;
      enregistrer({ statut: statut }).then(function (ok) {
        if (btn) occupe(btn, false);
        if (ok && a.statut !== avant) { P.toast(message); redessiner(); }
      });
    }

    // ---------- Contrôles liés aux champs ----------
    function zone(nom, enfant) { return h('div', { 'data-champ': nom }, enfant); }

    function saisie(nom, libelle, o) {
      o = o || {};
      var id = nouvelId();
      var estNombre = o.type === 'entier' || o.type === 'reel' || o.type === 'prix';
      var input = h('input', {
        class: 'g-input', id: id, type: 'text', inputmode: o.type === 'reel' ? 'decimal' : estNombre ? 'numeric' : null,
        placeholder: o.placeholder || '', maxlength: o.max ? String(o.max) : null, autocomplete: 'off',
      });
      var val = a[nom];
      input.value = val === null || val === undefined ? '' : o.type === 'prix' ? formaterMilliers(val) : estNombre ? String(val).replace('.', ',') : String(val);
      input.addEventListener('input', function () {
        if (!estNombre) { changer(nom, input.value); if (o.apres) o.apres(); return; }
        var n = nombreDepuisSaisie(input.value, o.type === 'reel');
        input.classList.toggle('is-invalide', Number.isNaN(n));
        if (Number.isNaN(n)) return;
        if (o.type !== 'reel' && n !== null) n = Math.round(n);
        changer(nom, n);
        if (o.apres) o.apres();
      });
      if (o.type === 'prix') input.addEventListener('blur', function () { if (a[nom] !== null && !Number.isNaN(a[nom])) input.value = formaterMilliers(a[nom]); });
      var controle = o.unite ? h('div', { class: 'g-unite' }, input, h('span', null, o.unite)) : input;
      return zone(nom, h('div', { class: 'g-champ' }, h('label', { for: id }, libelle), controle, o.aide ? h('small', null, o.aide) : null));
    }

    function liste(nom, libelle, options, o) {
      o = o || {};
      var id = nouvelId();
      var sel = h('select', { class: 'g-select', id: id },
        h('option', { value: '' }, o.vide || 'Non précisé'), options.map(function (x) { return h('option', { value: x[0] }, x[1]); }));
      sel.value = a[nom] === null || a[nom] === undefined ? '' : String(a[nom]);
      sel.addEventListener('change', function () { changer(nom, sel.value === '' ? null : o.conv ? o.conv(sel.value) : sel.value); });
      return zone(nom, h('div', { class: 'g-champ' }, h('label', { for: id }, libelle), sel, o.aide ? h('small', null, o.aide) : null));
    }

    function segments(nom, libelle, options, o) {
      o = o || {};
      var groupe = h('div', { class: 'g-segments', role: 'group', 'aria-label': libelle });
      var dessiner = function () {
        P.vider(groupe);
        options.forEach(function (x) {
          groupe.appendChild(h('button', { type: 'button', class: 'g-segment', 'aria-pressed': String(a[nom] === x[0]),
            onclick: function () {
              var v = (o.nullable && a[nom] === x[0]) ? null : x[0];
              changer(nom, v); dessiner(); if (o.apres) o.apres();
            } }, x[1]));
        });
      };
      dessiner();
      return zone(nom, h('div', { class: 'g-champ' }, h('span', { class: 'g-label' }, libelle), groupe, o.aide ? h('small', null, o.aide) : null));
    }

    function bascule(nom, libelle) {
      var c = h('input', { type: 'checkbox' });
      c.checked = Boolean(a[nom]);
      c.addEventListener('change', function () { changer(nom, c.checked); });
      return zone(nom, h('label', { class: 'g-bascule' }, c, libelle));
    }

    function lettres(nom, libelle, couleurs, estGes) {
      var groupe = h('div', { class: 'g-lettres', role: 'group', 'aria-label': libelle });
      var dessiner = function () {
        P.vider(groupe);
        R.classesDpe.forEach(function (c) {
          var clair = estGes ? (c === 'A' || c === 'B') : (c === 'C' || c === 'D' || c === 'E');
          var b = h('button', { type: 'button', class: 'g-lettre' + (clair ? ' clair' : ''), 'aria-pressed': String(a[nom] === c), 'aria-label': libelle + ' ' + c,
            onclick: function () { changer(nom, c); dessiner(); } }, c);
          b.style.background = couleurs[c];
          groupe.appendChild(b);
        });
      };
      dessiner();
      return zone(nom, h('div', { class: 'g-champ' }, h('span', { class: 'g-label' }, libelle), groupe));
    }

    function section(num, titre, sousTitre, corps, cle) {
      return h('section', { class: 'g-section', 'data-section': cle || '' },
        h('div', { class: 'g-section__tete' }, h('span', { class: 'g-section__num' }, String(num)),
          h('div', null, h('h2', null, titre), sousTitre ? h('p', null, sousTitre) : null)),
        h('div', { class: 'g-section__corps' }, corps));
    }

    // ---------- 1. Photos ----------
    var enAttente = [];   // envois en cours { cle, apercu, progression, erreur, prep }
    var grillePhotos = h('div', { class: 'g-photos' });
    var entreeFichiers = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'sr-only', tabindex: '-1' });
    var depot = h('div', { class: 'g-depot', role: 'button', tabindex: '0', 'aria-label': 'Ajouter des photos',
      onclick: function () { entreeFichiers.click(); },
      onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); entreeFichiers.click(); } } },
    P.icone('photo'), h('strong', null, 'Déposez vos photos ici ou cliquez pour les choisir'),
    h('span', null, 'JPEG ou PNG, jusqu\'à ' + 40 + ' photos. Elles sont redimensionnées automatiquement. La première sera la photo principale.'));
    entreeFichiers.addEventListener('change', function () { ajouterFichiers(entreeFichiers.files); entreeFichiers.value = ''; });
    ['dragenter', 'dragover'].forEach(function (t) {
      depot.addEventListener(t, function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) { e.preventDefault(); depot.classList.add('is-survol'); } });
    });
    ['dragleave', 'drop'].forEach(function (t) { depot.addEventListener(t, function () { depot.classList.remove('is-survol'); }); });
    depot.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); ajouterFichiers(e.dataTransfer.files); } });

    var fileEnvoi = [];
    var envoisActifs = 0;
    function ajouterFichiers(fichiers) {
      if (a.en_corbeille) return;
      Array.prototype.forEach.call(fichiers, function (f) {
        var item = { cle: Math.random().toString(36).slice(2), apercu: null, progression: 0, erreur: null, nom: f.name };
        enAttente.push(item);
        // La préparation (redimensionnement) se fait en parallèle, mais la file d'envoi
        // garde l'ordre de sélection.
        item.pret = P.photos.preparer(f).then(function (prep) {
          item.prep = prep; item.apercu = prep.apercu; dessinerPhotos(); return true;
        }).catch(function (err) { item.erreur = err.message; dessinerPhotos(); return false; });
        fileEnvoi.push(item);
      });
      dessinerPhotos();
      pomper();
    }
    function pomper() {
      // Un envoi à la fois : les photos gardent l'ordre dans lequel elles ont été choisies.
      while (envoisActifs < 1 && fileEnvoi.length) {
        var item = fileEnvoi.shift();
        envoisActifs += 1;
        (function (it) {
          it.pret.then(function (ok) {
            if (!ok) return null;
            return P.photos.envoyer(a.id, it.prep, function (p) { it.progression = p; majProgression(it); }).then(function (photo) {
              enAttente = enAttente.filter(function (x) { return x !== it; });
              a.photos.push(photo);
              URL.revokeObjectURL(it.apercu);
            });
          }).catch(function (err) { it.erreur = err.message; })
            .then(function () {
              envoisActifs -= 1; dessinerPhotos(); pomper();
              if (!envoisActifs && !fileEnvoi.length) rafraichirManquants();
            });
        })(item);
      }
    }
    function majProgression(it) {
      var barre = grillePhotos.querySelector('[data-envoi="' + it.cle + '"] .g-photo__progres i');
      var texte = grillePhotos.querySelector('[data-envoi="' + it.cle + '"] .g-photo__attente');
      if (barre) barre.style.width = Math.round(it.progression * 100) + '%';
      if (texte) texte.textContent = 'Envoi : ' + Math.round(it.progression * 100) + ' %';
    }
    var glisse = null;
    function deplacer(depuis, vers) {
      if (vers < 0 || vers >= a.photos.length || depuis === vers) return;
      var p = a.photos.splice(depuis, 1)[0];
      a.photos.splice(vers, 0, p);
      dessinerPhotos();
      api('annonces/' + a.id + '/photos/ordre', { method: 'PUT', corps: { ordre: a.photos.map(function (x) { return x.id; }) } })
        .then(function (r) { a.photos = r.photos; dessinerPhotos(); })
        .catch(function (err) { signaler(err); recharger(); });
    }
    function supprimerPhoto(photo) {
      confirmer('Supprimer cette photo ?', 'La photo sera retirée de l\'annonce et effacée.', 'Supprimer', true).then(function (ok) {
        if (!ok) return;
        api('photos/' + photo.id, { method: 'DELETE' }).then(function () {
          a.photos = a.photos.filter(function (x) { return x.id !== photo.id; });
          dessinerPhotos(); rafraichirManquants();
          P.toast('Photo supprimée.');
        }).catch(signaler);
      });
    }
    function dessinerPhotos() {
      P.vider(grillePhotos);
      a.photos.forEach(function (photo, i) {
        var legende = h('input', { class: 'g-photo__legende', type: 'text', placeholder: 'Légende (facultatif)', maxlength: '200', 'aria-label': 'Légende de la photo ' + (i + 1) });
        legende.value = photo.legende || '';
        legende.addEventListener('change', function () {
          api('photos/' + photo.id, { method: 'PATCH', corps: { legende: legende.value } }).then(function () { photo.legende = legende.value; }).catch(signaler);
        });
        var carte = h('div', { class: 'g-photo', draggable: 'true' },
          h('div', { class: 'g-photo__image' }, h('img', { src: photo.url_mini, alt: photo.legende || 'Photo ' + (i + 1), loading: 'lazy' }),
            i === 0 ? h('span', { class: 'badge badge--sand g-photo__couverture' }, P.icone('etoile'), 'Principale') : null),
          h('div', { class: 'g-photo__outils' },
            h('button', { type: 'button', 'aria-label': 'Déplacer vers la gauche', title: 'Déplacer vers la gauche', disabled: i === 0, onclick: function () { deplacer(i, i - 1); } }, P.icone('gauche')),
            h('button', { type: 'button', 'aria-label': 'Déplacer vers la droite', title: 'Déplacer vers la droite', disabled: i === a.photos.length - 1, onclick: function () { deplacer(i, i + 1); } }, P.icone('droite')),
            i !== 0 ? h('button', { type: 'button', 'aria-label': 'Mettre en photo principale', title: 'Mettre en photo principale', onclick: function () { deplacer(i, 0); } }, P.icone('etoile')) : null,
            h('button', { type: 'button', class: 'g-photo__suppr', 'aria-label': 'Supprimer la photo', title: 'Supprimer', onclick: function () { supprimerPhoto(photo); } }, P.icone('corbeille'))),
          legende);
        carte.addEventListener('dragstart', function (e) { glisse = i; carte.classList.add('is-glisse'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); });
        carte.addEventListener('dragend', function () { glisse = null; carte.classList.remove('is-glisse'); });
        carte.addEventListener('dragover', function (e) { if (glisse !== null) { e.preventDefault(); carte.classList.add('is-cible'); } });
        carte.addEventListener('dragleave', function () { carte.classList.remove('is-cible'); });
        carte.addEventListener('drop', function (e) { if (glisse === null) return; e.preventDefault(); carte.classList.remove('is-cible'); deplacer(glisse, i); });
        grillePhotos.appendChild(carte);
      });
      enAttente.forEach(function (it) {
        grillePhotos.appendChild(h('div', { class: 'g-photo' + (it.erreur ? ' g-photo--erreur' : ''), 'data-envoi': it.cle },
          h('div', { class: 'g-photo__image' }, it.apercu ? h('img', { src: it.apercu, alt: '' }) : null,
            h('div', { class: 'g-photo__attente' }, it.erreur ? it.erreur : it.prep ? 'Envoi : ' + Math.round(it.progression * 100) + ' %' : 'Préparation...'),
            it.erreur ? null : h('div', { class: 'g-photo__progres' }, h('i'))),
          h('div', { class: 'g-photo__outils' }, h('span', { class: 'g-photo__nom' }, ''),
            it.erreur ? h('button', { type: 'button', class: 'g-photo__suppr', 'aria-label': 'Retirer', title: 'Retirer', onclick: function () { enAttente = enAttente.filter(function (x) { return x !== it; }); dessinerPhotos(); } }, P.icone('croix')) : null)));
      });
      majSection('photos', a.photos.length > 0);
    }

    // ---------- 3. Adresse ----------
    var zoneAdresse = h('div', { class: 'g-grille' });
    var carteApercu = h('div', { class: 'g-carte-apercu' });
    var texteCarte = h('p', { class: 'carte__legende' });
    function majApercuCarte() {
      dessinerEnvirons();
      var mode = a.affichage_adresse;
      carteApercu.hidden = true;
      if (a.lat === null || a.lat === undefined) { texteCarte.textContent = ''; return; }
      if (mode === 'commune') {
        P.vider(texteCarte); texteCarte.append(P.icone('info'), 'Les acquéreurs voient seulement la commune, sans carte.');
        return;
      }
      carteApercu.hidden = false;
      if (mode === 'exacte') P.carte(carteApercu, a.lat, a.lng, 'exacte');
      else P.carte(carteApercu, a.lat_pub !== null && a.lat_pub !== undefined ? a.lat_pub : a.lat, a.lng_pub !== null && a.lng_pub !== undefined ? a.lng_pub : a.lng, 'zone');
      P.vider(texteCarte);
      texteCarte.append(P.icone('info'), mode === 'exacte'
        ? 'Aperçu : les acquéreurs voient l\'adresse exacte et ce repère.'
        : 'Aperçu : les acquéreurs voient cette zone de 500 m, décalée volontairement. L\'adresse reste confidentielle.');
    }
    function dessinerAdresse() {
      P.vider(zoneAdresse);
      var saisieAdresse = h('input', { class: 'g-input', type: 'text', id: nouvelId(), placeholder: 'Commencez à taper : 12 rue de la République, Rochefort', autocomplete: 'off',
        role: 'combobox', 'aria-expanded': 'false', 'aria-autocomplete': 'list' });
      var suggestions = h('div', { class: 'g-suggestions', hidden: true, role: 'listbox' });
      var resultats = [];
      var actif = -1;
      var attente = null;
      var dernierTexte = '';
      function choisir(f) {
        var p = f.properties;
        var estCommune = p.type === 'municipality';
        changer('adresse', estCommune ? null : p.name);
        changer('code_postal', p.postcode || null);
        changer('ville', p.city || p.name);
        changer('code_insee', p.citycode || null);
        changer('lat', Math.round(f.geometry.coordinates[1] * 1e6) / 1e6);
        a.lat_pub = null; a.lng_pub = null;
        changer('lng', Math.round(f.geometry.coordinates[0] * 1e6) / 1e6);
        suggestions.hidden = true;
        dessinerAdresse();
        majApercuCarte();
        if (a.statut !== 'brouillon') P.toast('Adresse choisie : pensez à enregistrer.');
      }
      function montrer() {
        P.vider(suggestions);
        suggestions.hidden = !resultats.length;
        saisieAdresse.setAttribute('aria-expanded', String(!suggestions.hidden));
        resultats.forEach(function (f, i) {
          suggestions.appendChild(h('button', { type: 'button', role: 'option', class: i === actif ? 'is-actif' : '', onmousedown: function (e) { e.preventDefault(); choisir(f); } },
            P.icone('lieu'), h('span', null, f.properties.label, h('small', null, f.properties.context || ''))));
        });
      }
      saisieAdresse.addEventListener('input', function () {
        clearTimeout(attente);
        var texte = saisieAdresse.value.trim();
        if (texte.length < 3) { resultats = []; montrer(); return; }
        attente = setTimeout(function () {
          dernierTexte = texte;
          fetch('https://data.geopf.fr/geocodage/search?index=address&limit=5&autocomplete=1&q=' + encodeURIComponent(texte))
            .then(function (r) { return r.json(); })
            .then(function (d) { if (texte !== dernierTexte) return; resultats = (d.features || []); actif = -1; montrer(); })
            .catch(function () { P.toast('Recherche d\'adresse indisponible : saisissez-la à la main ci-dessous.', 'erreur'); });
        }, 250);
      });
      saisieAdresse.addEventListener('keydown', function (e) {
        if (suggestions.hidden) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); actif = Math.min(actif + 1, resultats.length - 1); montrer(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); actif = Math.max(actif - 1, 0); montrer(); }
        else if (e.key === 'Enter' && actif >= 0) { e.preventDefault(); choisir(resultats[actif]); }
        else if (e.key === 'Escape') { suggestions.hidden = true; }
      });
      saisieAdresse.addEventListener('blur', function () { setTimeout(function () { suggestions.hidden = true; }, 150); });

      if (a.ville) {
        zoneAdresse.appendChild(h('div', { class: 'g-adresse-choisie' }, P.icone('lieu'),
          h('div', null, h('strong', null, [a.adresse, [a.code_postal, a.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')),
            a.lat === null || a.lat === undefined ? h('small', null, ' (sans position sur la carte)') : null)));
      }
      zoneAdresse.appendChild(h('div', { class: 'g-champ' },
        h('label', { for: saisieAdresse.id }, a.ville ? 'Changer l\'adresse' : 'Adresse du bien'),
        h('div', { class: 'g-autocomplete' }, saisieAdresse, suggestions),
        h('small', null, 'Choisissez l\'adresse dans la liste : la position sur la carte est trouvée automatiquement.')));
      zoneAdresse.appendChild(segments('affichage_adresse', 'Ce que voient les acquéreurs', R.affichagesAdresse, {
        aide: 'Par défaut, une zone approximative : l\'adresse exacte reste confidentielle jusqu\'à la visite.', apres: majApercuCarte }));
      zoneAdresse.appendChild(carteApercu);
      zoneAdresse.appendChild(texteCarte);
      zoneAdresse.appendChild(h('details', { class: 'g-details' }, h('summary', null, 'Saisir ou corriger à la main'),
        h('div', { class: 'g-grille g-grille--2' },
          saisie('adresse', 'Rue et numéro', { max: 200 }),
          saisie('quartier', 'Quartier (facultatif)', { max: 100, placeholder: 'Centre historique' }),
          saisie('code_postal', 'Code postal', { max: 5, placeholder: '17300' }),
          saisie('ville', 'Commune', { max: 100, placeholder: 'Rochefort' }))));
      zoneAdresse.appendChild(zoneEnvirons);
      majApercuCarte();
      dessinerEnvirons();
    }

    // ---------- Environs (OpenStreetMap) ----------
    // La recherche part d'ici, en tâche de fond : Overpass peut mettre une minute à répondre aux heures
    // chargées. Le serveur classe et enregistre ; les acquéreurs ne lisent que le résultat enregistré.
    var E = window.ENVIRONS;
    var zoneEnvirons = h('div', { class: 'g-environs' });
    var rechercheEnvirons = null;   // position en cours de recherche
    var echecEnvirons = false;
    function clePosition() {
      return a.lat === null || a.lat === undefined || a.lng === null || a.lng === undefined ? null
        : Number(a.lat).toFixed(6) + ',' + Number(a.lng).toFixed(6);
    }
    // Après chaque enregistrement et à l'ouverture : relance si l'adresse enregistrée n'a pas encore ses environs.
    function verifierEnvirons() {
      if (a.en_corbeille || !clePosition() || (a.environs && a.environs.a_jour) || rechercheEnvirons || echecEnvirons) return;
      if (modifs.lat !== undefined || modifs.lng !== undefined) return;   // position pas encore enregistrée
      chercherEnvirons(false);
    }
    function chercherEnvirons(manuel) {
      var pour = clePosition();
      if (!pour || rechercheEnvirons) return;
      rechercheEnvirons = pour; echecEnvirons = false; dessinerEnvirons();
      var requete = E.requete(a.lat, a.lng);
      (function essayer(i) {
        var arret = new AbortController();
        var minuteur = setTimeout(function () { arret.abort(); }, 100000);
        fetch(E.SERVEURS[i], { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(requete), signal: arret.signal })
          .then(function (r) { if (!r.ok) throw new Error('Overpass ' + r.status); return r.json(); }, function (e) { throw new Error('Overpass ' + e.message); })
          .then(function (d) {
            clearTimeout(minuteur);
            return api('annonces/' + a.id + '/environs', { method: 'POST', corps: { pour: pour, elements: E.nettoyer(d.elements) } })
              .then(function (r) {
                rechercheEnvirons = null;
                a.environs = r.annonce.environs;
                dessinerEnvirons();
                if (manuel) P.toast('Environs mis à jour.');
              });
          })
          .catch(function (err) {
            clearTimeout(minuteur);
            if (err instanceof P.ErreurApi) {
              rechercheEnvirons = null;
              if (err.code === 'position') { verifierEnvirons(); return; }   // l'adresse a changé : on repart
              echecEnvirons = true; dessinerEnvirons(); signaler(err); return;
            }
            if (i + 1 < E.SERVEURS.length) { essayer(i + 1); return; }
            rechercheEnvirons = null; echecEnvirons = true; dessinerEnvirons();
          });
      })(0);
    }
    function dessinerEnvirons() {
      P.vider(zoneEnvirons);
      if (!clePosition()) return;
      var titre = h('span', { class: 'g-label' }, 'Découvrir les environs');
      var env = a.environs || { categories: [], a_jour: false };
      if (rechercheEnvirons) {
        zoneEnvirons.append(titre, h('p', { class: 'g-environs__etat' }, P.icone('horloge'),
          'Recherche des lieux autour du bien (transports, écoles, commerces, santé) sur OpenStreetMap. Cela peut prendre une minute : vous pouvez continuer votre saisie.'));
        return;
      }
      if (echecEnvirons) {
        zoneEnvirons.append(titre, h('p', { class: 'g-environs__etat' }, P.icone('alerte'),
          'Le service OpenStreetMap ne répond pas pour l\'instant. L\'annonce reste valable sans cette rubrique.'),
        bouton('Réessayer', 'btn--light btn--sm', 'rafraichir', function () { echecEnvirons = false; chercherEnvirons(true); }));
        return;
      }
      if (!env.a_jour) {
        zoneEnvirons.append(titre, bouton('Chercher les lieux autour du bien', 'btn--light btn--sm', 'recherche', function () { chercherEnvirons(true); }));
        return;
      }
      var nb = env.categories.reduce(function (n, c) { return n + c.lieux.length; }, 0);
      var resume = nb
        ? P.pluriel(nb, 'lieu trouvé', 'lieux trouvés') + ' : ' + env.categories.map(function (c) { return c.libelle.toLowerCase() + ' (' + c.lieux.length + ')'; }).join(', ') + '.'
        : 'Aucun lieu trouvé autour du bien : la rubrique ne sera pas affichée.';
      [titre,
        h('p', { class: 'g-environs__etat' }, P.icone('coche'), resume + (env.le ? ' Recherche du ' + P.date(env.le) + '.' : '')),
        a.affichage_adresse === 'commune' ? h('p', { class: 'g-environs__etat' }, P.icone('info'), 'Non affichés aux acquéreurs : l\'annonce ne montre que la commune.') : null,
        nb ? h('details', { class: 'g-details' }, h('summary', null, 'Voir ce que verront les acquéreurs'),
          h('div', { class: 'g-environs__liste' }, env.categories.map(function (c) {
            return h('div', null, h('strong', null, c.libelle), h('ul', null, c.lieux.map(function (l) {
              return h('li', null, (l.nom ? l.nom + ' (' + l.type + ')' : l.type) + ' : ' + E.texteDuree(l));
            })));
          }))) : null,
        h('div', null, bouton('Actualiser', 'btn--light btn--sm', 'rafraichir', function () { chercherEnvirons(true); }))]
        .forEach(function (el) { if (el) zoneEnvirons.appendChild(el); });   // append() écrirait « null »
    }

    // ---------- Phrase des atouts ----------
    // « Parmi ses atouts : un jardin, une cheminée et une cave. », dans l'ordre du référentiel.
    var DEBUT_PHRASE_ATOUTS = 'Parmi ses atouts : ';
    function phraseAtouts() {
      var coches = a.atouts || [];
      var morceaux = R.atouts.filter(function (x) { return coches.indexOf(x[0]) >= 0; })
        .map(function (x) { return R.phrasesAtouts[x[0]]; }).filter(Boolean);
      if (!morceaux.length) return '';
      var liste = morceaux.length === 1 ? morceaux[0] : morceaux.slice(0, -1).join(', ') + ' et ' + morceaux[morceaux.length - 1];
      return DEBUT_PHRASE_ATOUTS + liste + '.';
    }
    // Ajoute la phrase en fin de description, ou remplace celle écrite la fois précédente.
    function descriptionAvecAtouts(texte, phrase) {
      var paragraphes = String(texte || '').replace(/\r\n?/g, '\n').split(/\n\s*\n/)
        .filter(function (p) { return p.trim() && p.trim().indexOf(DEBUT_PHRASE_ATOUTS) !== 0; });
      paragraphes.push(phrase);
      return paragraphes.join('\n\n');
    }

    // ---------- Titre proposé ----------
    function proposerTitre() {
      var type = R.libelle(R.typesBien, a.type_bien) || 'Bien';
      var morceaux = [type];
      if (a.type_bien === 'terrain' && a.surface_terrain) morceaux.push('de ' + P.hectares(a.surface_terrain));
      else if (a.nb_pieces) morceaux.push('de ' + P.pluriel(a.nb_pieces, 'pièce', 'pièces'));
      if (a.ville) morceaux.push('à ' + a.ville);
      return morceaux.join(' ');
    }

    // ---------- 6. Honoraires : calcul affiché ----------
    var calculHonoraires = h('p', { class: 'g-calcul', hidden: true });
    function majCalcul() {
      if (a.honoraires_charge !== 'acquereur' || !(a.prix_fai > 0) || !(a.honoraires_ttc > 0) || a.honoraires_ttc >= a.prix_fai) {
        calculHonoraires.hidden = true; return;
      }
      var net = a.prix_fai - a.honoraires_ttc;
      calculHonoraires.hidden = false;
      calculHonoraires.textContent = 'Affiché aux acquéreurs : ' + P.prix(a.prix_fai) + ' honoraires inclus, dont '
        + P.nombre(Math.round(a.honoraires_ttc / net * 10000) / 100) + ' % TTC à leur charge (' + P.prix(net) + ' hors honoraires).';
    }

    // ---------- Sections dépendantes ----------
    var corpsEnergie = h('div', { class: 'g-grille' });
    function dessinerEnergie() {
      P.vider(corpsEnergie);
      corpsEnergie.appendChild(segments('dpe_statut', 'Diagnostic de performance énergétique', R.dpeStatuts, { apres: dessinerEnergie }));
      if (a.dpe_statut === 'realise') {
        corpsEnergie.appendChild(h('div', { class: 'g-grille g-grille--2' },
          lettres('dpe_classe', 'Classe énergie', R.couleursDpe, false),
          lettres('ges_classe', 'Classe climat (GES)', R.couleursGes, true)));
        corpsEnergie.appendChild(h('div', { class: 'g-grille g-grille--4' },
          saisie('dpe_conso', 'Consommation', { type: 'entier', unite: 'kWh/m²' }),
          saisie('ges_emission', 'Émissions', { type: 'entier', unite: 'kg CO₂' }),
          saisie('dpe_depenses_min', 'Dépenses annuelles : minimum', { type: 'prix', unite: '€' }),
          saisie('dpe_depenses_max', 'Dépenses annuelles : maximum', { type: 'prix', unite: '€' })));
        var date = h('input', { class: 'g-input', type: 'date', id: nouvelId(), max: new Date().toISOString().slice(0, 10) });
        date.value = a.dpe_date || '';
        date.addEventListener('change', function () { changer('dpe_date', date.value || null); });
        corpsEnergie.appendChild(h('div', { class: 'g-grille g-grille--2' },
          saisie('dpe_annee_prix', 'Année de référence des prix de l\'énergie', { type: 'entier', placeholder: '2023', aide: 'Indiquée sur le DPE (« prix moyens des énergies indexés au 1er janvier… »).' }),
          zone('dpe_date', h('div', { class: 'g-champ' }, h('label', { for: date.id }, 'Date du DPE'), date, h('small', null, 'Les DPE réalisés avant le 1er juillet 2021 ne sont plus valables.')))));
        corpsEnergie.appendChild(h('p', { class: 'g-aide' }, h('strong', null, 'Obligation légale : '),
          'la classe énergie, la classe climat et l\'estimation des dépenses annuelles doivent figurer sur l\'annonce. Les classes F et G affichent automatiquement la mention « Logement à consommation énergétique excessive ».'));
      }
      if (a.dpe_statut === 'realise' || a.dpe_statut === 'vierge') corpsEnergie.appendChild(zoneDpePdf());
    }

    // DPE complet joint en PDF : les acquéreurs le consultent depuis l'annonce (demande de Catherine, 28/10/2026).
    var DPE_MAX = 4 * 1024 * 1024;   // limite d'envoi de l'hébergeur
    var entreeDpe = h('input', { type: 'file', accept: 'application/pdf,.pdf', class: 'sr-only', tabindex: '-1' });
    entreeDpe.addEventListener('change', function () { var f = entreeDpe.files[0]; entreeDpe.value = ''; if (f) joindreDpe(f); });
    var dpeEnvoi = false;
    function joindreDpe(f) {
      if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name || '')) { P.toast("Ce fichier n'est pas un PDF.", 'erreur'); return; }
      if (f.size > DPE_MAX) { P.toast('Ce PDF dépasse 4 Mo. Joignez le DPE seul (pas le dossier complet de diagnostics) ou réduisez-le.', 'erreur'); return; }
      dpeEnvoi = true; dessinerEnergie();
      api('annonces/' + a.id + '/dpe', { method: 'POST', binaire: f }).then(function (r) {
        a.dpe_pdf = r.dpe_pdf;
        P.toast('DPE joint à l\'annonce.');
      }).catch(signaler).then(function () { dpeEnvoi = false; dessinerEnergie(); });
    }
    function retirerDpe() {
      confirmer('Retirer le DPE joint ?', 'Le PDF ne sera plus proposé aux acquéreurs et sera effacé.', 'Retirer', true).then(function (ok) {
        if (!ok) return;
        api('annonces/' + a.id + '/dpe', { method: 'DELETE' }).then(function () {
          a.dpe_pdf = null; dessinerEnergie(); P.toast('DPE retiré de l\'annonce.');
        }).catch(signaler);
      });
    }
    function zoneDpePdf() {
      var contenu;
      if (dpeEnvoi) {
        contenu = [h('small', null, 'Envoi du PDF en cours...')];
      } else if (a.dpe_pdf) {
        contenu = [
          h('p', null, h('a', { href: a.dpe_pdf.url, target: '_blank', rel: 'noopener' }, 'Voir le DPE joint (PDF, ' + P.taille(a.dpe_pdf.octets) + ')')),
          h('div', { class: 'g-dpe-pdf__boutons' },
            bouton('Remplacer', 'btn--light btn--sm', 'rafraichir', function () { entreeDpe.click(); }),
            bouton('Retirer', 'btn--light btn--sm', 'corbeille', retirerDpe))];
      } else {
        contenu = [
          h('div', null, bouton('Joindre le DPE (PDF)', 'btn--light btn--sm', 'feuille', function () { entreeDpe.click(); })),
          h('small', null, 'Les acquéreurs pourront le consulter depuis l\'annonce. 4 Mo au maximum : le DPE seul, pas tout le dossier de diagnostics.')];
      }
      return h('div', { class: 'g-champ g-dpe-pdf' }, h('span', { class: 'g-label' }, 'Le DPE complet (PDF)'), contenu, entreeDpe);
    }
    var corpsHonoraires = h('div', { class: 'g-grille' });
    var champMandat = saisie('numero_mandat', 'N° de mandat', { max: 40, placeholder: 'Ex. 2026-014',
      aide: 'Affiché aux acquéreurs comme « Référence de l\'annonce ». Obligatoire pour mettre en ligne.' });
    // Ce que veut dire chaque option, en clair (Catherine : « ils n'ont pas le détail »).
    function explicationHonoraires() {
      var c = a.honoraires_charge;
      var lignes = [];
      if (c !== 'acquereur') lignes.push(h('p', null, h('strong', null, 'Vendeur : '),
        'le prix affiché est celui que paie l\'acquéreur ; vos honoraires sont prélevés sur ce prix. L\'annonce indique « Honoraires à la charge du vendeur ».'));
      if (c !== 'vendeur') lignes.push(h('p', null, h('strong', null, 'Acquéreur : '),
        'le prix affiché comprend vos honoraires. Saisissez leur montant TTC (ou calculez-le à partir du prix net vendeur) : l\'annonce affiche aussi le prix hors honoraires et leur pourcentage, comme l\'exige la loi.'));
      lignes.push(h('p', null, h('strong', null, 'Succession : '),
        'les honoraires sont souvent à la charge de l\'acquéreur. Dans tous les cas, c\'est le mandat qui fait foi.'));
      return h('div', { class: 'g-aide g-aide--honoraires' }, lignes);
    }

    // Calcul à partir du prix net vendeur, au taux du barème (ou un autre) : remplit le prix et les honoraires.
    var netSaisi = null;
    var tauxSaisi = String(R.baremeVente[0][0]);
    var calculOuvert = false;
    function calculateurBareme() {
      var net = h('input', { class: 'g-input', type: 'text', inputmode: 'numeric', id: nouvelId(), placeholder: '450 000', autocomplete: 'off' });
      if (netSaisi) net.value = formaterMilliers(netSaisi);
      else if (a.prix_fai > 0 && a.honoraires_ttc > 0 && a.honoraires_ttc < a.prix_fai) net.value = formaterMilliers(a.prix_fai - a.honoraires_ttc);
      var taux = h('input', { class: 'g-input', type: 'text', inputmode: 'decimal', id: nouvelId(), autocomplete: 'off' });
      taux.value = tauxSaisi.replace('.', ',');
      var resultat = h('p', { class: 'g-calcul', hidden: true });
      var choix = h('div', { class: 'g-segments', role: 'group', 'aria-label': 'Taux du barème' });
      function dessinerChoix() {
        P.vider(choix);
        R.baremeVente.forEach(function (x) {
          choix.appendChild(h('button', { type: 'button', class: 'g-segment', 'aria-pressed': String(nombreDepuisSaisie(taux.value, true) === x[0]),
            onclick: function () { taux.value = String(x[0]); tauxSaisi = taux.value; dessinerChoix(); apercu(); } }, x[0] + ' % ' + x[1].toLowerCase()));
        });
      }
      function apercu() {
        var n = nombreDepuisSaisie(net.value, false);
        var t = nombreDepuisSaisie(taux.value, true);
        if (!(n > 0) || !(t > 0) || t >= 50) { resultat.hidden = true; return null; }
        var hon = Math.round(n * t / 100);
        resultat.hidden = false;
        resultat.textContent = 'Honoraires : ' + P.prix(hon) + ' TTC. Prix affiché : ' + P.prix(n + hon) + ' honoraires inclus.';
        return { net: n, honoraires: hon };
      }
      net.addEventListener('input', apercu);
      net.addEventListener('blur', function () { var n = nombreDepuisSaisie(net.value, false); if (n > 0) net.value = formaterMilliers(n); });
      taux.addEventListener('input', function () { tauxSaisi = taux.value; dessinerChoix(); apercu(); });
      var appliquer = bouton('Reporter dans l\'annonce', 'btn--solid btn--sm', 'coche', function () {
        var r = apercu();
        if (!r) { P.toast('Saisissez le prix net vendeur et le taux.', 'erreur'); return; }
        netSaisi = r.net;
        changer('prix_fai', r.net + r.honoraires);
        changer('honoraires_ttc', r.honoraires);
        var champPrix = page.querySelector('[data-champ="prix_fai"] input');
        if (champPrix) champPrix.value = formaterMilliers(r.net + r.honoraires);
        dessinerHonoraires();
        P.toast('Prix et honoraires reportés' + (a.statut !== 'brouillon' ? ' : pensez à enregistrer.' : '.'));
      });
      dessinerChoix();
      apercu();
      var boite = h('details', { class: 'g-details' }, h('summary', null, 'Calculer à partir du prix net vendeur (barème)'),
        h('div', { class: 'g-grille' },
          h('div', { class: 'g-grille g-grille--2' },
            h('div', { class: 'g-champ' }, h('label', { for: net.id }, 'Prix net vendeur'), h('div', { class: 'g-unite' }, net, h('span', null, '€'))),
            h('div', { class: 'g-champ' }, h('label', { for: taux.id }, 'Taux des honoraires TTC'), h('div', { class: 'g-unite' }, taux, h('span', null, '%')), choix)),
          resultat,
          h('div', null, appliquer),
          h('small', null, 'Barème Petra Gest des maisons et appartements : ' + R.baremeVente.map(function (x) {
            return x[0] + ' % en ' + x[1].toLowerCase();
          }).join(', ') + ', du prix net vendeur. Pour un autre type de bien, saisissez le taux du barème.')));
      boite.open = calculOuvert;
      boite.addEventListener('toggle', function () { calculOuvert = boite.open; });
      return boite;
    }

    function dessinerHonoraires() {
      P.vider(corpsHonoraires);
      corpsHonoraires.appendChild(h('div', { class: 'g-grille g-grille--2' }, champMandat));
      corpsHonoraires.appendChild(segments('honoraires_charge', 'Honoraires à la charge de', R.honorairesCharge, { apres: function () { dessinerHonoraires(); majCalcul(); } }));
      corpsHonoraires.appendChild(explicationHonoraires());
      if (a.honoraires_charge === 'acquereur') {
        corpsHonoraires.appendChild(h('div', { class: 'g-grille g-grille--2' },
          saisie('honoraires_ttc', 'Montant des honoraires TTC', { type: 'prix', unite: '€', apres: majCalcul, aide: 'Compris dans le prix affiché.' })));
        corpsHonoraires.appendChild(calculHonoraires);
        corpsHonoraires.appendChild(calculateurBareme());
      } else {
        corpsHonoraires.appendChild(calculHonoraires);
      }
      majCalcul();
      corpsHonoraires.appendChild(segments('copropriete', 'Le bien est-il en copropriété ?', [[true, 'Oui'], [false, 'Non']], { apres: dessinerHonoraires }));
      if (a.copropriete === true) {
        corpsHonoraires.appendChild(h('div', { class: 'g-grille g-grille--2' },
          saisie('copro_nb_lots', 'Nombre de lots', { type: 'entier' }),
          saisie('copro_charges_annuelles', 'Charges annuelles moyennes du lot', { type: 'prix', unite: '€' })));
        corpsHonoraires.appendChild(segments('copro_procedure', 'Procédure en cours contre le syndicat ?', [[false, 'Non'], [true, 'Oui']], { apres: dessinerHonoraires,
          aide: 'Plan de sauvegarde, administrateur provisoire...' }));
        if (a.copro_procedure) corpsHonoraires.appendChild(saisie('copro_procedure_detail', 'Nature de la procédure', { max: 300 }));
      }
    }

    // ---------- État de la sauvegarde et barre d'actions ----------
    var etatTexte = h('span', { class: 'g-sauvegarde' });
    function etatSauvegarde(e) {
      P.vider(etatTexte);
      if (e === 'enCours') etatTexte.append('Enregistrement...');
      else if (e === 'erreur') etatTexte.append(P.icone('alerte'), 'Non enregistré');
      else if (derniereSauvegarde) etatTexte.append(P.icone('coche'), 'Enregistré à ' + derniereSauvegarde.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    }
    var barre = h('div', { class: 'g-actions' });
    function menuActions() {
      var ouvert = false;
      var listeMenu = h('div', { class: 'g-menu__liste', hidden: true });
      var ajouter = function (libelle, icone, action, danger) {
        listeMenu.appendChild(h('button', { type: 'button', class: danger ? 'danger' : '', onclick: function () { listeMenu.hidden = true; action(); } }, P.icone(icone), libelle));
      };
      var st = a.statut;
      if (st === 'publiee') { ajouter('Passer sous offre', 'horloge', function () { changerStatut('sous_offre', 'Annonce passée sous offre.'); }); ajouter('Marquer comme vendu', 'coche', function () { changerStatut('vendue', 'Annonce marquée vendue.'); }); }
      if (st === 'sous_offre') { ajouter('Remettre en vente', 'rafraichir', function () { changerStatut('publiee', 'Annonce remise en vente.'); }); ajouter('Marquer comme vendu', 'coche', function () { changerStatut('vendue', 'Annonce marquée vendue.'); }); }
      if (st === 'vendue') ajouter('Remettre en vente', 'rafraichir', function () { changerStatut('publiee', 'Annonce remise en vente.'); });
      if (st !== 'brouillon') ajouter('Retirer du site (brouillon)', 'crayon', function () { changerStatut('brouillon', 'Annonce retirée du site.'); });
      if (st !== 'archivee') ajouter('Archiver', 'feuille', function () { changerStatut('archivee', 'Annonce archivée.'); });
      ajouter('Voir comme un acquéreur', 'oeil', function () { enregistrer().then(function () { window.open('/bien?id=' + a.id, '_blank', 'noopener'); }); });
      ajouter('Copier le lien de ce bien', 'copier', function () { copier(location.origin + '/bien?id=' + a.id); });
      ajouter('Imprimer la fiche technique', 'imprimer', function () { ouvrirDocument('fiche'); });
      ajouter('Imprimer un bon de visite', 'imprimer', function () { ouvrirDocument('visite'); });
      ajouter('Dupliquer (sans les photos)', 'copier', dupliquer);
      ajouter('Mettre à la corbeille', 'corbeille', corbeille, true);
      var declencheur = bouton('Plus d\'actions', 'btn--light', 'menu', function (e) {
        e.stopPropagation(); ouvert = !ouvert; listeMenu.hidden = !ouvert;
      }, { 'aria-haspopup': 'true' });
      var fermer = function () { listeMenu.hidden = true; ouvert = false; };
      document.addEventListener('click', fermer);
      aQuitter.push(function () { document.removeEventListener('click', fermer); });
      return h('div', { class: 'g-menu' }, declencheur, listeMenu);
    }
    function majBarre() {
      P.vider(barre);
      var st = libelleStatut(a);
      var nbModifs = Object.keys(modifs).length;
      var etat = h('div', { class: 'g-actions__etat' }, badgeStatut(st[0], st[1]),
        a.statut === 'brouillon' || !nbModifs ? etatTexte : h('strong', null, 'Modifications non enregistrées'));
      var boutons = h('div', { class: 'g-actions__boutons' });
      if (a.en_corbeille) {
        boutons.appendChild(bouton('Restaurer', 'btn--solid', 'rafraichir', restaurer));
        boutons.appendChild(bouton('Supprimer définitivement', 'btn--danger', 'corbeille', supprimerDefinitivement));
      } else {
        boutons.appendChild(bouton('Aperçu', 'btn--light', 'oeil', function () { enregistrer().then(function () { window.open('/bien?id=' + a.id, '_blank', 'noopener'); }); }));
        boutons.appendChild(menuActions());
        if (a.statut === 'brouillon' || a.statut === 'archivee') {
          var pub = bouton('Mettre en ligne', 'btn--solid', 'coche', function () { changerStatut('publiee', 'Annonce en ligne : les détenteurs d\'un code la voient désormais.', pub); });
          boutons.appendChild(pub);
        } else {
          var enr = bouton('Enregistrer', 'btn--solid', 'coche', function () {
            occupe(enr, true);
            enregistrer().then(function (ok) { occupe(enr, false); if (ok) P.toast('Modifications enregistrées.'); });
          });
          if (!nbModifs) enr.disabled = true;
          boutons.appendChild(enr);
        }
      }
      barre.appendChild(h('div', { class: 'g-actions__inner' }, etat, boutons));
    }

    // ---------- Manquants ----------
    var zoneManquants = h('div');
    function majManquants() {
      P.vider(zoneManquants);
      if (a.en_corbeille) return;
      var m = a.manquants || [];
      if (a.statut === 'brouillon' || a.statut === 'archivee') {
        zoneManquants.appendChild(m.length
          ? h('div', { class: 'g-manquants' }, h('strong', null, 'Pour mettre en ligne, il reste à renseigner :'), h('ul', null, m.map(function (x) { return h('li', null, capitaliser(x)); })))
          : h('div', { class: 'g-manquants g-manquants--ok' }, h('strong', null, 'L\'annonce est complète.'), 'Vous pouvez la mettre en ligne avec le bouton en bas de page.'));
      } else if (m.length) {
        // Annonce en ligne avant une nouvelle obligation (n° de mandat) : on le rappelle sans bloquer.
        zoneManquants.appendChild(h('div', { class: 'g-manquants' }, h('strong', null, 'Annonce en ligne : il reste à renseigner'),
          h('ul', null, m.map(function (x) { return h('li', null, capitaliser(x)); }))));
      }
      majSection('essentiel', Boolean(a.type_bien && a.titre && a.prix_fai && (a.surface_habitable || a.surface_terrain)));
      majSection('adresse', Boolean(a.ville));
      majSection('description', Boolean(a.description));
      majSection('energie', Boolean(a.dpe_statut && (a.dpe_statut !== 'realise' || (a.dpe_classe && a.ges_classe))));
      majSection('honoraires', Boolean(a.numero_mandat && a.honoraires_charge && a.copropriete !== null && a.copropriete !== undefined));
    }
    function rafraichirManquants() {
      api('annonces/' + a.id).then(function (r) { a.manquants = r.annonce.manquants; majManquants(); }).catch(function () {});
    }
    function majSection(cle, complete) {
      var s = page.querySelector('[data-section="' + cle + '"]');
      if (s) s.classList.toggle('is-complete', complete);
    }

    // ---------- Actions ----------
    function dupliquer() {
      api('annonces/' + a.id + '/dupliquer', { method: 'POST', corps: {} }).then(function (r) {
        P.toast('Copie créée (sans les photos).');
        aller('annonces/' + r.annonce.id);
      }).catch(signaler);
    }
    function corbeille() {
      confirmer('Mettre à la corbeille ?', 'L\'annonce disparaît immédiatement du site. Elle reste récupérable pendant 30 jours dans la corbeille.', 'Mettre à la corbeille', true)
        .then(function (ok) {
          if (!ok) return;
          modifs = {};
          api('annonces/' + a.id, { method: 'DELETE' }).then(function () { P.toast('Annonce placée dans la corbeille.'); ongletAnnonces = 'corbeille'; aller('annonces'); }).catch(signaler);
        });
    }
    function restaurer() {
      api('annonces/' + a.id + '/restaurer', { method: 'POST', corps: {} }).then(function (r) { Object.assign(a, r.annonce); P.toast('Annonce restaurée.'); redessiner(); }).catch(signaler);
    }
    function supprimerDefinitivement() {
      confirmer('Supprimer définitivement ?', 'L\'annonce et ses photos seront effacées. Cette action est irréversible.', 'Supprimer définitivement', true).then(function (ok) {
        if (!ok) return;
        api('annonces/' + a.id + '?definitif=1', { method: 'DELETE' }).then(function () { P.toast('Annonce supprimée.'); aller('annonces'); }).catch(signaler);
      });
    }
    function recharger() { api('annonces/' + a.id).then(function (r) { Object.assign(a, r.annonce); redessiner(); }).catch(signaler); }

    // ---------- 8 et 9. Fiche technique et dossier interne (lot 3) ----------
    // Tout tient dans le seul champ « fiche » (JSON, validé par api/_lib/fiche.js). Chaque modification envoie
    // une copie neuve : un objet modifié sur place pendant un enregistrement ferait perdre la dernière saisie.
    function ficheCopie() { return JSON.parse(JSON.stringify(a.fiche || {})); }
    function videVal(v) { return v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length); }
    function ficheMaj(cle, valeur) {
      var f = ficheCopie();
      if (videVal(valeur)) delete f[cle]; else f[cle] = valeur;
      changer('fiche', Object.keys(f).length ? f : null);
    }
    function fv(cle) { return a.fiche ? a.fiche[cle] : undefined; }

    function fSaisie(cle, libelle, o) {
      o = o || {};
      var id = nouvelId();
      var el;
      if (o.lignes) {
        el = h('textarea', { class: 'g-textarea g-textarea--court', id: id, maxlength: o.max ? String(o.max) : null, placeholder: o.placeholder || '' });
      } else {
        el = h('input', { class: 'g-input', id: id, type: o.type === 'date' ? 'date' : o.type === 'email' ? 'email' : o.type === 'tel' ? 'tel' : 'text',
          inputmode: o.type === 'entier' ? 'numeric' : null, maxlength: o.max ? String(o.max) : null,
          placeholder: o.placeholder || '', autocomplete: 'off', list: o.suggestions ? id + '-l' : null });
      }
      var v = fv(cle);
      el.value = videVal(v) ? '' : o.type === 'entier' ? formaterMilliers(v) : String(v);
      el.addEventListener('input', function () {
        if (o.type !== 'entier') { ficheMaj(cle, el.value); return; }
        var n = nombreDepuisSaisie(el.value, false);
        el.classList.toggle('is-invalide', Number.isNaN(n));
        if (!Number.isNaN(n)) ficheMaj(cle, n === null ? null : Math.round(n));
      });
      var controle = o.unite ? h('div', { class: 'g-unite' }, el, h('span', null, o.unite)) : el;
      return h('div', { class: 'g-champ' + (o.large ? ' g-champ--large' : '') }, h('label', { for: id }, libelle), controle,
        o.suggestions ? h('datalist', { id: id + '-l' }, o.suggestions.map(function (s) { return h('option', { value: s }); })) : null,
        o.aide ? h('small', null, o.aide) : null);
    }
    function fChoix(cle, libelle, options) {
      var id = nouvelId();
      var sel = h('select', { class: 'g-select', id: id }, h('option', { value: '' }, 'Non précisé'),
        options.map(function (x) { return h('option', { value: x[0] }, x[1]); }));
      sel.value = fv(cle) || '';
      sel.addEventListener('change', function () { ficheMaj(cle, sel.value || null); });
      return h('div', { class: 'g-champ' }, h('label', { for: id }, libelle), sel);
    }
    // Oui / Non ; un second clic sur le choix actif le retire (« non précisé »).
    function fOuiNon(cle, libelle, apres) {
      var groupe = h('div', { class: 'g-segments', role: 'group', 'aria-label': libelle });
      var dessiner = function () {
        P.vider(groupe);
        [[true, 'Oui'], [false, 'Non']].forEach(function (x) {
          groupe.appendChild(h('button', { type: 'button', class: 'g-segment', 'aria-pressed': String(fv(cle) === x[0]),
            onclick: function () { ficheMaj(cle, fv(cle) === x[0] ? null : x[0]); dessiner(); if (apres) apres(); } }, x[1]));
        });
      };
      dessiner();
      return h('div', { class: 'g-champ' }, h('span', { class: 'g-label' }, libelle), groupe);
    }
    function fCases(cle, libelle, options) {
      var groupe = h('div', { class: 'g-atouts', role: 'group', 'aria-label': libelle });
      var dessiner = function () {
        P.vider(groupe);
        options.forEach(function (x) {
          var actif = (fv(cle) || []).indexOf(x[0]) >= 0;
          groupe.appendChild(h('button', { type: 'button', class: 'g-atout', 'aria-pressed': String(actif), onclick: function () {
            var l = (fv(cle) || []).slice();
            if (actif) l = l.filter(function (y) { return y !== x[0]; }); else l.push(x[0]);
            ficheMaj(cle, l); dessiner();
          } }, P.icone('coche'), x[1]));
        });
      };
      dessiner();
      return h('div', { class: 'g-champ' }, h('span', { class: 'g-label' }, libelle), groupe);
    }
    function sousTitre(texte, aide) {
      return h('div', { class: 'g-fiche__titre' }, h('h3', null, texte), aide ? h('p', null, aide) : null);
    }

    // Pièce par pièce
    var zonePieces = h('div', { class: 'g-pieces' });
    var totalPieces = h('p', { class: 'g-pieces__total', 'aria-live': 'polite' });
    function pieces() { return a.fiche && Array.isArray(a.fiche.pieces) ? a.fiche.pieces : []; }
    function piecesCopie() { return JSON.parse(JSON.stringify(pieces())); }
    function majPieces(liste, redessinerListe) {
      ficheMaj('pieces', liste);
      if (redessinerListe) dessinerPieces(); else majTotal();
    }
    // « Chambre 1 », « Chambre 2 »... ; les autres pièces ne sont numérotées qu'à partir de la deuxième.
    function nomParDefaut(type, liste) {
      var lib = R.pieceDe(type)[1];
      var deja = liste.filter(function (p) { return p.type === type; }).length;
      if (type === 'chambre') return lib + ' ' + (deja + 1);
      return deja ? lib + ' ' + (deja + 1) : lib;
    }
    function ajouterPiece(type) {
      var l = piecesCopie();
      if (l.length >= 60) { P.toast('60 pièces au maximum.', 'erreur'); return; }
      l.push({ type: type, nom: nomParDefaut(type, l) });
      majPieces(l, true);
      var champs = zonePieces.querySelectorAll('.g-piece');
      var derniere = champs[champs.length - 1];
      if (derniere) { derniere.scrollIntoView({ block: 'nearest' }); var s = derniere.querySelector('[data-surface]'); if (s) s.focus(); }
    }
    // Liste de départ tirée de l'essentiel : entrée, séjour, cuisine, chambres, salles de bains, WC.
    function preparerPieces() {
      var l = [];
      var ajout = function (t) { l.push({ type: t, nom: nomParDefaut(t, l) }); };
      ['entree', 'sejour', 'cuisine'].forEach(ajout);
      for (var i = 0; i < Math.min(a.nb_chambres || 0, 12); i++) ajout('chambre');
      for (var j = 0; j < Math.max(1, Math.min(a.nb_sdb || 1, 6)); j++) ajout(j === 0 ? 'salle_bains' : 'salle_eau');
      ajout('wc');
      majPieces(l, true);
      P.toast('Liste préparée : renseignez les surfaces, et retirez ou ajoutez des pièces au besoin.');
    }
    function cartePiece(p, i, total) {
      var def = R.pieceDe(p.type) || ['autre', 'Pièce', true, ''];
      function maj(cle, valeur, redessiner) {
        var l = piecesCopie();
        if (!l[i]) return;
        if (videVal(valeur)) delete l[i][cle]; else l[i][cle] = valeur;
        majPieces(l, redessiner);
      }
      var idNom = nouvelId(), idSurf = nouvelId(), idNiv = nouvelId(), idSol = nouvelId(), idCom = nouvelId();
      var nom = h('input', { class: 'g-input', id: idNom, maxlength: '60', autocomplete: 'off' });
      nom.value = p.nom || def[1];
      nom.addEventListener('input', function () { maj('nom', nom.value); });
      var surface = h('input', { class: 'g-input', id: idSurf, inputmode: 'decimal', autocomplete: 'off', 'data-surface': '' });
      surface.value = p.surface ? String(p.surface).replace('.', ',') : '';
      surface.addEventListener('input', function () {
        var n = nombreDepuisSaisie(surface.value, true);
        surface.classList.toggle('is-invalide', Number.isNaN(n));
        if (!Number.isNaN(n)) maj('surface', n);
      });
      var niveau = h('select', { class: 'g-select', id: idNiv }, h('option', { value: '' }, 'Non précisé'),
        R.niveaux.map(function (x) { return h('option', { value: x[0] }, x[1]); }));
      niveau.value = p.niveau || '';
      niveau.addEventListener('change', function () { maj('niveau', niveau.value || null); });
      var sol = h('select', { class: 'g-select', id: idSol }, h('option', { value: '' }, 'Non précisé'),
        R.sols.map(function (x) { return h('option', { value: x[0] }, x[1]); }));
      sol.value = p.sol || '';
      sol.addEventListener('change', function () { maj('sol', sol.value || null); });

      // Petits groupes à bascule (exposition, détails) : redessinés sur place, sans perdre la saisie voisine.
      function bascules(cle, options, classe) {
        var groupe = h('div', { class: classe, role: 'group' });
        var dessiner = function () {
          P.vider(groupe);
          var actuels = (piecesCopie()[i] || {})[cle] || [];
          options.forEach(function (x) {
            var actif = actuels.indexOf(x[0]) >= 0;
            groupe.appendChild(h('button', { type: 'button', class: classe === 'g-orient' ? 'g-orient__btn' : 'g-atout g-atout--petit',
              'aria-pressed': String(actif), 'aria-label': classe === 'g-orient' ? x[1] : null, title: classe === 'g-orient' ? x[1] : null,
              onclick: function () {
                var l = actif ? actuels.filter(function (y) { return y !== x[0]; }) : actuels.concat([x[0]]);
                maj(cle, l); dessiner();
              } }, classe === 'g-orient' ? x[0] : [P.icone('coche'), x[1]]));
          });
        };
        dessiner();
        return groupe;
      }
      var orient = bascules('orientations', R.orientations, 'g-orient');
      var details = R.detailsPour(p.type);
      var commentaire = h('input', { class: 'g-input', id: idCom, maxlength: '300', autocomplete: 'off',
        placeholder: 'Ex. : moulures au plafond, cheminée en marbre, vue sur le jardin' });
      commentaire.value = p.commentaire || '';
      commentaire.addEventListener('input', function () { maj('commentaire', commentaire.value); });

      var deplacer = function (sens) {
        var l = piecesCopie();
        var j = i + sens;
        if (j < 0 || j >= l.length) return;
        var x = l[i]; l[i] = l[j]; l[j] = x;
        majPieces(l, true);
      };
      var outils = h('div', { class: 'g-piece__outils' },
        h('button', { type: 'button', class: 'g-icone-btn', 'aria-label': 'Monter ' + nom.value, title: 'Monter', disabled: i === 0, onclick: function () { deplacer(-1); } }, P.icone('haut')),
        h('button', { type: 'button', class: 'g-icone-btn', 'aria-label': 'Descendre ' + nom.value, title: 'Descendre', disabled: i === total - 1, onclick: function () { deplacer(1); } }, P.icone('bas')),
        h('button', { type: 'button', class: 'g-icone-btn g-icone-btn--danger', 'aria-label': 'Retirer ' + nom.value, title: 'Retirer cette pièce', onclick: function () {
          var l = piecesCopie(); l.splice(i, 1); majPieces(l, true);
        } }, P.icone('corbeille')));

      return h('div', { class: 'g-piece' + (def[2] ? '' : ' g-piece--annexe') },
        h('div', { class: 'g-piece__tete' },
          h('span', { class: 'g-piece__num' }, String(i + 1)),
          h('div', { class: 'g-champ g-piece__nom' }, h('label', { for: idNom, class: 'sr-only' }, 'Nom de la pièce'), nom,
            h('small', null, def[1] + (def[2] ? '' : ' : hors surface habitable'))),
          outils),
        h('div', { class: 'g-piece__grille' },
          h('div', { class: 'g-champ' }, h('label', { for: idSurf }, 'Surface'), h('div', { class: 'g-unite' }, surface, h('span', null, 'm²'))),
          h('div', { class: 'g-champ' }, h('label', { for: idNiv }, 'Niveau'), niveau),
          h('div', { class: 'g-champ' }, h('label', { for: idSol }, 'Sol'), sol),
          h('div', { class: 'g-champ' }, h('span', { class: 'g-label' }, 'Exposition'), orient)),
        details.length ? bascules('details', details, 'g-atouts g-atouts--petits') : null,
        h('div', { class: 'g-champ' }, h('label', { for: idCom }, 'Remarques'), commentaire));
    }
    function dessinerPieces() {
      P.vider(zonePieces);
      var l = pieces();
      if (!l.length) {
        zonePieces.appendChild(h('div', { class: 'g-pieces__vide' },
          h('p', null, 'Aucune pièce pour l\'instant. Ajoutez-les une à une, ou partez de l\'essentiel de l\'annonce.'),
          h('button', { type: 'button', class: 'btn btn--light btn--sm', onclick: preparerPieces }, P.icone('pieces'),
            'Préparer la liste (' + P.pluriel(a.nb_chambres || 0, 'chambre', 'chambres') + ')')));
      }
      l.forEach(function (p, i) { zonePieces.appendChild(cartePiece(p, i, l.length)); });
      majTotal();
    }
    function majTotal() {
      var t = 0, n = 0;
      pieces().forEach(function (p) { var d = R.pieceDe(p.type); if (d && d[2] && p.surface > 0) { t += p.surface; n += 1; } });
      P.vider(totalPieces);
      if (!n) return;
      totalPieces.append(h('strong', null, 'Total des pièces habitables : ' + P.surface(Math.round(t * 100) / 100)),
        a.surface_habitable ? ' (surface habitable de l\'annonce : ' + P.surface(a.surface_habitable) + ')' : '',
        h('small', null, 'Hors balcon, terrasse, jardin, cave, garage, combles et véranda. Indicatif : la surface officielle reste celle du diagnostic.'));
    }
    var ajoutPieces = h('div', { class: 'g-champ g-pieces__ajout' }, h('span', { class: 'g-label' }, 'Ajouter une pièce'),
      h('div', { class: 'g-atouts' }, R.pieces.map(function (p) {
        return h('button', { type: 'button', class: 'g-atout g-atout--ajout', onclick: function () { ajouterPiece(p[0]); } }, P.icone('plus'), p[1]);
      })));

    // Situation locative : les champs du bail n'apparaissent que si le bien est loué.
    var zoneBail = h('div');
    function dessinerBail() {
      P.vider(zoneBail);
      if (fv('loue') !== true) return;
      zoneBail.appendChild(h('div', { class: 'g-grille g-grille--2' },
        fChoix('bail_type', 'Type de bail', R.typesBail),
        fSaisie('loyer_hc', 'Loyer mensuel hors charges', { type: 'entier', unite: '€' }),
        fSaisie('bail_debut', 'Entrée du locataire', { type: 'date' }),
        fSaisie('bail_fin', 'Fin de bail prévue', { type: 'date' })));
    }

    function corpsFiche() {
      dessinerPieces();
      dessinerBail();
      return [
        sousTitre('Pièce par pièce', 'Surface, exposition, sol et détails de chaque pièce : ils figurent sur la fiche technique remise lors des visites, jamais sur l\'annonce.'),
        zonePieces, totalPieces, ajoutPieces,
        sousTitre('Le bâtiment et le confort'),
        h('div', { class: 'g-grille g-grille--3' },
          fSaisie('construction', 'Type de construction', { max: 120, suggestions: ['Pierre de taille', 'Moellons', 'Brique', 'Parpaing', 'Béton', 'Ossature bois', 'Pan de bois'] }),
          fSaisie('facade', 'Façade', { max: 120, placeholder: 'Ex. : pierre, ravalée en 2019' }),
          fSaisie('toiture', 'Toiture', { max: 120, placeholder: 'Ex. : ardoise, refaite en 2015' }),
          fChoix('mitoyennete', 'Mitoyenneté', R.mitoyennetes),
          fChoix('vitrage', 'Vitrage', R.vitrages),
          fChoix('menuiseries', 'Menuiseries', R.menuiseries),
          fChoix('assainissement', 'Assainissement', R.assainissements)),
        h('div', { class: 'g-grille g-grille--2' },
          fOuiNon('lotissement', 'En lotissement'),
          fOuiNon('frais_notaire_reduits', 'Frais de notaire réduits (bien de moins de 5 ans)')),
        fCases('equipements', 'Équipements (en plus des atouts de l\'annonce)', R.equipementsFiche),
        sousTitre('Travaux, cadastre et syndic'),
        h('div', { class: 'g-grille g-grille--2' },
          fSaisie('travaux_realises', 'Travaux réalisés', { lignes: true, max: 1000, placeholder: 'Nature et année : toiture 2015, électricité 2021...' }),
          fSaisie('travaux_a_prevoir', 'Travaux à prévoir', { lignes: true, max: 1000 })),
        h('div', { class: 'g-grille g-grille--2' },
          fOuiNon('garantie_decennale', 'Garantie décennale en cours'),
          fSaisie('cadastre', 'Références cadastrales ou n° de lot', { max: 200, placeholder: 'Ex. : section AB n° 123, lot 417' })),
        h('div', { class: 'g-grille g-grille--3' },
          fChoix('syndic_type', 'Syndic (copropriété)', R.syndics),
          fSaisie('syndic_nom', 'Nom du syndic', { max: 120 }),
          fSaisie('syndic_tel', 'Téléphone du syndic', { type: 'tel', max: 40 })),
        fSaisie('travaux_votes', 'Travaux votés en assemblée générale (copropriété)', { lignes: true, max: 1000 }),
        sousTitre('Situation locative'),
        fOuiNon('loue', 'Le bien est-il loué ?', dessinerBail),
        zoneBail,
      ];
    }

    function corpsDossierInterne() {
      return [
        h('div', { class: 'message message--info' }, P.icone('cadenas'),
          h('span', null, 'Ces informations ne figurent que sur la fiche de rentrée (dossier interne). Elles ne sont jamais montrées aux acquéreurs, ni sur l\'annonce, ni sur la fiche technique.')),
        h('div', { class: 'g-grille g-grille--3' },
          fChoix('mandat_type', 'Type de mandat', R.typesMandat),
          fSaisie('mandat_date', 'Date du mandat', { type: 'date' }),
          fSaisie('apporteur', 'Apporteur', { max: 120 })),
        sousTitre('Vendeur'),
        h('div', { class: 'g-grille g-grille--2' },
          fSaisie('vendeur_noms', 'Nom(s) et prénom(s)', { max: 200 }),
          fSaisie('vendeur_adresse', 'Adresse', { max: 300 }),
          fSaisie('vendeur_tel', 'Téléphone', { type: 'tel', max: 60 }),
          fSaisie('vendeur_email', 'E-mail', { type: 'email', max: 160 })),
        h('div', { class: 'g-grille g-grille--2' },
          fSaisie('notaire', 'Notaire du vendeur', { max: 200 }),
          fSaisie('visites', 'Organisation des visites', { lignes: true, max: 1000, placeholder: 'Clés, disponibilités, personne à prévenir...' })),
        sousTitre('Votre avis', 'Les commentaires du conseiller reprennent la note interne (rubrique 7).'),
        h('div', { class: 'g-grille g-grille--2' },
          fSaisie('plus', 'Les plus', { lignes: true, max: 1500 }),
          fSaisie('moins', 'Les moins', { lignes: true, max: 1500 })),
      ];
    }

    // Documents imprimables : enregistre d'abord, puis ouvre la page du document dans un nouvel onglet.
    function ouvrirDocument(doc) {
      enregistrer().then(function () { window.open('/document?doc=' + doc + '&annonce=' + a.id, '_blank', 'noopener'); });
    }
    function carteDocuments() {
      var item = function (doc, titre, texte) {
        return h('button', { type: 'button', class: 'g-document', onclick: function () { ouvrirDocument(doc); } },
          h('span', { class: 'g-document__ico' }, P.icone('imprimer')), h('strong', null, titre), h('span', null, texte));
      };
      return h('section', { class: 'g-carte g-documents' }, h('h2', null, 'Documents à imprimer'),
        h('p', { class: 'g-documents__aide' }, 'Ils reprennent l\'annonce et la fiche technique. Dans la fenêtre d\'impression, choisissez « Enregistrer au format PDF » pour obtenir le fichier.'),
        h('div', { class: 'g-documents__liste' },
          item('fiche', 'Fiche technique', 'À remettre lors d\'une visite : photos, pièce par pièce, DPE, environs.'),
          item('visite', 'Bon de visite', 'Prérempli avec ce bien, à faire signer par le visiteur.'),
          item('interne', 'Fiche de rentrée', 'Dossier interne complet : vendeur, mandat, plus et moins. Ne pas remettre.'),
          item('decouverte', 'Fiche découverte', 'Questionnaire du rendez-vous d\'estimation, prérempli avec ce bien.')));
    }

    // ---------- Construction ----------
    function redessiner() {
      P.vider(page);
      var titreEntete = a.titre || 'Nouvelle annonce';
      page.appendChild(entete(titreEntete, a.en_corbeille ? 'Cette annonce est dans la corbeille.' : a.statut === 'brouillon'
        ? 'Brouillon : les modifications sont enregistrées automatiquement.'
        : 'Annonce ' + R.libelle(R.statuts, a.statut).toLowerCase() + '. Pensez à enregistrer vos modifications.', null, ['#/annonces', 'Toutes les annonces']));
      if (a.en_corbeille) {
        page.appendChild(h('div', { class: 'message message--info' }, P.icone('corbeille'),
          h('span', null, 'Dans la corbeille depuis le ' + P.date(a.supprime_le, true) + '. Elle sera supprimée définitivement 30 jours après. Restaurez-la pour la modifier.')));
        page.appendChild(barre); majBarre();
        return;
      }
      var champTitre = saisie('titre', 'Titre de l\'annonce', { max: 140, placeholder: 'Hôtel particulier du XVIIIᵉ siècle, cour et jardin' });
      var boutonTitre = h('button', { type: 'button', class: 'btn btn--light btn--sm', onclick: function () {
        var t = proposerTitre();
        var input = champTitre.querySelector('input');
        input.value = t; changer('titre', t);
      } }, P.icone('crayon'), 'Proposer un titre');
      champTitre.firstChild.appendChild(h('div', null, boutonTitre));

      var typeGroupe = h('div', { class: 'g-types', role: 'group', 'aria-label': 'Type de bien' });
      var dessinerTypes = function () {
        P.vider(typeGroupe);
        R.typesBien.forEach(function (t) {
          typeGroupe.appendChild(h('button', { type: 'button', class: 'g-type', 'aria-pressed': String(a.type_bien === t[0]), onclick: function () { changer('type_bien', t[0]); dessinerTypes(); } }, t[1]));
        });
      };
      dessinerTypes();

      var description = h('textarea', { class: 'g-textarea', id: nouvelId(), maxlength: '8000', placeholder: 'Présentez le bien : son histoire, ses volumes, ses atouts, son environnement. Séparez les paragraphes par une ligne vide.' });
      description.value = a.description || '';
      description.addEventListener('input', function () { changer('description', description.value); });

      var atouts = h('div', { class: 'g-atouts', role: 'group', 'aria-label': 'Atouts' });
      var dessinerAtouts = function () {
        P.vider(atouts);
        R.atouts.forEach(function (x) {
          var actif = (a.atouts || []).indexOf(x[0]) >= 0;
          atouts.appendChild(h('button', { type: 'button', class: 'g-atout', 'aria-pressed': String(actif), onclick: function () {
            var l = (a.atouts || []).slice();
            if (actif) l = l.filter(function (y) { return y !== x[0]; }); else l.push(x[0]);
            changer('atouts', l); dessinerAtouts();
          } }, P.icone('coche'), x[1]));
        });
      };
      dessinerAtouts();
      var boutonPhrase = h('button', { type: 'button', class: 'btn btn--light btn--sm', onclick: function () {
        var phrase = phraseAtouts();
        if (!phrase) { P.toast('Cochez d\'abord les atouts du bien.', 'erreur'); return; }
        description.value = descriptionAvecAtouts(description.value, phrase);
        changer('description', description.value);
        P.toast('Phrase ajoutée à la fin de la description : relisez-la.');
      } }, P.icone('crayon'), 'Écrire la phrase des atouts');

      // Bien vendu : le montrer ou non dans le catalogue (bandeau « Vendu »), et avec quelles informations.
      var carteVendu = (function () {
        if (a.statut !== 'vendue') return null;
        var choix = R.affichageVenduDe(a.vendu_affichage);
        var options = h('div', { class: 'g-vendu__options' });
        R.affichageVendu.forEach(function (x) {
          var c = h('input', { type: 'checkbox' });
          c.checked = choix[x[0]];
          c.addEventListener('change', function () { choix[x[0]] = c.checked; changer('vendu_affichage', Object.assign({}, choix)); });
          options.appendChild(h('label', { class: 'g-bascule g-bascule--petite' }, c, x[1]));
        });
        var blocOptions = h('div', { class: 'g-champ' }, h('span', { class: 'g-label' }, 'Informations affichées avec la photo'), options,
          h('small', null, 'La photo principale, le type de bien, le titre et le bandeau « Vendu » sont toujours affichés. Pensez à enregistrer.'));
        var montrer = h('input', { type: 'checkbox' });
        montrer.checked = Boolean(a.vendu_vitrine);
        blocOptions.hidden = !montrer.checked;
        montrer.addEventListener('change', function () { changer('vendu_vitrine', montrer.checked); blocOptions.hidden = !montrer.checked; });
        return h('section', { class: 'g-carte g-vendu' },
          h('h2', null, 'Bien vendu : affichage dans le catalogue'),
          zone('vendu_vitrine', h('label', { class: 'g-bascule' }, montrer, 'Montrer ce bien dans le fil des annonces, avec le bandeau « Vendu »')),
          zone('vendu_affichage', blocOptions));
      })();

      var editeurEl = h('div', { class: 'g-editeur' },
        zoneManquants,
        carteVendu,
        section(1, 'Photos', 'Glissez les photos pour changer leur ordre. La première est la photo principale.', [depot, entreeFichiers, grillePhotos], 'photos'),
        section(2, 'L\'essentiel', null, [
          h('div', { class: 'g-champ', 'data-champ': 'type_bien' }, h('span', { class: 'g-label' }, 'Type de bien'), typeGroupe),
          h('div', { class: 'g-grille g-grille--3' },
            saisie('prix_fai', 'Prix de vente honoraires inclus', { type: 'prix', unite: '€', apres: majCalcul }),
            saisie('surface_habitable', 'Surface habitable', { type: 'reel', unite: 'm²' }),
            saisie('surface_terrain', 'Terrain', { type: 'prix', unite: 'm²' }),
            saisie('nb_pieces', 'Nombre de pièces', { type: 'entier' }),
            saisie('nb_chambres', 'Chambres', { type: 'entier' }),
            saisie('nb_sdb', "Salles de bains ou d'eau", { type: 'entier' })),
          champTitre], 'essentiel'),
        section(3, 'Adresse', 'L\'adresse exacte n\'est jamais montrée sans votre accord.', zoneAdresse, 'adresse'),
        section(4, 'Description et atouts', null, [
          zone('description', h('div', { class: 'g-champ' }, h('label', { for: description.id }, 'Description'), description,
            h('small', null, 'Conseil maison : pas de tiret long, et on dit ce que le bien offre plutôt que ce que les autres n\'offrent pas.'))),
          h('div', { class: 'g-champ' }, h('span', { class: 'g-label' }, 'Atouts et équipements (cochez ceux qui s\'appliquent)'), atouts,
            h('div', null, boutonPhrase),
            h('small', null, 'Le bouton ajoute à la fin de la description une phrase qui reprend les cases cochées ; relancé, il la remplace.'))], 'description'),
        section(5, 'Performance énergétique', 'Informations reprises du diagnostic (DPE).', corpsEnergie, 'energie'),
        section(6, 'Mandat, honoraires et copropriété', 'Mentions obligatoires sur toute annonce de vente.', corpsHonoraires, 'honoraires'),
        h('section', { class: 'g-section' },
          h('details', { class: 'g-details g-details--section' },
            h('summary', { class: 'g-section__tete' }, h('span', { class: 'g-section__num' }, '7'), h('div', null, h('h2', null, 'Plus de détails'), h('p', null, 'Facultatif : époque, étage, chauffage, notes internes...'))),
            h('div', { class: 'g-section__corps' },
              h('div', { class: 'g-grille g-grille--3' },
                liste('epoque', 'Époque', R.epoques),
                saisie('annee_construction', 'Année de construction', { type: 'entier' }),
                liste('etat', 'État général', R.etats),
                liste('protection', 'Protection patrimoniale', R.protections, { vide: 'Non précisé' }),
                saisie('surface_carrez', 'Surface loi Carrez', { type: 'reel', unite: 'm²' }),
                saisie('nb_niveaux', 'Niveaux', { type: 'entier' }),
                saisie('etage', 'Étage (0 = rez-de-chaussée)', { type: 'entier' }),
                saisie('nb_etages_immeuble', 'Étages de l\'immeuble', { type: 'entier' }),
                liste('ascenseur', 'Ascenseur', [['true', 'Oui'], ['false', 'Non']], { conv: function (v) { return v === 'true'; } }),
                saisie('nb_parkings', 'Places de stationnement', { type: 'entier' }),
                liste('exposition', 'Exposition', R.expositions),
                liste('chauffage_type', 'Chauffage', R.chauffageTypes),
                liste('chauffage_energie', 'Énergie de chauffage', R.chauffageEnergies),
                saisie('taxe_fonciere', 'Taxe foncière annuelle', { type: 'prix', unite: '€' })),
              bascule('mise_en_avant', 'Mettre ce bien en avant dans la sélection (badge « Sélection », en tête de liste)'),
              bascule('mention_georisques', 'Afficher la mention Géorisques (obligatoire si un état des risques existe pour ce bien)'),
              h('div', { class: 'g-grille g-grille--2' },
                saisie('reference_interne', 'Référence interne', { max: 60, aide: 'Jamais visible des acquéreurs (ils voient le n° de mandat).' }),
                zone('note_interne', (function () {
                  var t = h('textarea', { class: 'g-textarea', id: nouvelId(), maxlength: '2000', placeholder: 'Disponibilités des vendeurs, points d\'attention...' });
                  t.style.minHeight = '110px';
                  t.value = a.note_interne || '';
                  t.addEventListener('input', function () { changer('note_interne', t.value); });
                  return h('div', { class: 'g-champ' }, h('label', { for: t.id }, 'Note interne'), t, h('small', null, 'Jamais visible des acquéreurs.'));
                })()))))),
        h('section', { class: 'g-section' },
          h('details', { class: 'g-details g-details--section', 'data-section': 'fiche' },
            h('summary', { class: 'g-section__tete' }, h('span', { class: 'g-section__num' }, '8'), h('div', null, h('h2', null, 'Fiche technique'),
              h('p', null, 'Pièce par pièce, bâtiment, travaux : pour la fiche remise en visite. Rien n\'apparaît sur l\'annonce.'))),
            h('div', { class: 'g-section__corps g-fiche' }, corpsFiche()))),
        h('section', { class: 'g-section' },
          h('details', { class: 'g-details g-details--section' },
            h('summary', { class: 'g-section__tete' }, h('span', { class: 'g-section__num' }, '9'), h('div', null, h('h2', null, 'Dossier interne'),
              h('p', null, 'Vendeur, mandat, plus et moins : jamais remis à l\'acquéreur.'))),
            h('div', { class: 'g-section__corps g-fiche' }, corpsDossierInterne()))),
        carteDocuments(),
        visiteurs && visiteurs.length ? h('section', { class: 'g-carte' }, h('h2', null, 'Qui a consulté ce bien ?'),
          h('ul', { class: 'g-activite' }, visiteurs.map(function (v) {
            return h('li', null, h('span', { class: 'g-activite__ico' }, P.icone('personne')),
              h('p', null, h('a', { href: '#/codes/' + v.id }, P.civilite(v.civilite, v.nom)), ' : ' + P.pluriel(v.vues, 'consultation', 'consultations'),
                h('small', null, 'Dernière ' + P.ilYa(v.derniere))));
          }))) : null);
      page.appendChild(editeurEl);
      page.appendChild(barre);

      dessinerPhotos();
      dessinerAdresse();
      dessinerEnergie();
      dessinerHonoraires();
      majManquants();
      majBarre();
      etatSauvegarde('ok');
    }
    derniereSauvegarde = a.modifie_le ? new Date(a.modifie_le) : null;
    redessiner();
    verifierEnvirons();
  }

  // =====================================================================
  // Codes d'accès
  // =====================================================================
  var LIBELLES_CODE = { actif: 'Actif', expire: 'Expiré', revoque: 'Révoqué' };
  var filtreCodes = 'tous';

  function vueCodes(page) {
    page.appendChild(entete("Codes d'accès", 'Chaque acquéreur reçoit un code personnel. Vous voyez ce qu\'il consulte et pouvez le révoquer à tout moment.', [
      h('a', { class: 'btn btn--light', href: '/api/admin/codes/export', download: '' }, P.icone('telecharger'), 'Exporter (Excel)'),
      h('a', { class: 'btn btn--solid', href: '#/codes/nouveau' }, P.icone('plus'), 'Créer un code'),
    ]));
    var recherche = h('input', { class: 'g-input', type: 'search', placeholder: 'Rechercher un nom, un e-mail, un code...', 'aria-label': 'Rechercher' });
    var segs = h('div', { class: 'g-segments', role: 'group', 'aria-label': 'Filtrer' });
    var zoneListe = h('div', null, h('p', { class: 'g-chargement' }, 'Chargement...'));
    page.appendChild(h('div', { class: 'g-outils' }, h('div', { class: 'g-recherche' }, P.icone('recherche'), recherche), segs));
    page.appendChild(zoneListe);
    var codes = [];
    function dessiner() {
      P.vider(segs);
      [['tous', 'Tous'], ['actif', 'Actifs'], ['expire', 'Expirés'], ['revoque', 'Révoqués']].forEach(function (x) {
        segs.appendChild(h('button', { type: 'button', class: 'g-segment', 'aria-pressed': String(filtreCodes === x[0]), onclick: function () { filtreCodes = x[0]; dessiner(); } }, x[1]));
      });
      var q = recherche.value.trim().toLowerCase().replace(/-/g, '');
      var choix = codes.filter(function (c) {
        if (filtreCodes !== 'tous' && c.statut !== filtreCodes) return false;
        if (!q) return true;
        return [c.nom, c.email, c.tel, c.code, c.note].filter(Boolean).join(' ').toLowerCase().replace(/-/g, '').indexOf(q) >= 0;
      });
      P.vider(zoneListe);
      if (!choix.length) {
        zoneListe.appendChild(h('div', { class: 'g-liste' }, h('div', { class: 'g-vide' }, P.icone('cle'),
          h('h3', null, codes.length ? 'Aucun code ne correspond' : 'Aucun code pour l\'instant'),
          h('p', null, codes.length ? 'Modifiez la recherche ou le filtre.' : 'Créez un code pour permettre à un acquéreur de consulter vos annonces.'),
          codes.length ? null : h('a', { class: 'btn btn--solid', href: '#/codes/nouveau' }, P.icone('plus'), 'Créer un code'))));
        return;
      }
      var corps = h('tbody');
      choix.forEach(function (c) {
        corps.appendChild(h('tr', { tabindex: '0', onclick: function () { aller('codes/' + c.id); }, onkeydown: function (e) { if (e.key === 'Enter') aller('codes/' + c.id); } },
          h('td', null, h('strong', null, P.civilite(c.civilite, c.nom)), h('small', null, c.email || c.tel || '')),
          h('td', null, h('span', { class: 'g-code' }, c.code_formate)),
          h('td', null, badgeStatut(c.statut, LIBELLES_CODE[c.statut]), h('small', { class: 'sr-only' }, ' ')),
          h('td', null, c.statut === 'revoque' ? 'Révoqué le ' + P.date(c.revoque_le) : "Jusqu'au " + P.date(c.expire_le)),
          h('td', null, c.derniere_utilisation ? P.ilYa(c.derniere_utilisation) : h('small', null, 'Jamais utilisé')),
          h('td', null, P.pluriel(c.fiches, 'consultation', 'consultations') + (c.appareils > 3 ? ' · ' + c.appareils + ' appareils' : ''))));
      });
      zoneListe.appendChild(h('table', { class: 'g-table' },
        h('thead', null, h('tr', null, ['Bénéficiaire', 'Code', 'Statut', 'Validité', 'Dernière visite', 'Activité'].map(function (t) { return h('th', { scope: 'col' }, t); }))),
        corps));
    }
    recherche.addEventListener('input', dessiner);
    api('codes').then(function (r) { codes = r.codes; dessiner(); }).catch(function (err) { P.vider(zoneListe); signaler(err); });
  }

  function vueNouveauCode(page) {
    page.appendChild(entete("Créer un code d'accès", 'Le code permet à cette personne de consulter toutes les annonces en ligne, jusqu\'à la date de fin.', null, ['#/codes', "Tous les codes d'accès"]));
    var donnees = { civilite: null, duree_mois: 3 };
    var nom = h('input', { class: 'g-input', id: 'cNom', type: 'text', maxlength: '120', autocomplete: 'off', placeholder: 'Jean Dupont' });
    var email = h('input', { class: 'g-input', id: 'cEmail', type: 'email', maxlength: '200', autocomplete: 'off', placeholder: 'facultatif' });
    var tel = h('input', { class: 'g-input', id: 'cTel', type: 'tel', maxlength: '30', autocomplete: 'off', placeholder: 'facultatif' });
    var note = h('textarea', { class: 'g-textarea', id: 'cNote', maxlength: '500', placeholder: 'Ex. : recherche une maison avec jardin, budget 800 000 €' });
    note.style.minHeight = '90px';
    var fin = h('input', { class: 'g-input', type: 'date', id: 'cFin', hidden: true, min: new Date(Date.now() + 86400000).toISOString().slice(0, 10) });
    var civ = h('div', { class: 'g-segments', role: 'group', 'aria-label': 'Civilité' });
    var dessinerCiv = function () {
      P.vider(civ);
      [['monsieur', 'Monsieur'], ['madame', 'Madame'], [null, 'Non précisé']].forEach(function (x) {
        civ.appendChild(h('button', { type: 'button', class: 'g-segment', 'aria-pressed': String(donnees.civilite === x[0]), onclick: function () { donnees.civilite = x[0]; dessinerCiv(); } }, x[1]));
      });
    };
    dessinerCiv();
    var duree = h('div', { class: 'g-segments', role: 'group', 'aria-label': 'Validité' });
    var dessinerDuree = function () {
      P.vider(duree);
      [[1, '1 mois'], [3, '3 mois'], [6, '6 mois'], [12, '1 an'], ['date', 'Jusqu\'au...']].forEach(function (x) {
        duree.appendChild(h('button', { type: 'button', class: 'g-segment', 'aria-pressed': String(donnees.duree_mois === x[0]), onclick: function () {
          donnees.duree_mois = x[0]; fin.hidden = x[0] !== 'date'; dessinerDuree(); if (x[0] === 'date') fin.focus();
        } }, x[1]));
      });
    };
    dessinerDuree();
    var retour = h('div', { 'aria-live': 'polite' });
    var creer = h('button', { type: 'submit', class: 'btn btn--solid' }, P.icone('cle'), 'Créer le code');
    var form = h('form', { class: 'g-carte g-grille', novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      P.vider(retour);
      if (!nom.value.trim()) { retour.appendChild(P.message('erreur', 'Indiquez le nom du bénéficiaire.')); nom.focus(); return; }
      if (donnees.duree_mois === 'date' && !fin.value) { retour.appendChild(P.message('erreur', 'Choisissez la date de fin.')); fin.focus(); return; }
      var corps = { civilite: donnees.civilite, nom: nom.value, email: email.value, tel: tel.value, note: note.value };
      if (donnees.duree_mois === 'date') corps.expire_le = fin.value; else corps.duree_mois = donnees.duree_mois;
      occupe(creer, true);
      api('codes', { method: 'POST', corps: corps }).then(function (r) {
        aller('codes/' + r.code.id + '/envoyer');
      }).catch(function (err) { occupe(creer, false); if (!err.gere) retour.appendChild(P.message('erreur', err.message)); });
    } },
    h('div', { class: 'g-champ' }, h('span', { class: 'g-label' }, 'Civilité'), civ),
    h('div', { class: 'g-grille g-grille--3' }, champ('Nom et prénom', nom), champ('E-mail', email, 'Pour envoyer le code par e-mail.'), champ('Téléphone portable', tel, 'Pour envoyer le code par SMS.')),
    champ('Note (facultatif)', note, 'Visible uniquement par l\'équipe. N\'y inscrivez aucune donnée sensible.'),
    h('div', { class: 'g-champ' }, h('span', { class: 'g-label' }, 'Validité du code'), duree, fin),
    retour,
    h('div', null, creer));
    page.appendChild(form);
    nom.focus();
  }

  function telInternational(tel) {
    var t = String(tel || '').replace(/[^\d+]/g, '');
    if (/^0\d{9}$/.test(t)) t = '+33' + t.slice(1);
    return t;
  }
  function messageCode(c) {
    var lien = location.origin + '/#' + c.code_formate;
    var nomFamille = String(c.nom || '').trim().split(/\s+/).slice(-1)[0];
    var salut = c.civilite === 'monsieur' ? 'Bonjour Monsieur ' + nomFamille : c.civilite === 'madame' ? 'Bonjour Madame ' + nomFamille : 'Bonjour ' + c.nom;
    return salut + ',\n\nVoici votre accès personnel aux biens que Petra Gest propose à la vente :\n' + lien
      + '\n\nVotre code : ' + c.code_formate + " (valable jusqu'au " + P.date(c.expire_le, true) + ').'
      + '\n\nJe reste à votre disposition pour organiser une visite.\n\n' + moi.nom + '\nPetra Gest, ' + ACCUEIL_TEL;
  }

  function blocEnvoi(c, ouvert) {
    var message = messageCode(c);
    var sujet = 'Votre accès aux biens Petra Gest';
    var boutons = h('div', { class: 'g-partage' },
      bouton('Copier le code', 'btn--light', 'copier', function () { copier(c.code_formate); }),
      bouton('Copier le message', 'btn--light', 'copier', function () { copier(message); }),
      h('a', { class: 'btn btn--solid', href: 'sms:' + telInternational(c.tel) + '?&body=' + encodeURIComponent(message) }, P.icone('message'), 'Envoyer par SMS'),
      h('a', { class: 'btn btn--solid', href: 'mailto:' + encodeURIComponent(c.email || '').replace(/%40/g, '@') + '?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(message) }, P.icone('mail'), 'Envoyer par e-mail'));
    if (navigator.share) {
      boutons.appendChild(bouton('Partager...', 'btn--light', 'partager', function () { navigator.share({ title: sujet, text: message }).catch(function () {}); }));
    }
    var codeGeant = h('p', { class: 'g-code-geant', 'aria-label': 'Code d\'accès' }, c.code_formate);
    return h('section', { class: 'g-carte' },
      h('h2', null, ouvert ? 'Code créé : envoyez-le à ' + P.civilite(c.civilite, c.nom) : 'Envoyer le code'),
      ouvert ? h('p', { class: 'lede' }, 'Le message contient un lien qui préremplit le code. La personne n\'a rien à retaper.') : null,
      codeGeant,
      boutons,
      h('details', { class: 'g-details', open: ouvert }, h('summary', null, 'Voir le message qui sera envoyé'), h('p', { class: 'g-message-type' }, message)));
  }

  function vueCode(page, id, justeCree) {
    page.appendChild(h('p', { class: 'g-chargement' }, 'Chargement...'));
    api('codes/' + id).then(function (r) { ficheCode(page, r.code, r.historique, justeCree); })
      .catch(function (err) { P.vider(page); if (!err.gere) page.appendChild(entete('Code introuvable', err.message, null, ['#/codes', "Tous les codes d'accès"])); });
  }

  function ficheCode(page, c, historique, justeCree) {
    P.vider(page);
    page.appendChild(entete(P.civilite(c.civilite, c.nom), null, null, ['#/codes', "Tous les codes d'accès"]));
    page.querySelector('.g-entete > div').appendChild(h('p', null, badgeStatut(c.statut, LIBELLES_CODE[c.statut]),
      '  Créé le ' + P.date(c.cree_le, true) + (c.cree_par_nom ? ' par ' + c.cree_par_nom : '')));

    var infos = h('dl', { class: 'g-infos' });
    var ligne = function (t, v) { if (v !== null && v !== undefined && v !== '') infos.appendChild(h('div', null, h('dt', null, t), h('dd', null, v))); };
    ligne('Code', h('span', { class: 'g-code' }, c.code_formate));
    ligne('E-mail', c.email);
    ligne('Téléphone', c.tel);
    ligne(c.statut === 'revoque' ? 'Révoqué le' : 'Valable jusqu\'au', c.statut === 'revoque' ? P.date(c.revoque_le, true) : P.date(c.expire_le, true));
    if (c.motif_revocation) ligne('Motif', c.motif_revocation);
    ligne('Première visite', c.premiere_utilisation ? P.date(c.premiere_utilisation, true) : 'Jamais');
    ligne('Dernière visite', c.derniere_utilisation ? P.dateHeure(c.derniere_utilisation) : 'Jamais');
    ligne('Connexions', String(c.nb_connexions));
    ligne('Biens consultés', String(c.fiches));
    ligne('Appareils différents', String(c.appareils));
    if (c.note) ligne('Note', c.note);

    var gauche = h('div', null);
    if (c.statut === 'actif') gauche.appendChild(blocEnvoi(c, justeCree));
    if (c.appareils > 3) {
      gauche.appendChild(h('div', { class: 'message message--info' }, P.icone('alerte'),
        h('span', null, 'Ce code a été utilisé depuis ' + c.appareils + ' appareils différents : il a peut-être été partagé.')));
    }
    gauche.appendChild(h('section', { class: 'g-carte' }, h('h2', null, 'Informations'), infos));
    var hist = h('ul', { class: 'g-historique' });
    var libelles = { connexion: 'Connexion à l\'espace', fiche: 'A consulté ', contact_tel: 'A cliqué sur « Appeler » : ', contact_mail: 'A cliqué sur « Écrire » : ' };
    historique.forEach(function (e) {
      hist.appendChild(h('li', null, h('time', { datetime: e.le }, P.dateHeure(e.le)),
        h('span', null, libelles[e.evenement] || e.evenement, e.bien ? h('a', { href: '#/annonces/' + e.bien.id }, e.bien.titre || 'annonce sans titre') : (e.evenement === 'connexion' ? '' : 'un bien retiré'))));
    });
    gauche.appendChild(h('section', { class: 'g-carte' }, h('h2', null, 'Historique'),
      historique.length ? hist : h('p', { class: 'lede' }, 'Ce code n\'a pas encore été utilisé.')));

    // Actions
    var actions = h('section', { class: 'g-carte' }, h('h2', null, 'Actions'));
    var modifier = function (corps, message) {
      return api('codes/' + c.id, { method: 'PATCH', corps: corps }).then(function () { P.toast(message); vueCode(page, c.id, false); }).catch(signaler);
    };
    if (c.statut !== 'revoque') {
      var mois = 3;
      var segs = h('div', { class: 'g-segments' });
      var dessinerSegs = function () {
        P.vider(segs);
        [[1, '1 mois'], [3, '3 mois'], [6, '6 mois'], [12, '1 an']].forEach(function (x) {
          segs.appendChild(h('button', { type: 'button', class: 'g-segment', 'aria-pressed': String(mois === x[0]), onclick: function () { mois = x[0]; dessinerSegs(); } }, x[1]));
        });
      };
      dessinerSegs();
      actions.appendChild(h('div', { class: 'g-champ' }, h('span', { class: 'g-label' }, 'Prolonger de'), segs,
        h('div', null, bouton('Prolonger', 'btn--solid btn--sm', 'calendrier', function () { modifier({ prolonger_mois: mois }, 'Code prolongé.'); }))));
      actions.appendChild(h('hr', { class: 'g-sep' }));
    }
    actions.appendChild(h('div', { class: 'g-grille' },
      bouton('Modifier les coordonnées', 'btn--light btn--block', 'crayon', function () { modaleCoordonnees(c, modifier); }),
      c.statut === 'revoque'
        ? bouton('Rétablir le code', 'btn--light btn--block', 'rafraichir', function () { modifier({ retablir: true }, 'Code rétabli.'); })
        : bouton('Révoquer le code', 'btn--danger btn--block', 'croix', function () { modaleRevocation(c, modifier); }),
      bouton('Supprimer définitivement', 'btn--light btn--block', 'corbeille', function () {
        confirmer('Supprimer définitivement ?', 'Le code, les coordonnées de ' + P.civilite(c.civilite, c.nom) + ' et tout son historique seront effacés (droit à l\'effacement). Irréversible.', 'Supprimer', true)
          .then(function (ok) { if (ok) api('codes/' + c.id, { method: 'DELETE' }).then(function () { P.toast('Code supprimé.'); aller('codes'); }).catch(signaler); });
      })));
    page.appendChild(h('div', { class: 'g-colonnes' }, gauche, h('div', null, actions)));
    if (justeCree) history.replaceState(null, '', '#/codes/' + c.id);
  }

  function modaleRevocation(c, modifier) {
    var motif = h('input', { class: 'g-input', id: 'motif', type: 'text', maxlength: '300', placeholder: 'Ex. : projet abandonné, bien acheté ailleurs' });
    modale({
      titre: 'Révoquer le code de ' + P.civilite(c.civilite, c.nom) + ' ?',
      corps: [h('p', null, 'Cette personne ne pourra plus rien consulter, immédiatement, même si elle a une page ouverte.'), champ('Motif (facultatif)', motif)],
      actions: [
        { libelle: 'Annuler', classe: 'btn--light', action: function (f) { f(); } },
        { libelle: 'Révoquer', classe: 'btn--danger', action: function (f) { f(); modifier({ revoquer: { motif: motif.value } }, 'Code révoqué : l\'accès est coupé.'); } },
      ],
    });
  }

  function modaleCoordonnees(c, modifier) {
    var donnees = { civilite: c.civilite };
    var nom = h('input', { class: 'g-input', id: 'mNom', type: 'text', maxlength: '120' }); nom.value = c.nom || '';
    var email = h('input', { class: 'g-input', id: 'mEmail', type: 'email', maxlength: '200' }); email.value = c.email || '';
    var tel = h('input', { class: 'g-input', id: 'mTel', type: 'tel', maxlength: '30' }); tel.value = c.tel || '';
    var note = h('textarea', { class: 'g-textarea', id: 'mNote', maxlength: '500' }); note.value = c.note || ''; note.style.minHeight = '90px';
    var civ = h('div', { class: 'g-segments' });
    var dessinerCiv = function () {
      P.vider(civ);
      [['monsieur', 'Monsieur'], ['madame', 'Madame'], [null, 'Non précisé']].forEach(function (x) {
        civ.appendChild(h('button', { type: 'button', class: 'g-segment', 'aria-pressed': String(donnees.civilite === x[0]), onclick: function () { donnees.civilite = x[0]; dessinerCiv(); } }, x[1]));
      });
    };
    dessinerCiv();
    modale({
      titre: 'Modifier les coordonnées',
      corps: [h('div', { class: 'g-champ' }, h('span', { class: 'g-label' }, 'Civilité'), civ), champ('Nom et prénom', nom), champ('E-mail', email), champ('Téléphone', tel), champ('Note', note)],
      actions: [
        { libelle: 'Annuler', classe: 'btn--light', action: function (f) { f(); } },
        { libelle: 'Enregistrer', classe: 'btn--solid', action: function (f) {
          if (!nom.value.trim()) { P.toast('Le nom est obligatoire.', 'erreur'); return; }
          f(); modifier({ civilite: donnees.civilite, nom: nom.value, email: email.value, tel: tel.value, note: note.value }, 'Coordonnées enregistrées.');
        } },
      ],
    });
  }

  // =====================================================================
  // Équipe
  // =====================================================================
  function modaleMotDePasseTemporaire(nom, email, mdp) {
    modale({
      titre: 'Mot de passe provisoire',
      corps: [
        h('p', null, 'Transmettez ces informations à ' + nom + ' de vive voix ou par téléphone. Ce mot de passe ne sera plus affiché ensuite.'),
        h('p', { class: 'g-code-geant g-code-geant--mdp' }, mdp),
        h('p', { class: 'g-aide' }, 'Adresse de connexion : ' + location.origin + '/espace-gestion', h('br'), 'Identifiant : ' + email, h('br'),
          'À la première connexion, un mot de passe personnel sera demandé.'),
      ],
      actions: [
        { libelle: 'Copier le mot de passe', classe: 'btn--light', icone: 'copier', action: function () { copier(mdp); } },
        { libelle: 'Terminé', classe: 'btn--solid', action: function (f) { f(); } },
      ],
    });
  }

  function vueEquipe(page) {
    var ajouter = bouton('Ajouter une personne', 'btn--solid', 'plus', function () {
      var nom = h('input', { class: 'g-input', id: 'eNom', type: 'text', maxlength: '80', placeholder: 'Catherine Badet' });
      var email = h('input', { class: 'g-input', id: 'eEmail', type: 'email', maxlength: '200', placeholder: 'prenom.nom@petragest.com' });
      modale({
        titre: 'Ajouter une personne à l\'équipe',
        corps: [h('p', null, 'Elle pourra gérer les annonces et les codes d\'accès, comme vous.'), champ('Prénom et nom', nom), champ('Adresse e-mail (identifiant)', email)],
        actions: [
          { libelle: 'Annuler', classe: 'btn--light', action: function (f) { f(); } },
          { libelle: 'Créer le compte', classe: 'btn--solid', action: function (f, b) {
            occupe(b, true);
            api('equipe', { method: 'POST', corps: { nom: nom.value, email: email.value } }).then(function (r) {
              f(); vueEquipe(coquille('equipe'));
              modaleMotDePasseTemporaire(r.admin.nom, r.admin.email, r.mdp_temporaire);
            }).catch(function (err) { occupe(b, false); signaler(err); });
          } },
        ],
      });
    });
    page.appendChild(entete('Équipe', 'Les personnes qui peuvent gérer les annonces et les codes d\'accès.', [ajouter]));
    var zoneListe = h('div', null, h('p', { class: 'g-chargement' }, 'Chargement...'));
    page.appendChild(zoneListe);
    api('equipe').then(function (r) {
      P.vider(zoneListe);
      var conteneur = h('div', { class: 'g-liste' });
      r.equipe.forEach(function (m) {
        var soi = m.id === moi.id;
        var outils = h('div', { class: 'g-ligne__droite' },
          m.actif ? badgeStatut('actif', 'Actif') : badgeStatut('archivee', 'Désactivé'),
          m.doit_changer_mdp && m.actif ? badgeStatut('sous_offre', 'Première connexion à faire') : null);
        if (!soi) {
          outils.appendChild(bouton('Nouveau mot de passe', 'btn--light btn--sm', 'cadenas', function () {
            confirmer('Réinitialiser le mot de passe ?', m.nom + ' recevra un mot de passe provisoire à changer à la première connexion. Ses sessions ouvertes sont fermées.', 'Réinitialiser')
              .then(function (ok) {
                if (ok) api('equipe/' + m.id + '/reinitialiser', { method: 'POST', corps: {} }).then(function (x) { modaleMotDePasseTemporaire(m.nom, m.email, x.mdp_temporaire); }).catch(signaler);
              });
          }));
          outils.appendChild(bouton(m.actif ? 'Désactiver' : 'Réactiver', 'btn--light btn--sm', m.actif ? 'croix' : 'rafraichir', function () {
            var faire = function () { api('equipe/' + m.id, { method: 'PATCH', corps: { actif: !m.actif } }).then(function () { P.toast(m.actif ? 'Compte désactivé.' : 'Compte réactivé.'); vueEquipe(coquille('equipe')); }).catch(signaler); };
            if (m.actif) confirmer('Désactiver ce compte ?', m.nom + ' ne pourra plus se connecter. Vous pourrez le réactiver plus tard.', 'Désactiver', true).then(function (ok) { if (ok) faire(); });
            else faire();
          }));
        }
        conteneur.appendChild(h('div', { class: 'g-ligne g-ligne--equipe' },
          h('div', { class: 'g-ligne__vignette' }, h('span', { class: 'g-moi__initiales' }, initiales(m.nom))),
          h('div', null, h('span', { class: 'g-ligne__titre' }, m.nom + (soi ? ' (vous)' : '')),
            h('div', { class: 'g-ligne__meta' }, h('span', null, P.icone('mail'), m.email),
              h('span', null, P.icone('horloge'), m.derniere_connexion ? 'Dernière connexion ' + P.ilYa(m.derniere_connexion) : 'Jamais connecté'))),
          outils));
      });
      zoneListe.appendChild(conteneur);
    }).catch(function (err) { P.vider(zoneListe); signaler(err); });
  }

  // =====================================================================
  // Mon compte
  // =====================================================================
  function vueCompte(page) {
    page.appendChild(entete('Mon compte', moi.nom + ' · ' + moi.email));
    var actuel = h('input', { class: 'g-input', type: 'password', id: 'kActuel', autocomplete: 'current-password' });
    var nouveau = h('input', { class: 'g-input', type: 'password', id: 'kNouveau', autocomplete: 'new-password' });
    var confirmation = h('input', { class: 'g-input', type: 'password', id: 'kConf', autocomplete: 'new-password' });
    var retour = h('div', { 'aria-live': 'polite' });
    var envoyer = h('button', { type: 'submit', class: 'btn btn--solid' }, P.icone('coche'), 'Changer mon mot de passe');
    page.appendChild(h('form', { class: 'g-carte g-grille', novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      P.vider(retour);
      if (nouveau.value.length < 12) { retour.appendChild(P.message('erreur', 'Au moins 12 caractères.')); return; }
      if (nouveau.value !== confirmation.value) { retour.appendChild(P.message('erreur', 'Les deux saisies ne sont pas identiques.')); return; }
      occupe(envoyer, true);
      api('session', { method: 'PATCH', corps: { actuel: actuel.value, nouveau: nouveau.value } }).then(function () {
        occupe(envoyer, false);
        actuel.value = nouveau.value = confirmation.value = '';
        retour.appendChild(P.message('succes', 'Mot de passe changé. Vos autres appareils ont été déconnectés.'));
      }).catch(function (err) { occupe(envoyer, false); if (!err.gere) retour.appendChild(P.message('erreur', err.message)); });
    } },
    h('h2', null, 'Changer mon mot de passe'),
    h('div', { class: 'g-grille g-grille--3' }, champ('Mot de passe actuel', actuel), champ('Nouveau mot de passe', nouveau, '12 caractères minimum.'), champ('Confirmation', confirmation)),
    retour, h('div', null, envoyer)));
  }

  // =====================================================================
  // Démarrage
  // =====================================================================
  P.api('/api/acces').then(function (e) { P.bandeauDemo(e && e.demo); }).catch(function () {});
  P.api('/api/admin/session').then(function (r) {
    if (r.doit_changer_mdp) { ecranMotDePasse(true); return; }
    moi = r;
    if (!location.hash || location.hash === '#' || location.hash === '#/') history.replaceState(null, '', '#/accueil');
    hashPrecedent = location.hash;
    afficherRoute();
  }).catch(function (err) {
    if (err.statut === 403 && err.code === 'changer_mdp') { ecranMotDePasse(true); return; }
    ecranConnexion();
  });
})();
