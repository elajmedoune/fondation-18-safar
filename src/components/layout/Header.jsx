import { Link } from 'react-router-dom';
import { Landmark } from 'lucide-react';
import ThemeToggle from './ThemeToggle.jsx';
import ProfileMenu from './ProfileMenu.jsx';
import NotificationBell from '../ui/NotificationBell.jsx';

export default function Header() {
  return (
    <header className="print:hidden shrink-0 flex items-center justify-between border-b border-gray-200/70 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md px-4 sm:px-6 py-3 relative z-40">
      <Link to="/tableau-de-bord" className="md:hidden flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-700 text-white shadow-sm shadow-primary-700/30">
          <Landmark size={16} />
        </div>
        <span className="font-bold text-primary-700 dark:text-primary-400 text-sm">
          18 Safar
        </span>
      </Link>

      <div className="hidden md:block" />

      <div className="flex items-center gap-1 sm:gap-2">
        <NotificationBell />
        <ThemeToggle />
        <ProfileMenu />
      </div>
    </header>
  );
}
