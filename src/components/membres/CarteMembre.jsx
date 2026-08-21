import { useRef, useState } from 'react';
import QRCode from 'qrcode.react';
import { Camera, Loader2, ShieldCheck, Download } from 'lucide-react';
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

async function fetchAsDataUrl(url) {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onloadend = () => res(reader.result);
    reader.onerror = rej;
    reader.readAsDataURL(blob);
  });
}

export default function CarteMembre({ membre, groupeNom, fonction, annee, onPhotoUpdated }) {
  const cardRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

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

  const handleExportPng = async () => {
    setExporting(true);
    try {
      const W = CARD_WIDTH;
      const H = CARD_HEIGHT;
      const S = EXPORT_SCALE;

      const [photoImg, logoImg] = await Promise.all([
        membre.photo_url ? loadImg(membre.photo_url).catch(() => null) : null,
        loadImg('/logo-transparent.png').catch(() => null)
      ]);

      let qrImg = null;
      try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(membre.qr_code_value)}&size=${200}x${200}&format=png`;
        qrImg = await loadImg(qrUrl);
      } catch {}

      const c = document.createElement('canvas');
      c.width = W * S;
      c.height = H * S;
      const ctx = c.getContext('2d');
      ctx.scale(S, S);

      roundedRect(ctx, 0, 0, W, H, 16);
      ctx.clip();

      ctx.fillStyle = CREAM;
      ctx.fillRect(0, 0, W, H);

      const topGrad = ctx.createLinearGradient(0, 0, W, 40);
      topGrad.addColorStop(0, GREEN);
      topGrad.addColorStop(1, GREEN_DARK);
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, W, 40);

      ctx.fillStyle = GOLD;
      ctx.fillRect(0, 40, W, 2);

      ctx.font = '800 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tW = ctx.measureText('Fondation 18 Safar').width;
      const tX = (W - tW) / 2;
      ctx.fillStyle = GOLD_LIGHT;
      ctx.textAlign = 'left';
      ctx.fillText('Fondation ', tX, 20);
      const f1W = ctx.measureText('Fondation ').width;
      ctx.fillStyle = '#ffffff';
      ctx.fillText('18', tX + f1W, 20);
      const f2W = ctx.measureText('18').width;
      ctx.fillStyle = GOLD_LIGHT;
      ctx.fillText(' Safar', tX + f1W + f2W, 20);

      ctx.fillStyle = CREAM;
      ctx.fillRect(0, 42, W, H - 42 - 38);

      const contentTop = 42;
      const contentH = H - 42 - 38;
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

      const qrSize = 100;
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

      const photoW = 88;
      const photoH = 108;
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

      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(W - 141, H - 14);
      ctx.lineTo(W - 16, H - 14);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '400 9px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Signature du titulaire', W - 16, H - 10);

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
            <div
              ref={cardRef}
              className="absolute top-0 left-0 origin-top-left shrink-0 overflow-hidden rounded-2xl shadow-lg shadow-gray-300/60 flex flex-col"
              style={{
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                transform: 'scale(0.7)',
                colorScheme: 'light',
                background: CREAM,
                border: `2px solid ${GOLD}`
              }}
            >
            <div
              className="relative flex shrink-0 flex-col items-center justify-center"
              style={{
                height: 40,
                background: `linear-gradient(160deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`,
                borderBottom: `2px solid ${GOLD}`
              }}
            >
              <p
                className="font-extrabold uppercase leading-none"
                style={{ fontSize: 18, letterSpacing: '0.02em', textShadow: '0 1px 1px rgba(0,0,0,0.35)' }}
              >
                <span style={{ color: GOLD_LIGHT }}>Fondation </span>
                <span style={{ color: '#ffffff' }}>18</span>
                <span style={{ color: GOLD_LIGHT }}> Safar</span>
              </p>
            </div>

            <div className="relative flex-1 min-h-0 overflow-hidden">
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.07]" style={{ height: 166, width: 166 }}>
                {!logoFailed && (
                  <img
                    src="/logo-transparent.png"
                    alt=""
                    crossOrigin="anonymous"
                    className="h-full w-full object-contain"
                  />
                )}
              </div>

              <div className="pointer-events-none absolute right-[-10px] top-[-10px] h-[100px] w-[100px] rounded-full opacity-[0.06]" style={{ background: GREEN }} />
              <div className="pointer-events-none absolute bottom-[-10px] left-[-10px] h-[80px] w-[80px] rounded-full opacity-[0.06]" style={{ background: GREEN }} />
              <div className="pointer-events-none absolute right-[-20px] top-[20px] h-[60px] w-[60px] rounded-full opacity-[0.05]" style={{ background: GOLD }} />
              <div className="pointer-events-none absolute bottom-[-15px] left-[15px] h-[50px] w-[50px] rounded-full opacity-[0.05]" style={{ background: GOLD }} />
              <div className="pointer-events-none absolute right-[-5px] bottom-[-5px] h-[130px] w-[130px] rounded-full border-[1.5px] opacity-[0.04]" style={{ borderColor: GREEN }} />
              <div className="pointer-events-none absolute left-[5px] top-[5px] h-[110px] w-[110px] rounded-full border-[1.5px] opacity-[0.04]" style={{ borderColor: GREEN }} />

              <div className="relative flex items-start gap-3.5 px-4 pt-3">
                <div className="flex shrink-0 flex-col items-center">
                  <div className="relative">
                    {membre.photo_url ? (
                      <img
                        src={membre.photo_url}
                        alt=""
                        crossOrigin="anonymous"
                        className="rounded-lg object-cover shadow-sm"
                        style={{ height: 92, width: 74, border: `2px solid ${GOLD}` }}
                      />
                    ) : (
                      <div
                        className="rounded-lg flex items-center justify-center text-lg font-bold shadow-sm"
                        style={{ height: 92, width: 74, background: '#f0ece0', color: GREEN, border: `2px solid ${GOLD}` }}
                      >
                        {membre.prenom?.[0]}
                        {membre.nom?.[0]}
                      </div>
                    )}
                    <button
                      type="button"
                      data-no-export="true"
                      onClick={handlePickPhoto}
                      disabled={uploading}
                      title="Importer une photo"
                      className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-white shadow hover:opacity-90 disabled:opacity-60"
                      style={{ background: GOLD }}
                    >
                      {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </div>
                  <p
                    className="mt-1.5 text-center font-bold tracking-wide leading-none"
                    style={{ fontSize: 10, color: GREEN }}
                  >
                    N° {membre.numero_membre}
                  </p>
                </div>

                <dl className="min-w-0 flex-1 space-y-2.5 text-[12.5px] leading-snug pt-0.5">
                  {[
                    ['Nom', membre.nom],
                    ['Prénom', membre.prenom],
                    ['Fonction', fonction || groupeNom || '—'],
                    ['Téléphone', membre.telephone || '—']
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-baseline gap-1.5">
                      <dt
                        className="shrink-0 font-bold uppercase tracking-wide"
                        style={{ color: GREEN, fontSize: 11.5 }}
                      >
                        {label} :
                      </dt>
                      <dd
                        className="min-w-0 flex-1 truncate font-semibold"
                        style={{
                          color: '#1a1a1a',
                          borderBottom: `1px dotted ${GOLD}`,
                          paddingBottom: 1
                        }}
                      >
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="relative flex items-end justify-between px-4 mt-2.5">
                <div
                  className="inline-flex items-center gap-2 rounded-md pl-1 pr-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide shadow-sm"
                  style={{ background: GREEN, border: `1px solid ${GOLD}`, color: '#ffffff' }}
                >
                  <span
                    className="flex items-center justify-center rounded-full bg-white overflow-hidden shrink-0"
                    style={{ height: 19, width: 19, border: `1px solid ${GOLD}` }}
                  >
                    {!logoFailed ? (
                      <img
                        src="/logo-transparent.png"
                        alt=""
                        crossOrigin="anonymous"
                        onError={() => setLogoFailed(true)}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <ShieldCheck className="h-3 w-3" style={{ color: GREEN }} strokeWidth={2} />
                    )}
                  </span>
                  Carte de membre
                </div>
                <div className="rounded-md p-1 shadow-sm" style={{ background: '#ffffff', border: `1px solid ${GOLD}` }}>
                  <QRCode value={membre.qr_code_value} size={60} />
                </div>
              </div>
            </div>

            <div
              className="relative shrink-0 flex items-center justify-between px-4"
              style={{
                height: 38,
                background: `linear-gradient(200deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`
              }}
            >
              <svg
                className="absolute left-0 right-0 -top-2 w-full"
                height="11"
                viewBox="0 0 480 11"
                preserveAspectRatio="none"
              >
                <path
                  d="M0,9 C75,0 150,11 240,4 C330,-3 400,9 480,2 L480,11 L0,11 Z"
                  fill={GOLD}
                  opacity="0.9"
                />
              </svg>

              <div>
                <p className="text-[9px] uppercase tracking-widest leading-none" style={{ color: GOLD_LIGHT }}>
                  Année
                </p>
                <p className="text-[15px] font-extrabold leading-tight" style={{ color: '#ffffff' }}>
                  {annee}
                </p>
              </div>
              <div className="text-right">
                <div style={{ borderBottom: `1px solid rgba(255,255,255,0.4)`, width: 125, marginBottom: 2 }} />
                <p className="text-[9px] leading-none" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  Signature du titulaire
                </p>
              </div>
            </div>
          </div>
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
