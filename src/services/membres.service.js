import { supabase } from '../lib/supabaseClient.js';
import { auditLogsService } from './auditLogs.service.js';

export const membresService = {
  async getByCampagne(campagneId) {
    const { data, error } = await supabase
      .from('campagne_membres')
      .select('*, membre:membres(*), groupe:groupes(*)')
      .eq('campagne_id', campagneId);
    if (error) throw error;
    return data;
  },

  // Comme getByCampagne, mais enrichit chaque fiche avec "fonctionAffichee" :
  // rôle du bureau (Président, Trésorier, Secrétaire, Administrateur) si le membre
  // a un compte avec ce rôle, sinon "Responsable de groupe" s'il l'est pour cette
  // campagne, sinon la fonction texte saisie manuellement.
  // Ajoute aussi les membres du bureau qui n'ont PAS de ligne dans campagne_membres.
  async getByCampagneAvecRoles(campagneId) {
    const fiches = await this.getByCampagne(campagneId);
    const campagneMembreIds = new Set(fiches.map((f) => f.membre?.id).filter(Boolean));
    const userIdsFromFiches = [...new Set(fiches.map((f) => f.membre?.user_id).filter(Boolean))];

    // 1) Récupérer les rôles bureau pour cette campagne (+ globaux)
    const { data: roles, error: rolesErr } = await supabase
      .from('user_roles')
      .select('user_id, role, campagne_id')
      .in('role', ['president', 'tresorier', 'secretaire', 'administrateur']);
    if (rolesErr) throw rolesErr;

    const ROLE_LABELS = { administrateur: 'Administrateur', president: 'Président', tresorier: 'Trésorier', secretaire: 'Secrétaire' };
    const ROLE_PRIORITY = ['administrateur', 'president', 'tresorier', 'secretaire'];

    // Identifier les admins globaux (admin principal, campagne_id = null) → exclus des membres
    const globalAdminUserIds = new Set(
      (roles || [])
        .filter((r) => r.role === 'administrateur' && r.campagne_id === null)
        .map((r) => r.user_id)
    );

    // Garder le plus prioritaire par user_id
    const roleByUserId = new Map();
    (roles || [])
      .filter((r) => r.campagne_id === null || r.campagne_id === campagneId)
      .forEach((r) => {
        if (globalAdminUserIds.has(r.user_id)) return;
        const current = roleByUserId.get(r.user_id);
        if (!current || ROLE_PRIORITY.indexOf(r.role) < ROLE_PRIORITY.indexOf(current)) {
          roleByUserId.set(r.user_id, r.role);
        }
      });

    // 2) Chercher les membres du bureau qui n'ont PAS encore de fiche campagne_membres
    const bureauUserIds = [...roleByUserId.keys()];
    const missingUserIds = bureauUserIds.filter((uid) => !userIdsFromFiches.includes(uid));

    let extraFiches = [];
    if (missingUserIds.length > 0) {
      const { data: extraMembres, error: extraErr } = await supabase
        .from('membres')
        .select('*')
        .in('user_id', missingUserIds);
      if (extraErr) throw extraErr;

      extraFiches = (extraMembres || []).map((m) => ({
        id: null,
        campagne_id: campagneId,
        membre_id: m.id,
        groupe_id: null,
        fonction: null,
        statut: 'actif',
        membre: m,
        groupe: null,
      }));
    }

    const allFiches = [...fiches, ...extraFiches];

    // 3) Responsables de groupe
    const { data: responsables, error: respErr } = await supabase
      .from('campagne_groupe_responsables')
      .select('membre_id')
      .eq('campagne_id', campagneId);
    if (respErr) throw respErr;
    const responsableIds = new Set((responsables || []).map((r) => r.membre_id));

    // 4) Enrichir chaque fiche (exclure l'admin principal)
    return allFiches
      .filter((f) => !globalAdminUserIds.has(f.membre?.user_id))
      .map((f) => {
        const roleBureau = f.membre?.user_id ? roleByUserId.get(f.membre.user_id) : null;
        const fonctionAffichee =
          (roleBureau && ROLE_LABELS[roleBureau]) ||
          (responsableIds.has(f.membre?.id) ? `Responsable (${f.groupe?.nom || 'groupe'})` : null) ||
          f.fonction ||
          null;
        return { ...f, fonctionAffichee, _roleBureau: roleBureau || null };
      });
  },

  async getByQrCode(qrValue) {
    const { data, error } = await supabase
      .from('membres')
      .select('*')
      .eq('qr_code_value', qrValue)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // Utilisé par le scanner : fiche du membre + son groupe/fonction pour la campagne active.
  async getFicheByQrCode(qrValue, campagneId) {
    const { data, error } = await supabase
      .from('membres')
      .select('*, campagne_membres!inner(id, fonction, statut, groupe:groupes(*))')
      .eq('qr_code_value', qrValue)
      .eq('campagne_membres.campagne_id', campagneId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getFicheMembre(membreId, campagneId) {
    const { data, error } = await supabase
      .from('membres')
      .select('*, campagne_membres(id, fonction, statut, groupe:groupes(*))')
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

  async searchForGroupe(campagneId, query, limit = 10) {
    if (!query || query.trim().length < 2) return [];
    const q = query.trim();
    const { data: membres, error: mErr } = await supabase
      .from('membres')
      .select('id, nom, prenom, numero_membre, telephone')
      .or(`nom.ilike.%${q}%,prenom.ilike.%${q}%,numero_membre.ilike.%${q}%,telephone.ilike.%${q}%`)
      .limit(limit);
    if (mErr) throw mErr;
    return membres || [];
  },

  async createWithGroupe({ nom, prenom, telephone, sexe, photo_url, fonction }, campagneId, groupeId, userId) {
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
    if (cmErr) throw cmErr;

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

  async create(membre) {
    const { data, error } = await supabase.from('membres').insert(membre).select().single();
    if (error) throw error;
    return data;
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