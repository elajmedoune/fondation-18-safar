import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Shield, UserX, UserCheck, Search, Mail, CalendarRange, CheckCircle, Clock, Archive, Pencil } from 'lucide-react';
import { useCampagneContext } from '../../contexts/CampagneContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { membresService } from '../../services/membres.service.js';
import { rolesService } from '../../services/roles.service.js';
import { campagnesService } from '../../services/campagnes.service.js';
import { ROLES } from '../../constants/roles.js';
import { supabase } from '../../lib/supabaseClient.js';

const ROLE_OPTIONS = [
  { value: ROLES.TRESORIER, label: 'Trésorier' },
  { value: ROLES.SECRETAIRE, label: 'Secrétaire' },
  { value: ROLES.PRESIDENT, label: 'Président' },
  { value: ROLES.ADMINISTRATEUR, label: 'Administrateur' }
];

const ROLE_COLORS = {
  tresorier: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  secretaire: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  president: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  administrateur: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
};

const STATUT_CAMPAGNE = {
  preparation: { label: 'En préparation', icon: Clock, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  active: { label: 'Active', icon: CheckCircle, cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  cloturee: { label: 'Clôturée', icon: Archive, cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' }
};

function formatFCFA(n) {
  return new Intl.NumberFormat('fr-FR').format(Number(n || 0)) + ' FCFA';
}

async function extractErrorMessage(error) {
  try {
    const body = await error.context.json();
    return body?.error || error.message;
  } catch {
    return error.message;
  }
}

const inputCls = "rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 w-full";
const selectCls = "rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 w-full";
const cardCls = "rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 shadow-sm";

export default function Utilisateurs() {
  const { campagneActive, setCampagneActive } = useCampagneContext();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState('existant');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [membreChoisi, setMembreChoisi] = useState(null);

  const [accEmail, setAccEmail] = useState('');
  const [accNom, setAccNom] = useState('');
  const [accPrenom, setAccPrenom] = useState('');
  const [accTelephone, setAccTelephone] = useState('');
  const [accGroupeId, setAccGroupeId] = useState('');
  const [accRole, setAccRole] = useState(ROLES.TRESORIER);
  const [sansProfil, setSansProfil] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [showCampagneForm, setShowCampagneForm] = useState(false);
  const [cAnnee, setCAnnee] = useState('');
  const [cNom, setCNom] = useState('');
  const [cDate, setCDate] = useState('');
  const [cObj, setCObj] = useState('');
  const [cHomme, setCHomme] = useState('');
  const [cFemme, setCFemme] = useState('');
  const [creatingCampagne, setCreatingCampagne] = useState(false);
  const [editingCampagneId, setEditingCampagneId] = useState(null);
  const [editObj, setEditObj] = useState('');
  const [editHomme, setEditHomme] = useState('');
  const [editFemme, setEditFemme] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [editingUser, setEditingUser] = useState(null);
  const [editRoleValue, setEditRoleValue] = useState(ROLES.TRESORIER);

  const { data: campagnes = [], isLoading: loadingCampagnes } = useQuery({
    queryKey: ['campagnes'],
    queryFn: campagnesService.list
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['campagnes'] });
    queryClient.invalidateQueries({ queryKey: ['user_roles'] });
    queryClient.invalidateQueries({ queryKey: ['comptes'] });
  };

  const { data: groupes = [] } = useQuery({
    queryKey: ['groupes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('groupes').select('*').order('nom');
      if (error) throw error;
      return data;
    }
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['user_roles'],
    queryFn: () => rolesService.listWithMembre()
  });

  const { data: comptes = [], isLoading: loadingComptes } = useQuery({
    queryKey: ['comptes'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('list-users');
      if (error) throw new Error(await extractErrorMessage(error));
      return data.users;
    }
  });

  const resetForm = () => {
    setAccEmail(''); setAccNom(''); setAccPrenom(''); setAccTelephone('');
    setAccGroupeId(''); setMembreChoisi(null); setSearchQuery(''); setSansProfil(false); setFeedback(null);
  };

  const handleSearch = async (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setMembreChoisi(null);
    if (value.trim().length < 2) { setSearchResults([]); return; }
    const res = await membresService.search(value);
    setSearchResults(res);
  };

  const selectMembre = (m) => { setMembreChoisi(m); setSearchResults([]); setSearchQuery(`${m.prenom} ${m.nom} — ${m.numero_membre}`); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const body = { email: accEmail, role: accRole, campagne_id: accRole === ROLES.ADMINISTRATEUR ? null : (campagneActive?.id || null) };
      if (accRole === ROLES.ADMINISTRATEUR && sansProfil) {
        body.sans_profil_membre = true;
      } else if (mode === 'existant') {
        if (!membreChoisi) throw new Error('Choisis un membre existant.');
        body.existing_membre_id = membreChoisi.id;
      } else {
        body.nom = accNom; body.prenom = accPrenom; body.telephone = accTelephone || null; body.membre_groupe_id = accGroupeId || null;
      }
      const { data, error } = await supabase.functions.invoke('create-user-with-role', { body });
      if (error) throw new Error(await extractErrorMessage(error));
      if (data?.error) throw new Error(data.error);
      setFeedback({ type: 'success', message: `Invitation envoyée à ${accEmail}.` });
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['user_roles'] });
      queryClient.invalidateQueries({ queryKey: ['comptes'] });
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message || 'Erreur lors de la création.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveRole = async (id, membreNom) => {
    if (!confirm(`Retirer ce role a ${membreNom || 'cet utilisateur'} ? Il ne pourra plus se connecter a l'application.`)) return;
    await rolesService.remove(id, { userId: currentUser.id, campagneId: campagneActive?.id || null });
    queryClient.invalidateQueries({ queryKey: ['user_roles'] });
    queryClient.invalidateQueries({ queryKey: ['comptes'] });
  };

  const handleToggleBan = async (targetUserId, ban) => {
    if (!confirm(ban ? 'Désactiver ce compte ? Les données sont conservées.' : 'Réactiver ce compte ?')) return;
    try {
      const { data, error } = await supabase.functions.invoke('toggle-user-ban', { body: { target_user_id: targetUserId, ban } });
      if (error) throw new Error(await extractErrorMessage(error));
      if (data?.error) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ['comptes'] });
    } catch (err) { alert(err.message); }
  };

  const startEditRole = (compte) => {
    const currentRole = compte.roles[0]?.role || ROLES.TRESORIER;
    setEditingUser(compte);
    setEditRoleValue(currentRole);
  };

  const handleSaveRole = async () => {
    if (!editingUser) return;
    try {
      if (editingUser.roles.length > 0) {
        const existingRole = editingUser.roles[0];
        await rolesService.update(existingRole.id, {
          role: editRoleValue,
          campagneId: editRoleValue === ROLES.ADMINISTRATEUR ? null : (campagneActive?.id || null)
        }, currentUser.id);
      } else {
        await rolesService.assign({
          userId: editingUser.id,
          role: editRoleValue,
          campagneId: editRoleValue === ROLES.ADMINISTRATEUR ? null : (campagneActive?.id || null)
        }, currentUser.id);
      }
      setEditingUser(null);
      refresh();
    } catch (err) { alert(err.message); }
  };

  const adminSansProfilActif = accRole === ROLES.ADMINISTRATEUR && sansProfil;

  const handleCreateCampagne = async (e) => {
    e.preventDefault();
    setCreatingCampagne(true);
    try {
      await campagnesService.create({
        annee: Number(cAnnee), nom: cNom, dateEvenement: cDate,
        objectifGlobal: Number(cObj) || 0,
        cotisationHomme: Number(cHomme) || 0,
        cotisationFemme: Number(cFemme) || 0
      }, currentUser.id);
      setCAnnee(''); setCNom(''); setCDate(''); setCObj(''); setCHomme(''); setCFemme('');
      setShowCampagneForm(false);
      refresh();
    } catch (err) { alert(err.message); } finally { setCreatingCampagne(false); }
  };

  const startEditCampagne = (c) => {
    setEditingCampagneId(c.id);
    setEditObj(c.objectif_global || '');
    setEditHomme(c.cotisation_homme || '');
    setEditFemme(c.cotisation_femme || '');
  };

  const handleSaveCampagne = async (c) => {
    setSavingEdit(true);
    try {
      await campagnesService.update(c.id, {
        nom: c.nom, dateEvenement: c.date_evenement,
        objectifGlobal: Number(editObj) || 0,
        cotisationHomme: Number(editHomme) || 0,
        cotisationFemme: Number(editFemme) || 0
      }, { userId: currentUser.id });
      setEditingCampagneId(null);
      refresh();
    } catch (err) { alert(err.message); } finally { setSavingEdit(false); }
  };

  const handleActiverCampagne = async (c) => {
    setBusyId(c.id);
    try { const updated = await campagnesService.activer(c.id, currentUser.id); setCampagneActive(updated); refresh(); }
    catch (err) { alert(err.message); } finally { setBusyId(null); }
  };

  const handleCloturerCampagne = async (c) => {
    if (!confirm(`Clôturer "${c.nom}" ?`)) return;
    setBusyId(c.id);
    try { await campagnesService.cloturer(c.id, currentUser.id); refresh(); }
    catch (err) { alert(err.message); } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto pb-8">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2"><Shield className="h-5 w-5" /> Administration</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gestion des campagnes, utilisateurs et rôles.</p>
      </div>

      {/* ── CAMPAGNES ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-gray-500 flex items-center gap-1.5 uppercase tracking-wide">
            <CalendarRange className="h-3.5 w-3.5" /> Campagnes
          </h2>
          <button
            onClick={() => setShowCampagneForm(!showCampagneForm)}
            className="inline-flex items-center gap-1 text-xs rounded-lg bg-primary-700 text-white px-3 py-1.5 font-medium hover:bg-primary-800 active:scale-[0.98] transition shrink-0"
          >
            {showCampagneForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {showCampagneForm ? 'Annuler' : 'Nouvelle'}
          </button>
        </div>

        {showCampagneForm && (
          <form onSubmit={handleCreateCampagne} className={`${cardCls} p-4 space-y-3`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input placeholder="Année (ex: 2026)" type="number" value={cAnnee} onChange={(e) => setCAnnee(e.target.value)} required className={inputCls} />
              <input placeholder="Nom (ex: 18 Safar 1447)" value={cNom} onChange={(e) => setCNom(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Date de l'événement</label>
              <input type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Objectif global (FCFA)</label>
              <input type="number" min="0" value={cObj} onChange={(e) => setCObj(e.target.value)} placeholder="Ex: 5000000" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Cotisation homme (FCFA)</label>
                <input type="number" min="0" value={cHomme} onChange={(e) => setCHomme(e.target.value)} placeholder="Ex: 100000" className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Cotisation femme (FCFA)</label>
                <input type="number" min="0" value={cFemme} onChange={(e) => setCFemme(e.target.value)} placeholder="Ex: 50000" className={inputCls} />
              </div>
            </div>
            <button type="submit" disabled={creatingCampagne} className="w-full rounded-lg bg-primary-700 text-white py-2.5 text-sm font-medium hover:bg-primary-800 disabled:opacity-50 transition">
              {creatingCampagne ? 'Création...' : 'Créer la campagne'}
            </button>
          </form>
        )}

        {loadingCampagnes ? (
          <p className="text-sm text-gray-500">Chargement...</p>
        ) : campagnes.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune campagne.</p>
        ) : (
          <ul className={`divide-y divide-gray-200 dark:divide-gray-800 ${cardCls} overflow-hidden`}>
            {campagnes.map((c) => {
              const statut = STATUT_CAMPAGNE[c.statut] || STATUT_CAMPAGNE.preparation;
              const StatusIcon = statut.icon;
              const isActive = c.statut === 'active';
              const isEditing = editingCampagneId === c.id;
              return (
                <li key={c.id} className={`px-4 py-3.5 space-y-2.5 ${isActive ? 'bg-green-50/60 dark:bg-green-900/10' : ''}`}>
                  {/* Titre + statut */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{c.nom}</p>
                      <p className="text-gray-500 text-xs">Année {c.annee} · {new Date(c.date_evenement).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${statut.cls}`}>
                      <StatusIcon className="h-3 w-3" /> <span className="hidden xs:inline">{statut.label}</span>
                    </span>
                  </div>

                  {/* Stats / édition */}
                  {!isEditing ? (
                    <div className="flex items-start justify-between gap-2">
                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>Objectif : <span className="font-medium text-gray-700 dark:text-gray-300">{formatFCFA(c.objectif_global)}</span></span>
                        <span>Homme : <span className="font-medium text-gray-700 dark:text-gray-300">{formatFCFA(c.cotisation_homme)}</span></span>
                        <span>Femme : <span className="font-medium text-gray-700 dark:text-gray-300">{formatFCFA(c.cotisation_femme)}</span></span>
                      </div>
                      <button onClick={() => startEditCampagne(c)} className="text-gray-400 hover:text-primary-600 shrink-0 p-1 -m-1" title="Modifier">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[11px] text-gray-500 block mb-0.5">Objectif</label>
                          <input type="number" min="0" value={editObj} onChange={(e) => setEditObj(e.target.value)} className={`${inputCls} px-2 py-1.5 text-xs`} />
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-500 block mb-0.5">Homme</label>
                          <input type="number" min="0" value={editHomme} onChange={(e) => setEditHomme(e.target.value)} className={`${inputCls} px-2 py-1.5 text-xs`} />
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-500 block mb-0.5">Femme</label>
                          <input type="number" min="0" value={editFemme} onChange={(e) => setEditFemme(e.target.value)} className={`${inputCls} px-2 py-1.5 text-xs`} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveCampagne(c)} disabled={savingEdit} className="flex-1 rounded-lg bg-primary-700 text-white py-2 text-xs font-medium hover:bg-primary-800 disabled:opacity-50">
                          {savingEdit ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                        <button onClick={() => setEditingCampagneId(null)} className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}

                  {!isEditing && (
                    <div className="flex gap-2 pt-1">
                      {!isActive && (
                        <button onClick={() => handleActiverCampagne(c)} disabled={busyId === c.id} className="w-full sm:w-auto inline-flex items-center justify-center gap-1 text-xs rounded-lg bg-primary-700 text-white px-3 py-1.5 font-medium hover:bg-primary-800 disabled:opacity-50">
                          <CheckCircle className="h-3 w-3" /> Activer
                        </button>
                      )}
                      {isActive && (
                        <button onClick={() => handleCloturerCampagne(c)} disabled={busyId === c.id} className="w-full sm:w-auto inline-flex items-center justify-center gap-1 text-xs rounded-lg border border-red-300 dark:border-red-800 text-red-600 px-3 py-1.5 font-medium hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50">
                          <Archive className="h-3 w-3" /> Clôturer
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── UTILISATEURS ── */}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-gray-500 flex items-center gap-1.5 uppercase tracking-wide">
            <Shield className="h-3.5 w-3.5" /> Utilisateurs & roles
          </h2>
          {campagneActive && (
            <button
              onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }}
              className="inline-flex items-center gap-1 text-xs rounded-lg bg-primary-700 text-white px-3 py-1.5 font-medium hover:bg-primary-800 active:scale-[0.98] transition shrink-0"
            >
              {showForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              {showForm ? 'Annuler' : 'Donner un accès'}
            </button>
          )}
        </div>

        {!campagneActive && (
          <p className="rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-sm px-4 py-3">
            Aucune campagne active. Activez une campagne d'abord.
          </p>
        )}

      {showForm && (
        <section className={`${cardCls} p-4 space-y-3`}>
          <h2 className="font-medium text-sm">Donner un accès (compte)</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input type="email" placeholder="Email" value={accEmail} onChange={(e) => setAccEmail(e.target.value)} required className={inputCls} />
            <select value={accRole} onChange={(e) => setAccRole(e.target.value)} className={selectCls}>
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            {accRole === ROLES.ADMINISTRATEUR && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={sansProfil} onChange={(e) => setSansProfil(e.target.checked)} />
                Compte admin technique (pas de profil membre)
              </label>
            )}
            {!adminSansProfilActif && (
              <>
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                  <label className="flex items-center gap-2"><input type="radio" checked={mode === 'existant'} onChange={() => setMode('existant')} /> Membre existant</label>
                  <label className="flex items-center gap-2"><input type="radio" checked={mode === 'nouveau'} onChange={() => setMode('nouveau')} /> Nouveau membre</label>
                </div>
                {mode === 'existant' ? (
                  <div className="relative">
                    <input type="text" placeholder="Nom, prénom ou numéro..." value={searchQuery} onChange={handleSearch} className={inputCls} />
                    {searchResults.length > 0 && (
                      <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg max-h-56 overflow-auto">
                        {searchResults.map((m) => (
                          <li key={m.id}>
                            <button type="button" onClick={() => selectMembre(m)} className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm">
                              {m.prenom} {m.nom} <span className="text-gray-500">— {m.numero_membre}</span>
                              {m.user_id && <span className="text-amber-600 text-xs"> (a déjà un compte)</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input placeholder="Nom" value={accNom} onChange={(e) => setAccNom(e.target.value)} required className={inputCls} />
                    <input placeholder="Prénom" value={accPrenom} onChange={(e) => setAccPrenom(e.target.value)} required className={inputCls} />
                    <input placeholder="Téléphone" value={accTelephone} onChange={(e) => setAccTelephone(e.target.value)} className={`sm:col-span-2 ${inputCls}`} />
                    <select value={accGroupeId} onChange={(e) => setAccGroupeId(e.target.value)} className={`sm:col-span-2 ${selectCls}`}>
                      <option value="">Groupe (optionnel)...</option>
                      {groupes.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}
            <button type="submit" disabled={submitting} className="w-full rounded-lg bg-primary-700 text-white py-2.5 text-sm font-medium hover:bg-primary-800 disabled:opacity-50">
              {submitting ? 'Création...' : "Créer et envoyer l'invitation"}
            </button>
          </form>
          {feedback && <p className={`text-sm ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{feedback.message}</p>}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-gray-500 flex items-center gap-1.5 uppercase tracking-wide"><Shield className="h-3.5 w-3.5" /> Rôles attribués</h2>
        {roles.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun rôle attribué.</p>
        ) : (
          <ul className={`divide-y divide-gray-200 dark:divide-gray-800 ${cardCls} overflow-hidden`}>
            {roles.map((r) => (
              <li key={r.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[r.role] || 'bg-gray-100 text-gray-600'}`}>
                    {ROLE_OPTIONS.find((o) => o.value === r.role)?.label || r.role}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.user_id === currentUser.id ? 'Toi' : (r.membre ? `${r.membre.prenom} ${r.membre.nom}` : r.user_id.slice(0, 8))}</p>
                    <p className="text-gray-500 text-xs">{r.campagne_id ? 'campagne actuelle' : 'global'} {r.groupe?.nom ? `· ${r.groupe.nom}` : ''}</p>
                  </div>
                </div>
                  {r.user_id !== currentUser.id && (
                    <button onClick={() => handleRemoveRole(r.id, r.membre ? `${r.membre.prenom} ${r.membre.nom}` : null)} className="self-start sm:self-auto text-red-600 hover:underline text-xs shrink-0">Retirer</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-gray-500 flex items-center gap-1.5 uppercase tracking-wide"><Mail className="h-3.5 w-3.5" /> Comptes existants</h2>
        {loadingComptes ? (
          <p className="text-sm text-gray-500">Chargement...</p>
        ) : (
          <ul className={`divide-y divide-gray-200 dark:divide-gray-800 ${cardCls} overflow-hidden`}>
            {comptes.map((c) => {
              const isSelf = c.id === currentUser.id;
              const isEditingThis = editingUser?.id === c.id;
              return (
                <li key={c.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    {c.membre?.photo_url ? (
                      <img src={c.membre.photo_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 text-xs font-medium shrink-0">
                        {c.membre?.prenom?.[0]}{c.membre?.nom?.[0]}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {c.membre ? `${c.membre.prenom} ${c.membre.nom}` : c.email}
                        {isSelf && <span className="text-xs text-gray-400"> (toi)</span>}
                      </p>
                      <p className="text-gray-500 text-xs truncate">
                        {c.email} · {c.roles.length > 0 ? c.roles.map((r) => r.role).join(', ') : <span className="text-red-500 font-medium">aucun role — acces bloque</span>}
                        {c.banned && <span className="text-red-600"> · desactive</span>}
                      </p>
                    </div>
                  </div>
                  {!isSelf && (
                    <div className="flex items-center gap-2 shrink-0">
                      {isEditingThis ? (
                        <div className="flex items-center gap-1.5">
                          <select value={editRoleValue} onChange={(e) => setEditRoleValue(e.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs">
                            {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                          <button onClick={handleSaveRole} className="text-green-600 hover:underline text-xs font-medium">Valider</button>
                          <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:underline text-xs">Annuler</button>
                        </div>
                      ) : (
                        <>
                          {c.roles.length > 0 && (
                            <button onClick={() => startEditRole(c)} className="text-primary-600 hover:underline text-xs">Modifier</button>
                          )}
                          {c.roles.length === 0 && (
                            <button onClick={() => startEditRole(c)} className="text-green-600 hover:underline text-xs font-medium">Attribuer</button>
                          )}
                          <button onClick={() => handleToggleBan(c.id, !c.banned)} className={`inline-flex items-center gap-1 text-xs ${c.banned ? 'text-green-600 hover:underline' : 'text-red-600 hover:underline'}`}>
                            {c.banned ? <><UserCheck className="h-3 w-3" /> Reactiver</> : <><UserX className="h-3 w-3" /> Desactiver</>}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      </section>
    </div>
  );
}