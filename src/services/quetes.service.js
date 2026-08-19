import { supabase } from '../lib/supabaseClient.js';
import { auditLogsService } from './auditLogs.service.js';

export const quetesService = {
  async listByCampagne(campagneId, limit = 20) {
    const { data, error } = await supabase
      .from('quetes')
      .select('*, collecteur:collecteurs(zone, membre:membres(nom, prenom))')
      .eq('campagne_id', campagneId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  async totalByCampagne(campagneId) {
    const { data, error } = await supabase
      .from('quetes')
      .select('montant')
      .eq('campagne_id', campagneId);
    if (error) throw error;
    return data.reduce((sum, row) => sum + Number(row.montant), 0);
  },

  async create({ campagneId, collecteurId, lieu, montant, note, userId }) {
    const { data, error } = await supabase
      .from('quetes')
      .insert({
        campagne_id: campagneId,
        collecteur_id: collecteurId,
        lieu,
        montant,
        note: note || null,
        enregistre_par: userId
      })
      .select('*, collecteur:collecteurs(zone, membre:membres(nom, prenom))')
      .single();
    if (error) throw error;
    await auditLogsService.log({
      userId, action: 'quete.create', entity: 'quetes',
      entityId: data.id, newData: data, campagneId
    });
    return data;
  }
};