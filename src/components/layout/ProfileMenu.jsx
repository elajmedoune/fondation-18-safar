import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Settings, CalendarRange, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { useRole } from '../../hooks/useRole.js';

const ROLE_LABELS = {
  membre: 'Membre',
  tresorier: 'Trésorier',
  secretaire: 'Secrétaire',
  president: 'Président',
  administrateur: 'Administrateur'
};

function initiales(membre, email) {
  if (membre?.prenom && membre?.nom) return `${membre.prenom[0]}${membre.nom[0]}`.toUpperCase();
  return (email?.[0] || '?').toUpperCase();
}

export default function ProfileMenu() {
  const { user, membre, signOut } = useAuth();
  const { rolePrincipal } = useRole();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const nomComplet = membre ? `${membre.prenom} ${membre.nom}` : user?.email;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {membre?.photo_url ? (
          <img src={membre.photo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-primary-700 text-white flex items-center justify-center text-xs font-semibold">
            {initiales(membre, user?.email)}
          </div>
        )}
        <ChevronDown size={14} className={`hidden sm:block text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-gray-200/70 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-xl shadow-gray-200/50 dark:shadow-black/30 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{nomComplet}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            <span className="inline-block mt-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
              {ROLE_LABELS[rolePrincipal] || rolePrincipal}
            </span>
          </div>

          <div className="py-1">
            <Link
              to="/mon-profil"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <User size={16} /> Mon profil
            </Link>
            <Link
              to="/parametres"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Settings size={16} /> Paramètres
            </Link>
            {(rolePrincipal === 'administrateur' || rolePrincipal === 'president') && (
              <Link
                to="/admin/campagnes"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <CalendarRange size={16} /> Campagnes
              </Link>
            )}
          </div>

          <div className="py-1 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <LogOut size={16} /> Déconnexion
            </button>
          </div>
        </div>
      )}
    </div>
  );
}