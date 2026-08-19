import { useAuthContext } from '../contexts/AuthContext.jsx';
import { useCampagneContext } from '../contexts/CampagneContext.jsx';
import { getRolePrioritaire } from '../constants/roles.js';

/**
 * hasRole('tresorier') -> true si l'utilisateur a ce rôle sur la campagne active
 *                         (ou un rôle global type administrateur/president, campagne_id = null)
 */
export function useRole() {
  const { roles } = useAuthContext();
  const { campagneActive } = useCampagneContext();

  const hasRole = (roleOrRoles) => {
    const wanted = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
    return roles.some(
      (r) =>
        wanted.includes(r.role) &&
        (r.campagne_id === null || r.campagne_id === campagneActive?.id)
    );
  };

  const isResponsableDe = (groupeId) =>
    roles.some(
      (r) =>
        r.role === 'responsable' &&
        r.groupe_id === groupeId &&
        (r.campagne_id === null || r.campagne_id === campagneActive?.id)
    );

  const roleNames = roles.map((r) => r.role);
  const rolePrincipal = getRolePrioritaire(roleNames);

  return { hasRole, isResponsableDe, roleNames, rolePrincipal };
}
