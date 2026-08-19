import { supabase } from '../lib/supabaseClient.js';
import { notificationsService } from './notifications.service.js';

const ACTION_LABELS = {
  'cotisation.create': 'Cotisation enregistrée',
  'cotisation.update': 'Cotisation modifiée',
  'cotisation.delete': 'Cotisation supprimée',
  'depense.create': 'Dépense enregistrée',
  'depense.update': 'Dépense modifiée',
  'depense.delete': 'Dépense supprimée',
  'don.create': 'Don enregistré',
  'quete.create': 'Quête enregistrée',
  'reunion.create': 'Réunion créée',
  'reunion.update': 'Réunion modifiée',
  'reunion.delete': 'Réunion supprimée',
  'reunion_participant.add': 'Participant ajouté',
  'reunion_participant.update': 'Présence modifiée',
  'reunion_participant.remove': 'Participant retiré',
  'role.assign': 'Rôle attribué',
  'role.update': 'Rôle modifié',
  'role.remove': 'Rôle retiré',
  'campagne.create': 'Campagne créée',
  'campagne.update': 'Campagne modifiée',
  'campagne.activate': 'Campagne activée',
  'campagne.close': 'Campagne clôturée',
  'membre.create': 'Membre créé',
  'membre.update': 'Membre modifié',
  'groupe.create': 'Groupe créé',
  'groupe.update': 'Groupe modifié',
  'groupe.delete': 'Groupe supprimé',
  'groupe.assign_membre': 'Membre ajouté au groupe',
  'groupe.remove_membre': 'Membre retiré du groupe',
  'groupe.add_responsable': 'Responsable ajouté',
  'groupe.remove_responsable': 'Responsable retiré',
  'user.ban': 'Compte désactivé',
  'user.unban': 'Compte réactivé',
  'user.create': 'Compte créé',
};

const ENTITY_LABELS = {
  cotisations: 'Cotisation',
  depenses: 'Dépense',
  dons: 'Don',
  quetes: 'Quête',
  reunions: 'Réunion',
  reunion_participants: 'Participant',
  user_roles: 'Rôle',
  campagnes: 'Campagne',
  membres: 'Membre',
  groupes: 'Groupe',
  campagne_membres: 'Rattachement',
  campagne_groupe_responsables: 'Responsable',
};

// Enrichit les logs avec les infos utilisateur depuis la table membres
async function enrichLogs(logs) {
  if (!logs || logs.length === 0) return [];
  const userIds = [...new Set(logs.map((l) => l.user_id).filter(Boolean))];
  if (userIds.length === 0) return logs;

  const { data: membres } = await supabase
    .from('membres')
    .select('user_id, prenom, nom, email')
    .in('user_id', userIds);

  const membreByUserId = new Map((membres || []).map((m) => [m.user_id, m]));
  return logs.map((l) => ({
    ...l,
    user: l.user_id ? {
      id: l.user_id,
      email: membreByUserId.get(l.user_id)?.email || null,
      membre: membreByUserId.get(l.user_id)
        ? { prenom: membreByUserId.get(l.user_id).prenom, nom: membreByUserId.get(l.user_id).nom }
        : null,
    } : null,
  }));
}

export const auditLogsService = {
  ACTION_LABELS,
  ENTITY_LABELS,

  async log({ userId, action, entity, entityId = null, oldData = null, newData = null, campagneId = null }) {
    try {
      const { error } = await supabase.from('audit_logs').insert({
        user_id: userId,
        action,
        entity,
        entity_id: entityId,
        old_data: oldData,
        new_data: newData,
        campagne_id: campagneId,
      });
      if (error) console.error('[audit] insert error:', error);

      // Auto-create notifications for bureau members
      try {
        const label = ACTION_LABELS[action] || action;
        const entityLabel = ENTITY_LABELS[entity] || entity;
        const notifType = action.includes('.delete') ? 'warning' : action.includes('.create') ? 'success' : 'info';

        // Get actor name
        const { data: membre } = await supabase
          .from('membres')
          .select('prenom, nom')
          .eq('user_id', userId)
          .maybeSingle();
        const actorName = membre ? `${membre.prenom} ${membre.nom}` : 'Un utilisateur';

        // Build detail from newData
        let detail = '';
        if (newData) {
          if (entity === 'cotisations' && newData.montant) detail = ` — ${newData.montant} FCFA`;
          else if (entity === 'depenses' && newData.montant) detail = ` — ${newData.montant} FCFA`;
          else if (entity === 'dons' && newData.montant) detail = ` — ${newData.montant} FCFA`;
          else if (entity === 'quetes' && newData.montant) detail = ` — ${newData.montant} FCFA`;
          else if (entity === 'reunions' && newData.titre) detail = ` — ${newData.titre}`;
          else if (entity === 'campagnes' && newData.nom) detail = ` — ${newData.nom}`;
          else if (entity === 'membres' && newData.nom) detail = ` — ${newData.prenom} ${newData.nom}`;
          else if (entity === 'groupes' && newData.nom) detail = ` — ${newData.nom}`;
        }

        await notificationsService.notifyBureau(campagneId, {
          titre: label,
          message: `${actorName} a effectué : ${entityLabel}${detail}`,
          type: notifType,
          entity,
          entityId,
          campagneId,
        });
      } catch (notifErr) {
        console.warn('[audit] notification failed:', notifErr);
      }
    } catch (err) {
      console.error('[audit] log failed:', err);
    }
  },

  async listByCampagne(campagneId, { action, userId, limit = 50, offset = 0 } = {}) {
    try {
      let q = supabase
        .from('audit_logs')
        .select('*')
        .eq('campagne_id', campagneId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (action) q = q.eq('action', action);
      if (userId) q = q.eq('user_id', userId);

      const { data, error } = await q;
      if (error) { console.warn('[audit] listByCampagne:', error.message); return []; }
      return await enrichLogs(data);
    } catch { return []; }
  },

  async countByCampagne(campagneId, { action, userId } = {}) {
    try {
      let q = supabase
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('campagne_id', campagneId);
      if (action) q = q.eq('action', action);
      if (userId) q = q.eq('user_id', userId);
      const { count, error } = await q;
      if (error) return 0;
      return count || 0;
    } catch { return 0; }
  },

  async listByUser(userId, campagneId, limit = 20) {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('campagne_id', campagneId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) return [];
      return await enrichLogs(data);
    } catch { return []; }
  },

  async getActiveUsers(campagneId) {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('user_id')
        .eq('campagne_id', campagneId);
      if (error) return [];

      const uniqueUserIds = [...new Set((data || []).map((r) => r.user_id).filter(Boolean))];
      if (uniqueUserIds.length === 0) return [];

      const { data: membres } = await supabase
        .from('membres')
        .select('user_id, prenom, nom, email')
        .in('user_id', uniqueUserIds);

      const membreByUserId = new Map((membres || []).map((m) => [m.user_id, m]));
      return uniqueUserIds.map((id) => ({
        id,
        user: {
          id,
          email: membreByUserId.get(id)?.email || null,
          membre: membreByUserId.get(id)
            ? { prenom: membreByUserId.get(id).prenom, nom: membreByUserId.get(id).nom }
            : null,
        },
      }));
    } catch { return []; }
  },

  async getActionTypes(campagneId) {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('action')
        .eq('campagne_id', campagneId);
      if (error) return [];
      return [...new Set((data || []).map((r) => r.action))].sort();
    } catch { return []; }
  },
};
