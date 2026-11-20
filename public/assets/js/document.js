/*
  Documents imprimables de l'espace de gestion (lot 3), aux couleurs de Petra Gest :
    fiche      : fiche technique remise au visiteur (photos, pièce par pièce, DPE, environs) ;
    interne    : fiche de rentrée, dossier interne complet (vendeur, mandat, plus et moins) ;
    visite     : bon de visite à faire signer ;
    decouverte : fiche découverte du rendez-vous d'estimation.
  Calés sur les deux modèles transmis par Catherine le 29/10/2026. Le PDF s'obtient par l'impression du
  navigateur (« Enregistrer au format PDF ») ; la mise en page A4 est dans document.css.
  Trois façons de remplir un champ :
    propre  : fiche remise au visiteur, seules les informations renseignées apparaissent ;
    complet : document prérempli, ce qui manque reste à compléter à la main (pointillés) ;
    vierge  : aucune annonce choisie, tout se remplit à la main.
  Règle de la maison : aucun innerHTML, tout passe par P.h().
*/
(function () {
  'use strict';
  var P = window.P;
  var R = window.REFERENTIEL;
  var h = P.h;

  var DOCUMENTS = {
    fiche: { titre: 'Fiche technique', aide: 'À remettre au visiteur. Seules les informations renseignées apparaissent, rien du dossier interne.' },
    interne: { titre: 'Fiche de rentrée', aide: 'Dossier interne : à ne pas remettre à un acquéreur. Ce qui manque se complète à la main.' },
    visite: { titre: 'Bon de visite', aide: 'À faire signer par le visiteur, en deux exemplaires.' },
    decouverte: { titre: 'Fiche découverte', aide: 'Questionnaire du rendez-vous d\'estimation chez le propriétaire.' },
  };

  var params = new URLSearchParams(location.search);
  var doc = DOCUMENTS[params.get('doc')] ? params.get('doc') : null;
  var idAnnonce = params.get('annonce');
  var outils = document.getElementById('doc-outils');
  var zone = document.getElementById('doc');

  var D = null;      // réponse de l'API : agence, contact, textes, conseiller, annonce
  var a = null;      // l'annonce (vue de gestion), ou null pour un document vierge
  var f = {};        // sa fiche technique
  var mode = 'vierge';
  var options = { adresse: true, photos: true, environs: true, visiteur: '', date: aujourdhui(), heure: '' };

  // ---------- Petits outils ----------
  function aujourdhui() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function vide(v) { return v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length); }
  function lib(liste, code) { return code ? R.libelle(liste, code) : ''; }
  function dateLongue(iso) { return iso ? P.date(iso.length === 10 ? iso + 'T12:00:00' : iso, true) : ''; }
  function joindre(liste, sep) { return liste.filter(function (x) { return !vide(x); }).join(sep || ', '); }
  function remplir(t) {
    return String(t)
      .replace(/\{agence\}/g, D.agence.nom)
      .replace(/\{mandat\}/g, a && a.numero_mandat ? ', titulaire du mandat de vente n° ' + a.numero_mandat : '')
      .replace(/\{email\}/g, D.agence.email);
  }
  function paragraphes(t) {
    return String(t).split(/\n\s*\n/).map(function (bloc) {
      var morceaux = [];
      bloc.split('\n').forEach(function (l, i) { if (i) morceaux.push(h('br')); morceaux.push(l); });
      return h('p', null, morceaux);
    });
  }

  // ---------- Éléments de formulaire imprimés ----------
  // « Libellé : valeur ». En mode propre, rien si la valeur manque ; sinon un pointillé à remplir.
  function ligne(libelle, valeur, classe) {
    var v = vide(valeur) ? '' : String(valeur);
    if (!v && mode === 'propre') return null;
    return h('div', { class: 'f-ligne' + (classe ? ' ' + classe : '') },
      libelle ? h('span', { class: 'f-ligne__lib' }, libelle) : null,
      h('span', { class: 'f-ligne__val' + (v ? '' : ' is-vide') }, v));
  }
  function caseC(texte, coche) { return h('span', { class: 'f-case' + (coche ? ' is-coche' : '') }, texte); }
  function ouiNon(libelle, valeur) {
    if (mode === 'propre') return vide(valeur) ? null : ligne(libelle, valeur ? 'Oui' : 'Non');
    return h('div', { class: 'f-ligne f-ligne--choix' }, h('span', { class: 'f-ligne__lib' }, libelle),
      h('span', { class: 'f-choix' }, caseC('Oui', valeur === true), caseC('Non', valeur === false)));
  }
  // Liste de cases : en mode propre, seulement les éléments cochés, en une phrase.
  function cases(liste, actifs, colonnes, libelle) {
    actifs = actifs || [];
    if (mode === 'propre') {
      var t = liste.filter(function (o) { return actifs.indexOf(o[0]) >= 0; }).map(function (o) { return o[1]; });
      return t.length ? ligne(libelle || '', enumeration(t), 'f-ligne--liste') : null;
    }
    return h('div', { class: 'f-groupe' }, libelle ? h('span', { class: 'f-groupe__lib' }, libelle) : null,
      h('div', { class: 'f-cases f-cases--' + (colonnes || 3) }, liste.map(function (o) { return caseC(o[1], actifs.indexOf(o[0]) >= 0); })));
  }
  // Texte libre : le texte saisi, ou un cadre vide à remplir à la main.
  function cadre(libelle, texte, hauteur) {
    if (vide(texte) && mode === 'propre') return null;
    return h('div', { class: 'f-cadre' + (vide(texte) ? ' f-cadre--' + (hauteur || 'moyen') : '') },
      libelle ? h('span', { class: 'f-cadre__lib' }, libelle) : null, vide(texte) ? null : paragraphes(texte));
  }
  function bloc(titre, contenu, classe) {
    var c = (Array.isArray(contenu) ? contenu : [contenu]).filter(Boolean);
    if (!c.length) return null;
    return h('section', { class: 'f-bloc' + (classe ? ' ' + classe : '') }, h('h2', { class: 'f-bloc__titre' }, titre), c);
  }
  function colonnes() {
    var c = Array.prototype.slice.call(arguments).filter(Boolean);
    return c.length ? h('div', { class: 'f-deux' }, c) : null;
  }
  function blanc(classe) { return h('span', { class: 'f-blanc' + (classe ? ' ' + classe : '') }); }

  // ---------- En-têtes et pied ----------
  function agence() {
    var g = D.agence;
    return h('div', { class: 'f-entete__agence' }, h('strong', null, g.raisonSociale),
      h('span', null, g.adresse), h('span', null, g.codePostal + ' ' + g.ville), h('span', null, g.tel), h('span', null, g.email));
  }
  function enteteFormulaire(titre, surTitre, badge) {
    return h('header', { class: 'f-entete' },
      h('img', { class: 'f-entete__logo', src: '/assets/pg-logo-navy.png', alt: 'Petra Gest', width: '900', height: '909' }),
      h('div', { class: 'f-entete__texte' }, h('p', { class: 'f-sur' }, surTitre), h('h1', null, titre),
        badge ? h('p', { class: 'f-badge' }, badge) : null),
      agence());
  }
  function pied(note) {
    var g = D.agence;
    return h('footer', { class: 'f-pied' },
      note ? h('p', { class: 'f-pied__note' }, note) : null,
      h('p', null, h('strong', null, g.nom), ' · ' + g.raisonSociale + ', ' + g.adresse + ', ' + g.codePostal + ' ' + g.ville
        + ' · ' + g.tel + ' · ' + g.email + ' · ' + g.site),
      h('p', null, g.carte + ' · ' + g.garantie));
  }
  function contactTexte() {
    var c = D.contact;
    return joindre([c.nom, c.qualite ? c.qualite.toLowerCase() : '', c.rsac], ', ');
  }

  // ---------- Données du bien ----------
  function typeBien() { return lib(R.typesBien, a.type_bien); }
  function lieu(exacte) {
    if (exacte && a.adresse) return joindre([a.adresse, joindre([a.code_postal, a.ville], ' ')]);
    return joindre([a.quartier, a.ville]) + (a.code_postal ? ' (' + a.code_postal + ')' : '');
  }
  function phrasePrix() {
    var p = a.prix_detail;
    if (!p) return '';
    if (p.charge === 'acquereur' && p.net) {
      return 'Honoraires inclus : ' + P.nombre(p.pourcentage) + ' % TTC à la charge de l\'acquéreur, soit un prix de ' + P.prix(p.net) + ' hors honoraires.';
    }
    if (p.charge === 'vendeur') return 'Honoraires à la charge du vendeur.';
    return '';
  }
  function epoque() { return joindre([lib(R.epoques, a.epoque), a.annee_construction ? String(a.annee_construction) : ''], ', '); }
  function chauffage() { return joindre([lib(R.chauffageTypes, a.chauffage_type), lib(R.chauffageEnergies, a.chauffage_energie)]); }
  function protection() { return a.protection && a.protection !== 'aucune' ? lib(R.protections, a.protection) : ''; }
  // « Cheminée, moulures, belle hauteur sous plafond » : minuscule après le premier libellé (sauf les sigles : WC, VMC).
  function enumeration(libelles) {
    return libelles.map(function (t, i) {
      return i && t.length > 1 && t.charAt(1) === t.charAt(1).toLowerCase() ? t.charAt(0).toLowerCase() + t.slice(1) : t;
    }).join(', ');
  }
  function detailsPiece(p) {
    var possibles = R.detailsPour(p.type);
    var t = enumeration((p.details || []).map(function (c) { return R.libelle(possibles, c); }).filter(Boolean));
    if (p.commentaire) t = t ? t + '. ' + p.commentaire : p.commentaire;
    return t;
  }

  // Tableau pièce par pièce. Vierge : les pièces habituelles du modèle de Catherine, à compléter.
  var PIECES_MODELE = ['Entrée', 'Séjour', 'Salon', 'Cuisine', 'Chambre 1', 'Chambre 2', 'Chambre 3', 'Chambre 4',
    'Bureau', 'Salle de bains', 'Salle d\'eau', 'WC', 'Cellier', 'Balcon ou terrasse', 'Cave', 'Garage'];
  function expoVierge() {
    return h('span', { class: 'f-expo' }, R.orientations.map(function (o) { return caseC(o[0], false); }));
  }
  function tableauPieces(pieces) {
    var corps = [];
    var aRemplir = mode !== 'propre';
    if (pieces.length) {
      pieces.forEach(function (p) {
        var def = R.pieceDe(p.type);
        corps.push(h('tr', { class: def && !def[2] ? 'is-annexe' : null },
          h('td', null, h('strong', null, p.nom || (def ? def[1] : ''))),
          h('td', null, lib(R.niveaux, p.niveau)),
          h('td', { class: 'f-num' }, p.surface ? P.surface(p.surface) : ''),
          h('td', null, (p.orientations || []).join(' ')),
          h('td', null, lib(R.sols, p.sol)),
          h('td', null, detailsPiece(p))));
      });
      if (aRemplir) for (var i = 0; i < 3; i++) corps.push(h('tr', { class: 'is-vide' }, [0, 1, 2, 3, 4, 5].map(function () { return h('td'); })));
    } else {
      PIECES_MODELE.forEach(function (n) {
        corps.push(h('tr', { class: 'is-vide' }, h('td', null, h('strong', null, n)), h('td'), h('td'), h('td', null, expoVierge()), h('td'), h('td')));
      });
      for (var j = 0; j < 3; j++) corps.push(h('tr', { class: 'is-vide' }, [0, 1, 2, 3, 4, 5].map(function () { return h('td'); })));
    }
    var total = window.REFERENTIEL && pieces.length ? surfaceHabitable(pieces) : null;
    return h('table', { class: 'f-table f-table--pieces' },
      h('thead', null, h('tr', null, ['Pièce', 'Niveau', 'Surface', 'Expo.', 'Sol', 'Équipements et remarques'].map(function (t) { return h('th', { scope: 'col' }, t); }))),
      h('tbody', null, corps),
      total ? h('tfoot', null, h('tr', null, h('td', { colspan: '2' }, 'Total des pièces habitables'), h('td', { class: 'f-num' }, P.surface(total)),
        h('td', { colspan: '3' }, 'Hors balcon, terrasse, jardin, cave, garage, combles et véranda.'))) : null);
  }
  function surfaceHabitable(pieces) {
    var t = 0, n = 0;
    pieces.forEach(function (p) { var d = R.pieceDe(p.type); if (d && d[2] && p.surface > 0) { t += p.surface; n += 1; } });
    return n ? Math.round(t * 100) / 100 : null;
  }

  // Étiquettes DPE (couleurs réglementaires : seule exception à la charte).
  function echelle(titre, couleurs, active, valeur, unite, estGes) {
    return h('div', { class: 'f-dpe' }, h('span', { class: 'f-dpe__titre' }, titre), R.classesDpe.map(function (c, i) {
      var clair = estGes ? (c === 'A' || c === 'B') : (c === 'C' || c === 'D' || c === 'E');
      var b = h('span', { class: 'f-dpe__barre' + (clair ? ' clair' : '') + (c === active ? ' is-active' : '') },
        h('b', null, c), c === active && valeur ? h('em', null, valeur + ' ' + unite) : null);
      b.style.background = couleurs[c];
      b.style.width = (34 + i * 9) + '%';
      return b;
    }));
  }
  function blocDpe() {
    if (a.dpe_statut === 'realise' && a.dpe_classe) {
      return [h('div', { class: 'f-dpe-deux' },
        echelle('Consommation d\'énergie', R.couleursDpe, a.dpe_classe, a.dpe_conso, 'kWh/m²/an', false),
        echelle('Émissions de gaz à effet de serre', R.couleursGes, a.ges_classe, a.ges_emission, 'kg CO₂/m²/an', true)),
      a.dpe_depenses_min !== null && a.dpe_depenses_max !== null && a.dpe_depenses_min !== undefined
        ? h('p', { class: 'f-note' }, 'Montant estimé des dépenses annuelles d\'énergie pour un usage standard : entre ' + P.prix(a.dpe_depenses_min)
          + ' et ' + P.prix(a.dpe_depenses_max) + ' par an' + (a.dpe_annee_prix ? ' (prix moyens des énergies indexés sur l\'année ' + a.dpe_annee_prix + ', abonnements compris).' : '.'))
        : null,
      ligne('Date du diagnostic', dateLongue(a.dpe_date))];
    }
    if (a.dpe_statut === 'vierge') return ligne('Diagnostic', 'DPE vierge (consommations non disponibles)');
    if (a.dpe_statut === 'non_soumis') return ligne('Diagnostic', 'Bien non soumis au DPE');
    return mode === 'propre' ? null : [ligne('Classe énergie'), ligne('Classe climat (GES)')];
  }

  function blocEnvirons() {
    var cats = a.environs && a.environs.a_jour ? a.environs.categories : [];
    if (!cats.length) return null;
    return [h('div', { class: 'f-environs' }, cats.map(function (c) {
      return h('div', null, h('strong', null, c.libelle), h('ul', null, c.lieux.slice(0, 6).map(function (l) {
        return h('li', null, h('span', null, l.nom ? l.nom + ' (' + l.type.toLowerCase() + ')' : l.type), h('em', null, window.ENVIRONS.texteDuree(l)));
      })));
    })), h('p', { class: 'f-note' }, 'Durées indicatives : à pied jusqu\'à 20 minutes, sinon en voiture. Lieux : © les contributeurs d\'OpenStreetMap.')];
  }

  // =====================================================================
  // Fiche technique (remise au visiteur)
  // =====================================================================
  function ficheTechnique() {
    mode = 'propre';
    var photos = a.photos || [];
    var chiffres = [
      [a.prix_fai ? P.prix(a.prix_fai) : '', 'Honoraires inclus'],
      [a.prix_detail && a.prix_detail.m2 ? P.prix(a.prix_detail.m2) : '', a.type_bien === 'terrain' ? 'Le m² de terrain' : 'Le m²'],
      [a.surface_habitable ? P.surface(a.surface_habitable) : '', 'Surface habitable'],
      [a.nb_pieces ? String(a.nb_pieces) : '', a.nb_pieces > 1 ? 'Pièces' : 'Pièce'],
      [a.nb_chambres ? String(a.nb_chambres) : '', a.nb_chambres > 1 ? 'Chambres' : 'Chambre'],
      [a.surface_terrain ? P.hectares(a.surface_terrain) : '', 'Terrain'],
      [a.etage !== null && a.etage !== undefined && a.type_bien === 'appartement' ? P.etage(a.etage) : '', 'Étage'],
    ].filter(function (x) { return x[0]; });
    var atouts = (a.atouts || []).map(function (c) { return R.libelle(R.atouts, c); }).filter(Boolean);
    var montrerEnvirons = options.environs && (options.adresse || a.affichage_adresse !== 'commune');
    var copro = a.copropriete === true;

    return [
      h('header', { class: 'ft-couv' },
        h('div', { class: 'ft-couv__bande' },
          h('img', { class: 'ft-couv__logo', src: '/assets/pg-logo-sable.png', alt: 'Petra Gest', width: '900', height: '909' }),
          h('div', { class: 'ft-couv__texte' },
            h('p', { class: 'ft-couv__sur' }, joindre(['Fiche technique', typeBien(), protection()], ' · ')),
            h('h1', null, a.titre || typeBien() || 'Bien à la vente'),
            h('p', { class: 'ft-couv__lieu' }, lieu(options.adresse)),
            a.numero_mandat ? h('p', { class: 'ft-couv__ref' }, 'Référence de l\'annonce : ' + a.numero_mandat) : null)),
        options.photos && photos[0] ? h('img', { class: 'ft-couv__photo', src: photos[0].url, alt: photos[0].legende || 'Photo principale du bien' }) : null,
        chiffres.length ? h('div', { class: 'ft-chiffres' }, chiffres.map(function (x) { return h('div', null, h('strong', null, x[0]), h('span', null, x[1])); })) : null,
        phrasePrix() ? h('p', { class: 'ft-prix' }, phrasePrix()) : null),
      bloc('Le bien', [a.description ? h('div', { class: 'f-texte' }, paragraphes(a.description)) : null,
        atouts.length ? ligne('Ses atouts', enumeration(atouts), 'f-ligne--liste') : null], 'f-bloc--long'),
      (f.pieces || []).length ? bloc('Pièce par pièce', tableauPieces(f.pieces), 'f-bloc--long') : null,
      colonnes(
        bloc('Le bâtiment', [ligne('Époque', epoque()), ligne('État général', lib(R.etats, a.etat)), ligne('Construction', f.construction),
          ligne('Façade', f.facade), ligne('Toiture', f.toiture), ligne('Mitoyenneté', lib(R.mitoyennetes, f.mitoyennete)),
          ligne('Niveaux', a.nb_niveaux), ligne('Étages de l\'immeuble', a.nb_etages_immeuble), ouiNon('Ascenseur', a.ascenseur),
          ligne('Protection', protection()), ouiNon('En lotissement', f.lotissement),
          f.frais_notaire_reduits ? ligne('Frais de notaire', 'Réduits (bien de moins de 5 ans)') : null]),
        bloc('Confort et équipements', [ligne('Chauffage', chauffage()), ligne('Exposition', lib(R.expositions, a.exposition)),
          ligne('Vitrage', lib(R.vitrages, f.vitrage)), ligne('Menuiseries', lib(R.menuiseries, f.menuiseries)),
          ligne('Assainissement', lib(R.assainissements, f.assainissement)),
          ligne('Stationnement', a.nb_parkings ? P.pluriel(a.nb_parkings, 'place', 'places') : ''),
          cases(R.equipementsFiche, f.equipements, 2, 'Équipements')])),
      colonnes(
        bloc('Travaux', [cadre('Travaux réalisés', f.travaux_realises), ouiNon('Garantie décennale en cours', f.garantie_decennale),
          cadre('Travaux à prévoir', f.travaux_a_prevoir), copro ? cadre('Travaux votés en assemblée générale', f.travaux_votes) : null]),
        bloc('Charges et taxes', [ligne('Taxe foncière', a.taxe_fonciere ? P.prix(a.taxe_fonciere) + ' par an' : ''),
          copro ? ligne('Copropriété', a.copro_nb_lots ? P.pluriel(a.copro_nb_lots, 'lot', 'lots') : 'Oui') : null,
          copro ? ligne('Charges courantes', a.copro_charges_annuelles ? P.prix(a.copro_charges_annuelles) + ' par an' : '') : null,
          copro ? ligne('Procédure en cours', a.copro_procedure ? (a.copro_procedure_detail || 'Oui') : 'Aucune') : null,
          copro ? ligne('Syndic', joindre([f.syndic_nom, lib(R.syndics, f.syndic_type)], ', ')) : null,
          ligne('Cadastre', f.cadastre)])),
      bloc('Situation locative', f.loue === true
        ? [ligne('Le bien est loué', lib(R.typesBail, f.bail_type) || 'Oui'), ligne('Loyer hors charges', f.loyer_hc ? P.prix(f.loyer_hc) + ' par mois' : ''),
          ligne('Locataire en place depuis le', dateLongue(f.bail_debut)), ligne('Fin de bail prévue le', dateLongue(f.bail_fin))]
        : f.loue === false ? ligne('Occupation', 'Vendu libre de toute location') : null),
      bloc('Performance énergétique', blocDpe()),
      montrerEnvirons ? bloc('Les environs', blocEnvirons()) : null,
      options.photos && photos.length > 1 ? bloc('En images', h('div', { class: 'ft-photos' }, photos.slice(1, 13).map(function (p) {
        return h('figure', null, h('img', { src: p.url_mini || p.url, alt: p.legende || '' }), p.legende ? h('figcaption', null, p.legende) : null);
      })), 'f-bloc--long f-bloc--photos') : null,
      h('section', { class: 'f-bloc ft-contact' },
        D.contact.photo ? h('img', { class: 'ft-contact__photo', src: D.contact.photo, alt: '' }) : null,
        h('div', null, h('p', { class: 'f-sur' }, 'Votre interlocutrice'),
          h('p', { class: 'ft-contact__nom' }, D.contact.nom),
          h('p', null, joindre([D.contact.qualite, D.contact.role], ' · ')),
          D.contact.rsac ? h('p', { class: 'ft-contact__rsac' }, D.contact.rsac) : null,
          h('p', { class: 'ft-contact__coord' }, joindre([D.contact.tel, D.contact.email], ' · ')))),
      h('div', { class: 'f-mentions' },
        a.mention_georisques ? h('p', null, 'Les informations sur les risques auxquels ce bien est exposé sont disponibles sur le site Géorisques : www.georisques.gouv.fr.') : null,
        h('p', null, 'Honoraires : barème consultable sur petragest.fr. Document d\'information non contractuel, établi le ' + dateLongue(aujourdhui())
          + ' d\'après les éléments connus à cette date. Photos non contractuelles.')),
      pied(),
    ];
  }

  // =====================================================================
  // Fiche de rentrée (dossier interne)
  // =====================================================================
  function ficheRentree() {
    mode = a ? 'complet' : 'vierge';
    var x = a || {};
    var p = x.prix_detail || {};
    var copro = x.copropriete;
    var equipements = R.atouts.concat(R.equipementsFiche);
    var actifs = (x.atouts || []).concat(f.equipements || []);
    // Net vendeur : prix moins honoraires, quel que soit celui qui les paie.
    var net = p.net || (x.prix_fai && x.honoraires_ttc && x.honoraires_ttc < x.prix_fai ? x.prix_fai - x.honoraires_ttc : null);

    return [
      enteteFormulaire('Fiche de rentrée', 'Prise de mandat', 'Dossier interne : ne pas remettre à un acquéreur'),
      h('div', { class: 'f-meta' },
        ligne('Date', a ? dateLongue(aujourdhui()) : ''), ligne('Conseiller', D.contact.nom), ligne('Apporteur', f.apporteur),
        a ? ligne('Type de mandat', lib(R.typesMandat, f.mandat_type)) : h('div', { class: 'f-ligne f-ligne--choix' }, h('span', { class: 'f-ligne__lib' }, 'Mandat'),
          h('span', { class: 'f-choix' }, R.typesMandat.map(function (t) { return caseC(t[1].replace('Mandat ', ''), false); }))),
        ligne('N° de mandat', x.numero_mandat), ligne('Date du mandat', dateLongue(f.mandat_date)),
        a ? ligne('Référence interne', x.reference_interne) : null),
      colonnes(
        bloc('Le vendeur', [ligne('Nom(s) et prénom(s)', f.vendeur_noms), ligne('Adresse', f.vendeur_adresse), a ? null : ligne(''),
          ligne('Téléphone', f.vendeur_tel), ligne('E-mail', f.vendeur_email), ligne('Notaire', f.notaire)]),
        bloc('Le bien', [ligne('Adresse', x.adresse), ligne('Code postal et ville', joindre([x.code_postal, x.ville], ' ')),
          ligne('Quartier', x.quartier), ligne('Étage', x.etage !== null && x.etage !== undefined ? P.etage(x.etage) : ''),
          ligne('Cadastre ou n° de lot', f.cadastre)])),
      bloc('Type de bien', cases(R.typesBien, x.type_bien ? [x.type_bien] : [], 3)),
      colonnes(
        bloc('Prix et surfaces', [ligne('Prix honoraires inclus', x.prix_fai ? P.prix(x.prix_fai) : ''),
          ligne('Honoraires TTC', x.honoraires_ttc ? P.prix(x.honoraires_ttc) + (p.charge ? ', à la charge ' + (p.charge === 'acquereur' ? 'de l\'acquéreur' : 'du vendeur') : '') : ''),
          ligne('Prix net vendeur', net ? P.prix(net) : ''),
          ligne('Prix au m²', p.m2 ? P.prixM2(p, x.type_bien) : ''),
          ouiNon('Frais de notaire réduits (moins de 5 ans)', f.frais_notaire_reduits),
          ligne('Surface habitable', x.surface_habitable ? P.surface(x.surface_habitable) : ''),
          ligne('Surface loi Carrez', x.surface_carrez ? P.surface(x.surface_carrez) : ''),
          ligne('Terrain', x.surface_terrain ? P.hectares(x.surface_terrain) : ''),
          ligne('Pièces', x.nb_pieces), ligne('Chambres', x.nb_chambres), ligne('Salles de bains ou d\'eau', x.nb_sdb)]),
        bloc('Le bâtiment', [ligne('Époque ou année', a ? epoque() : ''), ligne('Construction', f.construction), ligne('Façade', f.facade),
          ligne('Toiture', f.toiture), ligne('Niveaux', x.nb_niveaux), ligne('Étages de l\'immeuble', x.nb_etages_immeuble),
          ouiNon('Ascenseur', x.ascenseur), ligne('État général', lib(R.etats, x.etat)), ligne('Mitoyenneté', lib(R.mitoyennetes, f.mitoyennete)),
          ligne('Protection', a ? protection() : '')])),
      bloc('Pièce par pièce', tableauPieces(f.pieces || []), 'f-bloc--long'),
      bloc('Équipements', cases(equipements, actifs, 4)),
      colonnes(
        bloc('Confort', [ligne('Chauffage', a ? chauffage() : ''), ligne('Vitrage', lib(R.vitrages, f.vitrage)),
          ligne('Menuiseries', lib(R.menuiseries, f.menuiseries)), ligne('Assainissement', lib(R.assainissements, f.assainissement)),
          ligne('Exposition', lib(R.expositions, x.exposition)), ligne('Stationnement', x.nb_parkings ? P.pluriel(x.nb_parkings, 'place', 'places') : '')]),
        bloc('Charges et taxes', [ligne('Taxe foncière', x.taxe_fonciere ? P.prix(x.taxe_fonciere) + ' par an' : ''),
          ouiNon('Copropriété', copro), ligne('Nombre de lots', x.copro_nb_lots),
          ligne('Charges (par an)', x.copro_charges_annuelles ? P.prix(x.copro_charges_annuelles) : ''),
          ligne('Syndic', joindre([f.syndic_nom, lib(R.syndics, f.syndic_type)], ', ')), ligne('Téléphone du syndic', f.syndic_tel),
          ouiNon('Lotissement', f.lotissement)])),
      colonnes(
        bloc('Travaux', [cadre('Travaux réalisés', f.travaux_realises, 'petit'), ouiNon('Garantie décennale en cours', f.garantie_decennale),
          cadre('Travaux à prévoir', f.travaux_a_prevoir, 'petit'), cadre('Travaux votés (copropriété)', f.travaux_votes, 'petit')]),
        bloc('Situation locative et visites', [ouiNon('Bien loué', f.loue), ligne('Type de bail', lib(R.typesBail, f.bail_type)),
          ligne('Loyer hors charges', f.loyer_hc ? P.prix(f.loyer_hc) + ' par mois' : ''), ligne('Entrée du locataire', dateLongue(f.bail_debut)),
          ligne('Fin de bail prévue', dateLongue(f.bail_fin)), cadre('Organisation des visites', f.visites, 'petit')])),
      bloc('Environnement', a && a.environs && a.environs.a_jour && a.environs.categories.length
        ? [ligne('Secteur ou quartier', x.quartier), blocEnvirons()]
        : [ligne('Secteur ou quartier', x.quartier), h('div', { class: 'f-cases f-cases--4' },
          ['École', 'Collège', 'Lycée', 'Commerces', 'Bus', 'Gare', 'Centre-ville', 'Médecin'].map(function (t) { return ligne(t, ''); }))]),
      colonnes(bloc('Les plus', cadre('', f.plus, 'grand')), bloc('Les moins', cadre('', f.moins, 'grand'))),
      bloc('Commentaires du conseiller', cadre('', x.note_interne, 'grand')),
      pied(a ? 'Préparé par ' + D.conseiller + ' le ' + dateLongue(aujourdhui()) + '. Document interne, à ne pas remettre à un acquéreur.' : null),
    ];
  }

  // =====================================================================
  // Bon de visite
  // =====================================================================
  function bonDeVisite() {
    mode = a ? 'complet' : 'vierge';
    var bien;
    if (a) {
      bien = [ligne('Référence de l\'annonce', a.numero_mandat), ligne('Désignation', a.titre || typeBien()),
        ligne('Adresse', lieu(true)), ligne('Prix', a.prix_fai ? P.prix(a.prix_fai) + ' honoraires inclus' : ''),
        phrasePrix() ? h('p', { class: 'f-note' }, phrasePrix()) : null];
    } else {
      bien = h('table', { class: 'f-table' },
        h('thead', null, h('tr', null, h('th', { scope: 'col', class: 'f-col-ref' }, 'Référence'), h('th', { scope: 'col' }, 'Adresse du bien'), h('th', { scope: 'col', class: 'f-col-prix' }, 'Prix'))),
        h('tbody', null, [0, 1, 2].map(function () { return h('tr', { class: 'is-vide' }, h('td'), h('td'), h('td')); })));
    }
    return [
      enteteFormulaire('Bon de visite', 'Transaction immobilière'),
      bloc('Le bien visité', bien),
      colonnes(
        bloc('Le visiteur', [ligne('Nom(s) et prénom(s)', options.visiteur), ligne('Adresse'), ligne(''), ligne('Téléphone'), ligne('E-mail')]),
        bloc('La visite', [ligne('Date', dateLongue(options.date)), ligne('Heure', options.heure ? options.heure.replace(':', ' h ') : ''),
          ligne('Accompagnée par', contactTexte())])),
      h('section', { class: 'f-bloc f-engagement' }, h('h2', { class: 'f-bloc__titre' }, 'Engagement du visiteur'),
        D.textes.bonDeVisite.map(function (t) { return h('p', null, remplir(t)); })),
      h('p', { class: 'f-fait' }, 'Fait à ', blanc(), ', le ', blanc('f-blanc--court'), ', en deux exemplaires dont un remis au visiteur.'),
      h('div', { class: 'f-signatures' },
        h('div', { class: 'f-signature' }, h('strong', null, 'Le visiteur'), h('small', null, 'Signature précédée de la mention « Lu et approuvé »')),
        h('div', { class: 'f-signature' }, h('strong', null, 'Pour ' + D.agence.nom), h('small', null, contactTexte()))),
      h('p', { class: 'f-rgpd' }, remplir(D.textes.bonDeVisiteDonnees)),
      pied(),
    ];
  }

  // =====================================================================
  // Fiche découverte (rendez-vous d'estimation)
  // =====================================================================
  function question(texte, avecOuiNon, suite) {
    return h('div', { class: 'f-question' },
      h('div', { class: 'f-question__tete' }, h('span', null, texte), avecOuiNon ? h('span', { class: 'f-choix' }, caseC('Oui', false), caseC('Non', false)) : null),
      (suite || []).map(function (s) { return ligne(s); }));
  }
  function ficheDecouverte() {
    mode = a ? 'complet' : 'vierge';
    var x = a || {};
    var bareme = R.baremeVente.map(function (b) { return b[0] + ' % TTC en ' + b[1].toLowerCase(); }).join(', ');
    var lignesSecurite = [['Garage'], ['Parking fermé'], ['Stationnement payant'], ['Cave'], ['Résidence sécurisée'], ['Gardien ou concierge'], ['Ascenseur']];
    var proximites = [['École'], ['Collège'], ['Lycée'], ['Crèche'], ['Supermarché'], ['Boulangerie'], ['Médecin'], ['Bureau de poste'], ['Transports'], ['Gare']];
    var piecesDecouverte = ['Entrée', 'Séjour', 'Salon', 'Cuisine', 'WC', 'Salle de bains ou d\'eau', 'Chambre 1', 'Chambre 2', 'Chambre 3',
      'Chambre 4', 'Chambre 5', 'Bureau', 'Cellier', 'Balcon', 'Terrasse', 'Terrain', 'Cave', 'Garage', 'Autre'];
    var remarques = { Cuisine: 'Séparée, ouverte, aménagée, équipée', WC: 'Indépendant : oui, non', Terrain: 'Surface de plancher, zone du PLU' };

    return [
      enteteFormulaire('Fiche découverte', 'Rendez-vous d\'estimation'),
      h('div', { class: 'f-meta' }, ligne('Date', ''), ligne('Lieu du rendez-vous', a ? lieu(true) : ''), ligne('Conseiller', D.contact.nom)),
      bloc('Le propriétaire', h('div', { class: 'f-deux f-deux--serre' },
        h('div', null, ligne('Nom(s) et prénom(s)', f.vendeur_noms), ligne('Adresse', f.vendeur_adresse), ligne('Code postal et ville'), ligne('E-mail', f.vendeur_email)),
        h('div', null, ligne('Bâtiment, étage, code d\'accès'), ligne('Téléphone', f.vendeur_tel), ligne('Autre téléphone'), ligne('Notaire', f.notaire)))),
      bloc('1. Le projet', [
        question('Êtes-vous le seul propriétaire du bien ?', true, ['Sinon, combien de propriétaires, et lesquels']),
        question('Avez-vous vous-même estimé votre bien ?', true, ['Si oui, à combien, et sur quelle base']),
        question('Pourquoi souhaitez-vous connaître sa valeur ?', false, ['']),
        question('Un professionnel l\'a-t-il déjà estimé ?', true, ['Montant et date de l\'estimation']),
        question('Le bien est-il déjà en vente ?', true, ['Chez qui, depuis quand, à quel prix']),
        question('Y a-t-il eu des visites, et quelles réactions ?', false, ['']),
        question('Avez-vous reçu une offre ?', true, ['Montant']),
        question('Pourquoi vendez-vous ?', false, ['']),
        question('Avez-vous une date à respecter pour cette vente ?', true, ['Laquelle, et pourquoi']),
        question('Recherchez-vous un autre bien ?', true, ['Type, secteur, budget']),
      ], 'f-bloc--long'),
      bloc('2. Le bien et son quartier', [
        colonnes(
          h('div', { class: 'f-groupe' }, h('span', { class: 'f-groupe__lib' }, 'Sécurité et stationnement'),
            lignesSecurite.map(function (l) { return ouiNon(l[0]); })),
          h('div', { class: 'f-groupe' }, h('span', { class: 'f-groupe__lib' }, 'À proximité'),
            proximites.map(function (l) { return ouiNon(l[0]); }))),
        h('div', { class: 'f-deux f-deux--serre' },
          h('div', null, ligne('Type de chauffage', a ? chauffage() : ''), ligne('Contrat d\'entretien')),
          h('div', null, ligne('Mise en service de la chaudière'), ligne('Grande ville la plus proche'))),
        cadre('Projets d\'avenir dans le quartier', '', 'petit'),
        h('div', { class: 'f-deux' }, cadre('Avantages du quartier', '', 'petit'), cadre('Inconvénients du quartier', '', 'petit')),
      ], 'f-bloc--long'),
      bloc('3. Visite technique', [
        h('div', { class: 'f-deux f-deux--serre' },
          h('div', null, ligne('Type de bien', a ? typeBien() : ''), ligne('Étage', x.etage !== null && x.etage !== undefined ? P.etage(x.etage) : ''),
            ouiNon('Ascenseur', x.ascenseur), ligne('Surface habitable', x.surface_habitable ? P.surface(x.surface_habitable) : ''),
            ligne('Terrain', x.surface_terrain ? P.hectares(x.surface_terrain) : '')),
          h('div', null, ligne('Chambres', x.nb_chambres), ligne('Année de construction', x.annee_construction), ligne('Façade', f.facade),
            ligne('Menuiseries', lib(R.menuiseries, f.menuiseries)), ligne('Vitrage', lib(R.vitrages, f.vitrage)))),
        h('table', { class: 'f-table f-table--decouverte' },
          h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Pièce'), h('th', { scope: 'col', class: 'f-col-surface' }, 'Surface'),
            h('th', { scope: 'col', class: 'f-col-expo' }, 'Exposition'), h('th', { scope: 'col' }, 'Remarques'))),
          h('tbody', null, piecesDecouverte.map(function (n) {
            return h('tr', { class: 'is-vide' }, h('td', null, h('strong', null, n)), h('td'), h('td', null, expoVierge()),
              h('td', null, remarques[n] ? h('small', null, remarques[n]) : null));
          }))),
        h('div', { class: 'f-deux f-deux--serre' }, h('div', null, ligne('Travaux à prévoir'), ligne('Montant estimé')),
          h('div', null, ligne('Copropriété : travaux votés'), ligne('Montant'))),
      ], 'f-bloc--long'),
      bloc('4. Renseignements divers', h('div', { class: 'f-deux f-deux--serre' },
        h('div', null,
          h('div', { class: 'f-ligne f-ligne--choix' }, h('span', { class: 'f-ligne__lib' }, 'Syndic'),
            h('span', { class: 'f-choix' }, R.syndics.map(function (s) { return caseC(s[1].replace('Syndic ', ''), f.syndic_type === s[0]); }))),
          ligne('Nom et téléphone du syndic', joindre([f.syndic_nom, f.syndic_tel], ', ')),
          ligne('Charges de copropriété (par an)', x.copro_charges_annuelles ? P.prix(x.copro_charges_annuelles) : ''),
          ligne('Taxe foncière', x.taxe_fonciere ? P.prix(x.taxe_fonciere) : ''),
          ligne('Organisation des visites', f.visites)),
        h('div', null, ligne('Travaux effectués', f.travaux_realises), ouiNon('Garantie décennale', f.garantie_decennale), ligne('Montant et date'),
          ouiNon('Bien loué', f.loue), ligne('Type de bail et loyer hors charges'), ligne('Entrée du locataire et fin de bail')))),
      bloc('5. L\'estimation', [
        h('p', { class: 'f-note' }, 'Points à expliquer au propriétaire : les prix des biens comparables vendus dans le secteur, l\'état du marché local '
          + 'et la conjoncture, l\'emplacement et l\'environnement, l\'état du bien et les travaux à prévoir.'),
        h('div', { class: 'f-deux f-deux--serre' }, h('div', null, ligne('Estimation basse')), h('div', null, ligne('Estimation haute'))),
        ligne('Prix de présentation conseillé'),
      ]),
      bloc('6. ' + D.agence.nom + ' à vos côtés', h('ul', { class: 'f-puces' },
        h('li', null, 'Une interlocutrice unique, de l\'estimation à la signature chez le notaire.'),
        h('li', null, 'Une présentation soignée : photos, descriptif pièce par pièce et fiche technique remise à chaque visite.'),
        h('li', null, 'Un espace transaction privé : votre bien présenté en toute discrétion aux acquéreurs à qui nous remettons un code d\'accès.'),
        h('li', null, 'Un prix argumenté par l\'étude du marché local.'),
        h('li', null, 'Un barème d\'honoraires publié : ' + bareme + ', à la charge de l\'acquéreur.'))),
      bloc('7. Suivi', [
        question('Date à respecter pour réaliser la vente ?', true, ['Si oui, pourquoi']),
        h('table', { class: 'f-table f-table--suivi' },
          h('thead', null, h('tr', null, ['Date', 'Nom', 'Motif', 'Observation', 'Suivi'].map(function (t) { return h('th', { scope: 'col' }, t); }))),
          h('tbody', null, [0, 1, 2, 3, 4, 5].map(function () { return h('tr', { class: 'is-vide' }, [0, 1, 2, 3, 4].map(function () { return h('td'); })); }))),
      ], 'f-bloc--long'),
      colonnes(bloc('Les plus', cadre('', f.plus, 'grand')), bloc('Les moins', cadre('', f.moins, 'grand'))),
      bloc('Commentaires', cadre('', '', 'grand')),
      pied(),
    ];
  }

  // =====================================================================
  // Barre d'outils, impression, chargement
  // =====================================================================
  function option(cle, libelle) {
    var c = h('input', { type: 'checkbox' });
    c.checked = Boolean(options[cle]);
    c.addEventListener('change', function () { options[cle] = c.checked; rendre(); });
    return h('label', { class: 'doc-option' }, c, libelle);
  }
  function champOption(cle, libelle, type, placeholder) {
    var id = 'opt-' + cle;
    var i = h('input', { id: id, type: type, placeholder: placeholder || '', autocomplete: 'off', maxlength: type === 'text' ? '120' : null });
    i.value = options[cle] || '';
    i.addEventListener('input', function () { options[cle] = i.value; rendre(); });
    return h('span', { class: 'doc-option doc-option--champ' }, h('label', { for: id }, libelle), i);
  }
  function imagesChargees() {
    var imgs = Array.prototype.slice.call(zone.querySelectorAll('img'));
    return Promise.all(imgs.map(function (img) {
      if (img.complete) return null;
      return new Promise(function (ok) { img.addEventListener('load', ok); img.addEventListener('error', ok); });
    }));
  }
  function imprimer(e) {
    var b = e.currentTarget;
    b.disabled = true;
    Promise.race([imagesChargees(), new Promise(function (ok) { setTimeout(ok, 8000); })]).then(function () {
      b.disabled = false;
      window.print();
    });
  }
  function barreOutils() {
    P.vider(outils);
    var reglages = h('div', { class: 'doc-outils__reglages' });
    if (doc === 'fiche') {
      reglages.appendChild(option('adresse', 'Adresse exacte'));
      if ((a.photos || []).length) reglages.appendChild(option('photos', 'Photos'));
      if (a.environs && a.environs.a_jour && a.environs.categories.length) reglages.appendChild(option('environs', 'Environs'));
    }
    if (doc === 'visite') {
      reglages.appendChild(champOption('visiteur', 'Visiteur', 'text', 'Nom(s) et prénom(s)'));
      reglages.appendChild(champOption('date', 'Date', 'date'));
      reglages.appendChild(champOption('heure', 'Heure', 'time'));
    }
    outils.appendChild(h('div', { class: 'doc-outils__inner' },
      h('div', { class: 'doc-outils__titre' },
        h('a', { class: 'doc-outils__retour', href: a ? '/espace-gestion#/annonces/' + a.id : '/espace-gestion' }, P.icone('retour'), a ? 'Retour à l\'annonce' : 'Espace de gestion'),
        h('strong', null, DOCUMENTS[doc].titre + (a ? '' : ' (vierge)')),
        h('span', null, DOCUMENTS[doc].aide)),
      reglages.childNodes.length ? reglages : null,
      h('div', { class: 'doc-outils__action' },
        h('button', { type: 'button', class: 'btn btn--sand', onclick: imprimer }, P.icone('imprimer'), 'Imprimer ou enregistrer en PDF'),
        h('small', null, 'Destination « Enregistrer au format PDF ». Décochez « En-têtes et pieds de page » pour un document net.'))));
  }
  function rendre() {
    P.vider(zone);
    var contenu = doc === 'fiche' ? ficheTechnique() : doc === 'interne' ? ficheRentree() : doc === 'visite' ? bonDeVisite() : ficheDecouverte();
    zone.appendChild(h('article', { class: 'doc-feuille doc-feuille--' + doc + (mode === 'propre' ? ' is-propre' : '') }, contenu));
  }
  function erreur(texte, lien) {
    P.vider(outils);
    P.vider(zone);
    zone.appendChild(h('div', { class: 'doc-erreur' }, h('p', null, texte),
      lien ? h('a', { class: 'btn btn--solid', href: lien[0] }, lien[1]) : null));
  }

  if (!doc) { erreur('Ce document n\'existe pas.', ['/espace-gestion', 'Espace de gestion']); return; }
  // Sans annonce, la fiche technique n'a rien à montrer : on propose la fiche de rentrée vierge.
  if (doc === 'fiche' && !idAnnonce) doc = 'interne';
  P.api('/api/admin/documents' + (idAnnonce ? '?annonce=' + encodeURIComponent(idAnnonce) : '')).then(function (r) {
    D = r;
    a = r.annonce;
    f = (a && a.fiche) || {};
    var nom = a ? joindre([a.numero_mandat, a.titre], ' ') : 'vierge';
    document.title = DOCUMENTS[doc].titre + ' ' + nom + ' | Petra Gest';
    barreOutils();
    rendre();
  }).catch(function (err) {
    if (err.statut === 401) erreur('Connectez-vous à l\'espace de gestion pour préparer ce document, puis rouvrez-le.', ['/espace-gestion', 'Se connecter']);
    else if (err.statut === 404) erreur('Cette annonce est introuvable.', ['/espace-gestion#/annonces', 'Toutes les annonces']);
    else erreur(err.message || 'Le document n\'a pas pu être préparé.');
  });
})();
