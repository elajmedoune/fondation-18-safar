import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Gift, Heart } from 'lucide-react';
import { useCampagneContext } from '../../contexts/CampagneContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { donsService } from '../../services/dons.service.js';
import usePersistedState from '../../hooks/usePersistedState.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import ExportMenu from '../../components/ui/ExportMenu.jsx';

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

export default function Dons() {
  const { campagneActive } = useCampagneContext();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = usePersistedState('dons-showForm', false);
  const [type, setType] = usePersistedState('dons-type', 'bienfaiteur');
  const [donateurNom, setDonateurNom] = usePersistedState('dons-nom', '');
  const [donateurTelephone, setDonateurTelephone] = usePersistedState('dons-tel', '');
  const [montant, setMontant] = usePersistedState('dons-montant', '');
  const [note, setNote] = usePersistedState('dons-note', '');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const { data: dons = [], isLoading } = useQuery({
    queryKey: ['dons', campagneActive?.id],
    queryFn: () => donsService.listByCampagne(campagneActive.id),
    enabled: !!campagneActive
  });

  const { data: total = 0 } = useQuery({
    queryKey: ['dons-total', campagneActive?.id],
    queryFn: () => donsService.totalByCampagne(campagneActive.id),
    enabled: !!campagneActive
  });

  const resetForm = () => { setType('bienfaiteur'); setDonateurNom(''); setDonateurTelephone(''); setMontant(''); setNote(''); setFeedback(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!montant || Number(montant) <= 0) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await donsService.create({ campagneId: campagneActive.id, type, donateurNom, donateurTelephone, montant: Number(montant), campagneActivite: '', note, userId: user.id });
      setFeedback({ type: 'success', message: `Don de ${formatFCFA(montant)} enregistre.` });
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['dons', campagneActive.id] });
      queryClient.invalidateQueries({ queryKey: ['dons-total', campagneActive.id] });
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: "Erreur lors de l'enregistrement." });
    } finally { setSubmitting(false); }
  };

  const handleExportPDF = async () => {
    setOpenExport(false);
    const [logo, { default: jsPDF }, { default: autoTable }] = await Promise.all([
      loadLogoBase64(), import('jspdf'), import('jspdf-autotable')
    ]);
    const doc = new jsPDF();
    if (logo) { try { doc.addImage(logo, 'JPEG', 178, 10, 18, 18); } catch {} }
    doc.setFontSize(16); doc.setTextColor(15, 118, 110);
    doc.text(`Dons - ${campagneActive.nom || campagneActive.annee}`, 14, 18);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`${dons.length} don(s) - Total : ${formatFCFApdf(total)}`, 14, 25);
    doc.setDrawColor(15, 118, 110); doc.setLineWidth(0.5); doc.line(14, 30, 196, 30);
    autoTable(doc, {
      startY: 32,
      head: [['#', 'Type', 'Donateur', 'Montant', 'Date', 'Note']],
      body: dons.map((d, i) => [
        i + 1,
        d.type === 'anonyme' ? 'Anonyme' : 'Bienfaiteur',
        d.type === 'anonyme' ? '-' : (d.donateur_nom || '-'),
        formatFCFApdf(d.montant),
        new Date(d.date_don).toLocaleDateString('fr-FR'),
        d.note || ''
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
    }
    doc.save(`dons-${campagneActive.annee}.pdf`);
  };

  const handleExportExcel = async () => {
    setOpenExport(false);
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(dons.map((d, i) => ({
      '#': i + 1,
      'Type': d.type === 'anonyme' ? 'Anonyme' : 'Bienfaiteur',
      'Donateur': d.type === 'anonyme' ? '' : (d.donateur_nom || ''),
      'Telephone': d.type === 'anonyme' ? '' : (d.donateur_telephone || ''),
      'Montant': Number(d.montant),
      'Date': new Date(d.date_don).toLocaleDateString('fr-FR'),
      'Note': d.note || ''
    })));
    ws['!cols'] = [{ wch: 4 }, { wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dons');
    XLSX.writeFile(wb, `dons-${campagneActive.annee}.xlsx`);
  };

  if (!campagneActive) return <p className="text-sm text-gray-500">Aucune campagne active.</p>;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dons"
        subtitle={`${dons.length} don${dons.length !== 1 ? 's' : ''} · Total ${formatFCFA(total)}`}
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
              <span className="hidden sm:inline">{showForm ? 'Annuler' : 'Nouveau'}</span>
            </button>
          </div>
        }
      />

      {dons.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total dons</p>
            <p className="text-lg font-bold text-green-600 mt-1">{formatFCFA(total)}</p>
          </div>
          <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Nombre</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{dons.length}</p>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4 sm:p-5 space-y-3 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
              <option value="bienfaiteur">Bienfaiteur</option>
              <option value="anonyme">Anonyme</option>
            </select>
            <input type="number" min="1" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="Montant (FCFA)" required className={inputCls} />
          </div>
          {type === 'bienfaiteur' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="text" value={donateurNom} onChange={(e) => setDonateurNom(e.target.value)} placeholder="Nom du donateur" className={inputCls} />
              <input type="tel" value={donateurTelephone} onChange={(e) => setDonateurTelephone(e.target.value)} placeholder="Telephone" className={inputCls} />
            </div>
          )}
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optionnel)" className={inputCls} />
          <button type="submit" disabled={submitting} className="w-full rounded-xl bg-primary-700 text-white py-2.5 text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 shadow-sm shadow-primary-700/20 transition-all">
            {submitting ? 'Enregistrement...' : 'Enregistrer le don'}
          </button>
          {feedback && <p className={`text-sm ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{feedback.message}</p>}
        </form>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-700 border-t-transparent" />
        </div>
      ) : dons.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Gift className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucun don enregistre.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800/50 rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 shadow-sm overflow-hidden">
          {dons.map((d) => (
            <li key={d.id} className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-3.5 text-sm hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white">{d.type === 'anonyme' ? 'Don anonyme' : (d.donateur_nom || 'Bienfaiteur')}</p>
                <p className="text-gray-500 text-xs truncate">{new Date(d.date_don).toLocaleDateString('fr-FR')}{d.note ? ` · ${d.note}` : ''}</p>
              </div>
              <span className="font-bold text-green-600 shrink-0 whitespace-nowrap">+{formatFCFA(d.montant)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
