import { useEffect, useRef, useState } from 'react';
import { QrCode as QrCodeIcon, User, Wallet, Eye, Link2, Clock, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useRole } from '../../hooks/useRole.js';
import { useCampagneContext } from '../../contexts/CampagneContext.jsx';
import { membresService } from '../../services/membres.service.js';
import { cotisationsService } from '../../services/cotisations.service.js';
import { unlockAudio, playScanSuccess, playScanError } from '../../lib/sounds.js';
import PageHeader from '../../components/ui/PageHeader.jsx';

const inputCls = "rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 w-full focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all";
const selectCls = "rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 w-full focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all";

const MODES_PAIEMENT = [
  { value: 'especes', label: 'Espèces' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'virement', label: 'Virement' },
  { value: 'cheque', label: 'Chèque' },
  { value: 'autre', label: 'Autre' }
];

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatFCFA(n) {
  return new Intl.NumberFormat('fr-FR').format(Number(n || 0)) + ' FCFA';
}

function RoleBadge({ role }) {
  const styles = {
    administrateur: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    president: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    tresorier: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    secretaire: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    responsable: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  };
  const labels = {
    administrateur: 'Admin',
    president: 'Président',
    tresorier: 'Trésorier',
    secretaire: 'Secrétaire',
    responsable: 'Responsable',
  };
  if (!role) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${styles[role] || 'bg-gray-100 text-gray-600'}`}>
      {labels[role] || role}
    </span>
  );
}

export default function ScanQR() {
  const { user } = useAuth();
  const { hasRole } = useRole();
  const { campagneActive } = useCampagneContext();

  const videoRef = useRef(null);
  const controlsRef = useRef(null);

  const [scanning, setScanning] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [membre, setMembre] = useState(null);
  const [lookupError, setLookupError] = useState(null);
  const [cotisationsHistory, setCotisationsHistory] = useState([]);

  const peutEncaisser = hasRole(['tresorier', 'president', 'administrateur']);
  const peutVoirFiche = hasRole(['tresorier', 'president', 'administrateur', 'secretaire']);

  // --- Formulaire cotisation rapide (trésorier) ---
  const [montant, setMontant] = useState('');
  const [modePaiement, setModePaiement] = useState('especes');
  const [moisCotisation, setMoisCotisation] = useState(getCurrentMonth());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Scan history (persisted in sessionStorage)
  const [scanHistory, setScanHistory] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('scanHistory') || '[]');
    } catch { return []; }
  });

  useEffect(() => {
    if (!scanning || !cameraActive) return;
    const reader = new BrowserQRCodeReader();
    let cancelled = false;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, err, controls) => {
        controlsRef.current = controls;
        if (cancelled || !result) return;
        controls.stop();
        setScanning(false);
        handleDetected(result.getText());
      })
      .catch((err) => {
        console.error(err);
        setCameraError("Impossible d'accéder à la caméra. Vérifie les autorisations du navigateur.");
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, cameraActive]);

  const handleDetected = async (qrValue) => {
    setLookupError(null);
    setMembre(null);
    setCotisationsHistory([]);
    try {
      const data = await membresService.getFicheByQrCode(qrValue, campagneActive?.id);
      if (!data) {
        playScanError();
        setLookupError("Aucun membre ne correspond à ce code pour la campagne active.");
        return;
      }
      playScanSuccess();
      setMembre(data);

      // Add to scan history
      const entry = {
        id: data.id,
        nom: data.nom,
        prenom: data.prenom,
        numero_membre: data.numero_membre,
        photo_url: data.photo_url,
        timestamp: Date.now(),
      };
      setScanHistory((prev) => {
        const next = [entry, ...prev.filter((h) => h.id !== data.id)].slice(0, 10);
        sessionStorage.setItem('scanHistory', JSON.stringify(next));
        return next;
      });

      // Load cotisation history if user can see it
      if (peutEncaisser && campagneActive?.id) {
        try {
          const cotisations = await cotisationsService.listByMembre(data.id, campagneActive.id);
          setCotisationsHistory(cotisations || []);
        } catch { /* ignore */ }
      }
    } catch (err) {
      console.error(err);
      playScanError();
      setLookupError("Erreur lors de la recherche du membre.");
    }
  };

  const resetScan = () => {
    setMembre(null);
    setLookupError(null);
    setFeedback(null);
    setCotisationsHistory([]);
    setMontant('');
    setModePaiement('especes');
    setMoisCotisation(getCurrentMonth());
    setNote('');
    setScanning(true);
    setCameraActive(true);
  };

  const handleCotisation = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await cotisationsService.create({
        campagneId: campagneActive.id,
        membreId: membre.id,
        montant: Number(montant),
        modePaiement,
        note: note || null,
        userId: user.id,
        moisCotisation: moisCotisation || null,
      });
      setFeedback({ type: 'success', message: 'Cotisation enregistrée avec succès.' });
      setMontant('');
      setNote('');

      // Refresh cotisation history
      if (campagneActive?.id) {
        try {
          const cotisations = await cotisationsService.listByMembre(membre.id, campagneActive.id);
          setCotisationsHistory(cotisations || []);
        } catch { /* ignore */ }
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: "Erreur lors de l'enregistrement de la cotisation." });
    } finally {
      setSaving(false);
    }
  };

  const fiche = membre?.campagne_membres?.[0];
  const totalCotisations = cotisationsHistory.reduce((s, c) => s + Number(c.montant), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Scanner un QR Code"
        subtitle={membre ? `${membre.prenom} ${membre.nom}` : 'Présentez la carte de membre devant la caméra'}
      />

      {/* Camera / Scanner */}
      {!membre && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 shadow-sm overflow-hidden max-w-sm mx-auto">
            {cameraActive ? (
              <div className="relative aspect-square bg-black">
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                {/* Scanning overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-2 border-white/40 rounded-2xl">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary-400 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary-400 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary-400 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary-400 rounded-br-lg" />
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { unlockAudio(); setCameraActive(true); }}
                className="w-full flex flex-col items-center justify-center gap-3 aspect-square max-w-[280px] mx-auto bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-2xl"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white dark:bg-gray-800 shadow-sm">
                  <QrCodeIcon className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Activer la caméra</p>
                  <p className="text-xs text-gray-400 mt-1">Scanner le QR code d'un membre</p>
                </div>
              </button>
            )}
          </div>

          {cameraError && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-red-700 dark:text-red-400">{cameraError}</p>
                <button onClick={() => { setCameraError(null); setCameraActive(true); }} className="mt-2 text-xs font-medium text-red-600 hover:text-red-800 underline">
                  Réessayer
                </button>
              </div>
            </div>
          )}

          {lookupError && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-400">{lookupError}</p>
              </div>
              <button onClick={resetScan} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary-700 text-white py-2.5 text-sm font-semibold hover:bg-primary-800 shadow-sm transition-all">
                <RefreshCw className="h-4 w-4" />
                Scanner à nouveau
              </button>
            </div>
          )}

          {/* Role hint */}
          {peutEncaisser && !cameraActive && !cameraError && (
            <div className="flex items-center gap-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200/70 dark:border-green-800/50 p-3">
              <Wallet className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
              <p className="text-xs text-green-700 dark:text-green-400">
                Mode encaisse : après le scan, vous pourrez enregistrer une cotisation directement.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Member result */}
      {membre && (
        <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 shadow-sm overflow-hidden">
          {/* Member header */}
          <div className="p-5 pb-4">
            <div className="flex items-center gap-4">
              {membre.photo_url ? (
                <img src={membre.photo_url} alt="" className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-sm" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/40 dark:to-primary-800/40 flex items-center justify-center text-primary-700 dark:text-primary-400 text-base font-bold">
                  {membre.prenom?.[0]}{membre.nom?.[0]}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 dark:text-white truncate">{membre.prenom} {membre.nom}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">N° {membre.numero_membre}</p>
                <div className="flex items-center gap-2 mt-1">
                  <RoleBadge role={fiche?.fonction?.toLowerCase()} />
                  {fiche?.groupe?.nom && (
                    <span className="text-xs text-gray-400">{fiche.groupe.nom}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Cotisation history (for encaisseurs) */}
          {peutEncaisser && cotisationsHistory.length > 0 && (
            <div className="px-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cotisations cette campagne</p>
                <p className="text-xs font-bold text-green-600">{formatFCFA(totalCotisations)}</p>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {cotisationsHistory.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <span className="text-gray-600 dark:text-gray-400">
                      {c.mois_cotisation || '—'} · {MODES_PAIEMENT.find((m) => m.value === c.mode_paiement)?.label || ''}
                    </span>
                    <span className="font-medium text-green-600">{formatFCFA(c.montant)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 dark:border-gray-800" />

          {/* Cotisation form (tresorier/president/admin) */}
          {peutEncaisser && (
            <form onSubmit={handleCotisation} className="p-5 space-y-3">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Enregistrer une cotisation</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="number" min="1" step="1" placeholder="Montant (FCFA)"
                  value={montant} onChange={(e) => setMontant(e.target.value)} required
                  className={inputCls}
                />
                <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)} className={selectCls}>
                  {MODES_PAIEMENT.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <input type="month" value={moisCotisation} onChange={(e) => setMoisCotisation(e.target.value)} className={inputCls} title="Mois couvert par cette cotisation" />
              <input placeholder="Note (optionnel)" value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
              <button type="submit" disabled={saving} className="w-full rounded-xl bg-primary-700 text-white py-2.5 text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 shadow-sm shadow-primary-700/20 transition-all">
                {saving ? 'Enregistrement...' : 'Enregistrer la cotisation'}
              </button>
              {feedback && (
                <div className={`flex items-center gap-2 text-sm ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  {feedback.message}
                </div>
              )}
            </form>
          )}

          {/* Actions for non-encaisseurs */}
          {!peutEncaisser && (
            <div className="p-5 space-y-2">
              {peutVoirFiche && (
                <Link to={`/membres/${membre.id}`} className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary-700 text-white py-2.5 text-sm font-semibold hover:bg-primary-800 shadow-sm transition-all">
                  <Eye className="h-4 w-4" />
                  Voir la fiche complète
                </Link>
              )}
              {!peutVoirFiche && (
                <div className="text-center py-2 text-sm text-gray-500">
                  <User className="h-5 w-5 mx-auto mb-1 opacity-40" />
                  Membre identifié
                </div>
              )}
            </div>
          )}

          {/* Bottom actions */}
          <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-3 flex items-center gap-3">
            <button onClick={resetScan} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
              <RefreshCw className="h-4 w-4" />
              Scanner un autre
            </button>
            {peutVoirFiche && (
              <Link to={`/membres/${membre.id}`} className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                <Link2 className="h-4 w-4" />
                Fiche
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Scan history */}
      {!membre && scanHistory.length > 0 && (
        <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 pt-4 pb-2">
            <Clock className="h-3.5 w-3.5 text-gray-400" />
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Scans récents</p>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800/50">
            {scanHistory.map((h) => (
              <li key={h.id + h.timestamp} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                {h.photo_url ? (
                  <img src={h.photo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 text-xs font-bold">
                    {h.prenom?.[0]}{h.nom?.[0]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{h.prenom} {h.nom}</p>
                  <p className="text-xs text-gray-400">N° {h.numero_membre}</p>
                </div>
                <p className="text-[10px] text-gray-400 shrink-0">
                  {new Date(h.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
