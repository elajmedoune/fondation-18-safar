import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import QRCode from 'qrcode.react';
import { Camera, Loader2, ShieldCheck, Download } from 'lucide-react';
import { membresService } from '../../services/membres.service.js';

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

  // Exporte la carte en vrai fichier PNG téléchargeable (pas d'impression navigateur).
  // Utilise un clone caché avec des dimensions fixes pour garantir un rendu identique
  // quel que soit l'appareil ou la taille d'écran.
  const EXPORT_WIDTH = 400;

  const handleExportPng = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const original = cardRef.current;

      // Clone the card node off-screen with fixed width
      const clone = original.cloneNode(true);
      clone.style.position = 'fixed';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.width = EXPORT_WIDTH + 'px';
      clone.style.maxWidth = EXPORT_WIDTH + 'px';
      clone.style.flexShrink = '0';
      clone.style.margin = '0';
      clone.style.padding = '0';
      clone.style.border = 'none';
      clone.style.boxShadow = 'none';
      clone.removeAttribute('class');
      clone.className = '';

      // Apply same base styles as original
      const origStyles = window.getComputedStyle(original);
      clone.style.borderRadius = origStyles.borderRadius;
      clone.style.overflow = 'hidden';
      clone.style.backgroundColor = '#ffffff';
      clone.style.colorScheme = 'light';

      document.body.appendChild(clone);

      // Wait for layout + images
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 100));

      // Make sure all images inside the clone are loaded
      const imgs = clone.querySelectorAll('img');
      await Promise.all(
        Array.from(imgs).map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete) return resolve();
              img.onload = resolve;
              img.onerror = resolve;
              setTimeout(resolve, 2000);
            })
        )
      );

      const dataUrl = await toPng(clone, {
        pixelRatio: 3,
        cacheBust: true,
        width: EXPORT_WIDTH,
        backgroundColor: '#ffffff',
        filter: (node) => !node.dataset || node.dataset.noExport !== 'true'
      });

      const link = document.createElement('a');
      link.download = `carte-${membre.numero_membre || membre.id}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'export de la carte.");
    } finally {
      // Cleanup clone if still in DOM
      document.querySelectorAll('body > [style*="-9999px"]').forEach((el) => el.remove());
      setExporting(false);
    }
  };

  return (
    <div className="w-full max-w-sm space-y-2">
      {/*
        Tout ce qui est DANS cardRef a des couleurs FIXES (pas de dark:),
        volontairement, pour que la carte ait toujours le même rendu,
        que le site soit en mode clair ou sombre, à l'écran et à l'export.
      */}
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg shadow-gray-200/60"
        style={{ colorScheme: 'light' }}
      >
        {/* Bandeau supérieur */}
        <div className="relative bg-gradient-to-br from-primary-600 to-primary-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/90 ring-1 ring-white/40 overflow-hidden">
              {!logoFailed ? (
                <img
                  src="/logo.png"
                  alt="Logo"
                  crossOrigin="anonymous"
                  onError={() => setLogoFailed(true)}
                  className="h-full w-full object-contain p-1"
                />
              ) : (
                <ShieldCheck className="h-5 w-5 text-primary-700" strokeWidth={1.75} />
              )}
            </div>
            <div className="leading-tight">
              <p className="font-bold text-xs uppercase tracking-widest text-white">Fondation 18 Safar</p>
              <p className="text-[10px] text-white/80 mt-0.5">Carte de membre{annee ? ` — ${annee}` : ''}</p>
            </div>
          </div>
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -right-2 -bottom-8 h-16 w-16 rounded-full bg-white/5" />
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              {membre.photo_url ? (
                <img
                  src={membre.photo_url}
                  alt=""
                  crossOrigin="anonymous"
                  className="h-16 w-16 rounded-xl object-cover border-2 border-white shadow-sm"
                />
              ) : (
                <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center text-gray-400 text-lg font-bold border-2 border-white shadow-sm">
                  {membre.prenom?.[0]}{membre.nom?.[0]}
                </div>
              )}

              <button
                type="button"
                data-no-export="true"
                onClick={handlePickPhoto}
                disabled={uploading}
                title="Importer une photo"
                className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary-700 text-white shadow hover:bg-primary-800 disabled:opacity-60"
              >
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            <div className="min-w-0">
              <p className="font-semibold text-sm truncate text-gray-900">{membre.prenom} {membre.nom}</p>
              <p className="text-xs text-gray-400 mt-0.5">N° {membre.numero_membre}</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs border-t border-gray-100 pt-3">
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-gray-400">Groupe</dt>
              <dd className="font-medium text-gray-800 mt-0.5">{groupeNom || '—'}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-gray-400">Année</dt>
              <dd className="font-medium text-gray-800 mt-0.5">{annee || '—'}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-gray-400">Téléphone</dt>
              <dd className="font-medium text-gray-800 mt-0.5">{membre.telephone || '—'}</dd>
            </div>
            <div className="col-span-2 min-h-[1.1rem]">
              {fonction ? (
                <>
                  <dt className="text-[10px] uppercase tracking-wide text-gray-400">Fonction</dt>
                  <dd className="font-semibold text-primary-700 mt-0.5">{fonction}</dd>
                </>
              ) : null}
            </div>
          </dl>

          <div className="flex items-center justify-between pt-2 border-t border-dashed border-gray-200">
            <div className="flex items-center gap-1.5 text-gray-400">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="text-[10px] uppercase tracking-wide">Carte officielle</span>
            </div>
            <div className="rounded-lg border border-gray-100 p-1 bg-white shadow-sm">
              <QRCode value={membre.qr_code_value} size={80} />
            </div>
          </div>
        </div>
      </div>

      {/* Bouton export — hors de la zone capturée, jamais dans l'image exportée */}
      <button
        type="button"
        onClick={handleExportPng}
        disabled={exporting}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-60 transition-colors"
      >
        {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {exporting ? 'Export en cours...' : 'Exporter cette carte (PNG)'}
      </button>
    </div>
  );
}