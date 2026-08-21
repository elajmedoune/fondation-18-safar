import { supabase } from '../lib/supabaseClient.js';

export const presencesService = {
  async listByCampagne(campagneId) {
    const { data, error } = await supabase
      .from('presences_groupe')
      .select(`
        *,
        membre:membre_id ( id, nom, prenom, numero_membre ),
        groupe:groupe_id ( id, nom )
      `)
      .eq('campagne_id', campagneId)
      .order('date_presence', { ascending: false });
    if (error) throw error;
    return data;
  },

  async listByGroupeAndDate(campagneId, groupeId, datePresence) {
    const { data, error } = await supabase
      .from('presences_groupe')
      .select(`
        *,
        membre:membre_id ( id, nom, prenom, numero_membre )
      `)
      .eq('campagne_id', campagneId)
      .eq('groupe_id', groupeId)
      .eq('date_presence', datePresence);
    if (error) throw error;
    return data;
  },

  async upsert({ campagneId, groupeId, membreId, datePresence, statut, userId }) {
    const { data, error } = await supabase
      .from('presences_groupe')
      .upsert({
        campagne_id: campagneId,
        groupe_id: groupeId,
        membre_id: membreId,
        date_presence: datePresence,
        statut,
        enregistre_par: userId
      }, { onConflict: 'campagne_id,groupe_id,membre_id,date_presence' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id, campagneId) {
    const { error } = await supabase
      .from('presences_groupe')
      .delete()
      .eq('id', id)
      .eq('campagne_id', campagneId);
    if (error) throw error;
  }
};
