import { supabase } from '../lib/supabaseClient.js';

export const collecteursService = {
  async getOrCreate(campagneId, membreId, zone) {
    const { data: existing, error: findErr } = await supabase
      .from('collecteurs')
      .select('*, membre:membres(nom, prenom, numero_membre)')
      .eq('campagne_id', campagneId)
      .eq('membre_id', membreId)
      .maybeSingle();
    if (findErr) throw findErr;
    if (existing) return existing;

    const { data, error } = await supabase
      .from('collecteurs')
      .insert({ campagne_id: campagneId, membre_id: membreId, zone: zone || null })
      .select('*, membre:membres(nom, prenom, numero_membre)')
      .single();
    if (error) throw error;
    return data;
  }
};