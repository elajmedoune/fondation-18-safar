import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, CalendarRange, CheckCircle, Clock, Archive } from 'lucide-react';
import { campagnesService } from '../../services/campagnes.service.js';
import { useCampagneContext } from '../../contexts/CampagneContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';

const inputCls = "rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 w-full";

const STATUT_CONFIG = {
  preparation: { label: 'En préparation', icon: Clock, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  active: { label: 'Active', icon: CheckCircle, cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  cloturee: { label: 'Clôturée', icon: Archive, cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' }
};

function formatFCFA(n) {
  return new Intl.NumberFormat('fr-FR').format(Number(n || 0)) + ' FCFA';
}

export default function CampagnesList() {
  const queryClient = useQueryClient();
  const { setCampagneActive } = useCampagneContext();
  const { user } = useAuth();

  const [showForm, setShowForm] = useState(false);
  const [annee, setAnnee] = useState('');
  const [nom, setNom] = useState('');
  const [dateEvenement, setDateEvenement] = useState('');
  const [cotisationHomme, setCotisationHomme] = useState('');
  const [cotisationFemme, setCotisationFemme] = useState('');
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const { data: campagnes = [], isLoading } = useQuery({
    queryKey: ['campagnes'],
    queryFn: campagnesService.list
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['campagnes'] });

  const resetForm = () => { setAnnee(''); setNom(''); setDateEvenement(''); setCotisationHomme(''); setCotisationFemme(''); setFeedback(null); };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setFeedback(null);
    try {
      await campagnesService.create({
        annee: Number(annee), nom, dateEvenement,
        cotisationHomme: Number(cotisationHomme) || 0,
        cotisationFemme: Number(cotisationFemme) || 0
      }, user.id);
      setFeedback({ type: 'success', message: `Campagne ${nom} créée.` });
      resetForm();
      setShowForm(false);
      refresh();
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message || 'Erreur lors de la création.' });
    } finally { setCreating(false); }
  };

  const handleActiver = async (campagne) => {
    setBusyId(campagne.id);
    try { const updated = await campagnesService.activer(campagne.id, user.id); setCampagneActive(updated); refresh(); }
    catch (err) { alert(err.message); } finally { setBusyId(null); }
  };

  const handleCloturer = async (campagne) => {
    if (!confirm(`Clôturer la campagne ${campagne.nom} ?`)) return;
    setBusyId(campagne.id);
    try { await campagnesService.cloturer(campagne.id, user.id); refresh(); }
    catch (err) { alert(err.message); } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Campagnes annuelles</h1>
        <button onClick={() => { setShowForm(!showForm); resetForm(); }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary-700 text-white px-3 py-2 text-sm font-medium hover:bg-primary-800">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Annuler' : 'Nouvelle campagne'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Année (ex: 2026)" type="number" value={annee} onChange={(e) => setAnnee(e.target.value)} required className={inputCls} />
            <input placeholder="Nom (ex: 18 Safar 1447)" value={nom} onChange={(e) => setNom(e.target.value)} required className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Date de l'événement</label>
            <input type="date" value={dateEvenement} onChange={(e) => setDateEvenement(e.target.value)} required className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Cotisation homme (FCFA)</label>
              <input type="number" min="0" value={cotisationHomme} onChange={(e) => setCotisationHomme(e.target.value)} placeholder="Ex: 100000" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Cotisation femme (FCFA)</label>
              <input type="number" min="0" value={cotisationFemme} onChange={(e) => setCotisationFemme(e.target.value)} placeholder="Ex: 50000" className={inputCls} />
            </div>
          </div>
          <button type="submit" disabled={creating} className="w-full rounded-lg bg-primary-700 text-white py-2 text-sm font-medium hover:bg-primary-800 disabled:opacity-50">
            {creating ? 'Création...' : 'Créer la campagne'}
          </button>
          {feedback && <p className={`text-sm ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{feedback.message}</p>}
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500">Chargement...</p>
      ) : campagnes.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CalendarRange className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucune campagne pour l'instant.</p>
          <p className="text-xs mt-1">Clique sur "Nouvelle campagne" pour commencer.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campagnes.map((c) => {
            const statut = STATUT_CONFIG[c.statut] || STATUT_CONFIG.preparation;
            const StatusIcon = statut.icon;
            const isActive = c.statut === 'active';
            return (
              <div key={c.id} className={`rounded-xl border p-4 space-y-2 ${isActive ? 'border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10' : 'border-gray-200 dark:border-gray-800'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{c.nom}</p>
                    <p className="text-gray-500 text-xs">Année {c.annee} · Événement le {new Date(c.date_evenement).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${statut.cls}`}>
                    <StatusIcon className="h-3 w-3" /> {statut.label}
                  </span>
                </div>

                <div className="text-xs text-gray-500 flex items-center gap-4 pt-1">
                  <span>Homme : <span className="font-medium text-gray-700 dark:text-gray-300">{formatFCFA(c.cotisation_homme)}</span></span>
                  <span>Femme : <span className="font-medium text-gray-700 dark:text-gray-300">{formatFCFA(c.cotisation_femme)}</span></span>
                </div>

                <div className="flex gap-2 pt-1">
                  {!isActive && (
                    <button onClick={() => handleActiver(c)} disabled={busyId === c.id} className="inline-flex items-center gap-1 text-xs rounded-lg bg-primary-700 text-white px-3 py-1.5 font-medium hover:bg-primary-800 disabled:opacity-50">
                      <CheckCircle className="h-3 w-3" /> Activer
                    </button>
                  )}
                  {isActive && (
                    <button onClick={() => handleCloturer(c)} disabled={busyId === c.id} className="inline-flex items-center gap-1 text-xs rounded-lg border border-red-300 dark:border-red-800 text-red-600 px-3 py-1.5 font-medium hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50">
                      <Archive className="h-3 w-3" /> Clôturer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
