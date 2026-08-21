import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, MapPin, Search } from 'lucide-react';
import { useCampagneContext } from '../../contexts/CampagneContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { membresService } from '../../services/membres.service.js';
import { collecteursService } from '../../services/collecteurs.service.js';
import { quetesService } from '../../services/quetes.service.js';
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

export default function Quetes() {
  const { campagneActive } = useCampagneContext();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = usePersistedState('qt-showForm', false);
  const [query, setQuery] = usePersistedState('qt-query', '');
  const [resultats, setResultats] = useState([]);
  const [collecteurMembre, setCollecteurMembre] = usePersistedState('qt-collecteur', null);
  const [zone, setZone] = usePersistedState('qt-zone', '');
  const [lieu, setLieu] = usePersistedState('qt-lieu', '');
  const [montant, setMontant] = usePersistedState('qt-montant', '');
  const [note, setNote] = usePersistedState('qt-note', '');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const { data: quetes = [], isLoading } = useQuery({
    queryKey: ['quetes', campagneActive?.id],
    queryFn: () => quetesService.listByCampagne(campagneActive.id),
    enabled: !!campagneActive
  });

  const { data: total = 0 } = useQuery({
    queryKey: ['quetes-total', campagneActive?.id],
    queryFn: () => quetesService.totalByCampagne(campagneActive.id),
    enabled: !!campagneActive
  });

  const resetForm = () => { setCollecteurMembre(null); setQuery(''); setZone(''); setLieu(''); setMontant(''); setNote(''); setFeedback(null); };

  const handleSearch = async (e) => {
    const value = e.target.value;
    setQuery(value);
    setCollecteurMembre(null);
    if (value.trim().length < 2) { setResultats([]); return; }
    const res = await membresService.search(value);
    setResultats(res);
  };

  const selectMembre = (m) => { setCollecteurMembre(m); setResultats([]); setQuery(`${m.prenom} ${m.nom} — ${m.numero_membre}`); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!collecteurMembre || !lieu || !montant || Number(montant) < 0) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const collecteur = await collecteursService.getOrCreate(campagneActive.id, collecteurMembre.id, zone);
      await quetesService.create({ campagneId: campagneActive.id, collecteurId: collecteur.id, lieu, montant: Number(montant), note, userId: user.id });
      setFeedback({ type: 'success', message: `Quete de ${formatFCFA(montant)} enregistree pour ${lieu}.` });
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['quetes', campagneActive.id] });
      queryClient.invalidateQueries({ queryKey: ['quetes-total', campagneActive.id] });
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: "Erreur lors de l'enregistrement." });
    } finally { setSubmitting(false); }
  };

  const handleExportPDF = async () => {
    const [logo, { default: jsPDF }, { default: autoTable }] = await Promise.all([
      loadLogoBase64(), import('jspdf'), import('jspdf-autotable')
    ]);
    const doc = new jsPDF();
    if (logo) { try { doc.addImage(logo, 'JPEG', 178, 10, 18, 18); } catch {} }
    doc.setFontSize(16); doc.setTextColor(15, 118, 110);
    doc.text(`Quetes - ${campagneActive.nom || campagneActive.annee}`, 14, 18);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`${quetes.length} quete(s) - Total : ${formatFCFApdf(total)}`, 14, 25);
    doc.setDrawColor(15, 118, 110); doc.setLineWidth(0.5); doc.line(14, 30, 196, 30);
    autoTable(doc, {
      startY: 32,
      head: [['#', 'Lieu', 'Collecteur', 'Montant', 'Date', 'Note']],
      body: quetes.map((q, i) => [
        i + 1,
        q.lieu,
        q.collecteur?.membre ? `${q.collecteur.membre.prenom} ${q.collecteur.membre.nom}` : '',
        formatFCFApdf(q.montant),
        new Date(q.date_quete).toLocaleDateString('fr-FR'),
        q.note || ''
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
    doc.save(`quetes-${campagneActive.annee}.pdf`);
  };

  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(quetes.map((q, i) => ({
      '#': i + 1,
      'Lieu': q.lieu,
      'Collecteur': q.collecteur?.membre ? `${q.collecteur.membre.prenom} ${q.collecteur.membre.nom}` : '',
      'Zone': q.collecteur?.zone || '',
      'Montant': Number(q.montant),
      'Date': new Date(q.date_quete).toLocaleDateString('fr-FR'),
      'Note': q.note || ''
    })));
    ws['!cols'] = [{ wch: 4 }, { wch: 20 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Quetes');
    XLSX.writeFile(wb, `quetes-${campagneActive.annee}.xlsx`);
  };

  if (!campagneActive) return <p className="text-sm text-gray-500">Aucune campagne active.</p>;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quetes et collectes"
        subtitle={`${quetes.length} quete${quetes.length !== 1 ? 's' : ''} · Total ${formatFCFA(total)}`}
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

      {quetes.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total quêtes</p>
            <p className="text-lg font-bold text-green-600 mt-1">{formatFCFA(total)}</p>
          </div>
          <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Nombre</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{quetes.length}</p>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4 sm:p-5 space-y-3 shadow-sm">
          <div className="relative">
            <label className="text-xs text-gray-500 font-medium">Collecteur (membre)</label>
            <input type="text" value={query} onChange={handleSearch} placeholder="Nom, prenom ou numero..." className={`mt-1.5 ${inputCls}`} />
            {resultats.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg max-h-56 overflow-auto">
                {resultats.map((m) => (
                  <li key={m.id}><button type="button" onClick={() => selectMembre(m)} className="w-full text-left px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm transition-colors">{m.prenom} {m.nom} <span className="text-gray-500">— {m.numero_membre}</span></button></li>
                ))}
              </ul>
            )}
          </div>
          {collecteurMembre && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="text" value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="Lieu de la quete" required className={inputCls} />
                <input type="text" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Zone (optionnel)" className={inputCls} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="number" min="0" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="Montant (FCFA)" required className={inputCls} />
                <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optionnel)" className={inputCls} />
              </div>
              <button type="submit" disabled={submitting} className="w-full rounded-xl bg-primary-700 text-white py-2.5 text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 shadow-sm shadow-primary-700/20 transition-all">
                {submitting ? 'Enregistrement...' : 'Enregistrer la quete'}
              </button>
            </>
          )}
          {feedback && <p className={`text-sm ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{feedback.message}</p>}
        </form>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-700 border-t-transparent" />
        </div>
      ) : quetes.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucune quete enregistree.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800/50 rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 shadow-sm overflow-hidden">
          {quetes.map((q) => (
            <li key={q.id} className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-3.5 text-sm hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white truncate">{q.lieu}</p>
                <p className="text-gray-500 text-xs truncate">
                  {new Date(q.date_quete).toLocaleDateString('fr-FR')}
                  {q.collecteur?.membre ? ` · ${q.collecteur.membre.prenom} ${q.collecteur.membre.nom}` : ''}
                  {q.note ? ` · ${q.note}` : ''}
                </p>
              </div>
              <span className="font-bold text-green-600 shrink-0 whitespace-nowrap">+{formatFCFA(q.montant)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
