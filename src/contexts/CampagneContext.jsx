import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const CampagneContext = createContext(null);

export function CampagneProvider({ children }) {
  const [campagnes, setCampagnes] = useState([]);
  const [campagneActive, setCampagneActive] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('campagnes')
      .select('*')
      .order('annee', { ascending: false })
      .then(({ data }) => {
        setCampagnes(data || []);
        // Par défaut : la campagne au statut "active", sinon la plus récente
        const active = data?.find((c) => c.statut === 'active') || data?.[0] || null;
        setCampagneActive(active);
        setLoading(false);
      });
  }, []);

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
