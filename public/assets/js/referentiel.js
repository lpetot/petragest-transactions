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
      // Équipements ajoutés après la réunion du 28/10/2026 (Catherine : « cases à cocher, cheminée, etc. »)
      ['cuisine_equipee', 'Cuisine équipée'],
      ['dressing', 'Dressing'],
      ['buanderie', 'Buanderie'],
      ['veranda', 'Véranda'],
      ['poutres', 'Poutres apparentes'],
      ['pierres', 'Pierres apparentes'],
      ['stationnement', 'Place de stationnement'],
      ['climatisation', 'Climatisation'],
      ['fibre', 'Fibre optique'],
      ['digicode', 'Interphone ou digicode'],
    ],
    // Tournure de chaque atout dans la phrase écrite par « Écrire la phrase des atouts » (espace de gestion).
    phrasesAtouts: {
      parc: 'un parc', jardin: 'un jardin', piscine: 'une piscine', terrasse: 'une terrasse', balcon: 'un balcon',
      dependances: 'des dépendances', garage: 'un garage', cave: 'une cave', grenier: 'un grenier',
      cheminee: 'une cheminée', parquet: 'du parquet ancien', moulures: 'des moulures et décors',
      hauteur_plafond: 'une belle hauteur sous plafond', vue_mer: 'une vue sur la mer', vue_degagee: 'une vue dégagée',
      calme: 'un environnement calme', centre_ville: 'une situation en centre-ville', commerces: 'la proximité des commerces',
      gardien: 'un gardien', double_vitrage: 'le double vitrage', cuisine_equipee: 'une cuisine équipée',
      dressing: 'un dressing', buanderie: 'une buanderie', veranda: 'une véranda', poutres: 'des poutres apparentes',
      pierres: 'des pierres apparentes', stationnement: 'une place de stationnement', climatisation: 'la climatisation',
      fibre: 'la fibre optique', digicode: 'un interphone ou un digicode',
    },
    // Barème de vente publié par Petra Gest (page Honoraires, 22/10/2026) : maisons et appartements,
    // honoraires TTC à la charge de l'acquéreur, en % du prix net vendeur. Sert au calcul proposé dans l'éditeur.
    baremeVente: [
      [6, 'Mandat simple'],
      [5, 'Mandat exclusif'],
    ],
    // ---------- Fiche technique (lot 3) ----------
    // Calée sur les deux modèles transmis par Catherine le 29/10/2026 (fiche technique de rentrée et fiche
    // découverte d'un bien). Rien de ceci n'apparaît sur l'annonce publique : seulement dans les documents
    // imprimés depuis l'espace de gestion.
    // Pièces : [code, libellé, compte dans la surface habitable, groupe de détails]. Ne comptent pas :
    // combles non aménagés, caves, garages, balcons, terrasses, vérandas (article R156-1 du code de la construction).
    pieces: [
      ['entree', 'Entrée', true, ''],
      ['sejour', 'Séjour', true, ''],
      ['salon', 'Salon', true, ''],
      ['salle_manger', 'Salle à manger', true, ''],
      ['cuisine', 'Cuisine', true, 'cuisine'],
      ['chambre', 'Chambre', true, ''],
      ['bureau', 'Bureau', true, ''],
      ['salle_bains', 'Salle de bains', true, 'eau'],
      ['salle_eau', "Salle d'eau", true, 'eau'],
      ['wc', 'WC', true, 'wc'],
      ['dressing', 'Dressing', true, ''],
      ['buanderie', 'Buanderie', true, ''],
      ['cellier', 'Cellier', true, ''],
      ['degagement', 'Dégagement', true, ''],
      ['mezzanine', 'Mezzanine', true, ''],
      ['veranda', 'Véranda', false, ''],
      ['combles', 'Combles ou grenier', false, ''],
      ['cave', 'Cave', false, 'annexe'],
      ['garage', 'Garage', false, 'annexe'],
      ['balcon', 'Balcon', false, 'exterieur'],
      ['terrasse', 'Terrasse', false, 'exterieur'],
      ['jardin', 'Jardin', false, 'exterieur'],
      ['autre', 'Autre pièce', true, ''],
    ],
    niveaux: [
      ['sous_sol', 'Sous-sol'],
      ['rdc', 'Rez-de-chaussée'],
      ['n1', '1er étage'],
      ['n2', '2ᵉ étage'],
      ['n3', '3ᵉ étage'],
      ['combles', 'Combles'],
    ],
    orientations: [['N', 'Nord'], ['S', 'Sud'], ['E', 'Est'], ['O', 'Ouest']],
    sols: [
      ['parquet', 'Parquet'],
      ['carrelage', 'Carrelage'],
      ['tomettes', 'Tomettes'],
      ['pierre', 'Pierre'],
      ['marbre', 'Marbre'],
      ['beton_cire', 'Béton ciré'],
      ['stratifie', 'Stratifié'],
      ['vinyle', 'Sol vinyle'],
      ['moquette', 'Moquette'],
      ['jonc', 'Jonc de mer'],
      ['autre', 'Autre revêtement'],
    ],
    // Cases proposées pour chaque pièce : les « communes » partout sauf à l'extérieur, puis celles de son groupe.
    detailsPieces: {
      commun: [
        ['double_vitrage', 'Double vitrage'], ['cheminee', 'Cheminée'], ['placards', 'Placards'], ['moulures', 'Moulures'],
        ['poutres', 'Poutres apparentes'], ['hauteur', 'Belle hauteur sous plafond'], ['volets', 'Volets'],
        ['climatisation', 'Climatisation'], ['vue', 'Belle vue'],
      ],
      cuisine: [
        ['separee', 'Séparée'], ['ouverte', 'Ouverte sur le séjour'], ['coin', 'Coin cuisine'], ['amenagee', 'Aménagée'],
        ['equipee', 'Équipée'], ['ilot', 'Îlot central'], ['hotte', 'Hotte'],
      ],
      eau: [
        ['baignoire', 'Baignoire'], ['douche', 'Douche'], ['italienne', "Douche à l'italienne"],
        ['double_vasque', 'Double vasque'], ['avec_wc', 'WC'], ['seche_serviettes', 'Sèche-serviettes'],
      ],
      wc: [['independant', 'Indépendant'], ['lave_mains', 'Lave-mains']],
      annexe: [['electricite', 'Électricité'], ['eau', 'Point d\'eau'], ['porte_auto', 'Porte motorisée']],
      exterieur: [['clos', 'Clos'], ['arbore', 'Arboré'], ['sans_vis_a_vis', 'Sans vis-à-vis'], ['abrite', 'Abrité']],
    },
    mitoyennetes: [
      ['independant', 'Indépendant'],
      ['un_cote', "Mitoyen d'un côté"],
      ['deux_cotes', 'Mitoyen des deux côtés'],
    ],
    vitrages: [['simple', 'Simple vitrage'], ['double', 'Double vitrage'], ['triple', 'Triple vitrage'], ['mixte', 'Vitrages différents selon les pièces']],
    menuiseries: [['bois', 'Bois'], ['pvc', 'PVC'], ['alu', 'Aluminium'], ['mixte', 'Matériaux différents']],
    assainissements: [['tout_egout', "Tout-à-l'égout"], ['fosse', 'Fosse septique'], ['micro_station', 'Micro-station']],
    // Équipements techniques de la fiche : en plus des atouts de l'annonce (rien en double).
    equipementsFiche: [
      ['interphone', 'Interphone'], ['alarme', 'Alarme'], ['volets_roulants', 'Volets roulants électriques'],
      ['portail', 'Portail motorisé'], ['vmc', 'VMC'], ['adoucisseur', "Adoucisseur d'eau"],
      ['antenne', 'Antenne TV ou câble'], ['arrosage', 'Arrosage automatique'], ['puits', 'Puits'],
      ['recuperateur', "Récupérateur d'eau de pluie"], ['solaire', 'Panneaux solaires'], ['borne', 'Borne de recharge'],
      ['abri', 'Abri de jardin'], ['potager', 'Potager'],
    ],
    typesMandat: [['simple', 'Mandat simple'], ['exclusif', 'Mandat exclusif']],
    typesBail: [
      ['vide', "Location vide (bail d'habitation)"],
      ['meuble', 'Location meublée'],
      ['commercial', 'Bail commercial'],
      ['professionnel', 'Bail professionnel'],
      ['saisonnier', 'Location saisonnière'],
      ['autre', 'Autre'],
    ],
    syndics: [['professionnel', 'Syndic professionnel'], ['benevole', 'Syndic bénévole']],
    // Définition d'un type de pièce : [code, libellé, habitable, groupe], ou null.
    pieceDe: function (code) {
      for (var i = 0; i < this.pieces.length; i++) if (this.pieces[i][0] === code) return this.pieces[i];
      return null;
    },
    // Cases proposées pour un type de pièce (les communes ne valent pas pour l'extérieur, la cave ou le garage).
    detailsPour: function (code) {
      var p = this.pieceDe(code);
      var groupe = p ? p[3] : '';
      var communes = groupe === 'exterieur' || groupe === 'annexe' ? [] : this.detailsPieces.commun;
      return communes.concat(this.detailsPieces[groupe] || []);
    },
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
