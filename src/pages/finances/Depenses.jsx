import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Receipt, ShoppingCart, Wallet, TrendingDown, AlertTriangle, Trash2, Pencil } from 'lucide-react';
import { useCampagneContext } from '../../contexts/CampagneContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { depensesService } from '../../services/depenses.service.js';
import { objectifsService } from '../../services/objectifs.service.js';
import usePersistedState from '../../hooks/usePersistedState.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import ExportMenu from '../../components/ui/ExportMenu.jsx';

const CATEGORIES = ['Hygiène', 'Repas', 'Logistique', 'Transport', 'Sécurité', 'Ravitaillement', 'Installation', 'Autre'];

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

export default function Depenses() {
  const { campagneActive } = useCampagneContext();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = usePersistedState('dep-showForm', false);
  const [categorie, setCategorie] = usePersistedState('dep-categorie', CATEGORIES[0]);
  const [montant, setMontant] = usePersistedState('dep-montant', '');
  const [description, setDescription] = usePersistedState('dep-description', '');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editCategorie, setEditCategorie] = useState('');
  const [editMontant, setEditMontant] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);


  const { data: depenses = [], isLoading } = useQuery({
    queryKey: ['depenses', campagneActive?.id],
    queryFn: () => depensesService.listByCampagne(campagneActive.id),
    enabled: !!campagneActive
  });

  const { data: totalDepenses = 0 } = useQuery({
    queryKey: ['depenses-total', campagneActive?.id],
    queryFn: () => depensesService.totalByCampagne(campagneActive.id),
    enabled: !!campagneActive
  });

  const { data: totalRecettes = 0 } = useQuery({
    queryKey: ['depenses-recettes', campagneActive?.id],
    queryFn: () => objectifsService.totalRecettesCampagne(campagneActive.id),
    enabled: !!campagneActive
  });

  const solde = Number(totalRecettes) - Number(totalDepenses);
  const soldeNegatif = solde < 0;
  const montantValide = montant && Number(montant) > 0;
  const depasseSolde = montantValide && Number(montant) > solde;

  const resetForm = () => { setCategorie(CATEGORIES[0]); setMontant(''); setDescription(''); setFeedback(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!montantValide || depasseSolde) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await depensesService.create({ campagneId: campagneActive.id, categorie, montant: Number(montant), description, justificatifUrl: '', userId: user.id });
      setFeedback({ type: 'success', message: `Dépense de ${formatFCFA(montant)} enregistrée.` });
      resetForm();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['depenses', campagneActive.id] });
      queryClient.invalidateQueries({ queryKey: ['depenses-total', campagneActive.id] });
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: "Erreur lors de l'enregistrement." });
    } finally { setSubmitting(false); }
  };

  const startEdit = (d) => {
    setEditingId(d.id);
    setEditCategorie(d.categorie);
    setEditMontant(String(d.montant));
    setEditDescription(d.description || '');
  };

  const handleSaveEdit = async (id) => {
    if (!editMontant || Number(editMontant) <= 0) return;
    const ancienne = depenses.find((d) => d.id === id);
    const diff = Number(editMontant) - Number(ancienne?.montant || 0);
    if (diff > 0 && diff > solde) {
      setFeedback({ type: 'error', message: `Solde insuffisant. Disponible : ${formatFCFA(solde)}` });
      return;
    }
    setSavingEdit(true);
    try {
      await depensesService.update(id, { categorie: editCategorie, montant: Number(editMontant), description: editDescription || null }, { userId: user.id, campagneId: campagneActive.id });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['depenses', campagneActive.id] });
      queryClient.invalidateQueries({ queryKey: ['depenses-total', campagneActive.id] });
    } catch (err) { alert(err.message); }
    finally { setSavingEdit(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette dépense ?')) return;
    try {
      await depensesService.remove(id, { userId: user.id, campagneId: campagneActive.id });
      queryClient.invalidateQueries({ queryKey: ['depenses', campagneActive.id] });
      queryClient.invalidateQueries({ queryKey: ['depenses-total', campagneActive.id] });
    } catch (err) { alert(err.message); }
  };

  const handleExportPDF = async () => {
    setOpenExport(false);
    const [logo, { default: jsPDF }, { default: autoTable }] = await Promise.all([
      loadLogoBase64(), import('jspdf'), import('jspdf-autotable')
    ]);
    const doc = new jsPDF();
    if (logo) { try { doc.addImage(logo, 'JPEG', 178, 10, 18, 18); } catch {} }
    doc.setFontSize(16); doc.setTextColor(15, 118, 110);
    doc.text(`Depenses - ${campagneActive.nom || campagneActive.annee}`, 14, 18);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`${depenses.length} depense(s) - Total : ${formatFCFApdf(totalDepenses)} | Solde : ${formatFCFApdf(solde)}`, 14, 25);
    doc.setDrawColor(15, 118, 110); doc.setLineWidth(0.5); doc.line(14, 30, 196, 30);

    autoTable(doc, {
      startY: 32,
      head: [['#', 'Categorie', 'Description', 'Montant', 'Date']],
      body: depenses.map((d, i) => [
        i + 1,
        d.categorie,
        d.description || '',
        formatFCFApdf(d.montant),
        new Date(d.date_depense).toLocaleDateString('fr-FR')
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
    doc.save(`depenses-${campagneActive.annee}.pdf`);
  };

  const handleExportExcel = async () => {
    setOpenExport(false);
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(depenses.map((d, i) => ({
      '#': i + 1,
      'Categorie': d.categorie,
      'Description': d.description || '',
      'Montant': Number(d.montant),
      'Date': new Date(d.date_depense).toLocaleDateString('fr-FR')
    })));
    ws['!cols'] = [{ wch: 4 }, { wch: 18 }, { wch: 30 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Depenses');
    XLSX.writeFile(wb, `depenses-${campagneActive.annee}.xlsx`);
  };

  if (!campagneActive) return <p className="text-sm text-gray-500">Aucune campagne active.</p>;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Depenses"
        subtitle={`${depenses.length} depense${depenses.length !== 1 ? 's' : ''}`}
        action={
          <div className="flex items-center gap-2">
            <ExportMenu
              label={<span className="hidden sm:inline">Exporter</span>}
              items={[
                { label: 'PDF', onClick: handleExportPDF, bold: true },
                { label: 'Excel', onClick: handleExportExcel }
              ]}
            />
            <button onClick={() => { setShowForm(!showForm); resetForm(); }} className="inline-flex items-center gap-1.5 rounded-xl bg-primary-700 text-white px-4 py-2.5 text-sm font-semibold hover:bg-primary-800 shadow-sm shadow-primary-700/20 transition-all">
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              <span className="hidden sm:inline">{showForm ? 'Annuler' : 'Nouvelle'}</span>
            </button>
          </div>
        }
      />

      {/* Solde */}
      <div className={`rounded-2xl border p-3 sm:p-5 shadow-sm ${soldeNegatif ? 'border-red-200 dark:border-red-800 bg-red-50/70 dark:bg-red-950/30' : 'border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50'}`}>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-4">
          <div className="flex flex-col items-center text-center gap-1 sm:flex-row sm:items-center sm:text-left sm:gap-3">
            <div className="flex h-7 w-7 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-emerald-100 dark:bg-emerald-900/30 shrink-0">
              <Wallet className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0 w-full">
              <p className="text-[9px] sm:text-xs uppercase tracking-wide text-gray-500 font-medium truncate">Recettes</p>
              <p className="text-[11px] sm:text-sm font-bold text-emerald-700 dark:text-emerald-400 truncate">{formatFCFA(totalRecettes)}</p>
            </div>
          </div>
          <div className="flex flex-col items-center text-center gap-1 sm:flex-row sm:items-center sm:text-left sm:gap-3">
            <div className="flex h-7 w-7 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-red-100 dark:bg-red-900/30 shrink-0">
              <TrendingDown className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="min-w-0 w-full">
              <p className="text-[9px] sm:text-xs uppercase tracking-wide text-gray-500 font-medium truncate">Depenses</p>
              <p className="text-[11px] sm:text-sm font-bold text-red-600 dark:text-red-400 truncate">{formatFCFA(totalDepenses)}</p>
            </div>
          </div>
          <div className="flex flex-col items-center text-center gap-1 sm:flex-row sm:items-center sm:text-left sm:gap-3">
            <div className={`flex h-7 w-7 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl ${soldeNegatif ? 'bg-red-100 dark:bg-red-900/30' : 'bg-primary-100 dark:bg-primary-900/30'} shrink-0`}>
              <Receipt className={`h-3.5 w-3.5 sm:h-5 sm:w-5 ${soldeNegatif ? 'text-red-600 dark:text-red-400' : 'text-primary-600 dark:text-primary-400'}`} />
            </div>
            <div className="min-w-0 w-full">
              <p className="text-[9px] sm:text-xs uppercase tracking-wide text-gray-500 font-medium truncate">Solde</p>
              <p className={`text-[11px] sm:text-sm font-bold ${soldeNegatif ? 'text-red-600 dark:text-red-400' : 'text-primary-700 dark:text-primary-400'} truncate`}>{formatFCFA(solde)}</p>
            </div>
          </div>
        </div>
        {soldeNegatif && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-red-200/50 dark:border-red-800/50">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">Solde negatif — les depenses depassent les recettes de {formatFCFA(Math.abs(solde))}</p>
          </div>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4 sm:p-5 space-y-3 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className={selectCls}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div>
              <input type="number" min="1" max={solde > 0 ? solde : undefined} value={montant} onChange={(e) => setMontant(e.target.value)} placeholder={`Max ${formatFCFA(solde)}`} required className={`${inputCls} ${depasseSolde ? 'border-red-400 dark:border-red-600 ring-2 ring-red-200 dark:ring-red-800' : ''}`} />
              {depasseSolde && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Depasse le solde ({formatFCFA(solde)})
                </p>
              )}
            </div>
          </div>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optionnel)" className={inputCls} />
          <button type="submit" disabled={submitting || depasseSolde || !montantValide} className="w-full rounded-xl bg-primary-700 text-white py-2.5 text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 shadow-sm shadow-primary-700/20 transition-all">
            {submitting ? 'Enregistrement...' : 'Enregistrer la depense'}
          </button>
          {feedback && <p className={`text-sm ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{feedback.message}</p>}
        </form>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-700 border-t-transparent" />
        </div>
      ) : depenses.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucune depense enregistree.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800/50 rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 shadow-sm overflow-hidden">
          {depenses.map((d) => {
            const isEditing = editingId === d.id;
            return (
              <li key={d.id} className="px-3 sm:px-4 py-3 sm:py-3.5 text-sm hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select value={editCategorie} onChange={(e) => setEditCategorie(e.target.value)} className={selectCls}>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input type="number" min="1" value={editMontant} onChange={(e) => setEditMontant(e.target.value)} className={inputCls} />
                      <input type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Description" className={inputCls} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleSaveEdit(d.id)} disabled={savingEdit} className="rounded-xl bg-primary-700 text-white px-4 py-1.5 text-xs font-semibold hover:bg-primary-800 disabled:opacity-50 transition-all">
                        {savingEdit ? '...' : 'Enregistrer'}
                      </button>
                      <button onClick={() => setEditingId(null)} className="rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 sm:gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white">{d.categorie}</p>
                      <p className="text-gray-500 text-xs truncate">
                        {new Date(d.date_depense).toLocaleDateString('fr-FR')}{d.description ? ` · ${d.description}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <span className="font-bold text-red-600 text-xs sm:text-sm whitespace-nowrap">-{formatFCFA(d.montant)}</span>
                      <button onClick={() => startEdit(d)} className="text-gray-300 hover:text-primary-600 dark:text-gray-600 dark:hover:text-primary-400 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDelete(d.id)} className="text-gray-300 hover:text-red-600 dark:text-gray-600 dark:hover:text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
