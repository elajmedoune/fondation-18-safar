import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileDown, Wallet, Calendar, Pencil, X, Camera, Loader2, CreditCard, AlertCircle } from 'lucide-react';
import { useCampagneContext } from '../../contexts/CampagneContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { membresService } from '../../services/membres.service.js';
import { invalidateAll } from '../../lib/invalidateAll.js';
import { cotisationsService } from '../../services/cotisations.service.js';
import { supabase } from '../../lib/supabaseClient.js';
import { bustCache } from '../../lib/bustCache.js';
import BackButton from '../../components/ui/BackButton.jsx';

const MODES_PAIEMENT = [
  { value: 'especes', label: 'Espèces' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'virement', label: 'Virement' },
  { value: 'cheque', label: 'Chèque' },
  { value: 'autre', label: 'Autre' }
];

function formatFCFA(n) {
  return new Intl.NumberFormat('fr-FR').format(Number(n || 0)) + ' FCFA';
}

function formatFCFApdf(n) {
  // On formate a la main (sans Intl/toLocaleString) car les separateurs de
  // milliers renvoyes par la locale fr-FR (espace insecable fine, \u202F)
  // ne sont pas geres par la police standard de jsPDF : ils s'affichaient
  // comme un "/" et decalaient l'espacement de tout le texte.
  const num = Math.round(Number(n) || 0);
  const withSpaces = Math.abs(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (num < 0 ? '-' : '') + withSpaces + ' FCFA';
}

function getMonthLabel(yyyymm) {
  if (!yyyymm || yyyymm === 'Non daté') return 'Non daté';
  const [y, m] = yyyymm.split('-');
  const date = new Date(Number(y), Number(m) - 1);
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function getObjectif(sexe, campagne) {
  return sexe === 'feminin' ? Number(campagne?.cotisation_femme || 0) : Number(campagne?.cotisation_homme || 0);
}

async function loadLogoBase64() {
  try {
    const res = await fetch('/logo.jpeg');
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

const inputCls = "rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 w-full focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all";
const selectCls = "rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 w-full focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all";

export default function MembreProfil() {
  const { id } = useParams();
  const { campagneActive } = useCampagneContext();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [carteVendue, setCarteVendue] = useState(false);
  // Passer un payeur de "officiel" a "non officiel" est une decision
  // consequente : elle bloque ses cotisations futures. Elle exige donc une
  // confirmation explicite, pas un simple enregistrement.
  const [confirmeSansCarte, setConfirmeSansCarte] = useState(false);
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [sexe, setSexe] = useState('');
  const [groupeId, setGroupeId] = useState('');
  const [fonction, setFonction] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);
  const blobRef = useRef(null);

  const { data: fiche, isLoading } = useQuery({
    queryKey: ['membre-fiche', id, campagneActive?.id],
    queryFn: () => membresService.getFicheMembre(id, campagneActive.id),
    enabled: !!id && !!campagneActive?.id
  });

  const { data: roleBureau } = useQuery({
    queryKey: ['membre-role', fiche?.user_id, campagneActive?.id],
    queryFn: async () => {
      if (!fiche?.user_id || !campagneActive?.id) return null;
      // Bureau = rôle porté par la campagne active ; seul "administrateur" est global.
      // Filtre en JavaScript plutôt qu'en "or(and(...))" PostgREST : même logique
      // que notifications.service.js, sans la syntaxe de filtre imbriqué fragile.
      const { data, error } = await supabase
        .from('user_roles')
        .select('role, campagne_id')
        .eq('user_id', fiche.user_id)
        .in('role', ['president', 'tresorier', 'secretaire', 'administrateur']);
      if (error) throw error;
      if (!data?.length) return null;
      const pertinent = data.filter((r) =>
        r.role === 'administrateur' ? r.campagne_id == null : r.campagne_id === campagneActive.id
      );
      if (!pertinent.length) return null;
      const PRIORITY = ['administrateur', 'president', 'tresorier', 'secretaire'];
      const LABELS = { administrateur: 'Administrateur', president: 'Président', tresorier: 'Trésorier', secretaire: 'Secrétaire' };
      const best = PRIORITY.find((r) => pertinent.some((d) => d.role === r));
      return best ? LABELS[best] : null;
    },
    enabled: !!fiche?.user_id && !!campagneActive?.id
  });

  const { data: groupes = [] } = useQuery({
    queryKey: ['groupes', campagneActive?.id],
    enabled: !!campagneActive?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('groupes').select('*').eq('campagne_id', campagneActive.id).order('nom');
      if (error) throw error;
      return data;
    }
  });

  const { data: cotisations = [], isLoading: loadingCotisations } = useQuery({
    queryKey: ['cotisations-membre', id, campagneActive?.id],
    queryFn: () => cotisationsService.listByMembre(id, campagneActive.id),
    enabled: !!id && !!campagneActive?.id
  });

  const { data: totalCotisations = 0 } = useQuery({
    queryKey: ['cotisations-membre-total', id, campagneActive?.id],
    queryFn: () => cotisationsService.totalByMembre(id, campagneActive.id),
    enabled: !!id && !!campagneActive?.id
  });

  useEffect(() => {
    if (!fiche) return;
    const cm = fiche.campagne_membres?.[0];
    setNom(fiche.nom || '');
    setPrenom(fiche.prenom || '');
    setTelephone(fiche.telephone || '');
    setSexe(fiche.sexe || '');
    setGroupeId(cm?.groupe?.id || '');
    setFonction(cm?.fonction || '');
    setCarteVendue(fiche.carte_vendue === true);
  }, [fiche]);

  const startEdit = () => {
    if (!fiche) return;
    const cm = fiche.campagne_membres?.[0];
    setNom(fiche.nom || '');
    setPrenom(fiche.prenom || '');
    setTelephone(fiche.telephone || '');
    setSexe(fiche.sexe || '');
    setGroupeId(cm?.groupe?.id || '');
    setFonction(cm?.fonction || '');
    setCarteVendue(fiche.carte_vendue === true);
    setConfirmeSansCarte(false);
    setPhotoUrl('');
    setPhotoPreview('');
    setEditing(true);
    setFeedback(null);
  };

  // L'upload part immédiatement à la sélection : l'aperçu est visible dans le
  // formulaire, et l'URL n'est écrite en base qu'au clic sur "Enregistrer"
  // (champ photo_url), avec le reste des modifications.
  const handlePhotoPick = async (e) => {
    const file = e.target.files?.[0];
    // Réinitialise le champ : sans cela, resélectionner le même fichier ne
    // déclencherait pas onChange.
    e.target.value = '';
    if (!file) return;
    setUploadingPhoto(true);
    setFeedback(null);
    // Aperçu local immédiat. L'objet blob est libéré dès qu'il est remplacé
    // par l'URL publique, sinon il reste en mémoire toute la session.
    const apercu = URL.createObjectURL(file);
    if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    blobRef.current = apercu;
    setPhotoPreview(apercu);
    try {
      const uploaded = await membresService.uploadPhoto(file, id);
      setPhotoUrl(uploaded);
      setPhotoPreview(uploaded);
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    } catch (err) {
      console.error(err);
      setPhotoPreview('');
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
      setFeedback({ type: 'error', message: `Erreur : ${err?.message || err}` });
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Retrait de carte sur un membre qui a deja paye : on doit montrer le
  // montant avant validation.
  const retraitCarte = fiche?.carte_vendue === true && carteVendue === false && cotisations.length > 0;
  const savingBlocked = retraitCarte && !confirmeSansCarte;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      // photo_url n'est envoyé que si une nouvelle photo a été importée : sinon
      // on réécrirait la valeur existante et la purge de l'ancien fichier
      // (faite dans update()) porterait sur le fichier courant.
      const patch = { nom, prenom, telephone: telephone || null, sexe: sexe || null, carte_vendue: carteVendue };
      if (photoUrl) patch.photo_url = photoUrl;
      await membresService.update(id, patch, { userId: user.id, campagneId: campagneActive.id });
      const campagneMembreId = fiche?.campagne_membres?.[0]?.id;
      if (campagneMembreId) {
        // La fonction est portée par campagne_membres (ex: "Adjoint président")
        await membresService.updateFicheCampagne(campagneMembreId, { groupe_id: groupeId || null, fonction: fonction || null });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['membre-fiche', id, campagneActive?.id] }),
        queryClient.invalidateQueries({ queryKey: ['membres-liste', campagneActive?.id] }),
      ]);
      invalidateAll(queryClient);
      setEditing(false);
      setFeedback({ type: 'success', message: 'Modifications enregistrées.' });
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message || "Erreur." });
    } finally { setSaving(false); }
  };

  const handleExportReceipt = async () => {
    const [logo, { default: jsPDF }, { default: autoTable }] = await Promise.all([
      loadLogoBase64(), import('jspdf'), import('jspdf-autotable')
    ]);

    const objectif = getObjectif(fiche.sexe, campagneActive);
    const reste = Math.max(0, objectif - Number(totalCotisations));
    const pct = Math.min(100, Math.round((Number(totalCotisations) / objectif) * 100));
    const doc = new jsPDF();

    if (logo) { try { doc.addImage(logo, 'JPEG', 178, 10, 18, 18); } catch {} }

    doc.setFontSize(16); doc.setTextColor(15, 118, 110);
    doc.text('Recu de cotisations', 14, 18);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`Campagne ${campagneActive.nom || campagneActive.annee}`, 14, 25);
    doc.setDrawColor(15, 118, 110); doc.setLineWidth(0.5);
    doc.line(14, 30, 196, 30);

    doc.setFontSize(11); doc.setTextColor(40);
    let y = 35;
    doc.text(`Membre : ${fiche.prenom} ${fiche.nom}`, 14, y); y += 6;
    doc.text(`Numero : ${fiche.numero_membre}`, 14, y); y += 6;
    if (fiche.sexe) { doc.text(`Sexe : ${fiche.sexe === 'masculin' ? 'Masculin' : 'Feminin'}`, 14, y); y += 6; }
    if (fiche.telephone) { doc.text(`Telephone : ${fiche.telephone}`, 14, y); y += 6; }

    y += 2;
    doc.setDrawColor(200); doc.setLineWidth(0.3);
    doc.line(14, y, 196, y); y += 6;

    doc.setFontSize(12); doc.setTextColor(15, 118, 110);
    doc.text(`Objectif : ${formatFCFApdf(objectif)}`, 14, y); y += 7;
    doc.setFontSize(11); doc.setTextColor(40);
    doc.text(`Total cotise : ${formatFCFApdf(totalCotisations)}`, 14, y); y += 6;
    doc.text(`Reste a cotiser : ${formatFCFApdf(reste)}`, 14, y); y += 6;
    doc.text(`Progression : ${pct}%`, 14, y); y += 6;

    doc.setDrawColor(200); doc.setLineWidth(0.3);
    doc.line(14, y, 196, y); y += 8;

    autoTable(doc, {
      startY: y,
      head: [['#', 'Mois couvert', 'Montant', 'Mode', 'Date paiement', 'Note']],
      body: cotisations.map((c, i) => [
        i + 1,
        c.mois_cotisation ? getMonthLabel(c.mois_cotisation) : '-',
        formatFCFApdf(c.montant),
        MODES_PAIEMENT.find((m) => m.value === c.mode_paiement)?.label || c.mode_paiement || '',
        c.date_paiement ? new Date(c.date_paiement).toLocaleDateString('fr-FR') : '',
        c.note || ''
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 253, 250] },
      margin: { left: 14, right: 14 }
    });

    for (let i = 1; i <= doc.internal.getNumberOfPages(); i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(150);
      doc.text(`Fondation 18 Safar - ${campagneActive.nom || ''}`, 14, doc.internal.pageSize.height - 10);
      doc.text(`Page ${i}/${doc.internal.getNumberOfPages()}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
    }

    doc.save(`recu-${fiche.prenom}-${fiche.nom}-${campagneActive.annee}.pdf`);
  };

  if (!campagneActive) return <p className="text-sm text-gray-500 p-4">Aucune campagne active.</p>;
  if (isLoading) return <div className="flex items-center justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-700 border-t-transparent" /></div>;
  if (!fiche) return <p className="text-sm text-gray-500 p-4">Membre introuvable.</p>;

  const cm = fiche.campagne_membres?.[0];
  const objectif = getObjectif(fiche.sexe, campagneActive);
  const cotise = Number(totalCotisations);
  const reste = Math.max(0, objectif - cotise);
  const pct = Math.min(100, Math.round((cotise / objectif) * 100));

  return (
    <div className="space-y-5 max-w-2xl mx-auto px-1 sm:px-0">
      <BackButton to="/membres" label="Membres" />

      {/* Header membre */}
      <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col xs:flex-row items-start xs:items-center gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 w-full">
            {fiche.photo_url ? (
              <img src={fiche.photo_url} alt="" className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover ring-2 ring-primary-100 dark:ring-primary-900/40 shrink-0" />
            ) : (
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/40 dark:to-primary-800/40 flex items-center justify-center text-primary-700 dark:text-primary-400 text-lg sm:text-xl font-bold shrink-0">
                {fiche.prenom?.[0]}{fiche.nom?.[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">{fiche.prenom} {fiche.nom}</h1>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  N° {fiche.numero_membre}
                  {cm?.groupe?.nom ? ` · ${cm.groupe.nom}` : ''}
                </p>
                {/* Meme marqueur que dans la liste : pastille pleine verte pour
                    un officiel, bordure pointillee ambre sinon. */}
                <span
                  title={fiche.carte_vendue
                    ? 'Carte achetee : membre officiel, il peut cotiser'
                    : "Carte non achetee : ce membre ne peut pas cotiser. Utiliser le crayon pour enregistrer l'achat."}
                  className={`inline-flex items-center gap-1 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    fiche.carte_vendue
                      ? 'border-emerald-300/70 bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-800 dark:border-emerald-700 dark:from-emerald-900/40 dark:to-emerald-800/30 dark:text-emerald-300'
                      : 'border-dashed border-amber-300/70 bg-amber-50/60 text-amber-800 dark:border-amber-700/80 dark:bg-amber-950/30 dark:text-amber-400'
                  }`}
                >
                  <CreditCard className="h-3 w-3 shrink-0" strokeWidth={2.5} />
                  {fiche.carte_vendue ? 'Officiel' : 'Non officiel'}
                </span>
                {roleBureau && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 text-[10px] font-semibold tracking-wide shrink-0">
                    {roleBureau}
                  </span>
                )}
                {(!roleBureau && cm?.fonction) && (
                  <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 px-2 py-0.5 text-[10px] font-semibold tracking-wide shrink-0">
                    {cm.fonction}
                  </span>
                )}
              </div>
              {fiche.sexe && <p className="text-xs text-gray-400 mt-0.5 truncate">{fiche.sexe === 'masculin' ? 'Masculin' : 'Féminin'}{fiche.telephone ? ` · ${fiche.telephone}` : ''}</p>}
              {!fiche.carte_vendue && (
                <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-300">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" />
                  <span>
                    Carte non achetée : ce membre ne peut pas cotiser.
                    Si la carte vient d'être vendue, cliquez sur le crayon puis cochez « A déjà acheté sa carte ».
                  </span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={startEdit}
            className="w-full xs:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-800 px-3 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700 transition-all"
          >
            <Pencil className="h-3.5 w-3.5" /> Modifier
          </button>
        </div>
      </div>

      {editing && (
        <form onSubmit={handleSave} className="rounded-2xl border border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/20 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-primary-800 dark:text-primary-300">Modifier les informations</h3>
            <button type="button" onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600 p-1 -mr-1"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex items-center gap-3 pb-1">
            {photoPreview ? (
              <img src={bustCache(photoPreview, 0)} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-primary-300 dark:ring-primary-700 shrink-0" />
            ) : fiche.photo_url ? (
              <img src={fiche.photo_url} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-primary-100 dark:ring-primary-900/40 shrink-0" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/40 dark:to-primary-800/40 flex items-center justify-center text-primary-700 dark:text-primary-400 text-lg font-bold shrink-0">
                {fiche.prenom?.[0]}{fiche.nom?.[0]}
              </div>
            )}
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary-300 dark:border-primary-700 px-3 py-2 text-xs font-medium text-primary-800 dark:text-primary-300 hover:bg-primary-100/60 dark:hover:bg-primary-900/30 disabled:opacity-50 transition-all"
              >
                {uploadingPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                {uploadingPhoto ? 'Import...' : (fiche.photo_url ? 'Changer la photo' : 'Ajouter une photo')}
              </button>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                {photoUrl
                  ? 'Photo importée. Cliquez sur « Enregistrer » pour valider.'
                  : "L'image est envoyée immédiatement, puis validée avec le reste."}
              </p>
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoPick} disabled={uploadingPhoto} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)} required className={inputCls} />
            <input placeholder="Prénom" value={prenom} onChange={(e) => setPrenom(e.target.value)} required className={inputCls} />
            <select value={sexe} onChange={(e) => setSexe(e.target.value)} className={selectCls}>
              <option value="">Sexe...</option>
              <option value="masculin">Masculin</option>
              <option value="feminin">Féminin</option>
            </select>
            <input placeholder="Téléphone" value={telephone} onChange={(e) => setTelephone(e.target.value)} className={inputCls} />
            <select value={groupeId} onChange={(e) => setGroupeId(e.target.value)} className={selectCls}>
              <option value="">Groupe...</option>
              {groupes.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}
            </select>
            <input placeholder="Fonction (ex: Chef d'équipe, Chauffeur...)" value={fonction} onChange={(e) => setFonction(e.target.value)} className={inputCls} />
            {/* Seul un membre ayant achete sa carte peut cotiser. */}
            <label className="sm:col-span-2 flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={carteVendue}
                onChange={(e) => { setCarteVendue(e.target.checked); setConfirmeSansCarte(false); }}
                className="h-4 w-4 rounded border-gray-300 text-primary-700 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                A déjà acheté sa carte
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  Décocher cette case empêche le membre de cotiser.
                </span>
              </span>
            </label>
            {retraitCarte && (
              <div className="sm:col-span-2 rounded-xl border border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/50 px-3 py-2.5 space-y-2">
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                  Ce membre a {cotisations.length} cotisation{cotisations.length > 1 ? 's' : ''} pour{' '}
                  {Number(totalCotisations || 0).toLocaleString('fr-FR')} FCFA.
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Les cotisations déjà enregistrées sont conservées : l'argent est
                  encaissé, cette case ne l'annule pas. En revanche, ce membre ne
                  pourra plus cotiser.
                </p>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmeSansCarte}
                    onChange={(e) => setConfirmeSansCarte(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-xs text-amber-900 dark:text-amber-200">
                    Je confirme vouloir retirer la carte de ce membre
                  </span>
                </label>
              </div>
            )}
          </div>
          <button type="submit" disabled={saving || savingBlocked} className="w-full rounded-xl bg-primary-700 text-white py-2.5 text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 shadow-sm shadow-primary-700/20 transition-all">
            {saving ? 'Enregistrement...' : savingBlocked ? 'Confirmation requise' : 'Enregistrer'}
          </button>
        </form>
      )}

      {feedback && <p className={`text-sm ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{feedback.message}</p>}

      {/* Progression cotisation */}
      <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
            <Wallet className="h-4 w-4 text-primary-600 shrink-0" /> Cotisations
          </h2>
          <button
            onClick={handleExportReceipt}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-800 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700 transition-all shrink-0"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Reçu </span>PDF
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm gap-2">
            <span className="text-gray-500 truncate">Objectif ({fiche.sexe === 'feminin' ? 'Femme' : 'Homme'})</span>
            <span className="font-semibold shrink-0">{formatFCFA(objectif)}</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-gradient-to-r from-primary-500 to-primary-600'}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-500 flex-wrap gap-x-3 gap-y-1">
            <span>Cotisé : <span className="font-semibold text-green-600">{formatFCFA(cotise)}</span></span>
            <span>Reste : <span className={`font-semibold ${reste > 0 ? 'text-amber-600' : 'text-green-600'}`}>{formatFCFA(reste)}</span></span>
          </div>
          <p className="text-xs text-gray-400 text-right font-medium">{pct}%</p>
        </div>

        {loadingCotisations ? (
          <div className="flex items-center justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-700 border-t-transparent" />
          </div>
        ) : cotisations.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Aucune cotisation.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800/50">
            {cotisations.map((c) => {
              const moisLabel = c.mois_cotisation ? getMonthLabel(c.mois_cotisation) : null;
              const isLate = moisLabel && c.date_paiement && c.mois_cotisation !== c.date_paiement?.slice(0, 7);
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-green-600">+{formatFCFA(c.montant)}</p>
                    <p className="text-gray-500 text-xs truncate">
                      {new Date(c.date_paiement).toLocaleDateString('fr-FR')} · {MODES_PAIEMENT.find((m) => m.value === c.mode_paiement)?.label}
                      {c.note ? ` · ${c.note}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {isLate && <p className="text-xs text-amber-600 flex items-center gap-1 justify-end"><Calendar className="h-3 w-3" /> {moisLabel}</p>}
                    {!isLate && moisLabel && <p className="text-xs text-gray-400">{moisLabel}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}