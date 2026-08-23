import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { useAuthContext } from './AuthContext.jsx';

const CampagneContext = createContext(null);

export function CampagneProvider({ children }) {
  const { loading: authLoading, session, roles } = useAuthContext();
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
    // RÈGLE : le bureau n'accède qu'À SA campagne. Seul l'administrateur
    // (global) voit et peut basculer sur toutes les campagnes.
    let cancelled = false;
    supabase
      .from('campagnes')
      .select('*')
      .order('annee', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        const isAdmin = (roles || []).some((r) => r.role === 'administrateur');
        const mesCampagnes = new Set((roles || []).map((r) => r.campagne_id).filter(Boolean));
        const visibles = isAdmin ? data || [] : (data || []).filter((c) => mesCampagnes.has(c.id));
        setCampagnes(visibles);
        const active = visibles.find((c) => c.statut === 'active') || visibles[0] || null;
        setCampagneActive(active);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authLoading, session, roles]);

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
