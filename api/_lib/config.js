'use strict';
// Réglages de l'espace transaction. Ils changent rarement : les modifier ici puis redéployer.

module.exports = {
  // Interlocutrice affichée sur chaque fiche de bien.
  // ⚠ Adresse e-mail en @arsenalroyal.com fournie telle quelle par Laetitia : à faire valider.
  contact: {
    nom: 'Catherine Badet',
    role: 'Transaction immobilière',
    // Mention légale d'un agent commercial (réunion du 28/10/2026) : sa qualité et son immatriculation au
    // registre spécial des agents commerciaux (RSAC) s'affichent sous son nom, sur chaque fiche.
    // ⚠ Numéro à fournir par Catherine : tant qu'il manque, l'accueil de l'espace de gestion le rappelle.
    qualite: 'Agent commercial',
    rsac: { greffe: '', numero: '' },   // ex. { greffe: 'La Rochelle', numero: '123 456 789' }
    tel: '06 72 48 13 19',
    telLien: '+33672481319',
    email: 'catherine.badet@arsenalroyal.com',
    photo: '/assets/personne-catherine.jpg',
  },

  // Codes d'accès
  dureesCodeMois: [1, 3, 6, 12],
  dureeCodeMoisDefaut: 3,

  // Sessions (en jours). La base reste seule juge de l'expiration réelle d'un code.
  sessionVisiteurJours: 30,
  sessionAdminJours: 14,

  // Freins aux essais répétés (en plus du pare-feu Vercel, qui reste la protection principale)
  echecsMaxVisiteur: 8,
  echecsMaxAdmin: 5,
  fenetreEchecsMinutes: 15,

  // Annonces
  vendusVisiblesJours: 60,
  maxPhotosParAnnonce: 40,

  // Durées de conservation (RGPD)
  corbeilleJours: 30,
  consultationsMois: 12,
  tentativesJours: 30,
  anonymisationAnnees: 3,
  brouillonsVidesJours: 7,
};
