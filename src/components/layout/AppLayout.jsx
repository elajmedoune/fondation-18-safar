import { useState, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';
import BottomNav from './BottomNav.jsx';
import MobileMenu from './MobileMenu.jsx';
import useScrollRestoration from '../../hooks/useScrollRestoration.js';

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef(null);
  const location = useLocation();

  useScrollRestoration(mainRef);

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header />
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 md:pb-6 print:p-0 print:pb-0">
          <div className="max-w-4xl mx-auto w-full page-enter" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav onOpenMenu={() => setMenuOpen(true)} />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
