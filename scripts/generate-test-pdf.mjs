// Génère un PDF de test du tableau des cotisations et VÉRIFIE la mise en page.
//
//   node scripts/generate-test-pdf.mjs
//
// Produit preview/cotisations-test.pdf (données fictives) et sort en code 1 si
// une régression est détectée : en-tête coupé caractère par caractère, ligne
// trop haute, tableau hors page.
//
// Les largeurs de colonnes sont importées de src/lib/pdfTableLayout.js, le
// même module que l'application : le PDF de test ne peut donc pas diverger du
// PDF réellement produit par /finances/cotisations.

import { writeFileSync, mkdirSync } from 'node:fs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  LARGEURS_COMPACT, LARGEURS_ROOMY, MARGE, LARGEUR_UTILE, LARGEUR_PAGE, INDEX_PHOTO
} from '../src/lib/pdfTableLayout.js';

const NOMS = [
  'Elhadji Medoune Gningue', 'Bassirou Gningue', 'Serigne Gning', 'Mbaye Ndoa',
  'Pape Talla Mbaye', 'Thiama Thiam', 'Mané Talla', 'Amy Fall', 'Kadia Thiam',
];
const MONTANTS = [1000, 500, 1000, 1000, 1000, 500, 500, 500, 500];

const TETE = ['#', 'Membre', 'N°', 'Montant', 'Mode', 'Date', 'Note'];

const lignes = NOMS.map((nom, i) => [
  '',
  i + 1,
  nom,
  `F18 S-${String(13 + i * 7).padStart(5, '0')}`,
  `${MONTANTS[i].toLocaleString('fr-FR').replace(/ | /g, ' ')} FCFA`,
  'Espèces',
  '27/09/2026',
  i % 3 === 1 ? 'Enregistrer par Medoune' : '',
]);

// Deux jeux : police 8 (export global) et police 9 (export par mois).
const VARIANTES = [
  { nom: 'compact', fontSize: 8, cellPadding: 2, largeurs: LARGEURS_COMPACT },
  { nom: 'roomy', fontSize: 9, cellPadding: 3, largeurs: LARGEURS_ROOMY },
];

const doc = new jsPDF();
let echecs = 0;
const largeurTotale = (l) => Object.values(l).reduce((s, w) => s + w.cellWidth, 0);

