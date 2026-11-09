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
    // Numéro transmis par Catherine via Matis le 28/10/2026. Vide = l'accueil de l'espace de gestion le réclame.
    qualite: 'Agent commercial',
    rsac: { greffe: 'La Rochelle', numero: '835 372 723' },
    tel: '06 72 48 13 19',
    telLien: '+33672481319',
    email: 'catherine.badet@arsenalroyal.com',
    photo: '/assets/personne-catherine.jpg',
  },

  // Agence : en-tête et pied des documents imprimés (fiche technique, bon de visite...).
  // Reprend la page Mentions légales (public/mentions-legales.html) : les modifier ensemble.
  agence: {
    nom: 'Petra Gest',
    raisonSociale: 'Petragest SAS',
    adresse: '10 rue Bazeilles',
    codePostal: '17300',
    ville: 'Rochefort',
    tel: '05 64 72 07 81',
    email: 'direction@petragest.com',
    site: 'petragest.com',
    carte: 'Carte professionnelle n° CPI 1701 2025 000 000 014',
    garantie: 'Garantie financière : Galian SMA BTP, 120 000 €',
    signature: "Spécialiste du patrimoine immobilier d'exception.",
  },

  // Textes des documents imprimés. {agence}, {mandat} et {email} sont remplacés à l'impression.
  // ⚠ Le texte du bon de visite est un modèle rédigé par MJ Data le 29/10/2026 : à faire valider par Catherine.
  documents: {
    bonDeVisite: [
      "Je reconnais avoir visité ce jour le bien désigné ci-dessus, qui m'a été présenté par {agence}{mandat}.",
      "J'ai été informé(e) du prix demandé et des honoraires de l'agence, dont le barème est consultable sur petragest.com.",
      "Si je décide d'acquérir ce bien, je m'engage à le faire par l'intermédiaire de {agence}, et à ne pas traiter "
        + "directement avec le propriétaire, ni par l'intermédiaire d'un autre professionnel ou d'un tiers.",
    ],
    bonDeVisiteDonnees: "Les informations portées sur ce bon servent uniquement au suivi de votre visite et de la vente "
      + "par {agence}, et ne sont transmises à personne d'autre. Pour les consulter ou les faire effacer : {email}.",
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
  maxPhotosParAnnonce: 40,

  // Durées de conservation (RGPD)
  corbeilleJours: 30,
  consultationsMois: 12,
  tentativesJours: 30,
  anonymisationAnnees: 3,
  brouillonsVidesJours: 7,
};
