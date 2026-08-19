import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { clearScrollPositions } from '../hooks/useScrollRestoration.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [membre, setMembre] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadProfil = useCallback(async (userId) => {
    if (!userId) {
      setMembre(null);
      setRoles([]);
      return;
    }
    const [{ data: membreData }, { data: rolesData }] = await Promise.all([
      supabase.from('membres').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('user_roles').select('*').eq('user_id', userId)
    ]);
    setMembre(membreData || null);
    setRoles(rolesData || []);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      await loadProfil(session?.user?.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      await loadProfil(session?.user?.id);
    });

    return () => listener.subscription.unsubscribe();
  }, [loadProfil]);

  const signInWithPassword = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  const signOut = async () => {
    await supabase.auth.signOut();
    clearScrollPositions();
    sessionStorage.clear();
  };

  const refreshRoles = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    const { data } = await supabase.from('user_roles').select('*').eq('user_id', userId);
    setRoles(data || []);
  }, [session?.user?.id]);

  const value = {
    session,
    user: session?.user ?? null,
    membre,
    roles,
    roleNames: roles.map((r) => r.role),
    loading,
    signInWithPassword,
    signOut,
    refreshRoles
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext doit être utilisé dans AuthProvider');
  return ctx;
}