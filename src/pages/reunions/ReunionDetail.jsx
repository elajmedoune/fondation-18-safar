import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, X, UserPlus, CheckCircle, XCircle, Clock, HelpCircle, FileText, Trash2, CheckCheck } from 'lucide-react';
import { useCampagneContext } from '../../contexts/CampagneContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useRole } from '../../hooks/useRole.js';
import { reunionsService } from '../../services/reunions.service.js';
import { membresService } from '../../services/membres.service.js';
import BackButton from '../../components/ui/BackButton.jsx';

const STATUT_PRESENCE = [
  { value: 'present', label: 'Présent', icon: CheckCircle, color: 'text-green-600 bg-green-50 dark:bg-green-900/30' },
  { value: 'absent', label: 'Absent', icon: XCircle, color: 'text-red-600 bg-red-50 dark:bg-red-900/30' },
  { value: 'retard', label: 'Retard', icon: Clock, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30' },
  { value: 'excuse', label: 'Excusé', icon: HelpCircle, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' }
];

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  return `${h}h${m && m !== '00' ? m : ''}`;
}

const inputCls = "rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 w-full focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all";
const textareaCls = "rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 w-full focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all resize-none";

export default function ReunionDetail() {
  const { id } = useParams();
  const { campagneActive } = useCampagneContext();
  const { user } = useAuth();
  const { hasRole } = useRole();
  const queryClient = useQueryClient();
  const canWrite = hasRole(['secretaire', 'president', 'administrateur']);

  const [editingInfo, setEditingInfo] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editHeure, setEditHeure] = useState('');
  const [editLieu, setEditLieu] = useState('');
  const [editOrdre, setEditOrdre] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);

  const [editingCR, setEditingCR] = useState(false);
  const [compteRendu, setCompteRendu] = useState('');
  const [savingCR, setSavingCR] = useState(false);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerGroupe, setPickerGroupe] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAdding, setBulkAdding] = useState(false);

  const { data: reunion, isLoading } = useQuery({
    queryKey: ['reunion-detail', id],
    queryFn: () => reunionsService.getDetail(id),
    enabled: !!id
  });

  // Liste complète des membres de la campagne (même source que la page Membres,
  // inclut les membres du bureau sans fiche campagne), chargée à l'ouverture du sélecteur.
  const { data: fichesCampagne = [], isLoading: loadingMembres } = useQuery({
    queryKey: ['membres-campagne-roles', campagneActive?.id],
    queryFn: () => membresService.getByCampagneAvecRoles(campagneActive.id),
    enabled: showPicker && !!campagneActive?.id
  });

  const pickerData = useMemo(() => {
    const existingIds = new Set((reunion?.reunion_participants || []).map((p) => p.membre?.id));
    const byMembre = new Map();
    const groupeByMembreId = new Map();
    (fichesCampagne || []).forEach((f) => {
      if (!f.membre || existingIds.has(f.membre.id) || byMembre.has(f.membre.id)) return;
      byMembre.set(f.membre.id, f.membre);
      if (f.groupe?.id) groupeByMembreId.set(f.membre.id, f.groupe);
    });
    const groupes = [];
    const seenGroupes = new Set();
    groupeByMembreId.forEach((g) => {
      if (!seenGroupes.has(g.id)) { seenGroupes.add(g.id); groupes.push(g); }
    });
    return { disponibles: [...byMembre.values()], groupes, groupeByMembreId };
  }, [fichesCampagne, reunion?.reunion_participants]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['reunion-detail', id] });
    queryClient.invalidateQueries({ queryKey: ['reunions', campagneActive?.id] });
  };

  const startEditInfo = () => {
    if (!reunion) return;
    setEditDate(reunion.date_reunion);
    setEditHeure(reunion.heure || '');
    setEditLieu(reunion.lieu || '');
    setEditOrdre(reunion.ordre_du_jour || '');
    setEditingInfo(true);
  };

  const handleSaveInfo = async () => {
    setSavingInfo(true);
    try {
      await reunionsService.update(id, {
        dateReunion: editDate,
        heure: editHeure || null,
        lieu: editLieu || null,
        ordreDuJour: editOrdre || null
      }, { userId: user.id, campagneId: campagneActive?.id });
      setEditingInfo(false);
      invalidate();
    } catch (err) { alert(err.message); }
    finally { setSavingInfo(false); }
  };

  const startEditCR = () => {
    setCompteRendu(reunion?.compte_rendu || '');
    setEditingCR(true);
  };

  const handleSaveCR = async () => {
    setSavingCR(true);
    try {
      await reunionsService.update(id, { compteRendu: compteRendu || null }, { userId: user.id, campagneId: campagneActive?.id });
      setEditingCR(false);
      invalidate();
    } catch (err) { alert(err.message); }
    finally { setSavingCR(false); }
  };

  const toggleSelect = (membreId) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(membreId)) next.delete(membreId); else next.add(membreId);
    return next;
  });

  const handleBulkAdd = async () => {
    if (selectedIds.size === 0) return;
    setBulkAdding(true);
    try {
      await reunionsService.addParticipantsBulk(id, [...selectedIds], 'present', user.id, campagneActive?.id);
      setSelectedIds(new Set());
      setPickerSearch('');
      setPickerGroupe('all');
      setShowPicker(false);
      invalidate();
    } catch (err) { alert(err.message); }
    finally { setBulkAdding(false); }
  };

  const handleMarkAllPresent = async () => {
    try {
      await reunionsService.markAllPresent(id, user.id, campagneActive?.id);
      invalidate();
    } catch (err) { alert(err.message); }
  };

  const handleUpdateStatut = async (participantId, statut) => {
    try {
      await reunionsService.updateParticipantStatut(participantId, statut);
      invalidate();
    } catch (err) { alert(err.message); }
  };

  const handleRemoveParticipant = async (participantId) => {
    if (!confirm('Retirer ce participant ?')) return;
    try {
      await reunionsService.removeParticipant(participantId, { userId: user.id, campagneId: campagneActive?.id });
      invalidate();
    } catch (err) { alert(err.message); }
  };

  if (isLoading) return <div className="flex items-center justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-700 border-t-transparent" /></div>;
  if (!reunion) return <p className="text-sm text-gray-500">Réunion introuvable.</p>;

  const participants = reunion.reunion_participants || [];
  const presences = participants.filter((p) => p.statut_presence === 'present');
  const absents = participants.filter((p) => p.statut_presence === 'absent');
  const retards = participants.filter((p) => p.statut_presence === 'retard');
  const excuses = participants.filter((p) => p.statut_presence === 'excuse');

  const pickerQuery = pickerSearch.trim().toLowerCase();
  const disponiblesFiltres = pickerData.disponibles.filter((m) => {
    if (pickerGroupe !== 'all' && pickerData.groupeByMembreId.get(m.id)?.id !== pickerGroupe) return false;
    if (!pickerQuery) return true;
    return `${m.prenom} ${m.nom} ${m.numero_membre}`.toLowerCase().includes(pickerQuery);
  });
  const allFilteredSelected = disponiblesFiltres.length > 0 && disponiblesFiltres.every((m) => selectedIds.has(m.id));
  const toggleAllFiltered = () => setSelectedIds((prev) => {
    const next = new Set(prev);
    disponiblesFiltres.forEach((m) => (allFilteredSelected ? next.delete(m.id) : next.add(m.id)));
    return next;
  });

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <BackButton to="/reunions" label="Réunions" />

      {/* En-tête réunion */}
      <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4 sm:p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">{formatDate(reunion.date_reunion)}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-gray-500">
              {reunion.heure && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatTime(reunion.heure)}</span>}
              {reunion.lieu && <span className="flex items-center gap-1 min-w-0"><FileText className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{reunion.lieu}</span></span>}
            </div>
          </div>
          {canWrite && !editingInfo && (
            <button onClick={startEditInfo} className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-800 px-3 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
              <Pencil className="h-3.5 w-3.5" /> Modifier
            </button>
          )}
        </div>

        {editingInfo && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Date</label>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Heure</label>
                <input type="time" value={editHeure} onChange={(e) => setEditHeure(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Lieu</label>
              <input type="text" value={editLieu} onChange={(e) => setEditLieu(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Ordre du jour</label>
              <textarea value={editOrdre} onChange={(e) => setEditOrdre(e.target.value)} rows={3} className={textareaCls} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveInfo} disabled={savingInfo} className="rounded-xl bg-primary-700 text-white px-4 py-2 text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 transition-all">
                {savingInfo ? '...' : 'Enregistrer'}
              </button>
              <button onClick={() => setEditingInfo(false)} className="rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                Annuler
              </button>
            </div>
          </div>
        )}

        {reunion.ordre_du_jour && !editingInfo && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
            <p className="text-xs text-gray-500 font-medium mb-1">Ordre du jour</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{reunion.ordre_du_jour}</p>
          </div>
        )}
      </div>

      {/* Statistiques présences */}
      {participants.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Présents', count: presences.length, cls: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' },
            { label: 'Retards', count: retards.length, cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' },
            { label: 'Excusés', count: excuses.length, cls: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' },
            { label: 'Absents', count: absents.length, cls: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' }
          ].map((s) => (
            <div key={s.label} className={`rounded-xl p-2.5 sm:p-3 text-center ${s.cls}`}>
              <p className="text-lg font-bold">{s.count}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Participants */}
      <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4 sm:p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Participants ({participants.length})</h2>

        {canWrite && (
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={() => setShowPicker(true)} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary-200 dark:border-primary-800/60 bg-primary-50/50 dark:bg-primary-900/10 text-primary-700 dark:text-primary-400 px-3 py-2.5 text-xs font-semibold hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-all">
              <UserPlus className="h-4 w-4" /> Ajouter des membres
            </button>
            {participants.some((p) => p.statut_presence !== 'present') && (
              <button onClick={handleMarkAllPresent} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10 text-green-700 dark:text-green-400 px-3 py-2.5 text-xs font-semibold hover:bg-green-100 dark:hover:bg-green-900/30 transition-all">
                <CheckCheck className="h-4 w-4" /> Tout présent
              </button>
            )}
          </div>
        )}

        {participants.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">Aucun participant. Ajoute des membres pour faire l'appel.</p>
        ) : (
          <div className="space-y-1.5">
            {participants.map((p) => {
              const statut = STATUT_PRESENCE.find((s) => s.value === p.statut_presence);
              const StatutIcon = statut?.icon || CheckCircle;
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 py-2 px-2 sm:px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    {p.membre?.photo_url ? (
                      <img src={p.membre.photo_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/40 dark:to-primary-800/40 flex items-center justify-center text-primary-700 dark:text-primary-400 text-xs font-bold shrink-0">
                        {p.membre?.prenom?.[0]}{p.membre?.nom?.[0]}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.membre?.prenom} {p.membre?.nom}</p>
                      <p className="text-xs text-gray-500">N° {p.membre?.numero_membre}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    {canWrite ? (
                      STATUT_PRESENCE.map((s) => {
                        const SIcon = s.icon;
                        const isActive = p.statut_presence === s.value;
                        return (
                          <button
                            key={s.value}
                            onClick={() => handleUpdateStatut(p.id, s.value)}
                            className={`p-1.5 rounded-lg transition-all ${isActive ? s.color + ' font-bold' : 'text-gray-300 dark:text-gray-600 hover:text-gray-500'}`}
                            title={s.label}
                          >
                            <SIcon className="h-4 w-4" />
                          </button>
                        );
                      })
                    ) : (
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${statut?.color || ''}`}>
                        <StatutIcon className="h-3 w-3" /> {statut?.label}
                      </span>
                    )}
                    {canWrite && (
                      <button onClick={() => handleRemoveParticipant(p.id)} className="text-gray-300 hover:text-red-600 ml-1 transition-colors" title="Retirer">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Compte rendu */}
      <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-primary-600" /> Compte rendu
          </h2>
          {canWrite && !editingCR && (
            <button onClick={startEditCR} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-800 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
              <Pencil className="h-3 w-3" /> {reunion.compte_rendu ? 'Modifier' : 'Rédiger'}
            </button>
          )}
        </div>

        {editingCR ? (
          <div className="space-y-3">
            <textarea
              value={compteRendu}
              onChange={(e) => setCompteRendu(e.target.value)}
              rows={8}
              placeholder="Rédige le compte rendu de la réunion..."
              className={textareaCls}
            />
            <div className="flex gap-2">
              <button onClick={handleSaveCR} disabled={savingCR} className="rounded-xl bg-primary-700 text-white px-4 py-2 text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 transition-all">
                {savingCR ? '...' : 'Enregistrer'}
              </button>
              <button onClick={() => setEditingCR(false)} className="rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                Annuler
              </button>
            </div>
          </div>
        ) : reunion.compte_rendu ? (
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{reunion.compte_rendu}</p>
        ) : (
          <p className="text-sm text-gray-400 py-4 text-center">Aucun compte rendu pour cette réunion.</p>
        )}
      </div>

      {/* Modale d'ajout en masse des participants */}
      {showPicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPicker(false)} />
          <div className="relative w-full max-w-md h-[80vh] max-h-[640px] rounded-3xl border border-gray-200/70 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl flex flex-col overflow-hidden">
            <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Ajouter des membres</h2>
              <button onClick={() => setShowPicker(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="shrink-0 px-5 pb-2">
              <input type="text" value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} placeholder="Rechercher (nom, n° membre)..." className={inputCls} />
            </div>

            {pickerData.groupes.length > 0 && (
              <div className="shrink-0 px-5 pb-2 flex gap-1.5 overflow-x-auto">
                {[{ id: 'all', nom: 'Tous' }, ...pickerData.groupes].map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setPickerGroupe(g.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${pickerGroupe === g.id ? 'bg-primary-700 text-white' : 'border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                  >
                    {g.nom}
                  </button>
                ))}
              </div>
            )}

            {!loadingMembres && disponiblesFiltres.length > 0 && (
              <label className="shrink-0 mx-5 mb-1 flex items-center gap-2.5 text-xs font-medium text-gray-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAllFiltered}
                  className="h-4 w-4 rounded accent-primary-700"
                />
                Tout sélectionner ({disponiblesFiltres.length})
              </label>
            )}

            <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-0.5 min-h-0">
              {loadingMembres ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-700 border-t-transparent" />
                </div>
              ) : disponiblesFiltres.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">
                  {pickerData.disponibles.length === 0 ? 'Tous les membres sont déjà participants.' : 'Aucun membre trouvé.'}
                </p>
              ) : (
                disponiblesFiltres.map((m) => {
                  const groupe = pickerData.groupeByMembreId.get(m.id);
                  return (
                    <label key={m.id} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(m.id)}
                        onChange={() => toggleSelect(m.id)}
                        className="h-4 w-4 shrink-0 rounded accent-primary-700"
                      />
                      {m.photo_url ? (
                        <img src={m.photo_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/40 dark:to-primary-800/40 flex items-center justify-center text-primary-700 dark:text-primary-400 text-xs font-bold shrink-0">
                          {m.prenom?.[0]}{m.nom?.[0]}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{m.prenom} {m.nom}</p>
                        <p className="text-xs text-gray-500 truncate">
                          N° {m.numero_membre}{groupe ? ` · ${groupe.nom}` : ''}
                        </p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <div className="shrink-0 border-t border-gray-200 dark:border-gray-800 p-4">
              <button
                onClick={handleBulkAdd}
                disabled={selectedIds.size === 0 || bulkAdding}
                className="w-full rounded-xl bg-primary-700 text-white py-2.5 text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 shadow-sm shadow-primary-700/20 transition-all"
              >
                {bulkAdding ? 'Ajout...' : selectedIds.size > 0 ? `Ajouter ${selectedIds.size} membre${selectedIds.size > 1 ? 's' : ''} (présent)` : 'Sélectionne des membres'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}