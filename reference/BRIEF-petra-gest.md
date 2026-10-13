# BRIEF — PETRA GEST

> Créé le **21/09/2026** au démarrage de la **refonte du site petragest.com**.
> Sources : le site existant (https://petragest.com — WordPress, Georgia/gris, à moderniser)
> Logo de référence : **`PETRA GEST RVB.jpg`** (version RVB, indiquée par Laetitia le 21/09/2026).
> ⚠️ **Marque distincte de Petra Immo.** Même famille (« Petra »), mais identité propre :
> Petra Gest = **bleu RVB `#001B5C` + sable, Georgia (titres) + Nunito Sans (texte)**.
> Petra Immo = **vert sapin, Cinzel + Montserrat**. Ni les couleurs ni les polices ne se mélangent.

| Élément | Valeur |
|---|---|
| **Nom de la marque** | PETRA GEST (PETRA GEST SAS) |
| **Métier** | Syndic de copropriété · Gestion locative · Transaction immobilière — sur des biens inscrits, classés ou à fort caractère patrimonial, partout en France |
| **Accroche de la page d'accueil** | Titre « L'expertise patrimoniale alliée à l'innovation. » + sous-titre « Une gestion intégrée, transparente et durable des biens inscrits et classés : syndic de copropriété, gestion locative et transaction. » **Phrase d'origine fournie par Laetitia**, découpée en deux à sa demande. |
| **Ton — interdit** | **Aucune pique contre les confrères.** Pas de « syndic généraliste », pas d'« agence classique ». On dit ce qu'on fait, jamais ce que les autres ne font pas. |
| **Positionnement en une ligne** | « **Spécialiste du patrimoine immobilier d'exception** » — arbitré avec Laetitia le 21/09/2026. ⚠️ **Ne jamais réduire Petra Gest au « syndic de copropriété »** dans un slider, une accroche ou un pied de page : c'est un métier sur trois. Le mot « syndic » reste légitime là où on énumère les prestations, et dans le `<title>` pour le référencement. |
| **Fondatrice** | Jessica Lauthier |
| **Signature produit** | « **Patrimoine 360°** » (la solution intégrée maison) |
| **Positionnement** | Expertise patrimoniale + innovation. Gestion intégrée, transparente, durable. Sérieux institutionnel, pas « luxe » (≠ Petra Immo). |
| **Zone** | Siège à Rochefort (17), intervention **nationale** |
| **Couleur primaire** | **Bleu `#001B5C`** — relevé au pixel sur le logo RVB. C'est LA couleur de la marque. |
| **Couleur secondaire** | **Sable `#E6CDB7`** — la couleur du dessin dans le logo. |
| **Typo titre** | **Georgia** (police système). **Validée par Laetitia le 21/09/2026.** Akshar, la police du logotype, a été essayée puis écartée : trop condensée pour la cible haut de gamme. |
| **Typo texte** | **Nunito Sans** (Google Fonts) — la version non arrondie de Nunito, l'autre police de la marque. Sobre et lisible en petit corps. |
| **Ton** | Institutionnel, rassurant, précis. On parle à des copropriétaires et à des institutions (DRAC, ABF), pas à des acheteurs de luxe. |

## 🎨 Palette — relevée au pixel sur `PETRA GEST RVB.jpg` (18/09/2026)
```
--navy:#001B5C        /* primaire — LA couleur du logo (RVB, franche) */
--navy-deep:#00113C   /* fonds sombres, héros, pied de page */
--navy-soft:#0A2A7A   /* survols */
--navy-line:rgba(0,27,92,.12)
--sand:#E6CDB7        /* secondaire — la couleur du dessin dans le logo */
--sand-deep:#B9945F   /* version foncée, lisible sur fond clair (filets, surtitres) */
--sand-soft:#F3E6D8
--paper:#FAF7F3       /* fond clair chaud */
--paper-2:#F1E9E0
--ink:#141B33 · --slate:#5C6580 · --white:#FFFFFF
```
> ⚠️ **Le bleu est en RVB, donc franc et lumineux** (`#001B5C`), pas le bleu grisé de l'ancien
> fichier CMJN (`#212B51`, archivé). Ne pas revenir en arrière.
> Le **sable** sert aux filets, surtitres, boutons secondaires et au motif cannelé —
> **jamais en aplat large**. Sur fond clair, utiliser `--sand-deep` (contraste).

## 🖼️ Logos (dans `exemples\`)
> **Source officielle, indiquée par Laetitia le 21/09/2026** :
> Dossier `LOGOS` de la crea graphique : MAVEX > "Site de communication - Documents" > "VENTE & MARKETING" > "MAV VENTES ET MARKETING" > "02-LAETITIA" > "02- CREA GRAPHIQUES" > "LOGOS". Fichier **`PETRA GEST RVB.jpg`** (et son `.ai`).
> Le logo RVB **n'a plus de baseline** « Syndic de Copropriété » : emblème + « PETRA GEST ».

| Fichier | Usage |
|---|---|
| `PETRA GEST RVB.jpg` | **Source** (1667×1667, fond bleu plein). Jamais modifiée. |
| `pg-logo-navy.png` | Lockup vertical détouré, bleu. Fonds clairs. |
| `pg-logo-sable.png` | Lockup vertical détouré, sable. Fonds bleus. |
| `pg-logo-blanc.png` | Lockup vertical détouré, blanc. |
| `pg-logo-h-navy.png` / `-sable` / `-blanc` | Lockup **horizontal** remonté par moi. ⛔ **Écarté par Laetitia le 21/09/2026** : on garde le logo tel quel. Conservé seulement au cas où un support très large l'exigerait. |
| **`pg-logo-carre.png`** | **Le carré d'origine, couleurs comprises** (fond bleu, dessin sable), 600×600, recadré dans le JPEG source. **C'est lui qui va dans la barre de menu du site**, demandé par Laetitia le 21/09/2026. |
| `pg-embleme-navy.png` / `pg-embleme-sable.png` | Emblème seul (favicon, ornements). |

> ✅ **Règle tranchée le 21/09/2026 : le logo se pose TEL QUEL, en lockup vertical.**
> Pas de remontage, pas de recomposition. Conséquence sur le site : la barre de menu est haute
> (`--head-h:118px`, logo 82 px — 92/62 px sur mobile) pour que « PETRA GEST » reste lisible
> sous l'emblème. Pied de page : même lockup en sable, 104 px.

> ⚠️ **À faire valider** : ces déclinaisons sont **dérivées** du JPEG fourni (détourage,
> recoloration, remontage horizontal). Ce ne sont pas des exports du graphiste. Le lockup
> horizontal en particulier est un **remontage** : le logo officiel est vertical. S'il existe
> un export horizontal officiel, on le remplace.
>
> Les déclinaisons de l'ancien logo CMJN sont dans `exemples\Archive\`.

## 🏠 Page d'accueil — sections voulues par Laetitia (21/09/2026)
```
Slider (une seule vue) · Bandeau repères · Nos prestations · Nos valeurs · Nos points forts · Contact
```
> Le **bandeau repères** (Toute la France · ABF et DRAC · Trois métiers) est sorti du slider :
> bande blanche à part, **trois blocs encadrés**, une icône par repère.
> **Valeurs : quatre blocs encadrés** (Respect du bâti, Franchise, Temps long, Écoute).
> **Points forts : trois blocs**, repris du site en ligne. ⚠️ valeurs = ce que la maison EST,
> points forts = ce qu'elle A. Ne jamais laisser les deux se répéter.
> **Contact : formulaire à droite**, coordonnées à gauche. Formulaire non branché.
>
> ⛔ **Deux règles de Laetitia posées le 21/09/2026** : aucun **tiret long** (— ou –) dans les
> textes, ça fait IA ; et **jamais de texte collé à un filet**, on encadre et on met du padding.

## 🧭 Arborescence du NOUVEAU site (demandée par Laetitia le 21/09/2026)
```
Qui sommes-nous ?
Prestations ▾
   ├─ Syndic de copropriété
   ├─ Gestion locative
   └─ Transaction immobilière
Réalisations
Actualité
Contact
[Accès copropriétaire]   → https://copro.vilogi.com/   (déjà en ligne sur l'ancien site)
[Accès transaction]      → à fournir
```
Pages disparues / nouvelles par rapport à l'ancien site : « Accueil » reste (le logo y renvoie),
**« Qui sommes-nous ? » et « Actualité » sont à créer** (contenu à fournir), et **« Gestion
locative » n'existe nulle part sur l'ancien site** (contenu à écrire).

## 📞 Coordonnées
- Accueil général : **05 64 72 07 81**
- **Syndic de copropriété** : Carla de Bourtsoff, 06 72 48 20 08, syndic@petragest.com
- **Gestion locative ET transaction** : Catherine Badet, 06 72 48 13 19,
  catherine.badet@arsenalroyal.com (⚠️ adresse en @arsenalroyal.com, fournie telle quelle
  par Laetitia le 22/09/2026)
- **10 rue Bazeilles – F003 – 17300 Rochefort** — sur rendez-vous uniquement
- Du lundi au vendredi : 9h–12h30 et 13h30–17h
- E-mail : ? (absent du site actuel → à fournir)

## ✅ À faire
- Identité **100 % Petra Gest** : bleu #001B5C dominant, accent sable, **Georgia + Nunito Sans**.
- Reprendre la **grammaire de mise en page** du site Petra Immo (structure, respiration, filets
  ornementaux, reveals au scroll, menus déroulants) — **mais ni ses couleurs, ni ses logos,
  ni ses polices**. Laetitia a tranché le 21/09/2026 : Petra Gest a sa propre typographie.
- Stack maison : **un seul fichier HTML par page**, CSS + JS vanilla, **zéro dépendance**,
  Google Fonts pour Nunito Sans, Georgia est une police système. `prefers-reduced-motion`, responsive.
- **Aucune image en base64** : fichiers séparés dans `petra-gest-assets\`.
- Liens externes en `target="_blank" rel="noopener noreferrer"`.

## 🚫 À éviter
- Le vert et le **Cinzel/Montserrat** de Petra Immo, le navy+or de l'Arsenal Royal.
  Chaque marque reste chez elle.
- Georgia / le gris du site actuel : c'est précisément ce qu'on modernise.
- Esthétique « IA générique » (dégradés violets, emojis décoratifs, mise en page molle).
- Redessiner le logo.

## ⏳ En attente (Laetitia fournira)
- **Photos** : les trois cartes prestations sont illustrées (21/09/2026). Source des visuels :
  dossier « PETRA GEST > REFONTE SITE INTERNET » de la créa graphique ; recadrages dans
  `exemples\photos\`. Manquent encore : héros, points forts, pages intérieures.
- **Vérifier les crédits photo** avant mise en ligne (Unsplash : rien à faire ; banques
  d'images type Freepik : mention possible selon la licence).
- **Valider les textes « valeurs » et « points forts »** (rédigés ou réécrits par moi).
- **Brancher le formulaire de contact** de la page d'accueil.
- Contenu « Qui sommes-nous ? », « Actualité », « Gestion locative ».
- URL de l'**Accès transaction**, e-mail de contact, liens réseaux sociaux.
- Les vraies réalisations (les 3 du site actuel — Paris 5ᵉ, Avignon, Lille — sont sans photo).

---
*Une créa cliente utilise l'identité DU client, jamais le style MAVEX — sauf demande explicite.*
