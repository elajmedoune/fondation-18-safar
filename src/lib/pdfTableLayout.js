// Mise en page du tableau "cotisations" dans les exports PDF (jsPDF
// autoTable). Isolé et partagé entre l'application et le script de test
// (scripts/generate-test-pdf.mjs) : les deux utilisent exactement les mêmes
// largeurs, donc le PDF de test ne peut pas diverger du PDF réel.
//
// Unité : le mm. Page A4 = 210 mm de large, marges 14 => 182 mm utiles.
//
// Colonnes : 0 photo, 1 #, 2 Membre, 3 N°, 4 Montant, 5 Mode, 6 Date, 7 Note.

export const MARGE = 14;
export const LARGEUR_PAGE = 210;      // A4 portrait
export const LARGEUR_UTILE = LARGEUR_PAGE - MARGE * 2; // 182
export const INDEX_PHOTO = 0;

/**
 * Les largeurs sont toutes explicites, en mm, et somment exactement à 182.
 *
 * Pourquoi ne pas laisser une colonne en "auto" : le tableau débordait la
 * largeur de la page.
 *
 * Trois contraintes dictées par des défauts mesurés sur le PDF généré :
 *  - "#" (colonne 1) : avec cellWidth 7 et cellPadding 3, la zone de texte
 *    ne faisait plus que 1 mm et le symbole n'était PLUS DU TOUT écrit dans
 *    le PDF. Il faut au moins 3 mm de contenu, d'où 9 mm de colonne ;
 *  - "N°" : "F18 S-00013" était coupé sur 3 lignes ("F18 ", "S-00", "013") ;
 *  - "Montant" : "1 000 FCFA" était coupé sur 2 lignes, ce qui porta chaque
 *    ligne du tableau de 10 mm à 17 mm de haut.
 */
export const LARGEURS_COMPACT = {
  0: { cellWidth: 9 },
  1: { cellWidth: 8 },
  2: { cellWidth: 32 },
  3: { cellWidth: 24 },
  4: { cellWidth: 24 },
  5: { cellWidth: 16 },
  6: { cellWidth: 21 },
  7: { cellWidth: 48 },
};

export const LARGEURS_ROOMY = {
  0: { cellWidth: 10 },
  1: { cellWidth: 9 },
  2: { cellWidth: 36 },
  3: { cellWidth: 26 },
  4: { cellWidth: 27 },
  5: { cellWidth: 18 },
  6: { cellWidth: 23 },
  7: { cellWidth: 33 },
};

export const SOMME_COMPACT = Object.values(LARGEURS_COMPACT).reduce((s, w) => s + w.cellWidth, 0);
export const SOMME_ROOMY = Object.values(LARGEURS_ROOMY).reduce((s, w) => s + w.cellWidth, 0);
