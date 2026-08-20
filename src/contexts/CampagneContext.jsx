import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { useAuthContext } from './AuthContext.jsx';

const CampagneContext = createContext(null);

export function CampagneProvider({ children }) {
  const { loading: authLoading, session } = useAuthContext();
  const [campagnes, setCampagnes] = useState([]);
  const [campagneActive, setCampagneActive] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      setCampagnes([]);
      setCampagneActive(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    supabase
      .from('campagnes')
      .select('*')
      .order('annee', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        setCampagnes(data || []);
        const active = data?.find((c) => c.statut === 'active') || data?.[0] || null;
        setCampagneActive(active);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authLoading, session]);

  return (
    <CampagneContext.Provider value={{ campagnes, campagneActive, setCampagneActive, loading }}>
      {children}
    </CampagneContext.Provider>
  );
}

export function useCampagneContext() {
  const ctx = useContext(CampagneContext);
  if (!ctx) throw new Error('useCampagneContext doit être utilisé dans CampagneProvider');
  return ctx;
}
