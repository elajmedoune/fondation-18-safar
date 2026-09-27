import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes (voir .env.example)');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Rafraîchissement "single-flight" : Supabase fait TOURNER les refresh tokens
// (chaque échange en invalide un nouveau). Deux refreshSession() simultanés
// partent donc avec le même token : le premier aboutit, le second est rejeté
// et Supabase RÉVOQUE toute la famille de tokens. La session devient alors
// définitivement inutilisable (400 sur /auth/v1/token) jusqu'à une nouvelle
// connexion.
//
// Ce vrai risque est réel en conditions normales : le timer d'auto-refresh, le
// passage en arrière-plan (visibilitychange) et les appels invokeSafe qui
// rejouent après un 401 peuvent tous déclencher un refresh au même instant.
// On sérialise donc les appels : le premier lance l'échange, les autres
// attendent le même résultat.
let refreshInFlight = null;

export function refreshSessionOnce() {
  if (!refreshInFlight) {
    refreshInFlight = supabase.auth
      .refreshSession()
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

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