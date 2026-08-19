import { supabase } from '../lib/supabaseClient.js';

export const aiService = {
  async sendMessage(message, campagneId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Non authentifié');

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, campagneId }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur IA');
    return data.reply;
  },
};
