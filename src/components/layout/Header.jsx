import { Link } from 'react-router-dom';
import { Landmark, CheckCircle, Clock, Archive } from 'lucide-react';
import ThemeToggle from './ThemeToggle.jsx';
import ProfileMenu from './ProfileMenu.jsx';
import NotificationBell from '../ui/NotificationBell.jsx';
import { useCampagneContext } from '../../contexts/CampagneContext.jsx';

const STATUT_CAMPAGNE = {
  preparation: { label: 'Préparation', icon: Clock, cls: 'text-amber-600 dark:text-amber-400' },
  active: { label: 'Active', icon: CheckCircle, cls: 'text-green-600 dark:text-green-400' },
  cloturee: { label: 'Clôturée', icon: Archive, cls: 'text-gray-500 dark:text-gray-400' }
};

export default function Header() {
  const { campagnes, campagneActive, setCampagneActive, loading } = useCampagneContext();

  return (
    <header className="print:hidden shrink-0 flex items-center justify-between border-b border-gray-200/70 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md px-4 sm:px-6 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] relative z-40">
      <Link to="/tableau-de-bord" className="md:hidden flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-700 text-white shadow-sm shadow-primary-700/30">
          <Landmark size={16} />
        </div>
        <span className="font-bold text-primary-700 dark:text-primary-400 text-sm">
          18 Safar
        </span>
      </Link>

      <div className="hidden md:block" />

      {/* Sélecteur de campagne — desktop */}
      {!loading && campagnes.length > 0 && (
        <div className="hidden md:flex items-center gap-2">
          <select
            value={campagneActive?.id || ''}
            onChange={(e) => {
              const c = campagnes.find((c) => c.id === e.target.value);
              setCampagneActive(c || null);
            }}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500/40 max-w-[200px] truncate"
          >
            {campagnes.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
          {campagneActive && (() => {
            const st = STATUT_CAMPAGNE[campagneActive.statut] || STATUT_CAMPAGNE.preparation;
            const StatusIcon = st.icon;
            return (
              <span className={`inline-flex items-center gap-1 text-[10px] ${st.cls}`}>
                <StatusIcon className="h-3 w-3" />
              </span>
            );
          })()}
        </div>
      )}

      <div className="flex items-center gap-1 sm:gap-2">
        {/* Sélecteur de campagne — mobile */}
        {!loading && campagnes.length > 0 && (
          <select
            value={campagneActive?.id || ''}
            onChange={(e) => {
              const c = campagnes.find((c) => c.id === e.target.value);
              setCampagneActive(c || null);
            }}
            className="md:hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500/40 max-w-[110px] truncate"
          >
            {campagnes.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        )}
        <NotificationBell />
        <ThemeToggle />
        <ProfileMenu />
      </div>
    </header>
  );
}