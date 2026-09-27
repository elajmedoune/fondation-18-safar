import { supabase, refreshSessionOnce } from './supabaseClient.js';

// Appelle une Edge Function Supabase. Si l'appel échoue avec un statut lié à
// l'authentification (token expiré/invalide), on tente un rafraîchissement
// manuel de la session puis on rejoue l'appel une seule fois avant d'abandonner.
// Ça évite qu'un token expiré au réveil de l'app (PWA en arrière-plan) fasse
// échouer silencieusement l'appel sans seconde chance.
//
// Le rafraîchissement passe par refreshSessionOnce() : plusieurs appels 401
// simultanés ne déclenchent qu'un seul échange de token (sinon Supabase
// révoque la session et plus aucun refresh ne fonctionne).
export async function invokeSafe(name, options = {}) {
  let { data, error } = await supabase.functions.invoke(name, options);

  if (error) {
    const status = error?.context?.status;
    if (status === 401) {
      const { data: refreshData, error: refreshErr } = await refreshSessionOnce();
      if (!refreshErr && refreshData?.session) {
        ({ data, error } = await supabase.functions.invoke(name, options));
      }
    }
  }

  return { data, error };
}