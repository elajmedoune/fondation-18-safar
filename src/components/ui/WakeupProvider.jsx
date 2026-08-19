import { useState, useEffect, createContext, useContext } from 'react';
import { Loader2, Wifi } from 'lucide-react';

const WakeupContext = createContext({ waking: false });

export function useWakeup() {
  return useContext(WakeupContext);
}

export function WakeupProvider({ children }) {
  const [waking, setWaking] = useState(false);
  const [retries, setRetries] = useState(0);

  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) return;

    let cancelled = false;

    const ping = async () => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);

        const res = await fetch(`${supabaseUrl}/functions/v1/keepalive`, {
          signal: ctrl.signal,
          headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '' },
        });
        clearTimeout(timer);

        if (!res.ok && !cancelled) {
          triggerWakeup();
        }
      } catch {
        if (!cancelled) triggerWakeup();
      }
    };

    const triggerWakeup = () => {
      setWaking(true);
      setRetries(0);
    };

    const retryPing = async (attempt) => {
      if (cancelled) return;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 15000);

        const res = await fetch(`${supabaseUrl}/functions/v1/keepalive`, {
          signal: ctrl.signal,
          headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '' },
        });
        clearTimeout(timer);

        if (res.ok && !cancelled) {
          setWaking(false);
          return;
        }
      } catch {}

      if (!cancelled && attempt < 20) {
        setRetries(attempt + 1);
        setTimeout(() => retryPing(attempt + 1), 3000);
      } else if (!cancelled) {
        setWaking(false);
      }
    };

    ping();

    return () => { cancelled = true; };
  }, []);

  return (
    <WakeupContext.Provider value={{ waking }}>
      {children}
      {waking && <WakeupOverlay retries={retries} />}
    </WakeupContext.Provider>
  );
}

function WakeupOverlay({ retries }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white/90 dark:bg-gray-950/90 backdrop-blur-sm">
      <div className="text-center space-y-4 px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 dark:bg-primary-900/30 mx-auto">
          <Wifi className="h-8 w-8 text-primary-600 dark:text-primary-400 animate-pulse" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Connexion en cours...</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Le serveur se réveille, veuillez patienter
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Tentative {retries + 1}/20</span>
        </div>
      </div>
    </div>
  );
}
