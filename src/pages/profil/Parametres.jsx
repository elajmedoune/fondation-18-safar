import { useState } from 'react';
import { Moon, Sun, Lock } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { supabase } from '../../lib/supabaseClient.js';

export default function Parametres() {
  const { theme, toggleTheme } = useTheme();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setFeedback(null);
    if (newPassword.length < 6) {
      setFeedback({ type: 'error', message: 'Le mot de passe doit contenir au moins 6 caractères.' });
      return;
    }
    if (newPassword !== confirm) {
      setFeedback({ type: 'error', message: 'Les mots de passe ne correspondent pas.' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      setFeedback({ type: 'error', message: 'Erreur lors de la mise à jour.' });
    } else {
      setFeedback({ type: 'success', message: 'Mot de passe mis à jour.' });
      setNewPassword(''); setConfirm('');
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Paramètres</h1>

      {/* ── Apparence ── */}
      <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-5 space-y-3">
        <h2 className="text-sm font-medium text-gray-500">Apparence</h2>
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300">
            {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
            Mode {theme === 'dark' ? 'sombre' : 'clair'}
          </span>
          <span className="text-xs text-primary-700 dark:text-primary-400 font-medium">Changer</span>
        </button>
      </div>

      {/* ── Mot de passe ── */}
      <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-5 space-y-3">
        <h2 className="text-sm font-medium text-gray-500 flex items-center gap-2"><Lock size={14} /> Mot de passe</h2>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <input
            type="password"
            placeholder="Nouveau mot de passe"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
          />
          <input
            type="password"
            placeholder="Confirmer le mot de passe"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
          />
          {feedback && (
            <p className={`text-sm ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{feedback.message}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary-700 text-white py-2.5 text-sm font-medium hover:bg-primary-800 transition-colors disabled:opacity-50"
          >
            {loading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  );
}
