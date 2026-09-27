// Photos de membres dans les PDF (jsPDF).
//
// Deux problèmes distincts :
//  1. charger une image distante en data URL réduite, car jsPDF ne sait
//     embarquer qu'une image déjà convertie en base64 ;
//  2. la dessiner en rond via un détourage circulaire, ce que jsPDF ne
//     propose pas nativement.
//
// Tout est encapsulé ici pour être réutilisé par les autres exports.

// url -> Promise<dataUrl|null>. Évite de re-télécharger la même photo quand
// un membre apparaît sur plusieurs lignes ou dans plusieurs tableaux.
const cache = new Map();

/**
 * Charge une image distante et la convertit en data URL PNG circulaire.
 * Le détourage est fait ICI, dans le canvas, et non dans le PDF.
 *
 * Pourquoi : dans jsPDF, circle() sans style dessine le cercle et consomme
 * son chemin, si bien que clip() se retrouve avec un chemin vide et découpe
 * toute la zone suivante — le texte du tableau devenait invisible. Le
 * canvas produit un PNG transparent hors du cercle, qu'on insère ensuite
 * directement, sans aucune découpe côté PDF.
 *
 * @returns {Promise<string|null>} null si l'image est absente ou inaccessible.
 */
export async function loadPhotoDataUrl(url, size = 128) {
  if (!url) return null;
  if (cache.has(url)) return cache.get(url);

  const pending = (async () => {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return null;
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob);
      const side = Math.min(bitmap.width, bitmap.height);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      // Recadrage carré centré : une photo de membre n'est pas forcément
      // carrée, et un étirement déformerait le visage.
      ctx.drawImage(
        bitmap,
        (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side,
        0, 0, size, size
      );

      // destination-in + cercle plein : ne conserve que l'intérieur du rond.
      ctx.globalCompositeOperation = 'destination-in';
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      return canvas.toDataURL('image/png');
    } catch {
      // CORS bloqué, image corrompue, format non supporté : on retombe sur
      // les initiales plutôt que de faire échouer l'export entier.
      return null;
    }
  })();

  cache.set(url, pending);
  return pending;
}

/**
 * Précharge les photos d'un jeu de lignes et renvoie un Map
 * "clef de ligne" -> dataUrl. À appeler avant de générer le tableau.
 */
export async function preloadPhotos(rows, getKey, getUrl) {
  const entries = await Promise.all(
    rows.map(async (row) => [getKey(row), await loadPhotoDataUrl(getUrl(row))])
  );
  return new Map(entries);
}

const FOND = [236, 239, 238];
const TEXTE = [110, 120, 118];

/**
 * Dessine une photo circulaire dans un rectangle donné.
 * @param doc      instance jsPDF
 * @param x,y      coin haut-gauche du rond
 * @param d        diamètre
 * @param dataUrl  PNG déjà circulaire et transparent (cf. loadPhotoDataUrl)
 * @param initiales texte de repli si la photo est absente
 */
export function drawCirclePhoto(doc, x, y, d, dataUrl, initiales) {
  const r = d / 2;
  const cx = x + r;
  const cy = y + r;

  // Fond du rond : visible même sans photo, et évite un trou blanc.
  doc.setFillColor(...FOND);
  doc.circle(cx, cy, r, 'F');

  if (dataUrl) {
    // Insertion simple, sans clip() : le PNG est déjà circulaire.
    try {
      doc.addImage(dataUrl, 'PNG', x, y, d, d, undefined, 'FAST');
    } catch {
      // image refusée par jsPDF : le rond de fond reste visible
    }
  } else if (initiales) {
    doc.setFontSize(Math.max(5, d * 0.42));
    doc.setTextColor(...TEXTE);
    doc.text(String(initiales), cx, cy, { align: 'center', baseline: 'middle' });
  }
}
