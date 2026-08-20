import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes (voir .env.example)');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Correctif recommandé par Supabase pour les PWA / apps mobiles :
// le rafraîchissement automatique du token repose sur un timer JS, que les
// navigateurs mettent en pause quand l'app est en arrière-plan (app changée,
// écran verrouillé...). Résultat : au retour au premier plan, le token peut
// être expiré et les premiers appels échouent (400 "Session invalide") le
// temps qu'un rafraîchissement se déclenche. On force explicitement l'arrêt/
// la reprise du rafraîchissement selon la visibilité de la page.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}