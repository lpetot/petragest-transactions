/* Page d'entrée : saisie du code d'accès. */
(function () {
  'use strict';
  var P = window.P;
  var ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  var champ = document.getElementById('code');
  var form = document.getElementById('formCode');
  var bouton = document.getElementById('boutonCode');
  var retour = document.getElementById('retour');

  // Destination après connexion : liste blanche stricte (jamais une adresse arbitraire).
  function destination() {
    var suite = new URLSearchParams(location.search).get('suite') || '';
    if (/^\/biens$/.test(suite) || /^\/bien\?id=[a-z0-9]{10}$/.test(suite)) return suite;
    return '/biens';
  }

  function nettoyer(v) {
    var s = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    var out = '';
    for (var i = 0; i < s.length && out.length < 12; i++) if (ALPHABET.indexOf(s[i]) >= 0) out += s[i];
    return out;
  }
  function formater(brut) { return brut.replace(/(.{4})(?=.)/g, '$1-'); }

  function afficher(type, texte) {
    P.vider(retour);
    if (texte) retour.appendChild(P.message(type, texte));
  }

  champ.addEventListener('input', function () {
    var brut = nettoyer(champ.value);
    champ.value = formater(brut);
    if (retour.firstChild && retour.firstChild.classList.contains('message--erreur')) afficher();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var brut = nettoyer(champ.value);
    if (brut.length !== 12) {
      afficher('erreur', 'Le code comporte 12 caractères, par exemple K7QM-4TZP-9HWD.');
      champ.focus();
      return;
    }
    bouton.classList.add('is-busy');
    P.api('/api/acces', { method: 'POST', corps: { code: brut } }).then(function () {
      location.replace(destination());
    }).catch(function (err) {
      bouton.classList.remove('is-busy');
      afficher('erreur', err.message);
      champ.focus();
      champ.select();
    });
  });

  // Code transmis dans le lien (#K7QM-4TZP-9HWD) : on préremplit, on efface l'adresse,
  // mais on attend un clic : les antivirus de messagerie qui ouvrent les liens ne comptent pas.
  var fragment = decodeURIComponent((location.hash || '').slice(1));
  if (fragment) {
    var brut = nettoyer(fragment);
    if (brut.length === 12) {
      champ.value = formater(brut);
      afficher('info', 'Votre code a été prérempli. Cliquez sur « Accéder aux biens ».');
    }
    history.replaceState(null, '', location.pathname + location.search);
  }

  var raison = new URLSearchParams(location.search).get('raison');
  var messages = {
    fin: 'Votre accès a pris fin. Saisissez de nouveau votre code pour continuer.',
    revoque: "Votre code n'est plus actif. Contactez-nous pour obtenir un nouvel accès.",
    expire: 'Votre code a expiré. Contactez-nous pour le prolonger.',
    deconnexion: 'Vous êtes déconnecté. À bientôt.',
  };
  if (raison && messages[raison] && !fragment) afficher(raison === 'deconnexion' ? 'succes' : 'info', messages[raison]);

  // Déjà connecté ? Direction le catalogue.
  P.api('/api/acces').then(function (etat) {
    P.bandeauDemo(etat && etat.demo);
    if (etat && etat.connecte && !fragment) location.replace(destination());
  }).catch(function () { /* hors ligne : la page reste utilisable */ });

  if (!fragment) champ.focus({ preventScroll: true });
  else bouton.focus({ preventScroll: true });
})();
