import { supabase } from './supabaseClient.js';

// Appelle une Edge Function Supabase. Si l'appel échoue avec un statut lié à
// l'authentification (token expiré/invalide), on tente un rafraîchissement
// manuel de la session puis on rejoue l'appel une seule fois avant d'abandonner.
// Ça évite qu'un token expiré au réveil de l'app (PWA en arrière-plan) fasse
// échouer silencieusement l'appel sans seconde chance.
export async function invokeSafe(name, options = {}) {
  let { data, error } = await supabase.functions.invoke(name, options);

  if (error) {
    const status = error?.context?.status;
    if (status === 401 || status === 400) {
      const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr && refreshData?.session) {
        ({ data, error } = await supabase.functions.invoke(name, options));
      }
    }
  }

  return { data, error };
}