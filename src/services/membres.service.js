import { supabase } from '../lib/supabaseClient.js';
import { fetchAllPages } from '../lib/supabaseFetch.js';
import { auditLogsService } from './auditLogs.service.js';

export const membresService = {
  async getByCampagne(campagneId) {
    // Paginé : pas de limite sur le nombre de fiches renvoyées
    return fetchAllPages(() =>
      supabase
        .from('campagne_membres')
        .select('*, membre:membres(*), groupe:groupes(*)')
        .eq('campagne_id', campagneId)
        .order('membre_id')
    );
  },

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

  // Nombre EXACT de membres : tous les membres de la table "membres"
  // (simples + bureau) sauf les admins globaux. Comptage côté SQL,
  // donc juste même au-delà de 1000 lignes.
  async countMembres() {
    const excludeIds = [...(await this.getGlobalAdminUserIds())];
    let q = supabase.from('membres').select('*', { count: 'exact', head: true });
    if (excludeIds.length > 0) q = q.or(`user_id.is.null,user_id.not.in.(${excludeIds.join(',')})`);
    const { count, error } = await q;
    if (error) throw error;
    return count;
  },

  // Liste complète et officielle des membres de la fondation :
  // - TOUS les membres de la table "membres" (simples ET bureau),
  //   SAUF les comptes liés à un admin global — même définition que le
  //   Dashboard (countMembres) et l'assistant IA.
  // - Chaque membre est enrichi de son rattachement campagne (groupe,
  //   fonction, statut) s'il existe, sinon fiche virtuelle sans groupe.
  // - Paginé : aucune limite sur le nombre de membres.
  async getByCampagneAvecRoles(campagneId) {
    // 1) Rôles bureau pour cette campagne (+ globaux)
    const { data: roles, error: rolesErr } = await supabase
      .from('user_roles')
      .select('user_id, role, campagne_id')
      .in('role', ['president', 'tresorier', 'secretaire', 'administrateur']);
    if (rolesErr) throw rolesErr;

    const ROLE_LABELS = { administrateur: 'Administrateur', president: 'Président', tresorier: 'Trésorier', secretaire: 'Secrétaire' };
    const ROLE_PRIORITY = ['administrateur', 'president', 'tresorier', 'secretaire'];

    // Admins globaux (comptes techniques) → exclus des membres
    const globalAdminUserIds = new Set(
      (roles || [])
        .filter((r) => r.role === 'administrateur' && r.campagne_id === null)
        .map((r) => r.user_id)
    );

    // Rôle bureau le plus prioritaire par user_id (hors admins globaux)
    const roleByUserId = new Map();
    (roles || [])
      .filter((r) => !globalAdminUserIds.has(r.user_id) && (r.campagne_id === null || r.campagne_id === campagneId))
      .forEach((r) => {
        const current = roleByUserId.get(r.user_id);
        if (!current || ROLE_PRIORITY.indexOf(r.role) < ROLE_PRIORITY.indexOf(current)) {
          roleByUserId.set(r.user_id, r.role);
        }
      });

    // 2) Fiches campagne + tous les membres (paginés, sans limite)
    const [fiches, allMembres] = await Promise.all([
      fetchAllPages(() =>
        supabase
          .from('campagne_membres')
          .select('id, campagne_id, membre_id, groupe_id, fonction, statut, groupe:groupes(*)')
          .eq('campagne_id', campagneId)
          .order('membre_id')
      ),
      fetchAllPages(() => supabase.from('membres').select('*').order('nom').order('prenom')),
    ]);
    const ficheByMembreId = new Map(fiches.map((f) => [f.membre_id, f]));

    // 3) Responsables de groupe
    const { data: responsables, error: respErr } = await supabase
      .from('campagne_groupe_responsables')
      .select('membre_id')
      .eq('campagne_id', campagneId);
    if (respErr) throw respErr;
    const responsableIds = new Set((responsables || []).map((r) => r.membre_id));

    // 4) Construire une fiche par membre (hors admins globaux)
    return allMembres
      .filter((m) => !globalAdminUserIds.has(m.user_id))
      .map((m) => {
        const f = ficheByMembreId.get(m.id);
        const fiche = {
          id: f?.id ?? null,
          campagne_id: campagneId,
          membre_id: m.id,
          groupe_id: f?.groupe_id ?? null,
          fonction: f?.fonction ?? null,
          statut: f?.statut ?? null,
          membre: m,
          groupe: f?.groupe ?? null,
        };
        const roleBureau = m.user_id ? roleByUserId.get(m.user_id) : null;
        const fonctionAffichee =
          (roleBureau && ROLE_LABELS[roleBureau]) ||
          (responsableIds.has(m.id) ? `Responsable (${fiche.groupe?.nom || 'groupe'})` : null) ||
          fiche.fonction ||
          null;
        return { ...fiche, fonctionAffichee, _roleBureau: roleBureau || null };
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
    // Exclure les comptes liés à un admin global : ils ne font pas partie des membres
    const excludeIds = [...(await this.getGlobalAdminUserIds())];
    let req = supabase
      .from('membres')
      .select('id, nom, prenom, numero_membre, telephone')
      .or(`nom.ilike.%${q}%,prenom.ilike.%${q}%,numero_membre.ilike.%${q}%,telephone.ilike.%${q}%`)
      .limit(limit);
    if (excludeIds.length > 0) req = req.or(`user_id.is.null,user_id.not.in.(${excludeIds.join(',')})`);
    const { data: membres, error: mErr } = await req;
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