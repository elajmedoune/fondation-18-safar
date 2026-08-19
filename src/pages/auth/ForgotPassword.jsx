import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Landmark, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';

export default function ForgotPassword() {
  const { resetPasswordForEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await resetPasswordForEmail(email);
    if (error) {
      setError("Impossible d'envoyer l'email. Vérifiez l'adresse saisie.");
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-br from-primary-50 via-gray-50 to-primary-100 dark:from-gray-950 dark:via-gray-950 dark:to-primary-950/40">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-700 text-white shadow-lg shadow-primary-700/30">
            <Landmark className="h-8 w-8" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Mot de passe oublié
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {sent
              ? "Vérifiez votre boîte mail pour continuer"
              : 'Recevez un lien pour réinitialiser votre mot de passe'}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200/70 bg-white/90 p-6 shadow-xl shadow-gray-200/50 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/90 dark:shadow-black/20">
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Un email a été envoyé à <span className="font-medium text-gray-900 dark:text-white">{email}</span> avec
                un lien pour réinitialiser votre mot de passe.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="text-sm font-medium text-primary-700 hover:underline dark:text-primary-400"
              >
                Renvoyer l'email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Adresse email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="vous@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition-colors focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-100 dark:focus:border-primary-500"
                  />
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-primary-700 py-2.5 font-medium text-white shadow-md shadow-primary-700/20 transition-colors hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Envoi...' : 'Envoyer le lien'}
              </button>
            </form>
          )}
        </div>

        <Link
          to="/login"
          className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-gray-500 hover:text-primary-700 dark:text-gray-400 dark:hover:text-primary-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la connexion
        </Link>
      </div>
    </div>
  );
}