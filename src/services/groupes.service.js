import { supabase } from '../lib/supabaseClient.js';
import { fetchAllPages } from '../lib/supabaseFetch.js';
import { auditLogsService } from './auditLogs.service.js';
import { membresService } from './membres.service.js';

export const groupesService = {
  // Liste des groupes avec nombre de membres et responsables pour la campagne donnée.
  // Les comptes liés à un admin global sont exclus : ils ne font pas partie des membres.
  async getAllWithStats(campagneId) {
    const [{ data: groupes, error }, adminIds] = await Promise.all([
      supabase.from('groupes').select('*').order('nom'),
      membresService.getGlobalAdminUserIds(),
    ]);
    if (error) throw error;

    // Paginé : pas de limite sur le nombre de rattachements comptés
    const rattachements = await fetchAllPages(() =>
      supabase
        .from('campagne_membres')
        .select('groupe_id, membre:membres(user_id)')
        .eq('campagne_id', campagneId)
        .not('groupe_id', 'is', null)
    );

    const { data: responsables, error: rErr } = await supabase
      .from('campagne_groupe_responsables')
      .select('groupe_id, membre:membres(id, nom, prenom, user_id)')
      .eq('campagne_id', campagneId);
    if (rErr) throw rErr;

    const countByGroupe = {};
    for (const r of rattachements) {
      if (adminIds.has(r.membre?.user_id)) continue;
      countByGroupe[r.groupe_id] = (countByGroupe[r.groupe_id] || 0) + 1;
    }

    const responsablesByGroupe = {};
    for (const r of responsables) {
      if (adminIds.has(r.membre?.user_id)) continue;
      if (!responsablesByGroupe[r.groupe_id]) responsablesByGroupe[r.groupe_id] = [];
      responsablesByGroupe[r.groupe_id].push(r.membre);
    }

    return groupes.map((g) => ({
      ...g,
      membresCount: countByGroupe[g.id] || 0,
      responsables: responsablesByGroupe[g.id] || []
    }));
  },

  // Détail d'un groupe : infos + membres (campagne active) + responsables (campagne active).
  // Les comptes liés à un admin global sont exclus des deux listes.
  async getDetail(groupeId, campagneId) {
    const [{ data: groupe, error }, adminIds] = await Promise.all([
      supabase.from('groupes').select('*').eq('id', groupeId).single(),
      membresService.getGlobalAdminUserIds(),
    ]);
    if (error) throw error;

    const [membresRes, responsablesRes] = await Promise.all([
      supabase
        .from('campagne_membres')
        .select('id, fonction, statut, membre:membres(*)')
        .eq('campagne_id', campagneId)
        .eq('groupe_id', groupeId),
      supabase
        .from('campagne_groupe_responsables')
        .select('id, membre:membres(*)')
        .eq('campagne_id', campagneId)
        .eq('groupe_id', groupeId),
    ]);
    if (membresRes.error) throw membresRes.error;
    if (responsablesRes.error) throw responsablesRes.error;

    const membres = (membresRes.data || []).filter((cm) => !adminIds.has(cm.membre?.user_id));
    const responsables = (responsablesRes.data || []).filter((r) => !adminIds.has(r.membre?.user_id));

    return { ...groupe, membres, responsables };
  },

  async create({ nom, description }, userId, campagneId) {
    const { data, error } = await supabase
      .from('groupes')
      .insert({ nom, description: description || null })
      .select()
      .single();
    if (error) throw error;
    if (userId) {
      await auditLogsService.log({
        userId, action: 'groupe.create', entity: 'groupes',
        entityId: data.id, newData: data, campagneId
      });
    }
    return data;
  },

  async update(id, patch, { userId, campagneId } = {}) {
    let oldData = null;
    if (userId) {
      const { data: before } = await supabase.from('groupes').select('*').eq('id', id).single();
      oldData = before;
    }
    const { data, error } = await supabase.from('groupes').update(patch).eq('id', id).select().single();
    if (error) throw error;
    if (userId) {
      await auditLogsService.log({
        userId, action: 'groupe.update', entity: 'groupes',
        entityId: id, oldData, newData: data, campagneId
      });
    }
    return data;
  },

  async remove(id, { userId, campagneId } = {}) {
    let oldData = null;
    if (userId) {
      const { data: before } = await supabase.from('groupes').select('*').eq('id', id).single();
      oldData = before;
    }
    const { error: detachErr } = await supabase
      .from('campagne_membres')
      .update({ groupe_id: null })
      .eq('groupe_id', id);
    if (detachErr) throw detachErr;

    const { error } = await supabase.from('groupes').delete().eq('id', id);
    if (error) throw error;
    if (userId) {
      await auditLogsService.log({
        userId, action: 'groupe.delete', entity: 'groupes',
        entityId: id, oldData, campagneId
      });
    }
  },

  // Ajoute un membre existant à ce groupe : met à jour son rattachement à la campagne
  // s'il en a déjà un, sinon en crée un nouveau (cas d'un membre pas encore dans cette campagne).
  async assignMembre(campagneId, groupeId, membreId, userId) {
    const { data: existing, error: findErr } = await supabase
      .from('campagne_membres')
      .select('id')
      .eq('campagne_id', campagneId)
      .eq('membre_id', membreId)
      .maybeSingle();
    if (findErr) throw findErr;

    if (existing) {
      const { error } = await supabase
        .from('campagne_membres')
        .update({ groupe_id: groupeId })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('campagne_membres')
        .insert({ campagne_id: campagneId, membre_id: membreId, groupe_id: groupeId });
      if (error) throw error;
    }
    if (userId) {
      await auditLogsService.log({
        userId, action: 'groupe.assign_membre', entity: 'campagne_membres',
        entityId: membreId, newData: { campagneId, groupeId, membreId }, campagneId
      });
    }
  },

  async removeMembreFromGroupe(campagneMembreId, { userId, campagneId } = {}) {
    let oldData = null;
    if (userId) {
      const { data: before } = await supabase.from('campagne_membres').select('*').eq('id', campagneMembreId).single();
      oldData = before;
    }
    const { error } = await supabase
      .from('campagne_membres')
      .update({ groupe_id: null })
      .eq('id', campagneMembreId);
    if (error) throw error;
    if (userId) {
      await auditLogsService.log({
        userId, action: 'groupe.remove_membre', entity: 'campagne_membres',
        entityId: campagneMembreId, oldData, campagneId
      });
    }
  },

  async addResponsable(campagneId, groupeId, membreId, userId) {
    const { data, error } = await supabase
      .from('campagne_groupe_responsables')
      .insert({ campagne_id: campagneId, groupe_id: groupeId, membre_id: membreId })
      .select('id, membre:membres(*)')
      .single();
    if (error) throw error;
    if (userId) {
      await auditLogsService.log({
        userId, action: 'groupe.add_responsable', entity: 'campagne_groupe_responsables',
        entityId: data.id, newData: data, campagneId
      });
    }
    return data;
  },

  async removeResponsable(id, { userId, campagneId } = {}) {
    let oldData = null;
    if (userId) {
      const { data: before } = await supabase.from('campagne_groupe_responsables').select('*').eq('id', id).single();
      oldData = before;
    }
    const { error } = await supabase.from('campagne_groupe_responsables').delete().eq('id', id);
    if (error) throw error;
    if (userId) {
      await auditLogsService.log({
        userId, action: 'groupe.remove_responsable', entity: 'campagne_groupe_responsables',
        entityId: id, oldData, campagneId
      });
    }
  }
};