for (const v of VARIANTES) {
  if (largeurTotale(v.largeurs) > LARGEUR_UTILE) {
    console.error(`✗ ${v.nom} : largeurs = ${largeurTotale(v.largeurs)} mm > ${LARGEUR_UTILE} mm`);
    echecs++;
  }

  // Bornes verticales de chaque colonne, pour vérifier qu'aucune valeur ne
  // déborde de sa cellule.
  let x = MARGE;
  const bornes = v.largeurs && Object.keys(v.largeurs).length
    ? Object.values(v.largeurs).map((w) => { const b = [x, x + w.cellWidth]; x += w.cellWidth; return b; })
    : [];

  // Textes RÉELLEMENT rendus, cellule par cellule. Pour une valeur coupée sur
  // deux lignes, data.cell.text vaut ['F18 ', 'S-00', '013'] : la valeur
  // complète n'apparaît donc jamais dans le set, ce qui la signale.
  const teteEcrit = new Set();
  const corpsEcrit = new Set();

  autoTable(doc, {
    startY: doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : 32,
    head: [['', ...TETE]],
    body: lignes,
    styles: { fontSize: v.fontSize, cellPadding: v.cellPadding, overflow: 'linebreak' },
    headStyles: {
      fillColor: [15, 118, 110], textColor: 255,
      fontStyle: 'bold', fontSize: v.fontSize - 1,
    },
    margin: { left: MARGE, right: MARGE },
    columnStyles: v.largeurs,
    didDrawCell: (d) => {
      const rendu = Array.isArray(d.cell.text) ? d.cell.text.join(' ').trim() : String(d.cell.text ?? '').trim();
      if (rendu) (d.section === 'head' ? teteEcrit : corpsEcrit).add(rendu);

      if (d.section !== 'body' || d.column.index !== INDEX_PHOTO) return;
      const { x: cx, y: cy, width: cw, height: ch } = d.cell;
      const dia = Math.min(cw - 2, ch - 2, 9);
      // Initiales lues dans d.row.raw, jamais par index : le numéro de ligne
      // est absent quand une ligne est coupée par un saut de page.
      const nom = String(d.row?.raw?.[2] || '').trim();
      const ini = nom.split(/\s+/).slice(0, 2).map((m) => m[0] || '').join('').toUpperCase();
      d.doc.setFillColor(236, 239, 238);
      d.doc.circle(cx + cw / 2, cy + ch / 2, dia / 2, 'F');
      d.doc.setFontSize(Math.max(5, dia * 0.42));
      d.doc.setTextColor(110, 120, 118);
      d.doc.text(ini, cx + cw / 2, cy + ch / 2, { align: 'center', baseline: 'middle' });
    },
  });

  const rows = doc.lastAutoTable.allRows();
  const hTete = rows[0].height;
  const hCorps = rows[1].height;
  const bordDroit = MARGE + largeurTotale(v.largeurs);
  const hLigneTheorique = v.fontSize * 0.3528 + v.cellPadding * 2;

  console.log(`\n[${v.nom}] police ${v.fontSize}`);
  console.log(`  somme largeurs   : ${largeurTotale(v.largeurs)} / ${LARGEUR_UTILE} mm`);
  console.log(`  bord droit       : ${bordDroit} / ${LARGEUR_PAGE} mm`);
  console.log(`  hauteur en-tête  : ${hTete.toFixed(1)} mm`);
  console.log(`  hauteur ligne    : ${hCorps.toFixed(1)} mm (1 ligne = ${hLigneTheorique.toFixed(1)} mm)`);

  // L'en-tête doit tenir sur une seule ligne.
  if (hTete > hLigneTheorique * 1.6) {
    console.error(`  ✗ en-tête sur plusieurs lignes (${hTete.toFixed(1)} mm)`);
    echecs++;
  }
  // Une ligne de données doit tenir sur une à deux lignes.
  if (hCorps > hLigneTheorique * 2.4) {
    console.error(`  ✗ ligne sur plus de 2 lignes (${hCorps.toFixed(1)} mm)`);
    echecs++;
  }
  // Le tableau doit rester dans la page.
  if (bordDroit > LARGEUR_PAGE) {
    console.error(`  ✗ tableau hors page`);
    echecs++;
  }
  // La colonne N° doit contenir "F18 S-00013" sur une seule ligne.
  if (hCorps > hLigneTheorique * 1.6) {
    console.error(`  ✗ colonne N° ou Date coupée (hauteur ${hCorps.toFixed(1)} mm)`);
    echecs++;
  }

  // Chaque libellé d'en-tête doit être RÉELLEMENT écrit dans le flux PDF.
  // Ce test a été ajouté après un défaut invisible : avec une colonne de 7 mm
  // et un padding de 3, la zone de texte faisait 1 mm et le symbole "#" n'était
  // plus écrit du tout — le tableau avait l'air correct, il manquait un titre.
  const manquants = TETE.filter((t) => !teteEcrit.has(t));
  if (manquants.length) {
    console.error(`  ✗ en-têtes absents du PDF : ${manquants.map((m) => JSON.stringify(m)).join(', ')}`);
    echecs++;
  } else {
    console.log(`  en-têtes écrits      : ${TETE.length}/${TETE.length}`);
  }

  // Les valeurs des colonnes numériques ne doivent pas être coupées.
  const coupes = [];
  for (const attendu of ['F18 S-00013', '27/09/2026', '1 000 FCFA', 'Espèces']) {
    if (!corpsEcrit.has(attendu)) coupes.push(attendu);
  }
  if (coupes.length) {
    console.error(`  ✗ valeurs coupées sur plusieurs lignes : ${coupes.join(', ')}`);
    echecs++;
  } else {
    console.log(`  valeurs en une ligne : OK`);
  }
}

// Volontairement HORS de dist/ : « vite build » vide dist/ à chaque build et
// le fichier de test disparaissait avant qu'on puisse l'ouvrir.
mkdirSync('preview', { recursive: true });
const sortie = 'preview/cotisations-test.pdf';
writeFileSync(sortie, Buffer.from(doc.output('arraybuffer')));

console.log(`\nPDF écrit : ${sortie}`);
console.log(echecs === 0 ? '✓ mise en page conforme' : `✗ ${echecs} problème(s)`);
process.exit(echecs === 0 ? 0 : 1);
