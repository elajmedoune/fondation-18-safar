import { supabase } from '../lib/supabaseClient.js';
import { auditLogsService } from './auditLogs.service.js';

export const reunionsService = {
  async listByCampagne(campagneId) {
    const { data, error } = await supabase
      .from('reunions')
      .select('*')
      .eq('campagne_id', campagneId)
      .order('date_reunion', { ascending: false });
    if (error) throw error;
    return data;
  },

  async get(id) {
    const { data, error } = await supabase
      .from('reunions')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getDetail(id) {
    const { data, error } = await supabase
      .from('reunions')
      .select(`
        *,
        reunion_participants (
          id,
          statut_presence,
          membre:membre_id (
            id, nom, prenom, numero_membre, photo_url
          ),
          enregistre_par
        )
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create({ campagneId, dateReunion, heure, lieu, ordreDuJour, userId }) {
    const { data, error } = await supabase
      .from('reunions')
      .insert({
        campagne_id: campagneId,
        date_reunion: dateReunion,
        heure: heure || null,
        lieu: lieu || null,
        ordre_du_jour: ordreDuJour || null,
        created_by: userId
      })
      .select()
      .single();
    if (error) throw error;
    await auditLogsService.log({
      userId, action: 'reunion.create', entity: 'reunions',
      entityId: data.id, newData: data, campagneId
    });
    return data;
  },

  async update(id, { dateReunion, heure, lieu, ordreDuJour, compteRendu }, { userId, campagneId } = {}) {
    let oldData = null;
    if (userId) {
      const { data: before } = await supabase.from('reunions').select('*').eq('id', id).single();
      oldData = before;
    }
    const fields = {};
    if (dateReunion !== undefined) fields.date_reunion = dateReunion;
    if (heure !== undefined) fields.heure = heure;
    if (lieu !== undefined) fields.lieu = lieu;
    if (ordreDuJour !== undefined) fields.ordre_du_jour = ordreDuJour;
    if (compteRendu !== undefined) fields.compte_rendu = compteRendu;
    const { data, error } = await supabase
      .from('reunions')
      .update(fields)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (userId) {
      await auditLogsService.log({
        userId, action: 'reunion.update', entity: 'reunions',
        entityId: id, oldData, newData: data, campagneId
      });
    }
    return data;
  },

  async remove(id, { userId, campagneId } = {}) {
    let oldData = null;
    if (userId) {
      const { data: before } = await supabase.from('reunions').select('*').eq('id', id).single();
      oldData = before;
    }
    const { error } = await supabase.from('reunions').delete().eq('id', id);
    if (error) throw error;
    if (userId) {
      await auditLogsService.log({
        userId, action: 'reunion.delete', entity: 'reunions',
        entityId: id, oldData, campagneId
      });
    }
  },

  async addParticipant(reunionId, membreId, statutPresence, userId, campagneId) {
    const { data, error } = await supabase
      .from('reunion_participants')
      .upsert({
        reunion_id: reunionId,
        membre_id: membreId,
        statut_presence: statutPresence || 'present',
        enregistre_par: userId
      }, { onConflict: 'reunion_id,membre_id' })
      .select()
      .single();
    if (error) throw error;
    await auditLogsService.log({
      userId, action: 'reunion_participant.add', entity: 'reunion_participants',
      entityId: data.id, newData: data, campagneId
    });
    return data;
  },

  // Ajout en masse : une seule requête pour N membres (appel rapide d'une réunion).
  async addParticipantsBulk(reunionId, membreIds, statutPresence, userId, campagneId) {
    const rows = membreIds.map((membreId) => ({
      reunion_id: reunionId,
      membre_id: membreId,
      statut_presence: statutPresence || 'present',
      enregistre_par: userId
    }));
    const { data, error } = await supabase
      .from('reunion_participants')
      .upsert(rows, { onConflict: 'reunion_id,membre_id' })
      .select();
    if (error) throw error;
    await auditLogsService.log({
      userId, action: 'reunion_participant.bulk_add', entity: 'reunion_participants',
      entityId: reunionId, newData: { count: data?.length || rows.length }, campagneId
    });
    return data;
  },

  // Marque tous les participants non présents comme présents (une seule requête).
  async markAllPresent(reunionId, userId, campagneId) {
    const { data, error } = await supabase
      .from('reunion_participants')
      .update({ statut_presence: 'present' })
      .eq('reunion_id', reunionId)
      .neq('statut_presence', 'present')
      .select();
    if (error) throw error;
    await auditLogsService.log({
      userId, action: 'reunion_participant.bulk_present', entity: 'reunion_participants',
      entityId: reunionId, newData: { count: data?.length || 0 }, campagneId
    });
    return data;
  },

  async updateParticipantStatut(participantId, statutPresence, { userId, campagneId } = {}) {
    let oldData = null;
    if (userId) {
      const { data: before } = await supabase.from('reunion_participants').select('*').eq('id', participantId).single();
      oldData = before;
    }
    const { data, error } = await supabase
      .from('reunion_participants')
      .update({ statut_presence: statutPresence })
      .eq('id', participantId)
      .select()
      .single();
    if (error) throw error;
    if (userId) {
      await auditLogsService.log({
        userId, action: 'reunion_participant.update', entity: 'reunion_participants',
        entityId: participantId, oldData, newData: data, campagneId
      });
    }
    return data;
  },

  async removeParticipant(participantId, { userId, campagneId } = {}) {
    let oldData = null;
    if (userId) {
      const { data: before } = await supabase.from('reunion_participants').select('*').eq('id', participantId).single();
      oldData = before;
    }
    const { error } = await supabase.from('reunion_participants').delete().eq('id', participantId);
    if (error) throw error;
    if (userId) {
      await auditLogsService.log({
        userId, action: 'reunion_participant.remove', entity: 'reunion_participants',
        entityId: participantId, oldData, campagneId
      });
    }
  }
};
