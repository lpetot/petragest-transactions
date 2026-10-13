/*
  Outils communs à toutes les pages de l'espace transaction.
  Règle de sécurité : on ne construit JAMAIS de HTML à partir de données (pas d'innerHTML) ;
  tout passe par P.h(), qui crée les éléments et pose le texte avec textContent.
*/
(function () {
  'use strict';

  var SVG = 'http://www.w3.org/2000/svg';

  // Tracés d'icônes (trait 1.8, même famille que le site).
  var ICONES = {
    cadenas: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'],
    maison: ['M3 10.5 12 3l9 7.5', 'M5 10v11h14V10', 'M10 21v-6h4v6'],
    fleche: ['M5 12h14', 'M13 6l6 6-6 6'],
    retour: ['M19 12H5', 'M11 6l-6 6 6 6'],
    gauche: ['M15 5l-7 7 7 7'],
    droite: ['M9 5l7 7-7 7'],
    tel: ['M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2'],
    mail: ['M3 6h18v12H3z', 'M3 7l9 6 9-6'],
    sortie: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
    lieu: ['M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z', 'M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
    surface: ['M4 4h16v16H4z', 'M4 9h5', 'M15 4v5', 'M4 15h3'],
    pieces: ['M3 21h18', 'M5 21V4h14v17', 'M9 21v-6h6v6', 'M9 8h2', 'M13 8h2'],
    lit: ['M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7', 'M3 14h18', 'M3 18v2', 'M21 18v2', 'M7 9V6h4v3'],
    bain: ['M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z', 'M6 12V6a2 2 0 0 1 4 0', 'M7 19l-1 2', 'M17 19l1 2'],
    terrain: ['M3 20h18', 'M7 20v-5', 'M7 15a4 4 0 1 1 0-8 4 4 0 0 1 0 8z', 'M17 20v-3', 'M17 17a3 3 0 1 1 0-6 3 3 0 0 1 0 6z'],
    niveaux: ['M12 3l9 5-9 5-9-5z', 'M3 13l9 5 9-5', 'M3 17.5l9 5 9-5'],
    calendrier: ['M4 5h16v16H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
    cle: ['M8 20a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z', 'M11.2 12.3L20 3.5', 'M16.5 7l2.5 2.5', 'M14.5 9l2 2'],
    plus: ['M12 5v14', 'M5 12h14'],
    copier: ['M9 9h11v11H9z', 'M5 15H4V4h11v1'],
    partager: ['M4 12v8h16v-8', 'M12 3v12', 'M7 8l5-5 5 5'],
    message: ['M4 5h16v11H8l-4 4z'],
    recherche: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4'],
    coche: ['M5 12l5 5L20 7'],
    croix: ['M6 6l12 12', 'M18 6L6 18'],
    oeil: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
    crayon: ['M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4'],
    corbeille: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13', 'M10 11v6', 'M14 11v6'],
    photo: ['M4 7h4l2-3h4l2 3h4v13H4z', 'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
    poignee: ['M9 5h.01', 'M15 5h.01', 'M9 12h.01', 'M15 12h.01', 'M9 19h.01', 'M15 19h.01'],
    etoile: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'],
    graphique: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
    equipe: ['M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M2 21v-1a6 6 0 0 1 12 0v1', 'M16 3.5a4 4 0 0 1 0 7', 'M18 14a6 6 0 0 1 4 6v1'],
    personne: ['M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21v-1a8 8 0 0 1 16 0v1'],
    alerte: ['M12 3l10 18H2z', 'M12 10v5', 'M12 18h.01'],
    info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 11v6', 'M12 7h.01'],
    telecharger: ['M12 3v12', 'M7 10l5 5 5-5', 'M4 20h16'],
    externe: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v6H4V6h6'],
    horloge: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 7v5l3 3'],
    bouclier: ['M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z'],
    menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
    boussole: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M15.5 8.5l-2 5-5 2 2-5z'],
    feuille: ['M6 3h9l4 4v14H6z', 'M14 3v5h5', 'M9 13h6', 'M9 17h6'],
    fleur: ['M12 21V11', 'M12 11a4 4 0 0 1-4-4c2 0 4 1.8 4 4z', 'M12 11a4 4 0 0 0 4-4c-2 0-4 1.8-4 4z', 'M8 21h8'],
    euro: ['M17 6a7 7 0 1 0 0 12', 'M4 10h9', 'M4 14h9'],
    rafraichir: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 5v6h-6'],
  };

  function icone(nom, classe) {
    var s = document.createElementNS(SVG, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.8');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    if (classe) s.setAttribute('class', classe);
    (ICONES[nom] || []).forEach(function (d) {
      var p = document.createElementNS(SVG, 'path');
      p.setAttribute('d', d);
      s.appendChild(p);
    });
    return s;
  }

  // Création d'élément : h('div', {class: 'x', onclick: fn}, 'texte', autreElement, [liste])
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; });
        else if (k in el && k !== 'list' && k !== 'form' && typeof v !== 'string') el[k] = v;
        else el.setAttribute(k, v === true ? '' : String(v));
      });
    }
    for (var i = 2; i < arguments.length; i++) ajouter(el, arguments[i]);
    return el;
  }
  function ajouter(el, enfant) {
    if (enfant === null || enfant === undefined || enfant === false) return;
    if (Array.isArray(enfant)) { enfant.forEach(function (e) { ajouter(el, e); }); return; }
    if (typeof enfant === 'string' || typeof enfant === 'number') el.appendChild(document.createTextNode(String(enfant)));
    else el.appendChild(enfant);
  }
  function vider(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function flute(surFond) {
    var f = h('span', { class: 'flute' + (surFond ? ' on-dark' : ''), 'aria-hidden': 'true' });
    for (var i = 0; i < 5; i++) f.appendChild(document.createElement('i'));
    return f;
  }
  function eyebrow(texte, surFond) {
    return h('p', { class: 'eyebrow' + (surFond ? ' on-dark' : '') }, flute(surFond), texte);
  }

  // ---------- Appels à l'API ----------
  function ErreurApi(statut, corps) {
    this.statut = statut;
    this.code = (corps && corps.erreur) || 'reseau';
    this.message = (corps && corps.message) || 'Connexion impossible. Vérifiez votre réseau et réessayez.';
    this.corps = corps || {};
  }
  function api(chemin, options) {
    options = options || {};
    var init = { method: options.method || 'GET', headers: {}, credentials: 'same-origin' };
    if (options.corps !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.corps);
    } else if (options.binaire) {
      init.headers['Content-Type'] = 'application/octet-stream';
      init.body = options.binaire;
      Object.keys(options.entetes || {}).forEach(function (k) { init.headers[k] = options.entetes[k]; });
    }
    if (options.keepalive) init.keepalive = true;
    return fetch(chemin, init).then(function (r) {
      if (r.status === 204) return null;
      return r.text().then(function (t) {
        var corps = null;
        try { corps = t ? JSON.parse(t) : null; } catch (e) { corps = null; }
        if (!r.ok) throw new ErreurApi(r.status, corps);
        return corps;
      });
    }, function () { throw new ErreurApi(0, null); });
  }

  // ---------- Formats ----------
  var nfPrix = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  var nfNombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
  function prix(n) { return n === null || n === undefined ? '' : nfPrix.format(n); }
  function nombre(n) { return n === null || n === undefined ? '' : nfNombre.format(n); }
  function surface(n) { return n === null || n === undefined ? '' : nfNombre.format(n) + ' m²'; }
  function hectares(m2) {
    if (m2 === null || m2 === undefined) return '';
    if (m2 >= 10000) return nfNombre.format(Math.round(m2 / 100) / 100) + ' ha';
    return nfNombre.format(m2) + ' m²';
  }
  var optsDate = { timeZone: 'Europe/Paris' };
  function date(iso, long) {
    if (!iso) return '';
    var t = new Date(iso).toLocaleDateString('fr-FR', Object.assign({ day: 'numeric', month: long ? 'long' : 'short', year: 'numeric' }, optsDate));
    return t.replace(/^1 /, '1er ');
  }
  function dateHeure(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('fr-FR', Object.assign({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }, optsDate));
  }
  function ilYa(iso) {
    if (!iso) return '';
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return "à l'instant";
    if (s < 3600) return 'il y a ' + Math.floor(s / 60) + ' min';
    if (s < 86400) return 'il y a ' + Math.floor(s / 3600) + ' h';
    var j = Math.floor(s / 86400);
    if (j < 2) return 'hier';
    if (j < 30) return 'il y a ' + j + ' jours';
    return 'le ' + date(iso);
  }
  function etage(n) {
    if (n === null || n === undefined) return '';
    if (n === 0) return 'Rez-de-chaussée';
    if (n < 0) return 'Sous-sol';
    return n === 1 ? '1er étage' : n + 'ᵉ étage';
  }
  function civilite(c, nom) {
    var t = c === 'monsieur' ? 'M. ' : c === 'madame' ? 'Mme ' : '';
    return t + (nom || '');
  }
  function pluriel(n, un, plusieurs) { return n + ' ' + (n > 1 ? plusieurs : un); }

  // ---------- Notifications ----------
  function toast(texte, type) {
    var zone = document.querySelector('.toasts');
    if (!zone) { zone = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(zone); }
    var t = h('div', { class: 'toast' + (type === 'erreur' ? ' toast--erreur' : '') }, texte);
    zone.appendChild(t);
    setTimeout(function () { t.remove(); }, type === 'erreur' ? 6000 : 3500);
  }

  function message(type, texte) {
    return h('div', { class: 'message message--' + type, role: type === 'erreur' ? 'alert' : 'status' },
      icone(type === 'erreur' ? 'alerte' : type === 'succes' ? 'coche' : 'info'), h('span', null, texte));
  }

  // ---------- Couleurs réglementaires DPE ----------
  function pastilleDpe(classe, ges) {
    var R = window.REFERENTIEL;
    var couleur = (ges ? R.couleursGes : R.couleursDpe)[classe];
    var clair = !ges && ['C', 'D', 'E'].indexOf(classe) >= 0 || (ges && ['A', 'B'].indexOf(classe) >= 0);
    var p = h('span', { class: 'pastille-dpe' + (clair ? ' clair' : ''), title: (ges ? 'Classe climat ' : 'Classe énergie ') + classe }, classe);
    p.style.background = couleur;
    return p;
  }

  // ---------- En-tête : ombre au défilement ----------
  function initEntete() {
    var header = document.querySelector('.site-header');
    if (header) {
      var maj = function () { header.classList.toggle('is-stuck', window.scrollY > 12); };
      window.addEventListener('scroll', maj, { passive: true });
      maj();
    }
    var an = document.getElementById('annee');
    if (an) an.textContent = String(new Date().getFullYear());
  }

  // ---------- Apparitions au défilement ----------
  var observateur = null;
  function reveler(racine) {
    var els = (racine || document).querySelectorAll('.reveal:not(.is-in)');
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('is-in'); }); return; }
    if (!observateur) {
      observateur = new IntersectionObserver(function (entrees) {
        entrees.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('is-in'); observateur.unobserve(e.target); }
        });
      }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    }
    els.forEach(function (e) { observateur.observe(e); });
  }

  // Bandeau « maquette de démonstration » quand le site tourne en local avec des données fictives.
  function bandeauDemo(actif) {
    if (!actif || document.querySelector('.bandeau-demo')) return;
    var b = h('div', { class: 'bandeau-demo' }, 'Maquette de démonstration : biens, personnes et photos fictifs.');
    document.body.insertBefore(b, document.body.firstChild);
  }

  window.P = {
    h: h, vider: vider, icone: icone, flute: flute, eyebrow: eyebrow, api: api, ErreurApi: ErreurApi,
    prix: prix, nombre: nombre, surface: surface, hectares: hectares, date: date, dateHeure: dateHeure, ilYa: ilYa,
    etage: etage, civilite: civilite, pluriel: pluriel, toast: toast, message: message, pastilleDpe: pastilleDpe,
    initEntete: initEntete, reveler: reveler, bandeauDemo: bandeauDemo,
  };

  document.addEventListener('DOMContentLoaded', initEntete);
})();
