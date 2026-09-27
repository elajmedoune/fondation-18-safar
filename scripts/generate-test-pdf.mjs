// Test de mise en page des exports PDF.
//
// Produit preview/cotisations-test.pdf (données fictives) et sort en code 1
// si la mise en page ne respecte pas les règles ci-dessous.
//
// Le test rend DEUX tableaux :
//   1. la table "Membres", avec la configuration copiée verbatim de
//      src/pages/membres/MembresList.jsx. C'est la référence : son en-tête
//      tient sur une seule ligne, c'est le rendu attendu pour "Cotisations" ;
//   2. la table "Cotisations", avec la configuration réellement utilisée par
//      l'application (importée de src/lib/pdfTableLayout.js).
//
// Puis il compare les deux. Si les en-têtes divergent, c'est qu'une
// configuration a divergé de l'autre.

import { mkdirSync, writeFileSync } from 'node:fs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  COLUMN_STYLES, STYLES, HEAD_STYLES, MARGES, ALTERNATE_ROW_STYLES,
  TITRE_PHOTO, buildHead, INDEX_PHOTO, HAUTEUR_LIGNE, SEUIL_TETE_UNE_LIGNE, LARGEUR_PAGE
} from '../src/lib/pdfTableLayout.js';

const FCFA = (n) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';

const NOMS = [
  ['Gningue', 'Elhadji Medoune'], ['Sarr', 'Moussa'], ['Diop', 'Fatou Binta'],
  ['Faye', 'Ousmane'], ['Bassène', 'Mariama Sagna'], ['Ndiaye', 'Cheikh'],
];
const MODES = ['Espèces', 'Mobile Money', 'Espèces', 'Virement bancaire'];
const NOTES = ['Enregistrer par Medoune Sagna', '', 'Paiement partiel le 29/09', ''];

const COTISATIONS = Array.from({ length: 24 }, (_, i) => {
  const [nom, prenom] = NOMS[i % NOMS.length];
  return {
    index: i + 1,
    nom: `${prenom} ${nom}`,
    numero: `F18 S-000${13 + i}`,
    montant: 750000 + i * 125000,
    mode: MODES[i % MODES.length],
    date: `2${7 + (i % 3)}/09/2026`,
    note: NOTES[i % NOTES.length],
  };
});

const TETE_COTISATIONS = ['#', 'Membre', 'N°', 'Montant', 'Mode', 'Date', 'Note'];

let echecs = 0;
const echouees = (msg) => { console.error(`  ✗ ${msg}`); echecs++; };

/** Textes réellement écrits dans le flux PDF. */
function textesEcrits(doc) {
  const raw = Buffer.from(doc.output('arraybuffer')).toString('latin1');
  return new Set([...raw.matchAll(/\(([^)]*)\)\s*Tj/g)].map((m) => m[1]));
}

function titreDePage(doc, texte, sousTitre) {
  doc.setFontSize(16); doc.setTextColor(15, 118, 110);
  doc.text(texte, 14, 18);
  doc.setFontSize(10); doc.setTextColor(100);
  doc.text(sousTitre, 14, 25);
  doc.setDrawColor(15, 118, 110); doc.setLineWidth(0.5);
  doc.line(14, 30, 196, 30);
}

// ---------------------------------------------------------------- référence
// Configuration copiée verbatim de MembresList.jsx.
const doc = new jsPDF();
titreDePage(doc, 'Membres - 18 Safar 2027', `${NOMS.length} membre(s)`);
autoTable(doc, {
  startY: 32,
  head: [['#', 'Nom', 'Prenom', 'N° Membre', 'Telephone', 'Sexe', 'Groupe', 'Fonction', 'Cotisé', 'Objectif']],
  body: COTISATIONS.map((c) => [
    c.index, c.nom.split(' ')[1], c.nom.split(' ')[0], c.numero, '77 123 45 67',
    'M', 'Groupe A', 'Président', FCFA(c.montant), FCFA(500000),
  ]),
  styles: { fontSize: 7, cellPadding: 2 },
  headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
  alternateRowStyles: { fillColor: [240, 253, 250] },
  margin: { left: 10, right: 10 },
});

