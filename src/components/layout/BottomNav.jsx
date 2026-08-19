import { NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useRole } from '../../hooks/useRole.js';
import { PRIMARY_ACTION } from '../../constants/navConfig.js';
import { ICONS } from './icons.js';

// Nav mobile minimale : l'action principale du rôle + le menu complet.
export default function BottomNav({ onOpenMenu }) {
  const { rolePrincipal } = useRole();
  const action = PRIMARY_ACTION[rolePrincipal] || PRIMARY_ACTION.membre;
  const Icon = ICONS[action.icon];

  return (
    <nav className="print:hidden md:hidden fixed bottom-0 inset-x-0 z-10 border-t border-gray-200/70 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm flex items-center justify-center gap-3 px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
      <button
        onClick={onOpenMenu}
        className="flex flex-col items-center gap-0.5 px-4 py-1.5 text-[11px] font-medium rounded-lg text-gray-500 dark:text-gray-400"
      >
        <Menu size={20} />
        Menu
      </button>

      <NavLink
        to={action.to}
        className={({ isActive }) =>
          `flex-1 max-w-[220px] flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
            isActive
              ? 'bg-primary-700 text-white'
              : 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
          }`
        }
      >
        {Icon && <Icon size={18} />}
        {action.label}
      </NavLink>
    </nav>
  );
}