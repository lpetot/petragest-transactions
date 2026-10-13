/*
  Référentiel partagé entre le navigateur et le serveur : listes fermées et libellés.
  Une seule source : le serveur l'importe (validation), les pages l'affichent (libellés).
*/
(function (racine, fabrique) {
  'use strict';
  var r = fabrique();
  if (typeof module === 'object' && module.exports) module.exports = r;
  else racine.REFERENTIEL = r;
})(this, function () {
  'use strict';
  return {
    typesBien: [
      ['maison', 'Maison'],
      ['appartement', 'Appartement'],
      ['demeure', 'Demeure de caractère'],
      ['chateau', 'Château'],
      ['hotel_particulier', 'Hôtel particulier'],
      ['immeuble', 'Immeuble'],
      ['terrain', 'Terrain'],
      ['local', 'Local professionnel'],
      ['autre', 'Autre bien'],
    ],
    statuts: [
      ['brouillon', 'Brouillon'],
      ['publiee', 'En ligne'],
      ['sous_offre', 'Sous offre'],
      ['vendue', 'Vendu'],
      ['archivee', 'Archivée'],
    ],
    atouts: [
      ['parc', 'Parc'],
      ['jardin', 'Jardin'],
      ['piscine', 'Piscine'],
      ['terrasse', 'Terrasse'],
      ['balcon', 'Balcon'],
      ['dependances', 'Dépendances'],
      ['garage', 'Garage'],
      ['cave', 'Cave'],
      ['grenier', 'Grenier'],
      ['cheminee', 'Cheminée'],
      ['parquet', 'Parquet ancien'],
      ['moulures', 'Moulures et décors'],
      ['hauteur_plafond', 'Belle hauteur sous plafond'],
      ['vue_mer', 'Vue mer'],
      ['vue_degagee', 'Vue dégagée'],
      ['calme', 'Environnement calme'],
      ['centre_ville', 'Centre-ville'],
      ['commerces', 'Proche commerces'],
      ['gardien', 'Gardien'],
      ['double_vitrage', 'Double vitrage'],
    ],
    protections: [
      ['aucune', 'Aucune protection'],
      ['inscrit_mh', 'Inscrit aux monuments historiques'],
      ['classe_mh', 'Classé monument historique'],
      ['spr', 'Site patrimonial remarquable'],
      ['label_fdp', 'Label Fondation du patrimoine'],
    ],
    epoques: [
      ['medievale', 'Époque médiévale'],
      ['renaissance', 'Renaissance'],
      ['xviie', 'XVIIᵉ siècle'],
      ['xviiie', 'XVIIIᵉ siècle'],
      ['xixe', 'XIXᵉ siècle'],
      ['debut_xxe', 'Début du XXᵉ siècle'],
      ['entre_deux_guerres', 'Entre-deux-guerres'],
      ['apres_guerre', 'Après-guerre'],
      ['contemporaine', 'Contemporaine'],
    ],
    etats: [
      ['a_renover', 'À rénover'],
      ['a_rafraichir', 'À rafraîchir'],
      ['bon_etat', 'Bon état'],
      ['renove', 'Rénové'],
      ['neuf', 'Neuf'],
    ],
    expositions: [
      ['nord', 'Nord'], ['nord_est', 'Nord-est'], ['est', 'Est'], ['sud_est', 'Sud-est'],
      ['sud', 'Sud'], ['sud_ouest', 'Sud-ouest'], ['ouest', 'Ouest'], ['nord_ouest', 'Nord-ouest'],
      ['traversant', 'Traversant'],
    ],
    chauffageTypes: [
      ['individuel', 'Individuel'],
      ['collectif', 'Collectif'],
      ['aucun', 'Sans chauffage'],
    ],
    chauffageEnergies: [
      ['gaz', 'Gaz'],
      ['electricite', 'Électricité'],
      ['pompe_chaleur', 'Pompe à chaleur'],
      ['fioul', 'Fioul'],
      ['bois', 'Bois ou granulés'],
      ['reseau', 'Réseau de chaleur'],
      ['autre', 'Autre'],
    ],
    affichagesAdresse: [
      ['commune', 'Commune seulement'],
      ['zone', 'Zone approximative'],
      ['exacte', 'Adresse exacte'],
    ],
    honorairesCharge: [
      ['vendeur', 'Vendeur'],
      ['acquereur', 'Acquéreur'],
    ],
    dpeStatuts: [
      ['realise', 'DPE réalisé'],
      ['vierge', 'DPE vierge (consommations non disponibles)'],
      ['non_soumis', 'Non soumis au DPE'],
    ],
    classesDpe: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    // Couleurs réglementaires des étiquettes (arrêté du 31 mars 2021) : exception à la charte.
    couleursDpe: { A: '#009C6D', B: '#52B153', C: '#A5CC74', D: '#F4E70F', E: '#F0B40F', F: '#EB8235', G: '#D7221F' },
    couleursGes: { A: '#A4DBF8', B: '#8CB4D3', C: '#7792B1', D: '#606F8F', E: '#4D5271', F: '#393551', G: '#281B35' },
    // Libellé d'un code dans une liste [[code, libellé]]
    libelle: function (liste, code) {
      for (var i = 0; i < liste.length; i++) if (liste[i][0] === code) return liste[i][1];
      return '';
    },
  };
});
