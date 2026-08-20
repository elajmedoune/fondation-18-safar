import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Filter, ChevronDown, User, Clock, ArrowRight, Search, X, Shield } from 'lucide-react';
import { useCampagneContext } from '../../contexts/CampagneContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { auditLogsService } from '../../services/auditLogs.service.js';
import PageHeader from '../../components/ui/PageHeader.jsx';

const ACTION_CATEGORIES = {
  'Finance': ['cotisation.create', 'cotisation.update', 'cotisation.delete', 'depense.create', 'depense.update', 'depense.delete', 'don.create', 'quete.create'],
  'Réunions': ['reunion.create', 'reunion.update', 'reunion.delete', 'reunion_participant.add', 'reunion_participant.update', 'reunion_participant.remove'],
  'Rôles': ['role.assign', 'role.update', 'role.remove', 'user.ban', 'user.unban', 'user.create'],
  'Campagnes': ['campagne.create', 'campagne.update', 'campagne.activate', 'campagne.close'],
  'Groupes': ['groupe.create', 'groupe.update', 'groupe.delete', 'groupe.assign_membre', 'groupe.remove_membre', 'groupe.add_responsable', 'groupe.remove_responsable'],
  'Membres': ['membre.create', 'membre.update'],
};

const ACTION_ICONS = {
  create: { color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
  update: { color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  delete: { color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
  assign: { color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  remove: { color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
  activate: { color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
  close: { color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  add: { color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
  ban: { color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
  unban: { color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
};

function getActionStyle(action) {
  const verb = action.split('.').pop();
  return ACTION_ICONS[verb] || { color: 'text-gray-600', bg: 'bg-gray-50 dark:bg-gray-800' };
}

function formatDate(iso) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return { day, time };
}

function formatValue(val) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') {
    if (Array.isArray(val)) return val.map(formatValue).join(', ');
    if (val.nom !== undefined && val.prenom !== undefined) return `${val.prenom} ${val.nom}`.trim();
    if (val.nom !== undefined) return val.nom;
    return JSON.stringify(val);
  }
  return String(val);
}

function describeChanges(oldData, newData) {
  if (!oldData || !newData) return null;
  const changes = [];
  const skip = ['id', 'created_at', 'created_by', 'enregistre_par', 'qr_code_value'];
  for (const key of Object.keys(newData)) {
    if (skip.includes(key)) continue;
    const oldVal = oldData[key];
    const newVal = newData[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      const label = key.replace(/_/g, ' ');
      changes.push({ label, from: formatValue(oldVal), to: formatValue(newVal) });
    }
  }
  return changes.length > 0 ? changes : null;
}

const STORAGE_KEY = 'f18s-audit-trail';

function loadState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveState(state) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

export default function AuditTrail() {
  const { campagneActive } = useCampagneContext();
  const { user } = useAuth();

  const saved = loadState();
  const [selectedAction, setSelectedAction] = useState(saved?.selectedAction || '');
  const [selectedUser, setSelectedUser] = useState(saved?.selectedUser || '');
  const [page, setPage] = useState(saved?.page || 0);
  const [expandedId, setExpandedId] = useState(null);
  const limit = 30;

  const persist = useCallback(() => {
    saveState({ selectedAction, selectedUser, page });
  }, [selectedAction, selectedUser, page]);

  useEffect(() => { persist(); }, [persist]);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', campagneActive?.id, selectedAction, selectedUser, page],
    queryFn: () => auditLogsService.listByCampagne(campagneActive.id, {
      action: selectedAction || undefined,
      userId: selectedUser || undefined,
      limit,
      offset: page * limit,
    }),
    enabled: !!campagneActive?.id,
  });

  const { data: totalCount = 0 } = useQuery({
    queryKey: ['audit-logs-count', campagneActive?.id, selectedAction, selectedUser],
    queryFn: () => auditLogsService.countByCampagne(campagneActive.id, {
      action: selectedAction || undefined,
      userId: selectedUser || undefined,
    }),
    enabled: !!campagneActive?.id,
  });

  const { data: activeUsers = [] } = useQuery({
    queryKey: ['audit-users', campagneActive?.id],
    queryFn: () => auditLogsService.getActiveUsers(campagneActive.id),
    enabled: !!campagneActive?.id,
  });

  const totalPages = Math.ceil(totalCount / limit);

  if (!campagneActive) return <p className="text-sm text-gray-500">Aucune campagne active.</p>;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Traçabilité"
        subtitle={`${totalCount} action${totalCount !== 1 ? 's' : ''} enregistrée${totalCount !== 1 ? 's' : ''}`}
      />

      {/* Filtres */}
      <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Filtres</span>
          {(selectedAction || selectedUser) && (
            <button onClick={() => { setSelectedAction(''); setSelectedUser(''); setPage(0); sessionStorage.removeItem(STORAGE_KEY); }} className="ml-auto text-xs text-primary-600 hover:underline">
              Réinitialiser
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <select
              id="audit-action"
              name="audit-action"
              value={selectedAction}
              onChange={(e) => { setSelectedAction(e.target.value); setPage(0); }}
              className="w-full appearance-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 pr-8 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            >
              <option value="">Toutes les actions</option>
              {Object.entries(ACTION_CATEGORIES).map(([cat, actions]) => (
                <optgroup key={cat} label={cat}>
                  {actions.map((a) => (
                    <option key={a} value={a}>{auditLogsService.ACTION_LABELS[a] || a}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              id="audit-user"
              name="audit-user"
              value={selectedUser}
              onChange={(e) => { setSelectedUser(e.target.value); setPage(0); }}
              className="w-full appearance-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 pr-8 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            >
              <option value="">Tous les utilisateurs</option>
              {activeUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.user?.membre ? `${u.user.membre.prenom} ${u.user.membre.nom}` : u.user?.email || u.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Liste des logs */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-700 border-t-transparent" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucune action enregistrée.</p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800/50 rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 shadow-sm overflow-hidden">
            {logs.map((log) => {
              const style = getActionStyle(log.action);
              const { day, time } = formatDate(log.created_at);
              const userName = log.user?.membre ? `${log.user.membre.prenom} ${log.user.membre.nom}` : log.user?.email || '—';
              const isExpanded = expandedId === log.id;
              const changes = describeChanges(log.old_data, log.new_data);

              return (
                <li key={log.id}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    className="w-full text-left px-4 py-3.5 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 shrink-0 h-8 w-8 rounded-lg ${style.bg} flex items-center justify-center`}>
                        <span className={`text-xs font-bold ${style.color}`}>
                          {log.action.split('.').pop()[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {auditLogsService.ACTION_LABELS[log.action] || log.action}
                          </p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 font-mono">
                            {log.action}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <User className="h-3 w-3" />
                          <span>{userName}</span>
                          <span>·</span>
                          <Clock className="h-3 w-3" />
                          <span>{day} à {time}</span>
                        </div>
                      </div>
                      {changes && (
                        <ChevronDown className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </button>

                  {/* Détails des changements */}
                  {isExpanded && changes && (
                    <div className="px-4 pb-3 pt-0 ml-11">
                      <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 space-y-1.5">
                        {changes.map((c, i) => (
                          <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs">
                            <span className="font-medium text-gray-600 dark:text-gray-400 capitalize sm:min-w-[80px] shrink-0">{c.label}</span>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-red-500 line-through truncate">{c.from ?? '—'}</span>
                              <ArrowRight className="h-3 w-3 text-gray-400 shrink-0" />
                              <span className="text-green-600 truncate">{c.to ?? '—'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Page {page + 1} sur {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
                >
                  Précédent
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
