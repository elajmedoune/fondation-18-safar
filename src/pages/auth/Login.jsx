import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, LogIn, Landmark } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';

export default function Login() {
  const { session, signInWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (session) return <Navigate to="/tableau-de-bord" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await signInWithPassword(email, password);
    if (error) {
      const msg = error.message?.toLowerCase() || '';
      if (msg.includes('banned') || msg.includes('disabled')) {
        setError('Votre compte a été désactivé. Contactez l\'administrateur pour réactiver votre accès.');
      } else {
        setError('Email ou mot de passe incorrect.');
      }
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
            Fondation 18 Safar
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Connectez-vous à votre espace membre
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200/70 bg-white/90 p-6 shadow-xl shadow-gray-200/50 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/90 dark:shadow-black/20">
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

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Mot de passe
                </label>
                <Link
                  to="/mot-de-passe-oublie"
                  className="text-xs font-medium text-primary-700 hover:text-primary-800 hover:underline dark:text-primary-400 dark:hover:text-primary-300"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 outline-none transition-colors focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-100 dark:focus:border-primary-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
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
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-700 py-2.5 font-medium text-white shadow-md shadow-primary-700/20 transition-colors hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                'Connexion...'
              ) : (
                <>
                  <LogIn className="h-4.5 w-4.5" />
                  Se connecter
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-600">
          © {new Date().getFullYear()} Fondation 18 Safar. Tous droits réservés.
        </p>
      </div>
    </div>
  );
}