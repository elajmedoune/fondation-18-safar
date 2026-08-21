import { supabase } from '../lib/supabaseClient.js';
import { fetchAllPages } from '../lib/supabaseFetch.js';
import { auditLogsService } from './auditLogs.service.js';

export const membresService = {
  // IDs des comptes liés à un administrateur GLOBAL (campagne_id = null).
  // Ces comptes techniques ne sont PAS des membres de la fondation.
  async getGlobalAdminUserIds() {
    const { data, error } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'administrateur')
      .is('campagne_id', null);
    if (error) throw error;
    return new Set((data || []).map((r) => r.user_id));
  },

  // Nombre EXACT de membres de la CAMPAGNE : lignes campagne_membres de
  // cette campagne, hors comptes liés à un admin global (indépendant des
  // campagnes, il n'est pas un membre).
  async countMembres(campagneId) {
    const [rows, adminIds] = await Promise.all([
      fetchAllPages(() =>
        supabase
          .from('campagne_membres')
          .select('membre_id, membre:membres!inner(user_id)')
          .eq('campagne_id', campagneId)
      ),
      this.getGlobalAdminUserIds(),
    ]);
    return rows.filter((r) => !adminIds.has(r.membre?.user_id)).length;
  },

  // Liste complète et officielle des membres de la CAMPAGNE active :
  // - UNIQUEMENT les membres rattachés à cette campagne (campagne_membres),
  //   hors comptes liés à un admin global (indépendant des campagnes).
  // - Chaque fiche est enrichie du rôle bureau (porté par la campagne) et du
  //   statut de responsable de groupe éventuel.
  // - Paginé : aucune limite sur le nombre de membres.
  async getByCampagneAvecRoles(campagneId) {
    // 1) Rôles bureau pour cette campagne UNIQUEMENT (filtre serveur) +
    //    admins globaux (campagne_id = null). Seul l'admin est global.
    const [{ data: bureauRoles, error: rolesErr }, adminIds] = await Promise.all([
      supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['president', 'tresorier', 'secretaire'])
        .eq('campagne_id', campagneId),
      this.getGlobalAdminUserIds(),
    ]);
    if (rolesErr) throw rolesErr;

    const ROLE_LABELS = { president: 'Président', tresorier: 'Trésorier', secretaire: 'Secrétaire' };
    const ROLE_PRIORITY = ['president', 'tresorier', 'secretaire'];

    // Rôle bureau le plus prioritaire par user_id (campagne active uniquement)
    const roleByUserId = new Map();
    (bureauRoles || []).forEach((r) => {
      const current = roleByUserId.get(r.user_id);
      if (!current || ROLE_PRIORITY.indexOf(r.role) < ROLE_PRIORITY.indexOf(current)) {
        roleByUserId.set(r.user_id, r.role);
      }
    });

    // 2) Fiches campagne (avec membre + groupe) + responsables de groupe
    const [fiches, responsablesRes] = await Promise.all([
      fetchAllPages(() =>
        supabase
          .from('campagne_membres')
          .select('id, campagne_id, membre_id, fonction, statut, membre:membres(*), groupe:groupes(*)')
          .eq('campagne_id', campagneId)
      ),
      supabase
        .from('campagne_groupe_responsables')
        .select('membre_id')
        .eq('campagne_id', campagneId),
    ]);
    if (responsablesRes.error) throw responsablesRes.error;
    const responsableIds = new Set((responsablesRes.data || []).map((r) => r.membre_id));

    // 3) Construire une fiche par membre de la campagne (hors admins globaux)
    return fiches
      .filter((f) => !adminIds.has(f.membre?.user_id))
      .sort((a, b) =>
        `${a.membre?.nom || ''}${a.membre?.prenom || ''}`.localeCompare(`${b.membre?.nom || ''}${b.membre?.prenom || ''}`)
      )
      .map((f) => {
        const m = f.membre || {};
        const roleBureau = m.user_id ? roleByUserId.get(m.user_id) : null;
        const fonctionAffichee =
          (roleBureau && ROLE_LABELS[roleBureau]) ||
          (responsableIds.has(m.id) ? `Responsable (${f.groupe?.nom || 'groupe'})` : null) ||
          f.fonction ||
          null;
        return { ...f, fonctionAffichee, _roleBureau: roleBureau || null };
      });
  },

  // Utilisé par le scanner : reconnaît TOUS les membres (même définition que la
  // page Membres), avec ou sans rattachement à la campagne active. La fiche
  // campagne (groupe/fonction) est optionnelle. Les comptes liés à un admin
  // global ne sont pas reconnus.
  async getFicheByQrCode(qrValue, campagneId) {
    const { data: membre, error } = await supabase
      .from('membres')
      .select('*')
      .eq('qr_code_value', qrValue)
      .maybeSingle();
    if (error) throw error;
    if (!membre) return null;

    const adminIds = await this.getGlobalAdminUserIds();
    if (membre.user_id && adminIds.has(membre.user_id)) return null;

    let fiche = null;
    if (campagneId) {
      const { data } = await supabase
        .from('campagne_membres')
        .select('id, fonction, statut, groupe:groupes(*)')
        .eq('membre_id', membre.id)
        .eq('campagne_id', campagneId)
        .maybeSingle();
      fiche = data || null;
    }

    return { ...membre, campagne_membres: fiche ? [fiche] : [] };
  },

  async getFicheMembre(membreId, campagneId) {
    // "!inner" : un membre sans fiche dans cette campagne est considéré introuvable
    const { data, error } = await supabase
      .from('membres')
      .select('*, campagne_membres!inner(id, campagne_id, fonction, statut, groupe:groupes(*))')
      .eq('id', membreId)
      .eq('campagne_membres.campagne_id', campagneId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async search(query, limit = 8) {
    if (!query || query.trim().length < 2) return [];
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'administrateur')
      .is('campagne_id', null);
    const excludeIds = (adminRoles || []).map((r) => r.user_id);
    let q = supabase
      .from('membres')
      .select('*')
      .or(`numero_membre.ilike.%${query}%,nom.ilike.%${query}%,prenom.ilike.%${query}%,telephone.ilike.%${query}%`)
      .limit(limit);
    if (excludeIds.length > 0) q = q.or(`user_id.is.null,user_id.not.in.(${excludeIds.join(',')})`);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },

  // Recherche limitée aux membres rattachés à la campagne active
  // (utilisée par les collecteurs cotisations / quêtes).
  // NB : "!inner" est indispensable pour que le filtre sur campagne_membres
  // exclue réellement les membres sans fiche dans cette campagne.
  async searchInCampagne(campagneId, query, limit = 8) {
    if (!campagneId || !query || query.trim().length < 2) return [];
    const q = query.trim();
    const { data, error } = await supabase
      .from('membres')
      .select('id, nom, prenom, numero_membre, telephone, photo_url, campagne_membres!inner(fonction, statut)')
      .eq('campagne_membres.campagne_id', campagneId)
      .or(`numero_membre.ilike.%${q}%,nom.ilike.%${q}%,prenom.ilike.%${q}%,telephone.ilike.%${q}%`)
      .order('nom')
      .limit(limit);
    if (error) throw error;
    return data;
  },

  // Recherche pour ajouter un membre à un groupe : UNIQUEMENT les membres
  // rattachés à la campagne active.
  async searchForGroupe(campagneId, query, limit = 10) {
    if (!campagneId || !query || query.trim().length < 2) return [];
    const q = query.trim();
    const { data, error } = await supabase
      .from('membres')
      .select('id, nom, prenom, numero_membre, telephone, campagne_membres!inner(fonction)')
      .eq('campagne_membres.campagne_id', campagneId)
      .or(`nom.ilike.%${q}%,prenom.ilike.%${q}%,numero_membre.ilike.%${q}%,telephone.ilike.%${q}%`)
      .order('nom')
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async createWithGroupe({ nom, prenom, telephone, sexe, photo_url, fonction }, campagneId, groupeId, userId) {
    // Un membre est TOUJOURS créé DANS une campagne : pas de campagne = refus.
    if (!campagneId) throw new Error("Impossible de créer un membre hors campagne. Sélectionnez d'abord une campagne active.");
    // NB : "fonction" est portée par campagne_membres (par campagne), pas par membres.
    const { data: membre, error } = await supabase
      .from('membres')
      .insert({ nom, prenom, telephone: telephone || null, sexe: sexe || null, photo_url: photo_url || null })
      .select()
      .single();
    if (error) throw error;

    const { error: cmErr } = await supabase.from('campagne_membres').insert({
      campagne_id: campagneId,
      membre_id: membre.id,
      groupe_id: groupeId,
      fonction: fonction || null
    });
    if (cmErr) {
      // Ne jamais laisser un membre orphelin sans fiche campagne
      await supabase.from('membres').delete().eq('id', membre.id);
      throw cmErr;
    }

    if (userId) {
      await auditLogsService.log({
        userId, action: 'membre.create', entity: 'membres',
        entityId: membre.id, newData: membre, campagneId
      });
    }
    return membre;
  },

  async uploadPhoto(file, membreId) {
    const ext = file.name.split('.').pop();
    const path = `${membreId || 'temp-' + Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('membres-photos').upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('membres-photos').getPublicUrl(path);
    return data.publicUrl;
  },

  async update(id, patch, { userId, campagneId } = {}) {
    let oldData = null;
    if (userId) {
      const { data: before } = await supabase.from('membres').select('*').eq('id', id).single();
      oldData = before;
    }
    const { data, error } = await supabase.from('membres').update(patch).eq('id', id).select().single();
    if (error) throw error;
    if (userId) {
      await auditLogsService.log({
        userId, action: 'membre.update', entity: 'membres',
        entityId: id, oldData, newData: data, campagneId
      });
    }
    return data;
  },

  // Met à jour le rattachement campagne (groupe, fonction) d'un membre.
  // campagneMembreId = id de la ligne campagne_membres (pas l'id du membre).
  async updateFicheCampagne(campagneMembreId, { groupe_id, fonction }, { userId, campagneId } = {}) {
    let oldData = null;
    if (userId) {
      const { data: before } = await supabase.from('campagne_membres').select('*').eq('id', campagneMembreId).single();
      oldData = before;
    }
    const { data, error } = await supabase
      .from('campagne_membres')
      .update({ groupe_id: groupe_id || null, fonction: fonction || null })
      .eq('id', campagneMembreId)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new Error("Modification refusée. Vérifiez que vous avez les droits nécessaires.");
    if (userId) {
      await auditLogsService.log({
        userId, action: 'groupe.update', entity: 'campagne_membres',
        entityId: campagneMembreId, oldData, newData: data, campagneId
      });
    }
    return data;
  }
};