import { supabase } from '../lib/supabaseClient.js';
import { auditLogsService } from './auditLogs.service.js';

export const donsService = {
  async listByCampagne(campagneId, limit = 20) {
    const { data, error } = await supabase
      .from('dons')
      .select('*')
      .eq('campagne_id', campagneId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  async totalByCampagne(campagneId) {
    const { data, error } = await supabase
      .from('dons')
      .select('montant')
      .eq('campagne_id', campagneId);
    if (error) throw error;
    return data.reduce((sum, row) => sum + Number(row.montant), 0);
  },

  async create({ campagneId, type, donateurNom, donateurTelephone, montant, campagneActivite, note, userId }) {
    const { data, error } = await supabase
      .from('dons')
      .insert({
        campagne_id: campagneId,
        type,
        donateur_nom: type === 'anonyme' ? null : donateurNom,
        donateur_telephone: type === 'anonyme' ? null : donateurTelephone,
        montant,
        campagne_activite: campagneActivite || null,
        note,
        enregistre_par: userId
      })
      .select()
      .single();
    if (error) throw error;
    await auditLogsService.log({
      userId, action: 'don.create', entity: 'dons',
      entityId: data.id, newData: data, campagneId
    });
    return data;
  }
};