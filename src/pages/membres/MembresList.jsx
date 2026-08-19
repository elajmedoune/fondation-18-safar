import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Pencil, Search, Plus, X, FileDown, ChevronDown, Filter, Users, Shield, Target, CalendarX, CheckCircle2, AlertCircle } from 'lucide-react';
import { useCampagneContext } from '../../contexts/CampagneContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useRole } from '../../hooks/useRole.js';
import { membresService } from '../../services/membres.service.js';
import { supabase } from '../../lib/supabaseClient.js';
import usePersistedState from '../../hooks/usePersistedState.js';
import PageHeader from '../../components/ui/PageHeader.jsx';

const inputCls = "rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 w-full focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-all";
const selectCls = "rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 w-full focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-all";

const BUREAU_BADGES = {
  administrateur: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  president: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  tresorier: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  secretaire: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

function getObjectif(sexe, campagne) {
  return sexe === 'feminin' ? Number(campagne?.cotisation_femme || 0) : Number(campagne?.cotisation_homme || 0);
}

function formatFCFApdf(n) {
  const num = Math.round(Number(n) || 0);
  const withSpaces = Math.abs(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (num < 0 ? '-' : '') + withSpaces + ' FCFA';
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(yyyymm) {
  if (!yyyymm) return '';
  const [y, m] = yyyymm.split('-');
  const date = new Date(Number(y), Number(m) - 1);
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
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

export default function MembresList() {
  const { campagneActive } = useCampagneContext();
  const { user } = useAuth();
  const { hasRole } = useRole();
  const queryClient = useQueryClient();
  const canCreateMembre = hasRole(['administrateur', 'president', 'secretaire', 'tresorier']);

  const [q, setQ] = usePersistedState('mem-q', '');
  const [showForm, setShowForm] = usePersistedState('mem-showForm', false);
  const [openExport, setOpenExport] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [filterBureau, setFilterBureau] = usePersistedState('mem-fbureau', false);
  const [filterResp, setFilterResp] = usePersistedState('mem-fresp', false);
  const [filterObjectif, setFilterObjectif] = usePersistedState('mem-fobj', false);
  const [filterMois, setFilterMois] = usePersistedState('mem-fmois', '');

  const [mNom, setMNom] = usePersistedState('mem-nom', '');
  const [mPrenom, setMPrenom] = usePersistedState('mem-prenom', '');
  const [mTelephone, setMTelephone] = usePersistedState('mem-tel', '');
  const [mSexe, setMSexe] = usePersistedState('mem-sexe', '');
  const [mGroupeId, setMGroupeId] = usePersistedState('mem-groupe', '');
  const [mFonction, setMFonction] = usePersistedState('mem-fonction', '');
  const [mPhotoFile, setMPhotoFile] = useState(null);
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const { data: fiches = [], isLoading } = useQuery({
    queryKey: ['membres-liste', campagneActive?.id],
    queryFn: () => membresService.getByCampagneAvecRoles(campagneActive.id),
    enabled: !!campagneActive?.id
  });

  const { data: groupes = [] } = useQuery({
    queryKey: ['groupes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('groupes').select('*').order('nom');
      if (error) throw error;
      return data;
    }
  });

  // Fetch cotisation totals per member for this campagne
  const { data: cotisationsMap = {} } = useQuery({
    queryKey: ['cotisations-tous-membres', campagneActive?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotisations')
        .select('membre_id, montant, mois_cotisation')
        .eq('campagne_id', campagneActive.id);
      if (error) throw error;
      const map = {};
      (data || []).forEach((c) => {
        if (!map[c.membre_id]) map[c.membre_id] = { total: 0, months: new Set() };
        map[c.membre_id].total += Number(c.montant);
        if (c.mois_cotisation) map[c.membre_id].months.add(c.mois_cotisation);
      });
      // Convert sets to arrays for serialisation
      Object.values(map).forEach((v) => { v.months = [...v.months]; });
      return map;
    },
    enabled: !!campagneActive?.id
  });

  const enriched = useMemo(() => {
    return fiches.map((f) => {
      const m = f.membre;
      const cotData = cotisationsMap[m?.id] || { total: 0, months: [] };
      const objectif = getObjectif(m?.sexe, campagneActive);
      const pct = objectif > 0 ? Math.min(100, Math.round((cotData.total / objectif) * 100)) : 0;
      const isBureau = !!f._roleBureau;
      const isResp = f.fonctionAffichee === 'Responsable de groupe';
      const hasPaidThisMonth = filterMois ? cotData.months.includes(filterMois) : true;
      const objectifAtteint = cotData.total >= objectif && objectif > 0;

      let colorStatus = 'default'; // default | green | orange | red
      if (objectif > 0) {
        if (cotData.total >= objectif) colorStatus = 'green';
        else if (cotData.total > 0) colorStatus = 'orange';
        else colorStatus = 'red';
      }

      return { ...f, cotTotal: cotData.total, cotMonths: cotData.months, objectif, pct, isBureau, isResp, hasPaidThisMonth, objectifAtteint, colorStatus };
    });
  }, [fiches, cotisationsMap, campagneActive, filterMois]);

  const filtered = useMemo(() => {
    let list = enriched;

    // Text search
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter((f) => {
        const m = f.membre;
        return (
          m?.nom?.toLowerCase().includes(term) ||
          m?.prenom?.toLowerCase().includes(term) ||
          m?.numero_membre?.toLowerCase().includes(term) ||
          m?.telephone?.includes(term) ||
          f.fonctionAffichee?.toLowerCase().includes(term)
        );
      });
    }

    if (filterBureau) list = list.filter((f) => f.isBureau);
    if (filterResp) list = list.filter((f) => f.isResp);
    if (filterObjectif) list = list.filter((f) => !f.objectifAtteint && f.objectif > 0);
    if (filterMois) list = list.filter((f) => !f.hasPaidThisMonth);

    return list;
  }, [enriched, q, filterBureau, filterResp, filterObjectif, filterMois]);

  const activeFilterCount = [filterBureau, filterResp, filterObjectif, filterMois].filter(Boolean).length;

  const resetForm = () => {
    setMNom(''); setMPrenom(''); setMTelephone(''); setMSexe('');
    setMGroupeId(''); setMFonction(''); setMPhotoFile(null);
    setFeedback(null);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!campagneActive) {
      setFeedback({ type: 'error', message: "Aucune campagne active." });
      return;
    }
    setCreating(true);
    setFeedback(null);
    try {
      let photo_url = null;
      if (mPhotoFile) photo_url = await membresService.uploadPhoto(mPhotoFile);
      await membresService.createWithGroupe(
        { nom: mNom, prenom: mPrenom, telephone: mTelephone, sexe: mSexe || null, photo_url, fonction: mFonction || null },
        campagneActive.id,
        mGroupeId || null,
        user.id
      );
      setFeedback({ type: 'success', message: `Membre ${mPrenom} ${mNom} créé.` });
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['membres-liste', campagneActive?.id] });
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message || 'Erreur lors de la création.' });
    } finally {
      setCreating(false);
    }
  };

  if (!campagneActive) return <p className="text-sm text-gray-500">Aucune campagne active.</p>;

  const handleExportPDF = async () => {
    setOpenExport(false);
    const [logo, { default: jsPDF }, { default: autoTable }] = await Promise.all([
      loadLogoBase64(), import('jspdf'), import('jspdf-autotable')
    ]);
    const doc = new jsPDF();
    if (logo) { try { doc.addImage(logo, 'JPEG', 178, 10, 18, 18); } catch {} }
    doc.setFontSize(16); doc.setTextColor(15, 118, 110);
    doc.text(`Membres - ${campagneActive.nom || campagneActive.annee}`, 14, 18);
    doc.setFontSize(10); doc.setTextColor(100);
    const filterDesc = activeFilterCount > 0 ? ` (${activeFilterCount} filtre${activeFilterCount > 1 ? 's' : ''})` : '';
    doc.text(`${filtered.length} membre(s)${filterDesc}`, 14, 25);
    doc.setDrawColor(15, 118, 110); doc.setLineWidth(0.5); doc.line(14, 30, 196, 30);
    autoTable(doc, {
      startY: 32,
      head: [['#', 'Nom', 'Prenom', 'N° Membre', 'Telephone', 'Sexe', 'Groupe', 'Fonction', 'Cotisé', 'Objectif']],
      body: filtered.map((f, i) => [
        i + 1,
        f.membre?.nom || '',
        f.membre?.prenom || '',
        f.membre?.numero_membre || '',
        f.membre?.telephone || '',
        f.membre?.sexe === 'masculin' ? 'M' : f.membre?.sexe === 'feminin' ? 'F' : '',
        f.groupe?.nom || '',
        f.fonctionAffichee || '',
        formatFCFApdf(f.cotTotal),
        formatFCFApdf(f.objectif)
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 253, 250] },
      margin: { left: 10, right: 10 }
    });
    for (let i = 1; i <= doc.internal.getNumberOfPages(); i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(150);
      doc.text(`Fondation 18 Safar - ${campagneActive.nom || ''}`, 14, doc.internal.pageSize.height - 10);
      doc.text(`Page ${i}/${doc.internal.getNumberOfPages()}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
    }
    doc.save(`membres-${campagneActive.annee}.pdf`);
  };

  const handleExportExcel = async () => {
    setOpenExport(false);
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(filtered.map((f, i) => ({
      '#': i + 1,
      'Nom': f.membre?.nom || '',
      'Prenom': f.membre?.prenom || '',
      'N° Membre': f.membre?.numero_membre || '',
      'Telephone': f.membre?.telephone || '',
      'Sexe': f.membre?.sexe || '',
      'Groupe': f.groupe?.nom || '',
      'Fonction': f.fonctionAffichee || '',
      'Cotisé': f.cotTotal,
      'Objectif': f.objectif
    })));
    ws['!cols'] = [{ wch: 4 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Membres');
    XLSX.writeFile(wb, `membres-${campagneActive.annee}.xlsx`);
  };

  const STATUS_BORDER = {
    green: 'border-l-4 border-l-green-500',
    orange: 'border-l-4 border-l-amber-400',
    red: 'border-l-4 border-l-red-400',
    default: '',
  };

  const STATUS_ICON = {
    green: <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />,
    orange: <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />,
    red: <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />,
    default: null,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Membres — ${campagneActive.annee}`}
        subtitle={`${filtered.length} membre${filtered.length !== 1 ? 's' : ''}${activeFilterCount > 0 ? ` (${activeFilterCount} filtre${activeFilterCount > 1 ? 's' : ''})` : ''}`}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setOpenExport(openExport ? null : 'menu')} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-800 px-3 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                <FileDown className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exporter</span> <ChevronDown className="h-3 w-3" />
              </button>
              {openExport === 'menu' && (
                <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
                  <button onClick={handleExportPDF} className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-colors">PDF</button>
                  <button onClick={handleExportExcel} className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Excel</button>
                </div>
              )}
            </div>
            {canCreateMembre && (
              <button
                onClick={() => { setShowForm(!showForm); resetForm(); }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary-700 text-white px-4 py-2.5 text-sm font-semibold hover:bg-primary-800 shadow-sm shadow-primary-700/20 transition-all"
              >
                {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {showForm ? 'Annuler' : 'Nouveau membre'}
              </button>
            )}
          </div>
        }
      />

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-5 space-y-3 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Nom" value={mNom} onChange={(e) => setMNom(e.target.value)} required className={inputCls} />
            <input placeholder="Prénom" value={mPrenom} onChange={(e) => setMPrenom(e.target.value)} required className={inputCls} />
            <select value={mSexe} onChange={(e) => setMSexe(e.target.value)} className={selectCls}>
              <option value="">Sexe...</option>
              <option value="masculin">Masculin</option>
              <option value="feminin">Féminin</option>
            </select>
            <input placeholder="Téléphone (optionnel)" value={mTelephone} onChange={(e) => setMTelephone(e.target.value)} className={inputCls} />
            <select value={mGroupeId} onChange={(e) => setMGroupeId(e.target.value)} className={`sm:col-span-2 ${selectCls}`}>
              <option value="">Groupe...</option>
              {groupes.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}
            </select>
            <input placeholder="Fonction (ex: Chef d'équipe, Chauffeur...)" value={mFonction} onChange={(e) => setMFonction(e.target.value)} className={`sm:col-span-2 ${inputCls}`} />
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 block mb-1.5">Photo (optionnel)</label>
              <input type="file" accept="image/*" onChange={(e) => setMPhotoFile(e.target.files?.[0] || null)} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900/30 dark:file:text-primary-400 hover:file:bg-primary-100" />
            </div>
          </div>
          <button type="submit" disabled={creating} className="w-full rounded-xl bg-primary-700 text-white py-2.5 text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 shadow-sm shadow-primary-700/20 transition-all">
            {creating ? 'Création...' : 'Créer le membre'}
          </button>
          {feedback && <p className={`text-sm ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{feedback.message}</p>}
        </form>
      )}

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un membre..."
              className="w-full pl-10 pr-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all shrink-0 ${
              showFilters || activeFilterCount > 0
                ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                : 'border-gray-200 dark:border-gray-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filtres
            {activeFilterCount > 0 && (
              <span className="ml-0.5 h-4 w-4 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Filtres avancés</span>
              {activeFilterCount > 0 && (
                <button onClick={() => { setFilterBureau(false); setFilterResp(false); setFilterObjectif(false); setFilterMois(''); }} className="text-xs text-primary-600 hover:underline">
                  Tout effacer
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => setFilterBureau(!filterBureau)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium border transition-all ${
                  filterBureau ? 'border-purple-300 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Shield className="h-3.5 w-3.5" /> Bureau
              </button>
              <button
                onClick={() => setFilterResp(!filterResp)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium border transition-all ${
                  filterResp ? 'border-sky-300 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Users className="h-3.5 w-3.5" /> Responsables
              </button>
              <button
                onClick={() => setFilterObjectif(!filterObjectif)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium border transition-all ${
                  filterObjectif ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Target className="h-3.5 w-3.5" /> Objectif non atteint
              </button>
              <div className="relative">
                <CalendarX className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="month"
                  value={filterMois}
                  onChange={(e) => setFilterMois(e.target.value)}
                  className={`w-full appearance-none rounded-xl border pl-8 pr-2 py-2 text-xs font-medium transition-all ${
                    filterMois ? 'border-red-300 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-300' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                  title="Pas cotisé ce mois"
                />
              </div>
            </div>
            <p className="text-[10px] text-gray-400">Les filtres se combinent. Le filtre mois affiche les membres qui n'ont <strong>pas</strong> cotisé pour le mois sélectionné.</p>
          </div>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-700 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">Aucun membre trouvé.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800/50 rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 shadow-sm overflow-hidden">
          {filtered.map((f, i) => (
            <li key={f.id || f.membre?.id || i} className={STATUS_BORDER[f.colorStatus]}>
              <Link to={`/membres/${f.membre?.id}`} className="flex items-center justify-between gap-4 px-4 py-3.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  {f.membre?.photo_url ? (
                    <img src={f.membre.photo_url} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-gray-100 dark:ring-gray-800 shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/40 dark:to-primary-800/40 flex items-center justify-center text-primary-700 dark:text-primary-400 text-xs font-bold shrink-0">
                      {f.membre?.prenom?.[0]}{f.membre?.nom?.[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{f.membre?.prenom} {f.membre?.nom}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-gray-500 dark:text-gray-400 text-xs truncate">
                        N° {f.membre?.numero_membre} {f.groupe?.nom ? `· ${f.groupe.nom}` : ''}
                      </span>
                      {f.fonctionAffichee && (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${BUREAU_BADGES[f._roleBureau] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                          {f.fonctionAffichee}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {STATUS_ICON[f.colorStatus]}
                  {f.objectif > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      f.colorStatus === 'green' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      f.colorStatus === 'orange' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {f.pct}%
                    </span>
                  )}
                  <Pencil className="h-4 w-4 text-gray-300 dark:text-gray-600 shrink-0" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
