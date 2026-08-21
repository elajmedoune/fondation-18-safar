import { supabase } from '../lib/supabaseClient.js';

export const objectifsService = {
  async listByCampagne(campagneId) {
    const { data, error } = await supabase
      .from('objectifs')
      .select('*')
      .eq('campagne_id', campagneId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  // Total recettes (cotisations + dons + quêtes) pour l'objectif global
  async totalRecettesCampagne(campagneId) {
    const { data, error } = await supabase
      .from('v_recettes')
      .select('montant')
      .eq('campagne_id', campagneId);
    if (error) throw error;
    return data.reduce((sum, row) => sum + Number(row.montant), 0);
  },

  // Total dons rattachés à une activité précise, pour un objectif par activité
  async donsParActivite(campagneId) {
    const { data, error } = await supabase
      .from('dons')
      .select('montant, campagne_activite')
      .eq('campagne_id', campagneId)
      .not('campagne_activite', 'is', null);
    if (error) throw error;
    return data.reduce((acc, row) => {
      const key = row.campagne_activite;
      acc[key] = (acc[key] || 0) + Number(row.montant);
      return acc;
    }, {});
  },

  async create({ campagneId, type, activiteNom, montantCible }) {
    const { data, error } = await supabase
      .from('objectifs')
      .insert({
        campagne_id: campagneId,
        type,
        activite_nom: type === 'activite' ? activiteNom : null,
        montant_cible: montantCible
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, campagneId, { montantCible }) {
    const { data, error } = await supabase
      .from('objectifs')
      .update({ montant_cible: montantCible })
      .eq('id', id)
      .eq('campagne_id', campagneId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id, campagneId) {
    const { error } = await supabase
      .from('objectifs')
      .delete()
      .eq('id', id)
      .eq('campagne_id', campagneId);
    if (error) throw error;
  }
};