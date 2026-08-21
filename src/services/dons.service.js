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
  },

  // Modification limitée à la campagne active (type / donateur / montant / note).
  async update(id, campagneId, { type, donateurNom, donateurTelephone, montant, note }, { userId } = {}) {
    let oldData = null;
    if (userId) {
      const { data: before } = await supabase.from('dons').select('*').eq('id', id).eq('campagne_id', campagneId).maybeSingle();
      oldData = before;
    }
    const { data, error } = await supabase
      .from('dons')
      .update({
        type,
        donateur_nom: type === 'anonyme' ? null : (donateurNom || null),
        donateur_telephone: type === 'anonyme' ? null : (donateurTelephone || null),
        montant,
        note: note || null
      })
      .eq('id', id)
      .eq('campagne_id', campagneId)
      .select()
      .single();
    if (error) throw error;
    if (userId) {
      await auditLogsService.log({
        userId, action: 'don.update', entity: 'dons',
        entityId: id, oldData, newData: data, campagneId
      });
    }
    return data;
  },

  async remove(id, campagneId, { userId } = {}) {
    let oldData = null;
    if (userId) {
      const { data: before } = await supabase.from('dons').select('*').eq('id', id).eq('campagne_id', campagneId).maybeSingle();
      oldData = before;
    }
    const { error } = await supabase.from('dons').delete().eq('id', id).eq('campagne_id', campagneId);
    if (error) throw error;
    if (userId) {
      await auditLogsService.log({
        userId, action: 'don.delete', entity: 'dons',
        entityId: id, oldData, campagneId
      });
    }
  }
};