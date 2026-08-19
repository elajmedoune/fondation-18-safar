import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Pencil, Trash2, Target, TrendingUp, TrendingDown, Wallet, HandHeart, Coins } from 'lucide-react';
import { useCampagneContext } from '../../contexts/CampagneContext.jsx';
import { objectifsService } from '../../services/objectifs.service.js';
import { cotisationsService } from '../../services/cotisations.service.js';
import { donsService } from '../../services/dons.service.js';
import { quetesService } from '../../services/quetes.service.js';
import PageHeader from '../../components/ui/PageHeader.jsx';

function formatFCFA(n) {
  return new Intl.NumberFormat('fr-FR').format(Number(n || 0)) + ' FCFA';
}

const inputCls = "rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 w-full focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all";

export default function Objectifs() {
  const { campagneActive } = useCampagneContext();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editMontant, setEditMontant] = useState('');

  const [montantCible, setMontantCible] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const { data: objectifs = [], isLoading } = useQuery({
    queryKey: ['objectifs', campagneActive?.id],
    queryFn: () => objectifsService.listByCampagne(campagneActive.id),
    enabled: !!campagneActive
  });

  const { data: totalRecettes = 0 } = useQuery({
    queryKey: ['objectifs-recettes-globales', campagneActive?.id],
    queryFn: () => objectifsService.totalRecettesCampagne(campagneActive.id),
    enabled: !!campagneActive
  });

  const { data: totalCotisations = 0 } = useQuery({
    queryKey: ['objectifs-cotisations', campagneActive?.id],
    queryFn: () => cotisationsService.totalByCampagne(campagneActive.id),
    enabled: !!campagneActive
  });

  const { data: totalDons = 0 } = useQuery({
    queryKey: ['objectifs-dons', campagneActive?.id],
    queryFn: () => donsService.totalByCampagne(campagneActive.id),
    enabled: !!campagneActive
  });

  const { data: totalQuetes = 0 } = useQuery({
    queryKey: ['objectifs-quetes', campagneActive?.id],
    queryFn: () => quetesService.totalByCampagne(campagneActive.id),
    enabled: !!campagneActive
  });

  const objectif = objectifs.find((o) => o.type === 'global');
  const cible = objectif ? Number(objectif.montant_cible) : 0;
  const collecte = Number(totalRecettes);
  const reste = Math.max(cible - collecte, 0);
  const pct = cible > 0 ? Math.min(Math.round((collecte / cible) * 100), 100) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!montantCible || Number(montantCible) <= 0) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      await objectifsService.create({
        campagneId: campagneActive.id,
        type: 'global',
        activiteNom: null,
        montantCible: Number(montantCible)
      });
      setFeedback({ type: 'success', message: 'Objectif enregistré.' });
      setMontantCible('');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['objectifs', campagneActive.id] });
    } catch (err) {
      console.error(err);
      const msg = err.code === '23505'
        ? "Un objectif global existe déjà pour cette campagne."
        : "Erreur lors de l'enregistrement.";
      setFeedback({ type: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (id) => {
    if (!editMontant || Number(editMontant) <= 0) return;
    try {
      await objectifsService.update(id, { montantCible: Number(editMontant) });
      setEditingId(null);
      setEditMontant('');
      queryClient.invalidateQueries({ queryKey: ['objectifs', campagneActive.id] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet objectif ?')) return;
    try {
      await objectifsService.remove(id);
      queryClient.invalidateQueries({ queryKey: ['objectifs', campagneActive.id] });
    } catch (err) {
      console.error(err);
    }
  };

  if (!campagneActive) {
    return <p className="text-sm text-gray-500">Aucune campagne active. Crée d'abord une campagne.</p>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Objectif — ${campagneActive.annee}`}
        action={
          !objectif && (
            <button
              onClick={() => { setShowForm(!showForm); setMontantCible(''); setFeedback(null); }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-700 text-white px-4 py-2.5 text-sm font-semibold hover:bg-primary-800 shadow-sm shadow-primary-700/20 transition-all"
            >
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? 'Annuler' : 'Nouvel objectif'}
            </button>
          )
        }
      />

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-5 space-y-3 shadow-sm">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Montant cible (FCFA)</label>
          <input
            type="number"
            min="1"
            value={montantCible}
            onChange={(e) => setMontantCible(e.target.value)}
            placeholder="Ex : 10 000 000"
            required
            className={inputCls}
          />
          <button type="submit" disabled={submitting} className="w-full rounded-xl bg-primary-700 text-white py-2.5 text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 shadow-sm shadow-primary-700/20 transition-all">
            {submitting ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          {feedback && <p className={`text-sm ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{feedback.message}</p>}
        </form>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-700 border-t-transparent" />
        </div>
      ) : objectif ? (
        <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-6 space-y-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="font-bold text-lg text-gray-900 dark:text-white">Objectif global</p>
            <div className="flex items-center gap-3">
              {editingId === objectif.id ? (
                <>
                  <button onClick={() => handleUpdate(objectif.id)} className="text-xs text-primary-700 hover:underline font-semibold">Valider</button>
                  <button onClick={() => { setEditingId(null); setEditMontant(''); }} className="text-xs text-gray-500 hover:underline">Annuler</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditingId(objectif.id); setEditMontant(objectif.montant_cible); }} className="text-gray-400 hover:text-primary-600 transition-colors"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(objectif.id)} className="text-gray-400 hover:text-red-600 transition-colors"><Trash2 className="h-4 w-4" /></button>
                </>
              )}
            </div>
          </div>

          <div className="w-full h-4 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-primary-600' : 'bg-amber-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5 text-gray-500">
              <Target className="h-4 w-4" />
              {editingId === objectif.id ? (
                <input
                  type="number"
                  min="1"
                  value={editMontant}
                  onChange={(e) => setEditMontant(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleUpdate(objectif.id); if (e.key === 'Escape') { setEditingId(null); setEditMontant(''); } }}
                  className="w-40 rounded-xl border border-primary-300 dark:border-primary-700 bg-transparent px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                  autoFocus
                />
              ) : (
                <span>Objectif : <span className="font-semibold">{formatFCFA(cible)}</span></span>
              )}
              <span className="text-gray-400">·</span>
              <span className="font-bold">{pct}%</span>
            </div>
          </div>

          {/* Détail des sources */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100 dark:border-gray-800/50">
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-900/20 p-3">
              <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-wide text-emerald-600/70 dark:text-emerald-400/60 font-medium">Cotisations</p>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{formatFCFA(totalCotisations)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-sky-50/70 dark:bg-sky-900/20 p-3">
              <HandHeart className="h-5 w-5 text-sky-600 dark:text-sky-400 shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-wide text-sky-600/70 dark:text-sky-400/60 font-medium">Dons</p>
                <p className="text-sm font-bold text-sky-700 dark:text-sky-300">{formatFCFA(totalDons)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-amber-50/70 dark:bg-amber-900/20 p-3">
              <Coins className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-wide text-amber-600/70 dark:text-amber-400/60 font-medium">Quêtes</p>
                <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{formatFCFA(totalQuetes)}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-green-600 font-bold">{formatFCFA(collecte)}</span>
              <span className="text-gray-400 text-sm">collecté</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500 font-semibold">{formatFCFA(reste)}</span>
              <span className="text-gray-400 text-sm">restant</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          <Target className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucun objectif défini pour cette campagne.</p>
          <p className="text-xs mt-1">Clique sur "Nouvel objectif" pour commencer.</p>
        </div>
      )}
    </div>
  );
}
