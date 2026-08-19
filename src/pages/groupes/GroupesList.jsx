import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Pencil, Trash2, Users, UserCheck, Power, ChevronRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { useCampagneContext } from '../../contexts/CampagneContext.jsx';
import { groupesService } from '../../services/groupes.service.js';
import PageHeader from '../../components/ui/PageHeader.jsx';

const inputCls = "rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 w-full focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all";

export default function GroupesList() {
  const { user } = useAuth();
  const { campagneActive } = useCampagneContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [editId, setEditId] = useState(null);
  const [editNom, setEditNom] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: groupes = [], isLoading } = useQuery({
    queryKey: ['groupes-stats', campagneActive?.id],
    queryFn: () => groupesService.getAllWithStats(campagneActive.id),
    enabled: !!campagneActive?.id
  });

  const resetForm = () => { setNom(''); setDescription(''); setFeedback(null); };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setFeedback(null);
    try {
      await groupesService.create({ nom, description }, user.id, campagneActive.id);
      resetForm();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['groupes-stats'] });
      queryClient.invalidateQueries({ queryKey: ['groupes'] });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (e, g) => { e.stopPropagation(); setEditId(g.id); setEditNom(g.nom); setEditDescription(g.description || ''); };
  const cancelEdit = (e) => { e.stopPropagation(); setEditId(null); };

  const handleSaveEdit = async (e, id) => {
    e.stopPropagation();
    setSaving(true);
    try {
      await groupesService.update(id, { nom: editNom, description: editDescription || null }, { userId: user.id, campagneId: campagneActive.id });
      queryClient.invalidateQueries({ queryKey: ['groupes-stats'] });
      queryClient.invalidateQueries({ queryKey: ['groupes'] });
      setEditId(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActif = async (e, g) => {
    e.stopPropagation();
    try {
      await groupesService.update(g.id, { actif: !g.actif }, { userId: user.id, campagneId: campagneActive.id });
      queryClient.invalidateQueries({ queryKey: ['groupes-stats'] });
    } catch (err) { alert(err.message); }
  };

  const handleDelete = async (e, g) => {
    e.stopPropagation();
    const confirmMsg = g.membresCount > 0
      ? `"${g.nom}" contient ${g.membresCount} membre(s). Les supprimer du groupe (ils resteront membres) puis supprimer le groupe ?`
      : `Supprimer le groupe "${g.nom}" ?`;
    if (!confirm(confirmMsg)) return;
    try {
      await groupesService.remove(g.id, { userId: user.id, campagneId: campagneActive.id });
      queryClient.invalidateQueries({ queryKey: ['groupes-stats'] });
      queryClient.invalidateQueries({ queryKey: ['groupes'] });
    } catch (err) {
      alert("Suppression impossible : ce groupe a probablement des presences deja enregistrees. Desactive-le plutot.");
      console.error(err);
    }
  };

  const openGroupe = (g) => navigate(`/groupes/${g.id}`);

  if (!campagneActive) return <p className="text-sm text-gray-500">Aucune campagne active.</p>;

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <PageHeader
        title="Groupes"
        subtitle={`${groupes.length} groupe${groupes.length !== 1 ? 's' : ''} — ${campagneActive.nom || campagneActive.annee}`}
        action={
          <button
            onClick={() => { setShowForm(!showForm); resetForm(); }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-700 text-white px-4 py-2.5 text-sm font-semibold hover:bg-primary-800 shadow-sm shadow-primary-700/20 transition-all"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            <span className="hidden sm:inline">{showForm ? 'Annuler' : 'Nouveau groupe'}</span>
          </button>
        }
      />

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4 sm:p-5 space-y-3 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Nom (ex: Hygiene)" value={nom} onChange={(e) => setNom(e.target.value)} required className={inputCls} />
            <input placeholder="Description (optionnel)" value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
          </div>
          <button type="submit" disabled={creating} className="w-full rounded-xl bg-primary-700 text-white py-2.5 text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 shadow-sm shadow-primary-700/20 transition-all">
            {creating ? 'Creation...' : 'Creer le groupe'}
          </button>
          {feedback && <p className={`text-sm ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{feedback.message}</p>}
        </form>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-700 border-t-transparent" />
        </div>
      ) : groupes.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucun groupe pour l'instant.</p>
          <p className="text-xs mt-1">Clique sur "Nouveau groupe" pour commencer.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groupes.map((g) => {
            const isEditing = editId === g.id;
            return (
              <div
                key={g.id}
                onClick={() => !isEditing && openGroupe(g)}
                role={isEditing ? undefined : 'button'}
                tabIndex={isEditing ? undefined : 0}
                onKeyDown={(e) => { if (!isEditing && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openGroupe(g); } }}
                className={`rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4 shadow-sm space-y-3 transition-all ${!g.actif ? 'opacity-60' : ''} ${!isEditing ? 'cursor-pointer hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md active:scale-[0.99]' : ''}`}
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <input value={editNom} onChange={(e) => setEditNom(e.target.value)} className={inputCls} onClick={(e) => e.stopPropagation()} />
                    <input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Description" className={inputCls} onClick={(e) => e.stopPropagation()} />
                    <div className="flex gap-2">
                      <button onClick={(e) => handleSaveEdit(e, g.id)} disabled={saving} className="rounded-xl bg-primary-700 text-white px-4 py-1.5 text-xs font-semibold hover:bg-primary-800 disabled:opacity-50 transition-all">
                        {saving ? '...' : 'Enregistrer'}
                      </button>
                      <button onClick={cancelEdit} className="rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-primary-700 dark:text-primary-400 text-sm">
                            {g.nom}
                          </span>
                          {!g.actif && <span className="text-[10px] uppercase tracking-wider rounded-full bg-gray-200 dark:bg-gray-800 px-2 py-0.5 text-gray-500 font-medium">Desactive</span>}
                        </div>
                        {g.description && <p className="text-xs text-gray-500 mt-0.5">{g.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Users className="h-3.5 w-3.5" />
                          <span className="font-semibold">{g.membresCount}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-700" />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <UserCheck className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {g.responsables.length > 0
                          ? g.responsables.map((r) => `${r.prenom} ${r.nom}`).join(', ')
                          : 'Aucun responsable'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button onClick={(e) => startEdit(e, g)} className="inline-flex items-center gap-1 text-xs rounded-xl border border-gray-200 dark:border-gray-800 px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                        <Pencil className="h-3 w-3" /> Modifier
                      </button>
                      <button onClick={(e) => handleToggleActif(e, g)} className="inline-flex items-center gap-1 text-xs rounded-xl border border-gray-200 dark:border-gray-800 px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                        <Power className="h-3 w-3" /> {g.actif ? 'Desactiver' : 'Reactiver'}
                      </button>
                      <button onClick={(e) => handleDelete(e, g)} className="inline-flex items-center gap-1 text-xs rounded-xl border border-red-200 dark:border-red-800 text-red-600 px-2.5 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all">
                        <Trash2 className="h-3 w-3" /> Supprimer
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}