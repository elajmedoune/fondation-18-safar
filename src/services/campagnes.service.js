import { supabase } from '../lib/supabaseClient.js';
import { auditLogsService } from './auditLogs.service.js';

export const campagnesService = {
  async list() {
    const { data, error } = await supabase
      .from('campagnes')
      .select('*')
      .order('annee', { ascending: false });
    if (error) throw error;
    return data;
  },

  async create({ annee, nom, dateEvenement, dateDebutPreparation, objectifGlobal, cotisationHomme, cotisationFemme }, userId) {
    const { data, error } = await supabase
      .from('campagnes')
      .insert({
        annee,
        nom,
        date_evenement: dateEvenement,
        date_debut_preparation: dateDebutPreparation || null,
        objectif_global: objectifGlobal || 0,
        cotisation_homme: cotisationHomme || 0,
        cotisation_femme: cotisationFemme || 0,
        created_by: userId || null
      })
      .select()
      .single();
    if (error) throw error;
    if (userId) {
      await auditLogsService.log({
        userId, action: 'campagne.create', entity: 'campagnes',
        entityId: data.id, newData: data, campagneId: data.id
      });
    }
    return data;
  },

  async update(id, { nom, dateEvenement, dateDebutPreparation, objectifGlobal, cotisationHomme, cotisationFemme }, { userId } = {}) {
    let oldData = null;
    if (userId) {
      const { data: before } = await supabase.from('campagnes').select('*').eq('id', id).single();
      oldData = before;
    }
    const { data, error } = await supabase
      .from('campagnes')
      .update({
        nom,
        date_evenement: dateEvenement,
        date_debut_preparation: dateDebutPreparation || null,
        objectif_global: objectifGlobal || 0,
        cotisation_homme: cotisationHomme || 0,
        cotisation_femme: cotisationFemme || 0
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (userId) {
      await auditLogsService.log({
        userId, action: 'campagne.update', entity: 'campagnes',
        entityId: id, oldData, newData: data, campagneId: id
      });
    }
    return data;
  },

  // Modifier uniquement la date de l'événement d'une campagne
  // (sans toucher aux autres champs).
  async updateDate(id, dateEvenement, { userId } = {}) {
    let oldData = null;
    if (userId) {
      const { data: before } = await supabase.from('campagnes').select('*').eq('id', id).single();
      oldData = before;
    }
    const { data, error } = await supabase
      .from('campagnes')
      .update({ date_evenement: dateEvenement })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (userId) {
      await auditLogsService.log({
        userId, action: 'campagne.update_date', entity: 'campagnes',
        entityId: id, oldData, newData: data, campagneId: id
      });
    }
    return data;
  },

  async activer(id, userId) {
    // Récupérer l'ancien statut
    let oldData = null;
    if (userId) {
      const { data: before } = await supabase.from('campagnes').select('*').eq('id', id).single();
      oldData = before;
    }
    const { error: resetErr } = await supabase
      .from('campagnes')
      .update({ statut: 'preparation' })
      .eq('statut', 'active')
      .neq('id', id);
    if (resetErr) throw resetErr;

    const { data, error } = await supabase
      .from('campagnes')
      .update({ statut: 'active' })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (userId) {
      await auditLogsService.log({
        userId, action: 'campagne.activate', entity: 'campagnes',
        entityId: id, oldData, newData: data, campagneId: id
      });
    }
    return data;
  },

  async cloturer(id, userId) {
    let oldData = null;
    if (userId) {
      const { data: before } = await supabase.from('campagnes').select('*').eq('id', id).single();
      oldData = before;
    }
    const { data, error } = await supabase
      .from('campagnes')
      .update({ statut: 'cloturee' })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (userId) {
      await auditLogsService.log({
        userId, action: 'campagne.close', entity: 'campagnes',
        entityId: id, oldData, newData: data, campagneId: id
      });
    }
    return data;
  }
};