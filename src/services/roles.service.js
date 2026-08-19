import { supabase } from '../lib/supabaseClient.js';
import { auditLogsService } from './auditLogs.service.js';

export const rolesService = {
  async listWithMembre() {
    const { data: roles, error } = await supabase
      .from('user_roles')
      .select('*, groupe:groupes(nom)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const userIds = [...new Set((roles || []).map((r) => r.user_id).filter(Boolean))];
    let membresMap = {};
    if (userIds.length > 0) {
      const { data: membres } = await supabase
        .from('membres')
        .select('id, user_id, prenom, nom')
        .in('user_id', userIds);
      (membres || []).forEach((m) => { membresMap[m.user_id] = m; });
    }
    return (roles || []).map((r) => ({ ...r, membre: membresMap[r.user_id] || null }));
  },

  async assign({ userId, role, campagneId = null, groupeId = null }, callerUserId) {
    const { data, error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role, campagne_id: campagneId, groupe_id: groupeId })
      .select()
      .single();
    if (error) throw error;
    if (callerUserId) {
      await auditLogsService.log({
        userId: callerUserId, action: 'role.assign', entity: 'user_roles',
        entityId: data.id, newData: data, campagneId
      });
    }
    return data;
  },

  async remove(id, { userId, campagneId } = {}) {
    let oldData = null;
    if (userId) {
      const { data: before } = await supabase.from('user_roles').select('*').eq('id', id).single();
      oldData = before;
    }
    const { error } = await supabase.from('user_roles').delete().eq('id', id);
    if (error) throw error;
    if (userId) {
      await auditLogsService.log({
        userId, action: 'role.remove', entity: 'user_roles',
        entityId: id, oldData, campagneId
      });
    }
  },

  async update(id, { role, campagneId, groupeId }, callerUserId) {
    let oldData = null;
    if (callerUserId) {
      const { data: before } = await supabase.from('user_roles').select('*').eq('id', id).single();
      oldData = before;
    }
    const patch = { role };
    if (campagneId !== undefined) patch.campagne_id = campagneId;
    if (groupeId !== undefined) patch.groupe_id = groupeId || null;
    const { data, error } = await supabase
      .from('user_roles')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (callerUserId) {
      await auditLogsService.log({
        userId: callerUserId, action: 'role.update', entity: 'user_roles',
        entityId: id, oldData, newData: data, campagneId
      });
    }
    return data;
  }
};