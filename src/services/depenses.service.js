import { supabase } from '../lib/supabaseClient.js';
import { auditLogsService } from './auditLogs.service.js';

export const depensesService = {
  async listByCampagne(campagneId, limit = 20) {
    const { data, error } = await supabase
      .from('depenses')
      .select('*')
      .eq('campagne_id', campagneId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  async totalByCampagne(campagneId) {
    const { data, error } = await supabase
      .from('depenses')
      .select('montant')
      .eq('campagne_id', campagneId);
    if (error) throw error;
    return data.reduce((sum, row) => sum + Number(row.montant), 0);
  },

  async create({ campagneId, categorie, montant, description, justificatifUrl, userId }) {
    const { data, error } = await supabase
      .from('depenses')
      .insert({
        campagne_id: campagneId,
        categorie,
        montant,
        description: description || null,
        justificatif_url: justificatifUrl || null,
        enregistre_par: userId
      })
      .select()
      .single();
    if (error) throw error;
    await auditLogsService.log({
      userId, action: 'depense.create', entity: 'depenses',
      entityId: data.id, newData: data, campagneId
    });
    return data;
  },

  async update(id, patch, { userId, campagneId } = {}) {
    let oldData = null;
    if (userId) {
      const { data: before } = await supabase.from('depenses').select('*').eq('id', id).eq('campagne_id', campagneId).maybeSingle();
      oldData = before;
    }
    const { data, error } = await supabase
      .from('depenses')
      .update(patch)
      .eq('id', id)
      .eq('campagne_id', campagneId)
      .select()
      .single();
    if (error) throw error;
    if (userId) {
      await auditLogsService.log({
        userId, action: 'depense.update', entity: 'depenses',
        entityId: id, oldData, newData: data, campagneId
      });
    }
    return data;
  },

  async remove(id, { userId, campagneId } = {}) {
    let oldData = null;
    if (userId) {
      const { data: before } = await supabase.from('depenses').select('*').eq('id', id).eq('campagne_id', campagneId).maybeSingle();
      oldData = before;
    }
    const { error } = await supabase.from('depenses').delete().eq('id', id).eq('campagne_id', campagneId);
    if (error) throw error;
    if (userId) {
      await auditLogsService.log({
        userId, action: 'depense.delete', entity: 'depenses',
        entityId: id, oldData, campagneId
      });
    }
  }
};