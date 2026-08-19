import { useAuthContext } from '../contexts/AuthContext.jsx';

// Wrapper simple pour garder un point d'entrée stable si la logique évolue.
export function useAuth() {
  return useAuthContext();
}
