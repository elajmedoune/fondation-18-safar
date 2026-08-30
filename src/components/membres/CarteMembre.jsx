import { useRef, useState, useEffect } from 'react';
import { Camera, Loader2, Download } from 'lucide-react';
import { membresService } from '../../services/membres.service.js';

const CARD_WIDTH = 480;
const CARD_HEIGHT = 303;
const EXPORT_SCALE = 3;

const GREEN_DARK = '#0a3327';
const GREEN = '#0c4a37';
const GOLD = '#c9a227';
const GOLD_LIGHT = '#e9cf7a';
const CREAM = '#fbfaf5';

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function coverDraw(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sw, sh, sx, sy;
  if (imgRatio > boxRatio) { sh = img.height; sw = sh * boxRatio; sx = (img.width - sw) / 2; sy = 0; }
  else { sw = img.width; sh = sw / boxRatio; sx = 0; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Dessin COMPLET de la carte sur un canvas (unique source de vérité).
// Utilisé pour l'affichage à l'écran (scale=1) ET pour l'export (scale=3) :
// le rendu est donc garanti IDENTIQUE à l'écran et au téléchargement.
// ---------------------------------------------------------------------------
async function drawCard({ ctx, photoImg, logoImg, qrImg, membre, groupeNom, fonction, annee }) {
  // Toujours dessiner dans l'espace logique CARD_WIDTH x CARD_HEIGHT.
  // Le scale (export) est appliqué à l'extérieur et ne doit PAS changer ces
  // coordonnées : ctx.canvas.width serait la taille physique (multipliée),
  // ce qui pousserait le dessin hors du canvas pour l'export.
  const W = CARD_WIDTH;
  const H = CARD_HEIGHT;

  roundedRect(ctx, 0, 0, W, H, 16);
  ctx.clip();

  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);

  const HEADER_H = 44;
  const topGrad = ctx.createLinearGradient(0, 0, W, HEADER_H);
  topGrad.addColorStop(0, GREEN);
  topGrad.addColorStop(1, GREEN_DARK);
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, W, HEADER_H);

  ctx.fillStyle = GOLD;
  ctx.fillRect(0, HEADER_H, W, 2);

  ctx.font = '800 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tW = ctx.measureText('Fondation 18 Safar').width;
  const tX = (W - tW) / 2;
  ctx.fillStyle = GOLD_LIGHT;
  ctx.textAlign = 'left';
  ctx.fillText('Fondation ', tX, HEADER_H / 2);
  const f1W = ctx.measureText('Fondation ').width;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('18', tX + f1W, HEADER_H / 2);
  const f2W = ctx.measureText('18').width;
  ctx.fillStyle = GOLD_LIGHT;
  ctx.fillText(' Safar', tX + f1W + f2W, HEADER_H / 2);

  ctx.fillStyle = CREAM;
  ctx.fillRect(0, HEADER_H + 2, W, H - (HEADER_H + 2) - 38);

  const contentTop = HEADER_H + 2;
  const contentH = H - contentTop - 38;
  const contentMid = contentTop + contentH / 2;

  if (logoImg) {
    ctx.globalAlpha = 0.07;
    ctx.drawImage(logoImg, W / 2 - 83, 62, 166, 166);
    ctx.globalAlpha = 1;
  }

  ctx.globalAlpha = 0.06;
  ctx.fillStyle = GREEN;
  ctx.beginPath();
  ctx.arc(W - 10, contentTop + 10, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-10, H - 38 - 10, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(W - 20, contentTop + 30, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(20, H - 38 - 25, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(W - 5, H - 38 - 5, 65, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(5, contentTop + 5, 55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const qrSize = 118;
  const qrPad = 7;
  const badgeH = 34;
  const badgeGap = 6;
  const rightBlockH = qrSize + qrPad * 2 + badgeGap + badgeH;
  const rightBlockY = contentMid - rightBlockH / 2;
  const qrX = W - 16 - qrSize - qrPad;
  const qrY = rightBlockY + qrPad;

  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, qrX - qrPad, qrY - qrPad, qrSize + qrPad * 2, qrSize + qrPad * 2, 8);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  roundedRect(ctx, qrX - qrPad, qrY - qrPad, qrSize + qrPad * 2, qrSize + qrPad * 2, 8);
  ctx.stroke();
  if (qrImg) {
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  }

  const badgeW = 180;
  const badgeX = qrX - qrPad + (qrSize + qrPad * 2 - badgeW) / 2;
  const badgeY = qrY + qrSize + qrPad + badgeGap;
  ctx.fillStyle = GREEN;
  roundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 8);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  roundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 8);
  ctx.stroke();

  if (logoImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(badgeX + 15, badgeY + badgeH / 2, 10, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.drawImage(logoImg, badgeX + 5, badgeY + badgeH / 2 - 10, 20, 20);
    ctx.restore();
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.arc(badgeX + 15, badgeY + badgeH / 2, 10, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 14px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Carte de membre', badgeX + 32, badgeY + badgeH / 2);

  const photoW = 112;
  const photoH = 134;
  const numH = 16;
  const leftBlockH = photoH + numH;
  const leftBlockY = contentMid - leftBlockH / 2;
  const photoX = 18;
  const photoY = leftBlockY;

  if (photoImg) {
    ctx.save();
    roundedRect(ctx, photoX, photoY, photoW, photoH, 8);
    ctx.clip();
    coverDraw(ctx, photoImg, photoX, photoY, photoW, photoH);
    ctx.restore();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    roundedRect(ctx, photoX, photoY, photoW, photoH, 8);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#f0ece0';
    roundedRect(ctx, photoX, photoY, photoW, photoH, 8);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    roundedRect(ctx, photoX, photoY, photoW, photoH, 8);
    ctx.stroke();
    ctx.fillStyle = GREEN;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${membre.prenom?.[0] || ''}${membre.nom?.[0] || ''}`, photoX + photoW / 2, photoY + photoH / 2);
  }

  ctx.fillStyle = GREEN;
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`N° ${membre.numero_membre}`, photoX + photoW / 2, photoY + photoH + 6);

  const fieldX = photoX + photoW + 18;
  const fieldStartY = contentMid - (3 * 32) / 2;
  const fields = [
    ['Nom', membre.nom],
    ['Prénom', membre.prenom],
    ['Fonction', fonction || groupeNom || '—'],
    ['Téléphone', membre.telephone || '—']
  ];

  fields.forEach(([label, value], i) => {
    const fy = fieldStartY + i * 32;
    ctx.fillStyle = GREEN;
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${label} :`, fieldX, fy);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText(value || '—', fieldX, fy + 15);
  });

  const footerY = H - 38;
  const footGrad = ctx.createLinearGradient(0, footerY, W, H);
  footGrad.addColorStop(0, GREEN);
  footGrad.addColorStop(1, GREEN_DARK);
  ctx.fillStyle = footGrad;
  ctx.fillRect(0, footerY, W, 38);

  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(0, footerY);
  ctx.bezierCurveTo(75, footerY - 9, 150, footerY + 2, 240, footerY - 5);
  ctx.bezierCurveTo(330, footerY - 12, 400, footerY, 480, footerY - 7);
  ctx.lineTo(W, footerY + 2);
  ctx.lineTo(0, footerY + 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = GOLD_LIGHT;
  ctx.font = '600 9px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Année', 16, footerY + 6);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 15px system-ui, sans-serif';
  ctx.fillText(String(annee), 16, footerY + 18);

  // Logo en haut à droite, premier plan (dessiné en dernier)
  if (logoImg) {
    const cx = W - 14 - 28;
    const cy = 30;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.drawImage(logoImg, cx - 28, cy - 28, 56, 56);
    ctx.restore();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// Charge toutes les images nécessaires (photo, logo, QR)
async function loadAssets(membre) {
  const [photoImg, logoImg] = await Promise.all([
    membre.photo_url ? loadImg(membre.photo_url).catch(() => null) : null,
    loadImg('/logo-transparent.png').catch(() => null)
  ]);
  let qrImg = null;
  try {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(membre.qr_code_value)}&size=${200}x${200}&format=png`;
    qrImg = await loadImg(qrUrl);
  } catch {}
  return { photoImg, logoImg, qrImg };
}

export default function CarteMembre({ membre, groupeNom, fonction, annee, onPhotoUpdated }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [cardUrl, setCardUrl] = useState(null);

  if (!membre) return null;

  const handlePickPhoto = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const photo_url = await membresService.uploadPhoto(file, membre.id);
      await membresService.update(membre.id, { photo_url });
      onPhotoUpdated?.(membre.id, photo_url);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'import de la photo.");
    } finally {
      setUploading(false);
    }
  };

  // Génère l'image de la carte à l'écran (scale=1) — même rendu que l'export
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const assets = await loadAssets(membre);
      if (cancelled) return;
      const c = document.createElement('canvas');
      c.width = CARD_WIDTH;
      c.height = CARD_HEIGHT;
      const ctx = c.getContext('2d');
      await drawCard({ ctx, ...assets, membre, groupeNom, fonction, annee });
      if (!cancelled) setCardUrl(c.toDataURL('image/png'));
    })();
    return () => { cancelled = true; };
  }, [membre, groupeNom, fonction, annee]);

  const handleExportPng = async () => {
    setExporting(true);
    try {
      const assets = await loadAssets(membre);
      const c = document.createElement('canvas');
      c.width = CARD_WIDTH * EXPORT_SCALE;
      c.height = CARD_HEIGHT * EXPORT_SCALE;
      const ctx = c.getContext('2d');
      ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
      await drawCard({ ctx, ...assets, membre, groupeNom, fonction, annee });

      const link = document.createElement('a');
      link.download = `carte-${membre.numero_membre || membre.id}.png`;
      link.href = c.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'export de la carte.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-2">
      <div className="w-full overflow-x-auto flex justify-center">
        <div style={{ minWidth: CARD_WIDTH * 0.7 }}>
          <div style={{ width: CARD_WIDTH * 0.7, height: CARD_HEIGHT * 0.7, position: 'relative' }}>
            {cardUrl ? (
              <img
                src={cardUrl}
                alt={`Carte de ${membre.prenom} ${membre.nom}`}
                width={CARD_WIDTH}
                height={CARD_HEIGHT}
                style={{ width: CARD_WIDTH * 0.7, height: CARD_HEIGHT * 0.7, borderRadius: 12 }}
              />
            ) : (
              <div
                className="flex items-center justify-center"
                style={{ width: CARD_WIDTH * 0.7, height: CARD_HEIGHT * 0.7, borderRadius: 12 }}
              >
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: GREEN }} />
              </div>
            )}

            {/* Bouton photo superposé au centre de la photo */}
            {cardUrl && (
              <button
                type="button"
                onClick={handlePickPhoto}
                disabled={uploading}
                title="Importer une photo"
                className="absolute flex items-center justify-center rounded-full text-white shadow hover:opacity-90 disabled:opacity-60"
                style={{ background: GOLD, bottom: 58, right: 245, height: 32, width: 32 }}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleExportPng}
        disabled={exporting}
        style={{ width: CARD_WIDTH * 0.7, maxWidth: '100%' }}
        className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-60 transition-colors"
      >
        {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {exporting ? 'Export en cours...' : 'Exporter cette carte (PNG)'}
      </button>
    </div>
  );
}
