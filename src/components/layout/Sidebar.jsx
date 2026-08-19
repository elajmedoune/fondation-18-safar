import { NavLink, Link } from 'react-router-dom';
import { Landmark } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { getSidebarItems } from '../../constants/navConfig.js';
import { ICONS } from './icons.js';

export default function Sidebar() {
  const { roleNames } = useAuth();
  const items = getSidebarItems(roleNames.length ? roleNames : ['membre']);

  return (
    <aside className="hidden md:flex md:flex-col md:w-48 shrink-0 h-full border-r border-gray-200/70 dark:border-gray-800 bg-white/50 dark:bg-gray-950/50">
      <Link to="/tableau-de-bord" className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-700 text-white shadow-sm shadow-primary-700/30 shrink-0">
          <Landmark size={16} />
        </div>
        <span className="font-extrabold text-primary-800 dark:text-primary-300 text-lg tracking-tight">18 Safar</span>
      </Link>

      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {items.map(({ label, to, icon }) => {
          const Icon = ICONS[icon];
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/tableau-de-bord'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 shadow-sm shadow-primary-500/10'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/80 hover:text-gray-900 dark:hover:text-gray-200'
                }`
              }
            >
              {Icon && <Icon size={16} />}
              {label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
