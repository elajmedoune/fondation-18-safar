// Mise en page du tableau "cotisations" dans les exports PDF (jsPDF
// autoTable),alignée sur le tableau "Membres" (src/pages/membres/
// MembresList.jsx), dont l'en-tête tient sur une seule ligne.
//
// Ce module est importé par l'application ET par scripts/generate-test-pdf.
// mjs : les deux ne peuvent plus diverger, ce qui est arrivé plusieurs fois
// avec des largeurs dupliquées à la main.
//
// Pourquoi ne PAS règler les largeurs colonne par colonne :
// autoTable n'éclate un mot caractère par caractère que si la zone de texte
// d'une colonne est plus étroite qu'un seul caractère. C'est ce qui produisait
// des en-têtes sur 6 lignes. En laissant autoTable répartir la largeur utile
// selon le contenu réel (comme pour "Membres"), chaque colonne fait au moins
// la largeur de son titre : l'en-tête ne peut plus se couper.
//
// Seule la colonne photo est figée : les colonnes 1 à 7 restent en auto, sinon
// une colonne vide (la photo) capturerait la largeur disponible.
//
// Unité : le mm. A4 portrait = 210 mm, marges 10 => 190 mm utiles.

export const MARGE = 10;
export const LARGEUR_PAGE = 210;
export const LARGEUR_UTILE = LARGEUR_PAGE - MARGE * 2; // 190
export const INDEX_PHOTO = 0;

// Diamètre du rond de photo, en mm. Le diamètre réel est
// min(largeur - 2, hauteur de ligne - 2, TAILLE_PHOTO) : il est donc borné par
// la HAUTEUR de ligne. Une photo de 9 mm dans une ligne de 7,2 mm (police 8 pt)
// donnait en réalité 5,2 mm. D'où LARGEUR_PHOTO et HAUTEUR_LIGNE_PHOTO.
//
// 13 mm suffit pour un rond de 8 mm : la largeur n'est pas le facteur limitant.
// Mesuré : à 14 mm les colonnes de texte se resserrent au point de couper
// "Elhadji Medoune Gningue" et "Enregistrer par Medoune Sagna" sur deux lignes
// (10 cellules coupées). À 13 mm : 0 cellule coupée, et le tableau tient sur
// une page au lieu de deux.
export const TAILLE_PHOTO = 8;
export const LARGEUR_PHOTO = 13;
export const HAUTEUR_LIGNE_PHOTO = 10;

// Palette identique à celle du tableau "Membres" (#0F766E).
export const VERT = [15, 118, 110];
export const BLANC = 255;
export const RAYONNE = [240, 253, 250];

// 7 pt est la valeur d'origine, calquée sur le tableau "Membres". 8 pt est
// plus confortable à la lecture ; l'en-tête hérite de cette valeur via
// styles.fontSize, donc les titres grossissent avec le corps.
export const POLICE = 8;
export const PADDING = 2;

// Titre de la colonne photo laissé vide : la cellule reste peinte, la bande
// verte reste continue, et aucun mot n'a à tenir dans 11 mm.
export const TITRE_PHOTO = '';

/**
 * Construit l'en-tête du tableau.
 *
 * Le double crochets est OBLIGATOIRE : autoTable attend une liste de LIGNES.
 * Un tableau plat ["#", "Membre", ...] est interprété comme 8 lignes d'en-tête
 * distinctes, chacune avec une seule cellule. Les mots se retrouvent alors
 * empilés dans des cellules étroites, et les titres de plusieurs lettres
 * ("Membre", "Montant", "Mode", "Date", "Note") se coupent caractère par
 * caractère. Seuls "#" et "N°", assez courts, restaient lisibles — c'est
 * l'indice qui a permis d'identifier le bug.
 *
 * Cette fonction est utilisée par l'application ET par le test : impossible
 * que les deux divergent à nouveau sur ce point.
 */
export const buildHead = (titles) => [[TITRE_PHOTO, ...titles]];

export const COLUMN_STYLES = {
  [INDEX_PHOTO]: { cellWidth: LARGEUR_PHOTO, minCellHeight: HAUTEUR_LIGNE_PHOTO },
};

export const STYLES = { fontSize: POLICE, cellPadding: PADDING };

export const HEAD_STYLES = {
  fillColor: VERT,
  textColor: BLANC,
  fontStyle: 'bold',
};

export const MARGES = { left: MARGE, right: MARGE };

export const ALTERNATE_ROW_STYLES = { fillColor: RAYONNE };

// Hauteur d'une ligne de texte unique, déduite de la police : 0,4 mm par point
// (mesuré : 7 pt -> 2,8 mm de ligne) plus le padding vertical. Le seuil suit
// donc automatiquement un changement de POLICE.
export const HAUTEUR_LIGNE = POLICE * 0.4 + PADDING * 2;

// Un en-tête qui tient sur une seule ligne ne doit pas dépasser ce seuil.
// Au-delà, c'est qu'un titre se répartit sur plusieurs lignes.
export const SEUIL_TETE_UNE_LIGNE = HAUTEUR_LIGNE * 1.25;
