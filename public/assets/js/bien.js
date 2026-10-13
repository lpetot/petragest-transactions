/* Fiche détaillée d'un bien. Tout le contenu est posé en texte (jamais de HTML construit). */
(function () {
  'use strict';
  var P = window.P;
  var R = window.REFERENTIEL;
  var h = P.h;
  var id = new URLSearchParams(location.search).get('id') || '';

  var galerie = document.getElementById('galerie');
  var fiche = document.getElementById('fiche');

  // ---------- Galerie et visionneuse ----------
  function construireGalerie(bien) {
    var photos = bien.photos;
    galerie.classList.remove('squelette');
    galerie.removeAttribute('aria-busy');
    P.vider(galerie);
    if (!photos.length) { galerie.hidden = true; return; }
    var visibles = photos.slice(0, 3);
    galerie.className = 'galerie' + (visibles.length === 1 ? ' galerie--1' : visibles.length === 2 ? ' galerie--2' : '');
    visibles.forEach(function (p, i) {
      galerie.appendChild(h('button', { type: 'button', class: 'galerie__photo', 'aria-label': 'Agrandir la photo ' + (i + 1) + (p.legende ? ' : ' + p.legende : ''), onclick: function () { ouvrir(photos, i); } },
        h('img', {
          src: i === 0 ? p.url : p.url_mini, srcset: p.url_mini + ' 800w, ' + p.url + ' 2000w',
          sizes: i === 0 ? '(max-width: 760px) 100vw, 66vw' : '33vw',
          alt: p.legende || bien.titre, width: String(p.largeur), height: String(p.hauteur), loading: i === 0 ? 'eager' : 'lazy',
        })));
    });
    var badges = [];
    if (bien.statut === 'sous_offre') badges.push(h('span', { class: 'badge badge--sand' }, 'Sous offre'));
    if (bien.statut === 'vendue') badges.push(h('span', { class: 'badge' }, 'Vendu'));
    if (badges.length) galerie.appendChild(h('div', { class: 'galerie__badges' }, badges));
    if (photos.length > 1) {
      galerie.appendChild(h('button', { type: 'button', class: 'btn btn--white btn--sm galerie__tout', onclick: function () { ouvrir(photos, 0); } },
        P.icone('photo'), 'Voir les ' + photos.length + ' photos'));
    }
  }

  function ouvrir(photos, depart) {
    var index = depart;
    var avant = document.activeElement;
    var img = h('img', { alt: '' });
    var compteur = h('span');
    var legende = h('p', { class: 'visionneuse__legende' });
    function montrer() {
      var p = photos[index];
      img.src = p.url;
      img.alt = p.legende || 'Photo ' + (index + 1);
      compteur.textContent = (index + 1) + ' / ' + photos.length;
      legende.textContent = p.legende || '';
    }
    function aller(d) { index = (index + d + photos.length) % photos.length; montrer(); }
    function fermer() {
      document.removeEventListener('keydown', clavier);
      boite.remove();
      document.body.style.overflow = '';
      if (avant && avant.focus) avant.focus();
    }
    function clavier(e) {
      if (e.key === 'Escape') fermer();
      else if (e.key === 'ArrowRight') aller(1);
      else if (e.key === 'ArrowLeft') aller(-1);
    }
    var fermerBtn = h('button', { type: 'button', class: 'visionneuse__fermer', 'aria-label': 'Fermer', onclick: fermer }, P.icone('croix'));
    var scene = h('div', { class: 'visionneuse__scene' }, img);
    if (photos.length > 1) {
      scene.appendChild(h('button', { type: 'button', class: 'visionneuse__nav visionneuse__nav--g', 'aria-label': 'Photo précédente', onclick: function () { aller(-1); } }, P.icone('gauche')));
      scene.appendChild(h('button', { type: 'button', class: 'visionneuse__nav visionneuse__nav--d', 'aria-label': 'Photo suivante', onclick: function () { aller(1); } }, P.icone('droite')));
    }
    // Balayage au doigt
    var x0 = null;
    scene.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
    scene.addEventListener('pointerup', function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 50 && photos.length > 1) aller(dx < 0 ? 1 : -1);
    });
    var boite = h('div', { class: 'visionneuse', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Photos du bien' },
      h('div', { class: 'visionneuse__haut' }, compteur, fermerBtn), scene, legende);
    document.body.appendChild(boite);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', clavier);
    montrer();
    fermerBtn.focus();
  }

  // ---------- Contenu ----------
  function miniCartes(b) {
    var cartes = [];
    var ajouter = function (ico, valeur, libelle) { if (valeur) cartes.push({ ico: ico, valeur: valeur, libelle: libelle }); };
    if (b.type_bien === 'terrain') {
      ajouter('terrain', P.hectares(b.surface_terrain), 'Surface du terrain');
    } else {
      ajouter('surface', P.surface(b.surface_habitable), 'Surface habitable');
      ajouter('pieces', b.nb_pieces && String(b.nb_pieces), b.nb_pieces > 1 ? 'Pièces' : 'Pièce');
      ajouter('lit', b.nb_chambres && String(b.nb_chambres), b.nb_chambres > 1 ? 'Chambres' : 'Chambre');
      ajouter('terrain', b.surface_terrain && P.hectares(b.surface_terrain), 'Terrain');
      ajouter('bain', b.nb_sdb && String(b.nb_sdb), b.nb_sdb > 1 ? "Salles d'eau" : "Salle d'eau");
      ajouter('niveaux', b.etage !== null && b.etage !== undefined ? P.etage(b.etage) : '', 'Étage');
      ajouter('calendrier', b.annee_construction && String(b.annee_construction), 'Construction');
    }
    return h('div', { class: 'mini-cards' }, cartes.slice(0, 4).map(function (c) {
      return h('div', { class: 'mini-card' }, h('span', { class: 'mini-card__ico' }, P.icone(c.ico)), h('strong', null, c.valeur), h('span', null, c.libelle));
    }));
  }

  function paragraphes(texte) {
    return h('div', { class: 'texte' }, String(texte || '').split(/\n\s*\n/).map(function (p) {
      var bloc = h('p');
      p.split('\n').forEach(function (ligne, i) { if (i) bloc.appendChild(h('br')); bloc.appendChild(document.createTextNode(ligne)); });
      return bloc;
    }));
  }

  function caracteristiques(b) {
    var lignes = [];
    var l = function (titre, valeur) { if (valeur !== '' && valeur !== null && valeur !== undefined) lignes.push([titre, valeur]); };
    l('Type de bien', R.libelle(R.typesBien, b.type_bien));
    l('Époque', R.libelle(R.epoques, b.epoque));
    l('Année de construction', b.annee_construction ? String(b.annee_construction) : '');
    l('État', R.libelle(R.etats, b.etat));
    l('Surface habitable', b.surface_habitable ? P.surface(b.surface_habitable) : '');
    l('Surface loi Carrez', b.surface_carrez ? P.surface(b.surface_carrez) : '');
    l('Terrain', b.surface_terrain ? P.hectares(b.surface_terrain) : '');
    l('Pièces', b.nb_pieces ? String(b.nb_pieces) : '');
    l('Chambres', b.nb_chambres ? String(b.nb_chambres) : '');
    l("Salles de bains ou d'eau", b.nb_sdb ? String(b.nb_sdb) : '');
    l('Niveaux', b.nb_niveaux ? String(b.nb_niveaux) : '');
    if (b.etage !== null && b.etage !== undefined) l('Étage', P.etage(b.etage) + (b.nb_etages_immeuble ? ' sur ' + b.nb_etages_immeuble : ''));
    if (b.ascenseur !== null && b.ascenseur !== undefined) l('Ascenseur', b.ascenseur ? 'Oui' : 'Non');
    l('Stationnement', b.nb_parkings ? P.pluriel(b.nb_parkings, 'place', 'places') : '');
    l('Exposition', R.libelle(R.expositions, b.exposition));
    var chauffage = [R.libelle(R.chauffageTypes, b.chauffage_type), R.libelle(R.chauffageEnergies, b.chauffage_energie)].filter(Boolean).join(', ');
    l('Chauffage', chauffage);
    l('Taxe foncière', b.taxe_fonciere ? P.prix(b.taxe_fonciere) + ' par an' : '');
    if (b.protection && b.protection !== 'aucune') l('Protection patrimoniale', R.libelle(R.protections, b.protection));
    return h('dl', { class: 'caracteristiques' }, lignes.map(function (x) { return h('div', null, h('dt', null, x[0]), h('dd', null, x[1])); }));
  }

  function echelle(titre, classes, actif, couleurs, valeur, unite, estGes) {
    var barres = h('div', { class: 'echelle__barres' });
    classes.forEach(function (c, i) {
      var clair = estGes ? (c === 'A' || c === 'B') : (c === 'C' || c === 'D' || c === 'E');
      var barre = h('div', { class: 'echelle__barre' + (clair ? ' clair' : '') + (c === actif ? ' is-actif' : '') },
        h('span', null, c), c === actif && valeur ? h('em', null, valeur + ' ' + unite) : null);
      barre.style.background = couleurs[c];
      barre.style.width = (38 + i * 9) + '%';
      barres.appendChild(barre);
    });
    return h('div', { class: 'echelle' }, h('h3', null, titre), barres);
  }

  function blocEnergie(b) {
    var d = b.dpe;
    var contenu = [];
    if (d.statut === 'realise') {
      contenu.push(h('div', { class: 'energie' },
        echelle('Classe énergie', R.classesDpe, d.classe, R.couleursDpe, d.conso, 'kWh/m²/an', false),
        echelle('Classe climat (GES)', R.classesDpe, d.ges, R.couleursGes, d.emission, 'kg CO₂/m²/an', true)));
      if (d.depenses_min !== null && d.depenses_max !== null) {
        contenu.push(h('p', { class: 'echelle__valeur' },
          "Montant estimé des dépenses annuelles d'énergie pour un usage standard : ",
          h('strong', null, 'entre ' + P.prix(d.depenses_min) + ' et ' + P.prix(d.depenses_max) + ' par an'),
          d.annee_prix ? '. Prix moyens des énergies indexés sur l\'année ' + d.annee_prix + ' (abonnements compris).' : '.'));
      }
      if (d.classe === 'F' || d.classe === 'G') contenu.push(h('p', { class: 'alerte-energie' }, 'Logement à consommation énergétique excessive.'));
    } else if (d.statut === 'vierge') {
      contenu.push(h('p', null, 'Diagnostic de performance énergétique vierge : consommations non disponibles.'));
    } else if (d.statut === 'non_soumis') {
      contenu.push(h('p', null, "Bien non soumis au diagnostic de performance énergétique."));
    } else {
      return null;
    }
    return h('section', { class: 'bloc reveal' }, P.eyebrow('Performance énergétique'), h('div', { class: 'encadre' }, contenu));
  }

  function blocCopro(b) {
    if (!b.copropriete) return null;
    var c = b.copropriete;
    var lignes = [h('p', null, h('strong', null, 'Bien soumis au statut de la copropriété'),
      c.nb_lots !== null ? ', ' + P.pluriel(c.nb_lots, 'lot', 'lots') + '.' : '.')];
    if (c.charges_annuelles !== null) lignes.push(h('p', null, 'Montant moyen annuel de la quote-part de charges : ' + P.prix(c.charges_annuelles) + '.'));
    lignes.push(h('p', null, c.procedure
      ? 'Procédure en cours : ' + (c.procedure_detail || 'nous consulter') + '.'
      : 'Aucune procédure en cours à l\'encontre du syndicat des copropriétaires.'));
    return h('section', { class: 'bloc reveal' }, P.eyebrow('Copropriété'), h('div', { class: 'encadre texte' }, lignes));
  }

  function blocLocalisation(b) {
    var loc = b.localisation;
    var lieu = [loc.quartier, loc.ville].filter(Boolean).join(', ') + (loc.code_postal ? ' (' + loc.code_postal + ')' : '');
    var elts = [P.eyebrow('Localisation'), h('h2', null, loc.affichage === 'exacte' && loc.adresse ? loc.adresse + ', ' + lieu : lieu)];
    if (loc.position) {
      var carte = h('div');
      P.carte(carte, loc.position.lat, loc.position.lng, loc.position.precision);
      elts.push(carte);
      elts.push(h('p', { class: 'carte__legende' }, P.icone('info'), loc.position.precision === 'exacte'
        ? 'Emplacement du bien.'
        : 'Le bien se situe dans le cercle indiqué. Son adresse exacte vous sera communiquée lors de la visite.'));
    } else {
      elts.push(h('p', { class: 'carte__legende' }, P.icone('info'), "L'adresse exacte vous sera communiquée lors de la visite."));
    }
    return h('section', { class: 'bloc reveal' }, elts);
  }

  function prixCarte(b) {
    var enfants = [P.eyebrow('Prix de vente', true)];
    if (b.statut === 'vendue') {
      enfants.push(h('p', { class: 'prix-carte__montant' }, 'Vendu'));
      enfants.push(h('p', { class: 'prix-carte__detail' }, 'Ce bien a trouvé preneur. Contactez-nous : nous pouvons vous présenter des biens similaires.'));
    } else if (b.prix) {
      enfants.push(h('p', { class: 'prix-carte__montant' }, P.prix(b.prix.fai)));
      if (b.prix.charge === 'acquereur' && b.prix.net) {
        enfants.push(h('p', { class: 'prix-carte__detail' },
          'Honoraires inclus : ' + P.nombre(b.prix.pourcentage) + ' % TTC à la charge de l\'acquéreur, soit un prix de '
          + P.prix(b.prix.net) + ' hors honoraires.'));
      } else {
        enfants.push(h('p', { class: 'prix-carte__detail' }, 'Honoraires à la charge du vendeur.'));
      }
    } else {
      enfants.push(h('p', { class: 'prix-carte__montant' }, 'Prix sur demande'));
    }
    if (b.statut === 'sous_offre') enfants.push(h('p', { class: 'prix-carte__statut' }, h('span', { class: 'badge badge--sand' }, 'Sous offre')));
    return h('div', { class: 'prix-carte' }, enfants);
  }

  // Rappel du prix sous le titre, sur petit écran (la colonne prix passe tout en bas).
  function prixMobile(b) {
    var montant = b.statut === 'vendue' ? 'Vendu' : b.prix ? P.prix(b.prix.fai) : 'Prix sur demande';
    var detail = b.statut === 'vendue' ? '' : b.prix && b.prix.charge === 'acquereur' ? 'Honoraires inclus' : b.prix ? 'Honoraires à la charge du vendeur' : '';
    return h('div', { class: 'fiche__prix-mobile' }, h('div', null, h('strong', null, montant), detail ? h('small', null, detail) : null),
      h('a', { class: 'btn btn--sand btn--sm', href: '#contact' }, P.icone('tel'), 'Contacter'));
  }

  function journaliser(evenement) {
    P.api('/api/biens?id=' + encodeURIComponent(id), { method: 'POST', corps: { evenement: evenement }, keepalive: true }).catch(function () {});
  }

  function contactCarte(b) {
    var c = b.contact;
    var sujet = 'Demande d\'information : ' + b.titre;
    return h('div', { class: 'contact-carte', id: 'contact' },
      h('div', { class: 'contact-carte__qui' },
        h('img', { src: c.photo, alt: '', width: '64', height: '64' }),
        h('div', null, h('strong', null, c.nom), h('span', null, c.role))),
      h('a', { class: 'btn btn--solid', href: 'tel:' + c.telLien, onclick: function () { journaliser('contact_tel'); } }, P.icone('tel'), 'Appeler ' + c.tel),
      h('a', { class: 'btn btn--light', href: 'mailto:' + c.email + '?subject=' + encodeURIComponent(sujet), onclick: function () { journaliser('contact_mail'); } }, P.icone('mail'), 'Écrire un message'),
      h('p', null, 'Visites sur rendez-vous uniquement. Nous vous répondons sous 48 heures ouvrées.'));
  }

  function construireFiche(b) {
    document.title = b.titre + ' | Espace transaction Petra Gest';
    var type = R.libelle(R.typesBien, b.type_bien);
    var protection = b.protection && b.protection !== 'aucune' ? R.libelle(R.protections, b.protection) : '';
    var lieu = [b.localisation.quartier, b.localisation.ville].filter(Boolean).join(', ') + (b.localisation.code_postal ? ' (' + b.localisation.code_postal + ')' : '');

    var principal = h('div', { class: 'fiche__principal' },
      h('header', { class: 'fiche__entete' },
        P.eyebrow([type, protection].filter(Boolean).join(' · ')),
        h('h1', null, b.titre),
        lieu ? h('p', { class: 'fiche__lieu' }, P.icone('lieu'), lieu) : null,
        prixMobile(b)),
      miniCartes(b),
      b.description ? h('section', { class: 'bloc reveal' }, P.eyebrow('Le bien'), paragraphes(b.description)) : null,
      b.atouts.length ? h('section', { class: 'bloc reveal' }, P.eyebrow('Les atouts'),
        h('ul', { class: 'atouts' }, b.atouts.map(function (a) { return h('li', { class: 'atout' }, R.libelle(R.atouts, a)); }))) : null,
      h('section', { class: 'bloc reveal' }, P.eyebrow('Caractéristiques'), caracteristiques(b)),
      blocEnergie(b),
      blocCopro(b),
      blocLocalisation(b),
      h('div', { class: 'mentions-legales-bien' },
        b.mention_georisques ? h('p', null, 'Les informations sur les risques auxquels ce bien est exposé sont disponibles sur le site Géorisques : ',
          h('a', { href: 'https://www.georisques.gouv.fr', target: '_blank', rel: 'noopener noreferrer' }, 'www.georisques.gouv.fr'), '.') : null,
        h('p', null, 'Honoraires : consultez notre ', h('a', { href: '/honoraires' }, 'barème des honoraires'), '. Photos non contractuelles.')));

    var aside = h('aside', { class: 'aside' }, prixCarte(b), contactCarte(b));
    P.vider(fiche);
    fiche.appendChild(principal);
    fiche.appendChild(aside);
    P.reveler(fiche);
  }

  function apercu(b) {
    if (!b.apercu) return;
    var libelles = { brouillon: 'un brouillon', archivee: 'archivée', publiee: 'en ligne', sous_offre: 'sous offre', vendue: 'vendue' };
    var texte = b.apercu.en_corbeille
      ? 'Aperçu équipe : cette annonce est dans la corbeille, les visiteurs ne la voient pas.'
      : (b.apercu.statut === 'brouillon' || b.apercu.statut === 'archivee')
        ? 'Aperçu équipe : cette annonce est ' + libelles[b.apercu.statut] + ', les visiteurs ne la voient pas encore.'
        : 'Aperçu équipe : voici ce que voient les détenteurs d\'un code.';
    document.getElementById('apercu').appendChild(h('div', { class: 'message message--info' }, P.icone('oeil'), h('span', null, texte)));
    document.getElementById('apercu').style.marginBottom = '1rem';
  }

  // Chargement
  fiche.appendChild(h('div', { class: 'fiche__squelette squelette', 'aria-hidden': 'true' }));
  Promise.all([P.visiteur.chargerSession(), P.api('/api/biens?id=' + encodeURIComponent(id))]).then(function (res) {
    var etat = res[0];
    var bien = res[1].bien;
    if (!etat.connecte) {
      document.getElementById('enteteNom').textContent = 'Aperçu équipe Petra Gest';
      document.getElementById('enteteValidite').textContent = 'Connecté à l\'espace de gestion';
      document.getElementById('enteteUtilisateur').hidden = false;
      document.getElementById('deconnexion').hidden = true;
    }
    apercu(bien);
    construireGalerie(bien);
    construireFiche(bien);
  }).catch(function (err) {
    if (P.visiteur.gererErreur(err)) return;
    galerie.hidden = true;
    P.vider(fiche);
    fiche.appendChild(h('div', { class: 'vide' },
      h('h2', null, err.statut === 404 ? "Ce bien n'est plus proposé" : 'Chargement impossible'),
      h('p', null, err.statut === 404 ? 'Il a peut-être été vendu ou retiré de la vente. Découvrez les autres biens de notre sélection.' : err.message),
      h('a', { class: 'btn btn--solid', href: '/biens' }, P.icone('retour'), 'Tous les biens')));
  });
})();
