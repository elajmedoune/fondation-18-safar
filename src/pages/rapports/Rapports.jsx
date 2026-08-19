import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, FileText, Trash2, Pencil, Download, Calendar } from 'lucide-react';
import { useCampagneContext } from '../../contexts/CampagneContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { rapportsService } from '../../services/rapports.service.js';
import usePersistedState from '../../hooks/usePersistedState.js';
import PageHeader from '../../components/ui/PageHeader.jsx';

const TYPES_RAPPORT = [
  { value: 'general', label: 'Général' },
  { value: 'financier', label: 'Financier' },
  { value: 'activite', label: 'Activité' }
];

const TYPE_COLORS = {
  general: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  financier: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  activite: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
};

const inputCls = "rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 w-full focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all";
const textareaCls = "rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 w-full focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all resize-none";

export default function Rapports() {
  const { campagneActive } = useCampagneContext();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = usePersistedState('rap-showForm', false);
  const [type, setType] = usePersistedState('rap-type', 'general');
  const [titre, setTitre] = usePersistedState('rap-titre', '');
  const [contenu, setContenu] = usePersistedState('rap-contenu', '');
  const [fichierUrl, setFichierUrl] = usePersistedState('rap-fichier', '');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editContenu, setEditContenu] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const { data: rapports = [], isLoading } = useQuery({
    queryKey: ['rapports', campagneActive?.id],
    queryFn: () => rapportsService.listByCampagne(campagneActive.id),
    enabled: !!campagneActive?.id
  });

  const resetForm = () => { setType('general'); setTitre(''); setContenu(''); setFichierUrl(''); setFeedback(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!titre.trim()) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await rapportsService.create({
        campagneId: campagneActive.id,
        type,
        titre: titre.trim(),
        contenu: contenu || null,
        fichierUrl: fichierUrl || null,
        userId: user.id
      });
      setFeedback({ type: 'success', message: 'Rapport créé.' });
      resetForm();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['rapports', campagneActive.id] });
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message || 'Erreur.' });
    } finally { setSubmitting(false); }
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setEditContenu(r.contenu || '');
  };

  const handleSaveEdit = async (id) => {
    setSavingEdit(true);
    try {
      await rapportsService.update(id, { contenu: editContenu || null });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['rapports', campagneActive.id] });
    } catch (err) { alert(err.message); }
    finally { setSavingEdit(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce rapport ?')) return;
    try {
      await rapportsService.remove(id);
      queryClient.invalidateQueries({ queryKey: ['rapports', campagneActive.id] });
    } catch (err) { alert(err.message); }
  };

  if (!campagneActive) return <p className="text-sm text-gray-500">Aucune campagne active.</p>;

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <PageHeader
        title="Rapports"
        subtitle={`${rapports.length} rapport${rapports.length !== 1 ? 's' : ''}`}
        action={
          <button onClick={() => { setShowForm(!showForm); resetForm(); }} className="inline-flex items-center gap-1.5 rounded-xl bg-primary-700 text-white px-4 py-2.5 text-sm font-semibold hover:bg-primary-800 shadow-sm shadow-primary-700/20 transition-all">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Annuler' : 'Nouveau'}
          </button>
        }
      />

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-5 space-y-3 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
                {TYPES_RAPPORT.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Titre *</label>
              <input type="text" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex: Rapport financier janvier" required className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Contenu</label>
            <textarea value={contenu} onChange={(e) => setContenu(e.target.value)} rows={8} placeholder="Rédige le rapport ici..." className={textareaCls} />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Lien fichier (optionnel)</label>
            <input type="url" value={fichierUrl} onChange={(e) => setFichierUrl(e.target.value)} placeholder="https://..." className={inputCls} />
          </div>
          <button type="submit" disabled={submitting} className="w-full rounded-xl bg-primary-700 text-white py-2.5 text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 shadow-sm shadow-primary-700/20 transition-all">
            {submitting ? 'Création...' : 'Créer le rapport'}
          </button>
          {feedback && <p className={`text-sm ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{feedback.message}</p>}
        </form>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-700 border-t-transparent" />
        </div>
      ) : rapports.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucun rapport pour cette campagne.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rapports.map((r) => {
            const isExpanded = expandedId === r.id;
            const isEditing = editingId === r.id;
            return (
              <div key={r.id} className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                  className="w-full text-left px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${TYPE_COLORS[r.type] || TYPE_COLORS.general}`}>
                        {TYPES_RAPPORT.find((t) => t.value === r.type)?.label || r.type}
                      </span>
                      <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{r.titre}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-gray-800/50 pt-3">
                    <div className="flex items-center gap-2 justify-end">
                      {r.fichier_url && (
                        <a href={r.fichier_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-800 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                          <Download className="h-3 w-3" /> Fichier
                        </a>
                      )}
                      {!isEditing && (
                        <button onClick={() => startEdit(r)} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-800 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                          <Pencil className="h-3 w-3" /> Modifier
                        </button>
                      )}
                      <button onClick={() => handleDelete(r.id)} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-800 text-red-600 px-3 py-1.5 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/30 transition-all">
                        <Trash2 className="h-3 w-3" /> Supprimer
                      </button>
                    </div>

                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea value={editContenu} onChange={(e) => setEditContenu(e.target.value)} rows={10} className={textareaCls} placeholder="Contenu du rapport..." />
                        <div className="flex gap-2">
                          <button onClick={() => handleSaveEdit(r.id)} disabled={savingEdit} className="rounded-xl bg-primary-700 text-white px-4 py-2 text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 transition-all">
                            {savingEdit ? '...' : 'Enregistrer'}
                          </button>
                          <button onClick={() => setEditingId(null)} className="rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : r.contenu ? (
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{r.contenu}</p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Aucun contenu.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
