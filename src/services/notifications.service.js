import { supabase } from '../lib/supabaseClient.js';

export const notificationsService = {
  // Créer une notification
  async create({ userId, titre, message, type = 'info', entity = null, entityId = null, campagneId = null }) {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      titre,
      message,
      type,
      entity,
      entity_id: entityId,
      campagne_id: campagneId,
    });
    if (error) console.error('[notif] create error:', error);
  },

  // Lister les notifs d'un utilisateur
  async listByUser(userId, { unreadOnly = false, limit = 50, campagneId = null } = {}) {
    let q = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (unreadOnly) q = q.eq('lu', false);
    if (campagneId) q = q.eq('campagne_id', campagneId);
    const { data, error } = await q;
    if (error) return [];
    return data || [];
  },

  // Compter les notifs non lues
  async countUnread(userId, campagneId = null) {
    let q = supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('lu', false);
    if (campagneId) q = q.eq('campagne_id', campagneId);
    const { count, error } = await q;
    if (error) return 0;
    return count || 0;
  },

  // Marquer comme lu
  async markRead(id) {
    const { error } = await supabase
      .from('notifications')
      .update({ lu: true })
      .eq('id', id);
    if (error) console.error('[notif] markRead error:', error);
  },

  // Marquer toutes comme lues
  async markAllRead(userId) {
    const { error } = await supabase
      .from('notifications')
      .update({ lu: true })
      .eq('user_id', userId)
      .eq('lu', false);
    if (error) console.error('[notif] markAllRead error:', error);
  },

  // Supprimer une notif
  async remove(id) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);
    if (error) console.error('[notif] remove error:', error);
  },

  // Supprimer toutes les notifs d'un user
  async removeAll(userId) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId);
    if (error) console.error('[notif] removeAll error:', error);
  },

  // Helper : notifier le bureau de la campagne active (+ admins globaux).
  // Règle : seul "administrateur" est global ; les autres rôles du bureau
  // ne valent que pour leur campagne.
  async notifyBureau(campagneId, { titre, message, type = 'info', entity = null, entityId = null }) {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id')
      .or(`and(role.in.(president,tresorier,secretaire),campagne_id.eq.${campagneId}),and(role.eq.administrateur,campagne_id.is.null)`);

    if (!roles || roles.length === 0) return;
    const uniqueUserIds = [...new Set(roles.map((r) => r.user_id))];

    const inserts = uniqueUserIds.map((uid) => ({
      user_id: uid,
      titre,
      message,
      type,
      entity,
      entity_id: entityId,
      campagne_id: campagneId,
    }));

    const { error } = await supabase.from('notifications').insert(inserts);
    if (error) console.error('[notif] notifyBureau error:', error);
  },
};
