import { NavLink } from 'react-router-dom';
import { X, Landmark } from 'lucide-react';
import { useRole } from '../../hooks/useRole.js';
import { NAV_ITEMS } from '../../constants/navConfig.js';
import { ICONS } from './icons.js';

export default function MobileMenu({ open, onClose }) {
  const { rolePrincipal } = useRole();
  const items = NAV_ITEMS[rolePrincipal] || NAV_ITEMS.membre;

  return (
    <>
      <div
        onClick={onClose}
        className={`md:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      <div
        className={`md:hidden fixed inset-y-0 left-0 z-40 w-72 max-w-[80vw] bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 shadow-2xl transform transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-700 text-white">
              <Landmark size={16} />
            </div>
            <span className="font-semibold text-primary-700 dark:text-primary-400">18 Safar</span>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        <nav className="p-2 space-y-0.5">
          {items.map(({ label, to, icon }) => {
            const Icon = ICONS[icon];
            return (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`
                }
              >
                {Icon && <Icon size={18} />}
                {label}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </>
  );
}