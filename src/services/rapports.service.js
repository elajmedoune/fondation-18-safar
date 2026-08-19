import { supabase } from '../lib/supabaseClient.js';

export const rapportsService = {
  async listByCampagne(campagneId) {
    const { data, error } = await supabase
      .from('rapports')
      .select('*')
      .eq('campagne_id', campagneId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async get(id) {
    const { data, error } = await supabase
      .from('rapports')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create({ campagneId, type, titre, contenu, fichierUrl, userId }) {
    const { data, error } = await supabase
      .from('rapports')
      .insert({
        campagne_id: campagneId,
        type,
        titre,
        contenu: contenu || null,
        fichier_url: fichierUrl || null,
        created_by: userId
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, { type, titre, contenu, fichierUrl }) {
    const fields = {};
    if (type !== undefined) fields.type = type;
    if (titre !== undefined) fields.titre = titre;
    if (contenu !== undefined) fields.contenu = contenu;
    if (fichierUrl !== undefined) fields.fichier_url = fichierUrl;
    const { data, error } = await supabase
      .from('rapports')
      .update(fields)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    const { error } = await supabase.from('rapports').delete().eq('id', id);
    if (error) throw error;
  }
};
