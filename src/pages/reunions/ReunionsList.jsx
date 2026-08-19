import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Calendar, MapPin, Clock, FileText, Trash2 } from 'lucide-react';
import { useCampagneContext } from '../../contexts/CampagneContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useRole } from '../../hooks/useRole.js';
import { reunionsService } from '../../services/reunions.service.js';
import usePersistedState from '../../hooks/usePersistedState.js';
import PageHeader from '../../components/ui/PageHeader.jsx';

const inputCls = "rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 w-full focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all";
const textareaCls = "rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 w-full focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all resize-none";

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  return `${h}h${m && m !== '00' ? m : ''}`;
}

export default function ReunionsList() {
  const { campagneActive } = useCampagneContext();
  const { user } = useAuth();
  const { hasRole } = useRole();
  const queryClient = useQueryClient();
  const canWrite = hasRole(['secretaire', 'president', 'administrateur']);

  const [showForm, setShowForm] = usePersistedState('reu-showForm', false);
  const [dateReunion, setDateReunion] = usePersistedState('reu-date', '');
  const [heure, setHeure] = usePersistedState('reu-heure', '');
  const [lieu, setLieu] = usePersistedState('reu-lieu', '');
  const [ordreDuJour, setOrdreDuJour] = usePersistedState('reu-ordre', '');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const { data: reunions = [], isLoading } = useQuery({
    queryKey: ['reunions', campagneActive?.id],
    queryFn: () => reunionsService.listByCampagne(campagneActive.id),
    enabled: !!campagneActive?.id
  });

  const resetForm = () => { setDateReunion(''); setHeure(''); setLieu(''); setOrdreDuJour(''); setFeedback(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dateReunion) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await reunionsService.create({
        campagneId: campagneActive.id,
        dateReunion,
        heure: heure || null,
        lieu: lieu || null,
        ordreDuJour: ordreDuJour || null,
        userId: user.id
      });
      setFeedback({ type: 'success', message: 'Réunion créée.' });
      resetForm();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['reunions', campagneActive.id] });
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message || 'Erreur.' });
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette réunion et toutes ses présences ?')) return;
    try {
      await reunionsService.remove(id, { userId: user.id, campagneId: campagneActive.id });
      queryClient.invalidateQueries({ queryKey: ['reunions', campagneActive.id] });
    } catch (err) { alert(err.message); }
  };

  if (!campagneActive) return <p className="text-sm text-gray-500">Aucune campagne active.</p>;

  const now = new Date();
  const upcoming = reunions.filter((r) => new Date(r.date_reunion) >= now);
  const past = reunions.filter((r) => new Date(r.date_reunion) < now);

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <PageHeader
        title="Réunions"
        subtitle={`${reunions.length} réunion${reunions.length !== 1 ? 's' : ''}`}
        action={
          canWrite && (
            <button onClick={() => { setShowForm(!showForm); resetForm(); }} className="inline-flex items-center gap-1.5 rounded-xl bg-primary-700 text-white px-4 py-2.5 text-sm font-semibold hover:bg-primary-800 shadow-sm shadow-primary-700/20 transition-all">
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? 'Annuler' : 'Nouvelle'}
            </button>
          )
        }
      />

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-5 space-y-3 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Date *</label>
              <input type="date" value={dateReunion} onChange={(e) => setDateReunion(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Heure</label>
              <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Lieu</label>
            <input type="text" value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="Salle, adresse..." className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Ordre du jour</label>
            <textarea value={ordreDuJour} onChange={(e) => setOrdreDuJour(e.target.value)} rows={3} placeholder="Points à aborder..." className={textareaCls} />
          </div>
          <button type="submit" disabled={submitting} className="w-full rounded-xl bg-primary-700 text-white py-2.5 text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 shadow-sm shadow-primary-700/20 transition-all">
            {submitting ? 'Création...' : 'Créer la réunion'}
          </button>
          {feedback && <p className={`text-sm ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{feedback.message}</p>}
        </form>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-700 border-t-transparent" />
        </div>
      ) : reunions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucune réunion planifiée.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">À venir</h2>
              <div className="space-y-2">
                {upcoming.map((r) => (
                  <Link
                    key={r.id}
                    to={`/reunions/${r.id}`}
                    className="block rounded-2xl border border-primary-200 dark:border-primary-800/40 bg-primary-50/30 dark:bg-primary-900/10 p-4 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white">{formatDate(r.date_reunion)}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          {r.heure && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatTime(r.heure)}</span>}
                          {r.lieu && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {r.lieu}</span>}
                        </div>
                        {r.ordre_du_jour && <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{r.ordre_du_jour}</p>}
                      </div>
                      {canWrite && (
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(r.id); }} className="text-gray-400 hover:text-red-600 shrink-0 transition-colors" title="Supprimer">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Passées</h2>
              <div className="space-y-2">
                {past.map((r) => (
                  <Link
                    key={r.id}
                    to={`/reunions/${r.id}`}
                    className="block rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white">{formatDate(r.date_reunion)}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          {r.heure && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatTime(r.heure)}</span>}
                          {r.lieu && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {r.lieu}</span>}
                        </div>
                        {r.compte_rendu && (
                          <div className="flex items-center gap-1 mt-1.5 text-xs text-green-600">
                            <FileText className="h-3 w-3" /> Compte rendu disponible
                          </div>
                        )}
                      </div>
                      {canWrite && (
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(r.id); }} className="text-gray-400 hover:text-red-600 shrink-0 transition-colors" title="Supprimer">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