const teteMembres = doc.lastAutoTable.allRows()[0].height;
console.log('[référence] tableau "Membres" (config de MembresList.jsx)');
console.log(`  en-tête : ${teteMembres.toFixed(1)} mm`);
if (teteMembres > SEUIL_TETE_UNE_LIGNE) {
  echouees(`la référence elle-même est sur plusieurs lignes (${teteMembres.toFixed(1)} mm) : la référence n'est plus exploitable`);
}

// ------------------------------------------------------------- cotisations
titreDePage(doc, 'Cotisations', `${COTISATIONS.length} cotisation(s)`);

// Les cellules de la colonne photo sont vides comme dans l'application : c'est
// didDrawCell qui y dessine la photo circulaire.
const body = COTISATIONS.map((c) => [
  TITRE_PHOTO, c.index, c.nom, c.numero, FCFA(c.montant), c.mode, c.date, c.note,
]);

const ecrits = new Set();
autoTable(doc, {
  startY: doc.lastAutoTable.finalY + 12,
  head: buildHead(TETE_COTISATIONS),
  body,
  styles: STYLES,
  headStyles: HEAD_STYLES,
  alternateRowStyles: ALTERNATE_ROW_STYLES,
  margin: MARGES,
  columnStyles: COLUMN_STYLES,
  didDrawCell: (d) => {
    if (d.cell.text) {
      ecrits.add((Array.isArray(d.cell.text) ? d.cell.text.join(' ') : String(d.cell.text)).trim());
    }
    if (d.section !== 'body' || d.column.index !== INDEX_PHOTO) return;
    const { x, y, width, height } = d.cell;
    const dia = Math.min(width - 2, height - 2, 9);
    // Le nom est lu dans d.row.raw : d.row.index est absent quand une ligne
    // est coupée par un saut de page, ce qui lève une TypeError et casse
    // l'export global.
    const nom = String(d.row?.raw?.[2] || '').trim();
    const initiales = nom.split(/\s+/).slice(0, 2).map((m) => m[0] || '').join('').toUpperCase();
    d.doc.setFillColor(236, 239, 238);
    d.doc.circle(x + width / 2, y + height / 2, dia / 2, 'F');
    d.doc.setFontSize(Math.max(5, dia * 0.42));
    d.doc.setTextColor(110, 120, 118);
    d.doc.text(initiales, x + width / 2, y + height / 2, { align: 'center', baseline: 'middle' });
  },
});

const lignes = doc.lastAutoTable.allRows();
const teteCotisations = lignes[0].height;
const corps = lignes.slice(1);

console.log('\n[cible] tableau "Cotisations" (config de l\'application)');
console.log(`  en-tête          : ${teteCotisations.toFixed(1)} mm`);
console.log(`  bandeau vert     : ${(teteCotisations / HAUTEUR_LIGNE).toFixed(1)} ligne(s) de texte`);
console.log(`  lignes           : ${corps.length}, dont ${corps.filter((l) => l.height > SEUIL_TETE_UNE_LIGNE).length} sur plusieurs lignes`);
console.log(`  pages            : ${doc.internal.getNumberOfPages()}`);

// 1. L'en-tête doit tenir sur une seule ligne.
if (teteCotisations > SEUIL_TETE_UNE_LIGNE) {
  echouees(`en-tête sur plusieurs lignes (${teteCotisations.toFixed(1)} mm pour une ligne = ${HAUTEUR_LIGNE} mm)`);
}

// 1 bis. Contrôle STRUCTUREL, le plus important : l'en-tête doit être
//      exactement UNE ligne de cellules. C'est le test qui manquait et qui a
//      laissé passer le bug : un tableau plat est interprété comme 8 lignes
//      d'en-tête, et la hauteur totale du bandeau vert n'en dit rien.
const nbLignesTete = (doc.lastAutoTable.head || []).length;
if (nbLignesTete !== 1) {
  echouees(`l'en-tête est interprété comme ${nbLignesTete} lignes au lieu d'une : les mots sont empilés et les titres longs se coupent caractère par caractère`);
} else {
  console.log(`  lignes d'en-tête : ${nbLignesTete} (1 seule, mots côte à côte)`);
}

