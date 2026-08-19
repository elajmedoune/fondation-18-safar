import { supabase } from '../lib/supabaseClient.js';
import { auditLogsService } from './auditLogs.service.js';

export const cotisationsService = {
  async listByCampagne(campagneId, limit = 50) {
    const { data, error } = await supabase
      .from('cotisations')
      .select('*, membre:membres(nom, prenom, numero_membre)')
      .eq('campagne_id', campagneId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  async listAllByCampagne(campagneId) {
    const { data, error } = await supabase
      .from('cotisations')
      .select('*, membre:membres(nom, prenom, numero_membre)')
      .eq('campagne_id', campagneId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async totalByCampagne(campagneId) {
    const { data, error } = await supabase
      .from('cotisations')
      .select('montant')
      .eq('campagne_id', campagneId);
    if (error) throw error;
    return data.reduce((sum, row) => sum + Number(row.montant), 0);
  },

  async create({ campagneId, membreId, montant, modePaiement, note, userId, moisCotisation }) {
    const { data, error } = await supabase
      .from('cotisations')
      .insert({
        campagne_id: campagneId,
        membre_id: membreId,
        montant,
        mode_paiement: modePaiement,
        note,
        mois_cotisation: moisCotisation || null,
        enregistre_par: userId
      })
      .select('*, membre:membres(nom, prenom, numero_membre)')
      .single();
    if (error) throw error;
    await auditLogsService.log({
      userId, action: 'cotisation.create', entity: 'cotisations',
      entityId: data.id, newData: data, campagneId
    });
    return data;
  },

  async update(id, { montant, modePaiement, note, moisCotisation }, { userId, campagneId } = {}) {
    // Récupérer l'état avant modification
    let oldData = null;
    if (userId) {
      const { data: before } = await supabase.from('cotisations').select('*').eq('id', id).single();
      oldData = before;
    }
    const { data, error } = await supabase
      .from('cotisations')
      .update({
        montant,
        mode_paiement: modePaiement,
        note: note || null,
        mois_cotisation: moisCotisation || null
      })
      .eq('id', id)
      .select('*, membre:membres(nom, prenom, numero_membre)')
      .single();
    if (error) throw error;
    if (userId) {
      await auditLogsService.log({
        userId, action: 'cotisation.update', entity: 'cotisations',
        entityId: id, oldData, newData: data, campagneId
      });
    }
    return data;
  },

  async remove(id, { userId, campagneId } = {}) {
    let oldData = null;
    if (userId) {
      const { data: before } = await supabase.from('cotisations').select('*').eq('id', id).single();
      oldData = before;
    }
    const { error } = await supabase.from('cotisations').delete().eq('id', id);
    if (error) throw error;
    if (userId) {
      await auditLogsService.log({
        userId, action: 'cotisation.delete', entity: 'cotisations',
        entityId: id, oldData, campagneId
      });
    }
  },

  async listByMembre(membreId, campagneId) {
    const { data, error } = await supabase
      .from('cotisations')
      .select('*')
      .eq('membre_id', membreId)
      .eq('campagne_id', campagneId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async totalByMembre(membreId, campagneId) {
    const { data, error } = await supabase
      .from('cotisations')
      .select('montant')
      .eq('membre_id', membreId)
      .eq('campagne_id', campagneId);
    if (error) throw error;
    return data.reduce((sum, row) => sum + Number(row.montant), 0);
  }
};
