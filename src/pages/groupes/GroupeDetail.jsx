import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileDown, FileSpreadsheet, UserPlus, X, Search } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { useCampagneContext } from '../../contexts/CampagneContext.jsx';
import { groupesService } from '../../services/groupes.service.js';
import { membresService } from '../../services/membres.service.js';

const selectCls = "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100";
const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-gray-100";

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

export default function GroupeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { campagneActive } = useCampagneContext();
  const queryClient = useQueryClient();

  const [nouveauResponsableId, setNouveauResponsableId] = useState('');
  const [addingResponsable, setAddingResponsable] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addingMembreId, setAddingMembreId] = useState(null);

  const { data: groupe, isLoading, error } = useQuery({
    queryKey: ['groupe-detail', id, campagneActive?.id],
    queryFn: () => groupesService.getDetail(id, campagneActive.id),
    enabled: !!id && !!campagneActive?.id
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['groupe-detail', id] });
    queryClient.invalidateQueries({ queryKey: ['groupes-stats'] });
  };

  const handleAddResponsable = async (e) => {
    e.preventDefault();
    if (!nouveauResponsableId) return;
    setAddingResponsable(true);
    try {
      await groupesService.addResponsable(campagneActive.id, id, nouveauResponsableId, user.id);
      setNouveauResponsableId('');
      invalidate();
    } catch (err) {
      alert(err.message);
    } finally {
      setAddingResponsable(false);
    }
  };

  const handleRemoveResponsable = async (responsableId) => {
    if (!confirm('Retirer ce responsable ?')) return;
    try {
      await groupesService.removeResponsable(responsableId, { userId: user.id, campagneId: campagneActive.id });
      invalidate();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return;
    setSearching(true);
    try {
      const results = await membresService.searchForGroupe(campagneActive.id, searchQuery);
      setSearchResults(results);
    } catch (err) {
      alert(err.message);
    } finally {
      setSearching(false);
    }
  };

  const handleAddMembre = async (membreId) => {
    setAddingMembreId(membreId);
    try {
      await groupesService.assignMembre(campagneActive.id, id, membreId, user.id);
      setSearchResults((prev) => prev.filter((m) => m.id !== membreId));
      invalidate();
    } catch (err) {
      alert(err.message);
    } finally {
      setAddingMembreId(null);
    }
  };

  const handleRemoveMembre = async (cm) => {
    if (!confirm(`Retirer ${cm.membre.prenom} ${cm.membre.nom} de ce groupe ? (il reste membre)`)) return;
    try {
      await groupesService.removeMembreFromGroupe(cm.id, { userId: user.id, campagneId: campagneActive.id });
      invalidate();
    } catch (err) {
      alert(err.message);
    }
  };

  if (!campagneActive) return <p className="text-sm text-gray-500 p-4">Aucune campagne active.</p>;
  if (isLoading) return <p className="text-sm text-gray-500 p-4">Chargement...</p>;
  if (error) return <p className="text-sm text-red-600 p-4">Erreur : {error.message}</p>;
  if (!groupe) return <p className="text-sm text-gray-500 p-4">Groupe introuvable.</p>;

  const responsableIds = new Set(groupe.responsables.map((r) => r.membre.id));
  const candidatsResponsable = groupe.membres.filter((m) => !responsableIds.has(m.membre.id));

  const buildRows = () => groupe.membres.map((cm) => ({
    numero: cm.membre.numero_membre,
    nom: cm.membre.nom,
    prenom: cm.membre.prenom,
    telephone: cm.membre.telephone || '',
    fonction: cm.fonction || '',
    role: responsableIds.has(cm.membre.id) ? 'Responsable' : 'Membre'
  }));

  const slug = groupe.nom.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const handleExportPdf = async () => {
    const [logo, { default: jsPDF }, { default: autoTable }] = await Promise.all([
  loadLogoBase64(), import('jspdf'), import('jspdf-autotable')
]);
const rows = buildRows();
const doc = new jsPDF();
if (logo) { try { doc.addImage(logo, 'JPEG', 178, 10, 18, 18); } catch {} }
doc.setFontSize(14);
    doc.text(`Groupe : ${groupe.nom}`, 14, 16);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Campagne : ${campagneActive.nom} — ${rows.length} membre(s)`, 14, 22);

    const responsablesTxt = groupe.responsables.length
      ? groupe.responsables.map((r) => `${r.membre.prenom} ${r.membre.nom}`).join(', ')
      : 'Aucun responsable désigné';
    doc.text(`Responsable(s) : ${responsablesTxt}`, 14, 28);

    autoTable(doc, {
      startY: 34,
      head: [['N°', 'Nom', 'Prénom', 'Téléphone', 'Fonction', 'Rôle']],
      body: rows.map((r) => [r.numero, r.nom, r.prenom, r.telephone || '-', r.fonction || '-', r.role]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [15, 118, 110] },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.raw[5] === 'Responsable') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [15, 118, 110];
        }
      }
    });

    doc.save(`groupe-${slug}.pdf`);
  };

  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const rows = buildRows().map((r) => ({
      'N° membre': r.numero,
      'Nom': r.nom,
      'Prénom': r.prenom,
      'Téléphone': r.telephone,
      'Fonction': r.fonction,
      'Rôle': r.role
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, groupe.nom.slice(0, 31));
    XLSX.writeFile(wb, `groupe-${slug}.xlsx`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8 pb-8">

      {/* En-tête — sticky sur mobile pour garder le retour accessible en scrollant */}
      <div className="sticky top-0 z-10 -mx-4 sm:mx-0 px-4 sm:px-0 pt-3 pb-3 sm:pt-0 sm:pb-0 bg-gray-50/95 dark:bg-gray-950/95 sm:bg-transparent backdrop-blur sm:backdrop-blur-none border-b border-gray-200 dark:border-gray-800 sm:border-0">
        <Link
          to="/groupes"
          className="inline-flex items-center gap-1.5 -ml-1 px-1 py-1 text-sm text-primary-700 dark:text-primary-400 active:opacity-60"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          Groupes
        </Link>

        <div className="flex items-start justify-between gap-3 mt-1">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold truncate">{groupe.nom}</h1>
              {!groupe.actif && (
                <span className="shrink-0 text-xs rounded-full bg-gray-200 dark:bg-gray-800 px-2 py-0.5 text-gray-600 dark:text-gray-400">
                  Désactivé
                </span>
              )}
            </div>
            {groupe.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{groupe.description}</p>
            )}
          </div>
        </div>

        {/* Boutons export — pleine largeur et empilables sur mobile */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleExportPdf}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700"
          >
            <FileDown className="h-3.5 w-3.5" />
            Export PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Responsables */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5 space-y-3">
        <h2 className="font-medium">Responsables</h2>

        {groupe.responsables.length === 0 && (
          <p className="text-sm text-gray-500">Aucun responsable désigné pour cette campagne.</p>
        )}

        {groupe.responsables.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              {r.membre.prenom} {r.membre.nom}{' '}
              <span className="text-gray-500">· N° {r.membre.numero_membre}</span>
            </span>
            <button
              onClick={() => handleRemoveResponsable(r.id)}
              className="shrink-0 text-xs text-red-600 hover:underline py-1"
            >
              Retirer
            </button>
          </div>
        ))}

        {candidatsResponsable.length > 0 && (
          <form
            onSubmit={handleAddResponsable}
            className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-gray-200 dark:border-gray-800"
          >
            <select
              value={nouveauResponsableId}
              onChange={(e) => setNouveauResponsableId(e.target.value)}
              className={selectCls}
            >
              <option value="">Désigner un responsable...</option>
              {candidatsResponsable.map((m) => (
                <option key={m.membre.id} value={m.membre.id}>{m.membre.prenom} {m.membre.nom}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={addingResponsable || !nouveauResponsableId}
              className="shrink-0 rounded-lg bg-primary-700 text-white px-4 py-2 text-sm font-medium hover:bg-primary-800 disabled:opacity-50"
            >
              Ajouter
            </button>
          </form>
        )}

        {candidatsResponsable.length === 0 && groupe.membres.length === 0 && (
          <p className="text-xs text-gray-500">Ajoute d'abord des membres à ce groupe pour pouvoir désigner un responsable.</p>
        )}
      </section>

      {/* Ajouter un membre */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5 space-y-3">
        <h2 className="font-medium">Ajouter un membre au groupe</h2>

        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              placeholder="Rechercher par nom, prénom ou n° membre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-9 ${inputCls}`}
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="shrink-0 rounded-lg bg-primary-700 text-white px-4 py-2 text-sm font-medium hover:bg-primary-800 disabled:opacity-50"
          >
            {searching ? '...' : 'Chercher'}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {searchResults.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 text-sm rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2.5"
              >
                <span className="min-w-0 truncate">
                  {m.prenom} {m.nom} <span className="text-gray-500">· N° {m.numero_membre}</span>
                </span>
                <button
                  onClick={() => handleAddMembre(m.id)}
                  disabled={addingMembreId === m.id}
                  className="shrink-0 inline-flex items-center gap-1 text-xs text-primary-700 dark:text-primary-400 hover:underline disabled:opacity-50"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {addingMembreId === m.id ? 'Ajout...' : 'Ajouter'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Liste des membres */}
      <section className="space-y-3">
        <h2 className="font-medium">Membres ({groupe.membres.length})</h2>

        {groupe.membres.length === 0 && (
          <p className="text-sm text-gray-500">Aucun membre dans ce groupe pour cette campagne.</p>
        )}

        <div className="space-y-2">
          {groupe.membres.map((cm) => (
            <div
              key={cm.id}
              className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 p-3 hover:bg-gray-50 dark:hover:bg-gray-900"
            >
              <Link to={`/membres/${cm.membre.id}`} className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{cm.membre.prenom} {cm.membre.nom}</p>
                <p className="text-xs text-gray-500 truncate">
                  N° {cm.membre.numero_membre}{cm.fonction ? ` · ${cm.fonction}` : ''}
                </p>
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                {responsableIds.has(cm.membre.id) && (
                  <span className="hidden xs:inline text-xs rounded-full bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 px-2 py-0.5">
                    Responsable
                  </span>
                )}
                <button
                  onClick={() => handleRemoveMembre(cm)}
                  title="Retirer du groupe"
                  className="p-1.5 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}