// 2. Comparaison avec la référence, exprimée en NOMBRE DE LIGNES DE TEXTE et
//    non en millimètres : les deux tableaux n'ont pas la même police (Membres
//    est resté à 7 pt, Cotisations est passé à 8 pt), donc une comparaison de
//    hauteurs absolues ne mesurerait que le choix typographique. Ce qu'on veut
//    vérifier, c'est que les deux en-têtes tiennent sur une seule ligne.
const lignesTeteMembres = teteMembres / 6.8; // 6.8 = ligne unique à 7 pt + 2*2
const lignesTeteCotisations = teteCotisations / HAUTEUR_LIGNE;
console.log(`  lignes de texte    : Membres ${lignesTeteMembres.toFixed(1)} | Cotisations ${lignesTeteCotisations.toFixed(1)}`);
if (Math.abs(lignesTeteMembres - lignesTeteCotisations) > 0.25) {
  echouees(`l'en-tête n'a pas le même nombre de lignes que la référence "Membres" (${lignesTeteCotisations.toFixed(1)} contre ${lignesTeteMembres.toFixed(1)})`);
}

// 3. Aucun titre ne doit manquer. Ce test existe parce qu'un défaut était
//    invisible : avec une colonne de 7 mm et un padding de 3, la zone de
//    texte faisait 1 mm et le symbole "#" n'était PLUS DU TOUT écrit.
const manquants = TETE_COTISATIONS.filter((t) => !ecrits.has(t));
if (manquants.length) {
  echouees(`titres absents du PDF : ${manquants.map((m) => `"${m}"`).join(', ')}`);
} else {
  console.log(`  titres écrits    : ${TETE_COTISATIONS.length}/${TETE_COTISATIONS.length}`);
}

// 4. Les valeurs ne doivent pas être coupées. Pour une valeur sur deux lignes,
//    d.cell.text vaut ["F18 ", "S-00", "013"] : la valeur complète n'apparaît
//    jamais, ce qui la signale.
const primera = COTISATIONS[0];
const attendus = [primera.numero, primera.date, FCFA(primera.montant), primera.mode];
const coupes = attendus.filter((v) => !ecrits.has(v));
if (coupes.length) {
  echouees(`valeurs coupées sur plusieurs lignes : ${coupes.map((v) => `"${v}"`).join(', ')}`);
} else {
  console.log('  N° / Date / Montant / Mode : sur une seule ligne');
}

// 5. Le tableau doit tenir dans la page.
const bordDroit = MARGES.left + LARGEUR_PAGE - MARGES.right;
console.log(`  bord droit       : ${bordDroit.toFixed(0)} / ${LARGEUR_PAGE} mm`);
if (bordDroit > LARGEUR_PAGE) echouees('tableau hors page');

// 6. Contrôle final sur le flux PDF réel : chaque titre doit apparaître comme
//    opérateur de texte EXACT. Un titre découpé caractère par caractère
//    produirait des opérateurs de 1 caractère et jamais le mot entier.
//    La comparaison doit être exacte : "N°" est aussi une sous-chaîne du
//    titre "N° Membre" du tableau de référence, et ça ne doit pas compter
//    comme un défaut.
const flux = textesEcrits(doc);
const titresAbsents = TETE_COTISATIONS.filter((t) => !flux.has(t));
if (titresAbsents.length) {
  echouees(`titres absents du flux PDF : ${titresAbsents.map((t) => `"${t}"`).join(', ')}`);
}

mkdirSync('preview', { recursive: true });
const sortie = 'preview/cotisations-test.pdf';
writeFileSync(sortie, Buffer.from(doc.output('arraybuffer')));

console.log(`\nPDF écrit : ${sortie}`);
console.log(echecs === 0 ? '✓ mise en page conforme' : `✗ ${echecs} problème(s)`);
process.exit(echecs === 0 ? 0 : 1);
