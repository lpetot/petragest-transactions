/* Session visiteur commune au catalogue et aux fiches : en-tête nominatif, déconnexion, fin d'accès. */
(function () {
  'use strict';
  var P = window.P;

  // Renvoie vers la saisie du code en gardant la page demandée.
  function versEntree(raison) {
    var suite = location.pathname + location.search;
    var q = new URLSearchParams();
    if (/^\/biens$/.test(suite) || /^\/bien\?id=[a-z0-9]{10}$/.test(suite)) q.set('suite', suite);
    q.set('raison', raison || 'fin');
    location.replace('/?' + q.toString());
  }

  function gererErreur(err) {
    if (err && err.statut === 401) {
      var r = err.corps && err.corps.raison;
      versEntree(r === 'revoque' || r === 'expire' ? r : 'fin');
      return true;
    }
    return false;
  }

  function chargerSession() {
    return P.api('/api/acces').then(function (etat) {
      P.bandeauDemo(etat.demo);
      if (etat.connecte) {
        document.getElementById('enteteNom').textContent = 'Accès de ' + P.civilite(etat.civilite, etat.nom);
        document.getElementById('enteteValidite').textContent = "Valable jusqu'au " + P.date(etat.expire_le, true);
        document.getElementById('enteteUtilisateur').hidden = false;
      }
      return etat;
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var bouton = document.getElementById('deconnexion');
    if (bouton) bouton.addEventListener('click', function () {
      bouton.classList.add('is-busy');
      P.api('/api/acces', { method: 'DELETE' }).catch(function () {}).then(function () {
        location.replace('/?raison=deconnexion');
      });
    });
  });

  P.visiteur = { chargerSession: chargerSession, gererErreur: gererErreur, versEntree: versEntree };
})();
