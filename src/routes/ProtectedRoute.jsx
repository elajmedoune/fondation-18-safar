import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { LogOut } from 'lucide-react';

function isUserBanned(user) {
  if (!user?.banned_until) return false;
  return new Date(user.banned_until) > new Date();
}

export default function ProtectedRoute() {
  const { session, roles, loading, refreshRoles, signOut } = useAuth();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      refreshRoles().finally(() => setChecked(true));
    }
  }, [loading, session, refreshRoles]);

  if (loading || (session && !checked)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-700 border-t-transparent" />
      </div>
    );
  }

  if (!session) return <Navigate to="/" replace />;

  if (isUserBanned(session.user)) {
    return (
      <div className="flex h-screen items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Compte désactivé</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Votre compte a été désactivé par un administrateur. Vous ne pouvez plus accéder à l'application.
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Contactez l'administrateur pour réactiver votre accès.
          </p>
          <button
            onClick={signOut}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  const hasAnyRole = roles.length > 0;
  const isGlobalAdmin = roles.some((r) => r.role === 'administrateur' && r.campagne_id === null);

  if (!hasAnyRole && !isGlobalAdmin) {
    return (
      <div className="flex h-screen items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/30">
            <span className="text-2xl">🚫</span>
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Acces refuse</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Vous n'avez aucun role attribue. Contactez l'administrateur pour obtenir un acces.
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
