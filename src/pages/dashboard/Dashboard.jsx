import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, Wallet, Target, Calendar, ArrowRight, HandHeart, Coins, Receipt, TrendingDown, Settings, FileText, CreditCard, QrCode, UserCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from '../../hooks/useAuth.js';
import { useCampagneContext } from '../../contexts/CampagneContext.jsx';
import { useRole } from '../../hooks/useRole.js';
import { supabase } from '../../lib/supabaseClient.js';
import { fetchAllPages } from '../../lib/supabaseFetch.js';
import { membresService } from '../../services/membres.service.js';
import { cotisationsService } from '../../services/cotisations.service.js';
import { donsService } from '../../services/dons.service.js';
import { quetesService } from '../../services/quetes.service.js';
import { depensesService } from '../../services/depenses.service.js';
import { objectifsService } from '../../services/objectifs.service.js';

function formatFCFA(n) {
  return new Intl.NumberFormat('fr-FR').format(Number(n || 0)) + ' FCFA';
}

const PIE_COLORS = ['#0d9488', '#0ea5e9', '#f59e0b', '#ef4444'];

function CustomBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl px-3 py-2 text-xs">
      <p className="font-semibold text-gray-900 dark:text-white mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-medium text-gray-900 dark:text-white">{formatFCFA(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function CustomPieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.payload.fill }} />
        <span className="font-medium text-gray-900 dark:text-white">{d.name}</span>
        <span className="text-gray-500">{formatFCFA(d.value)}</span>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent = 'primary' }) {
  const accents = {
    primary: 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    sky: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-3 sm:p-4 shadow-sm">
      <div className={`inline-flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl mb-2 sm:mb-3 ${accents[accent]}`}>
        <Icon size={14} className="sm:hidden" />
        <Icon size={18} className="hidden sm:block" />
      </div>
      <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-base sm:text-xl font-semibold mt-0.5 text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label, sub, accent = 'primary' }) {
  const accents = {
    primary: 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    sky: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    purple: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-2 rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-3 sm:p-4 hover:border-primary-300 dark:hover:border-primary-800 transition-colors group min-w-0"
    >
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <div className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl ${accents[accent]}`}>
          <Icon size={16} className="sm:hidden" />
          <Icon size={18} className="hidden sm:block" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{label}</p>
          <p className="text-xs text-gray-500 truncate">{sub}</p>
        </div>
      </div>
      <ArrowRight size={18} className="text-gray-400 group-hover:text-primary-600 transition-colors shrink-0" />
    </Link>
  );
}

export default function Dashboard() {
  const { membre } = useAuth();
  const { campagneActive } = useCampagneContext();
  const { rolePrincipal } = useRole();

  const { data: nbMembres } = useQuery({
    queryKey: ['dashboard-membres', campagneActive?.id],
    queryFn: () => membresService.countMembres(campagneActive.id),
    enabled: !!campagneActive
  });

  const { data: groupesCount } = useQuery({
    queryKey: ['dashboard-groupes', campagneActive?.id],
    queryFn: async () => {
      // La table "groupes" (Hygiene, Logistique, Securite...) n'a pas de
      // campagne_id : c'est un catalogue global. Le rattachement a une
      // campagne se fait via campagne_membres (chaque membre est assigne a
      // un groupe pour une campagne donnee). Pour avoir "les groupes de
      // cette campagne", on compte les groupe_id distincts utilises dans
      // campagne_membres pour cette campagne, plutot que de filtrer
      // directement sur "groupes" (qui causait le 400 Bad Request).
      // Paginé : pas de limite sur le nombre de fiches analysées.
      const data = await fetchAllPages(() =>
        supabase
          .from('campagne_membres')
          .select('groupe_id')
          .eq('campagne_id', campagneActive.id)
          .not('groupe_id', 'is', null)
      );
      return new Set(data.map((r) => r.groupe_id)).size;
    },
    enabled: !!campagneActive
  });

  const { data: totalCotisations } = useQuery({
    queryKey: ['dashboard-cotisations', campagneActive?.id],
    queryFn: () => cotisationsService.totalByCampagne(campagneActive.id),
    enabled: !!campagneActive
  });

  const { data: totalDons } = useQuery({
    queryKey: ['dashboard-dons', campagneActive?.id],
    queryFn: () => donsService.totalByCampagne(campagneActive.id),
    enabled: !!campagneActive
  });

  const { data: totalQuetes } = useQuery({
    queryKey: ['dashboard-quetes', campagneActive?.id],
    queryFn: () => quetesService.totalByCampagne(campagneActive.id),
    enabled: !!campagneActive
  });

  const { data: totalDepenses } = useQuery({
    queryKey: ['dashboard-depenses', campagneActive?.id],
    queryFn: () => depensesService.totalByCampagne(campagneActive.id),
    enabled: !!campagneActive
  });

  const { data: objectif } = useQuery({
    queryKey: ['dashboard-objectif', campagneActive?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('objectifs')
        .select('*')
        .eq('campagne_id', campagneActive.id)
        .eq('type', 'global')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!campagneActive
  });

  const { data: prochaineReunion } = useQuery({
    queryKey: ['dashboard-reunion', campagneActive?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunions')
        .select('id, date_reunion, heure, lieu')
        .eq('campagne_id', campagneActive.id)
        .gte('date_reunion', new Date().toISOString().split('T')[0])
        .order('date_reunion', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!campagneActive
  });

  const heure = new Date().getHours();
  const salutation = heure < 12 ? 'Bonjour' : heure < 18 ? 'Bon après-midi' : 'Bonsoir';

  const totalRecettes = Number(totalCotisations || 0) + Number(totalDons || 0) + Number(totalQuetes || 0);
  const solde = totalRecettes - Number(totalDepenses || 0);
  const progression = objectif ? Math.min(100, Math.round((totalRecettes / objectif.montant_cible) * 100)) : null;

  const ROLE_BADGES = {
    administrateur: { label: 'Administrateur', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    president: { label: 'Président', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    tresorier: { label: 'Trésorier', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    secretaire: { label: 'Secrétaire', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  };

  const badge = ROLE_BADGES[rolePrincipal];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {salutation}{membre?.prenom ? `, ${membre.prenom}` : ''}
          </h1>
          {badge && (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${badge.cls}`}>
              {badge.label}
            </span>
          )}
        </div>
        {campagneActive ? (
          <p className="text-sm text-gray-500 mt-0.5 truncate">
            {campagneActive.nom} · {new Date(campagneActive.date_evenement).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        ) : (
          <p className="text-sm text-amber-600 mt-0.5">Aucune campagne active pour le moment.</p>
        )}
      </div>

      {campagneActive && (
        <>
          {/* ===== ADMIN — voit tout ===== */}
          {rolePrincipal === 'administrateur' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                <StatCard icon={Users} label="Membres" value={nbMembres ?? '—'} accent="primary" />
                <StatCard icon={Wallet} label="Cotisations" value={formatFCFA(totalCotisations)} accent="emerald" />
                <StatCard icon={HandHeart} label="Dons" value={formatFCFA(totalDons)} accent="sky" />
                <StatCard icon={Coins} label="Quêtes" value={formatFCFA(totalQuetes)} accent="amber" />
                <StatCard icon={Receipt} label="Dépenses" value={formatFCFA(totalDepenses)} accent="red" />
                <StatCard icon={Target} label="Objectif" value={progression !== null ? `${progression}%` : '—'} accent="primary" />
              </div>

              {/* Graphiques financiers */}
              <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4 sm:p-5 shadow-sm overflow-hidden">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Vue financière</p>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  {/* Bar chart — recettes vs dépenses */}
                  <div className="md:col-span-3 min-w-0">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={[
                        { name: 'Cotisations', montant: Number(totalCotisations || 0) },
                        { name: 'Dons', montant: Number(totalDons || 0) },
                        { name: 'Quêtes', montant: Number(totalQuetes || 0) },
                        { name: 'Dépenses', montant: Number(totalDepenses || 0) },
                      ]} barSize={32} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                        <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(13,148,136,0.06)' }} />
                        <Bar dataKey="montant" name="Montant" radius={[6, 6, 0, 0]}>
                          {[0, 1, 2, 3].map((i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Pie chart — répartition recettes */}
                  <div className="md:col-span-2 flex flex-col items-center min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1">Répartition recettes</p>
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Cotisations', value: Number(totalCotisations || 0) },
                            { name: 'Dons', value: Number(totalDons || 0) },
                            { name: 'Quêtes', value: Number(totalQuetes || 0) },
                          ].filter((d) => d.value > 0)}
                          cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={3} dataKey="value" stroke="none"
                        >
                          {[0, 1, 2].map((i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                        </Pie>
                        <Tooltip content={<CustomPieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
                      {[
                        { label: 'Cotisations', color: PIE_COLORS[0] },
                        { label: 'Dons', color: PIE_COLORS[1] },
                        { label: 'Quêtes', color: PIE_COLORS[2] },
                      ].map((l) => (
                        <div key={l.label} className="flex items-center gap-1.5 text-[10px] text-gray-500">
                          <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                          {l.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Solde */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <div className="col-span-2 sm:col-span-1">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Solde</p>
                    <p className={`text-lg font-bold truncate ${solde >= 0 ? 'text-primary-700 dark:text-primary-400' : 'text-red-600 dark:text-red-400'}`}>{formatFCFA(solde)}</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Recettes</p>
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 truncate">{formatFCFA(totalRecettes)}</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Dépenses</p>
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400 truncate">{formatFCFA(totalDepenses)}</p>
                  </div>
                </div>
              </div>

              {objectif && (
                <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Objectif — {campagneActive.annee}</p>
                    <span className="text-sm font-semibold text-primary-700 dark:text-primary-400">{progression}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${progression >= 100 ? 'bg-green-500' : 'bg-gradient-to-r from-primary-500 to-primary-700'}`} style={{ width: `${progression}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{formatFCFA(totalRecettes)} / {formatFCFA(objectif.montant_cible)}</p>
                </div>
              )}

              {prochaineReunion && (
                <Link
                  to={`/reunions/${prochaineReunion.id}`}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-amber-200/70 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 hover:border-amber-300 dark:hover:border-amber-700 transition-colors group min-w-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
                      <Calendar size={18} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">Prochaine réunion</p>
                      <p className="text-xs text-gray-500 truncate">
                        {new Date(prochaineReunion.date_reunion).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        {prochaineReunion.heure ? ` · ${prochaineReunion.heure}` : ''}
                        {prochaineReunion.lieu ? ` · ${prochaineReunion.lieu}` : ''}
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={18} className="text-gray-400 group-hover:text-amber-600 transition-colors shrink-0" />
                </Link>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-1">Navigation</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <QuickLink to="/admin/utilisateurs" icon={Settings} label="Admin" sub="Utilisateurs" accent="purple" />
                  <QuickLink to="/groupes" icon={Users} label="Groupes" sub={`${groupesCount ?? 0} groupes`} accent="primary" />
                  <QuickLink to="/membres" icon={UserCheck} label="Membres" sub={`${nbMembres ?? 0} inscrits`} accent="primary" />
                  <QuickLink to="/scan" icon={QrCode} label="Scan QR" sub="Scanner" accent="sky" />
                </div>
              </div>
            </>
          )}

          {/* ===== PRÉSIDENT ===== */}
          {rolePrincipal === 'president' && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <StatCard icon={Users} label="Membres" value={nbMembres ?? '—'} accent="primary" />
                <StatCard icon={Wallet} label="Recettes" value={formatFCFA(totalRecettes)} accent="emerald" />
                <StatCard icon={TrendingDown} label="Dépenses" value={formatFCFA(totalDepenses)} accent="red" />
                <StatCard icon={Target} label="Solde" value={formatFCFA(solde)} accent={solde >= 0 ? 'sky' : 'red'} />
              </div>

              {objectif && (
                <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Objectif — {campagneActive.annee}</p>
                    <span className="text-sm font-semibold text-primary-700 dark:text-primary-400">{progression}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${progression >= 100 ? 'bg-green-500' : 'bg-gradient-to-r from-primary-500 to-primary-700'}`} style={{ width: `${progression}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{formatFCFA(totalRecettes)} / {formatFCFA(objectif.montant_cible)}</p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-1">Navigation</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <QuickLink to="/reunions" icon={Calendar} label="Réunions" sub={prochaineReunion ? `${new Date(prochaineReunion.date_reunion).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : 'Aucune'} accent="amber" />
                  <QuickLink to="/rapports" icon={FileText} label="Rapports" sub="Rédiger" accent="sky" />
                  <QuickLink to="/admin/utilisateurs" icon={Settings} label="Admin" sub="Utilisateurs" accent="purple" />
                  <QuickLink to="/membres/cartes" icon={CreditCard} label="Cartes" sub="Imprimer" accent="primary" />
                </div>
              </div>
            </>
          )}

          {/* ===== TRÉSORIER ===== */}
          {rolePrincipal === 'tresorier' && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <StatCard icon={Wallet} label="Cotisations" value={formatFCFA(totalCotisations)} accent="emerald" />
                <StatCard icon={HandHeart} label="Dons" value={formatFCFA(totalDons)} accent="sky" />
                <StatCard icon={Coins} label="Quêtes" value={formatFCFA(totalQuetes)} accent="amber" />
                <StatCard icon={Receipt} label="Dépenses" value={formatFCFA(totalDepenses)} accent="red" />
              </div>

              {/* Solde */}
              <div className={`rounded-2xl border p-5 shadow-sm ${solde < 0 ? 'border-red-200 dark:border-red-800 bg-red-50/70 dark:bg-red-950/30' : 'border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">Solde disponible</p>
                    <p className={`text-2xl font-bold ${solde >= 0 ? 'text-primary-700 dark:text-primary-400' : 'text-red-600 dark:text-red-400'}`}>{formatFCFA(solde)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Recettes − Dépenses</p>
                    <p className="text-xs text-gray-400">{formatFCFA(totalRecettes)} − {formatFCFA(totalDepenses)}</p>
                  </div>
                </div>
              </div>

              {objectif && (
                <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Objectif — {campagneActive.annee}</p>
                    <span className="text-sm font-semibold text-primary-700 dark:text-primary-400">{progression}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${progression >= 100 ? 'bg-green-500' : 'bg-gradient-to-r from-primary-500 to-primary-700'}`} style={{ width: `${progression}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{formatFCFA(totalRecettes)} / {formatFCFA(objectif.montant_cible)}</p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-1">Navigation</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <QuickLink to="/finances/cotisations" icon={Wallet} label="Cotisations" sub="Enregistrer" accent="emerald" />
                  <QuickLink to="/finances/depenses" icon={Receipt} label="Dépenses" sub={formatFCFA(totalDepenses)} accent="red" />
                  <QuickLink to="/finances/dons" icon={HandHeart} label="Dons" sub="Enregistrer" accent="sky" />
                  <QuickLink to="/finances/quetes" icon={Coins} label="Quêtes" sub="Enregistrer" accent="amber" />
                  <QuickLink to="/finances/objectifs" icon={Target} label="Objectifs" sub="Suivi" accent="primary" />
                  <QuickLink to="/scan" icon={QrCode} label="Scan QR" sub="Scanner" accent="sky" />
                </div>
              </div>
            </>
          )}

          {/* ===== SECRÉTAIRE ===== */}
          {rolePrincipal === 'secretaire' && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <StatCard icon={Users} label="Membres" value={nbMembres ?? '—'} accent="primary" />
                <StatCard icon={Calendar} label="Réunions" value={prochaineReunion ? '1 à venir' : 'Aucune'} accent="amber" />
              </div>

              {prochaineReunion && (
                <Link
                  to={`/reunions/${prochaineReunion.id}`}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-amber-200/70 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 hover:border-amber-300 dark:hover:border-amber-700 transition-colors group min-w-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
                      <Calendar size={18} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">Prochaine réunion</p>
                      <p className="text-xs text-gray-500 truncate">
                        {new Date(prochaineReunion.date_reunion).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        {prochaineReunion.heure ? ` · ${prochaineReunion.heure}` : ''}
                        {prochaineReunion.lieu ? ` · ${prochaineReunion.lieu}` : ''}
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={18} className="text-gray-400 group-hover:text-amber-600 transition-colors shrink-0" />
                </Link>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-1">Navigation</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <QuickLink to="/reunions" icon={Calendar} label="Réunions" sub="Gérer" accent="amber" />
                  <QuickLink to="/membres" icon={Users} label="Membres" sub={`${nbMembres ?? 0} membres`} accent="primary" />
                  <QuickLink to="/rapports" icon={FileText} label="Rapports" sub="Rédiger" accent="sky" />
                  <QuickLink to="/membres/cartes" icon={CreditCard} label="Cartes" sub="Imprimer" accent="primary" />
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}