import { useAuthContext } from '../contexts/AuthContext.jsx';
import { useCampagneContext } from '../contexts/CampagneContext.jsx';
import { getRolePrioritaire } from '../constants/roles.js';

// RÈGLE : tout dépend de la campagne active. SEUL le rôle "administrateur"
// est global (indépendant de la campagne). Un rôle bureau/responsable rattaché
// à une autre campagne ne donne AUCUN droit sur la campagne active.
export function useRole() {
  const { roles } = useAuthContext();
  const { campagneActive } = useCampagneContext();

  const estRoleActif = (r) =>
    r.role === 'administrateur' || r.campagne_id === campagneActive?.id;

  const hasRole = (roleOrRoles) => {
    const wanted = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
    return roles.some((r) => wanted.includes(r.role) && estRoleActif(r));
  };

  const isResponsableDe = (groupeId) =>
    roles.some(
      (r) =>
        r.role === 'responsable' &&
        r.groupe_id === groupeId &&
        r.campagne_id === campagneActive?.id
    );

  // Rôles valides pour la campagne active (admin global inclus)
  const roleNamesActifs = [
    ...new Set(roles.filter(estRoleActif).map((r) => r.role)),
  ];
  const rolePrincipal = getRolePrioritaire(roleNamesActifs);

  return {
    hasRole,
    isResponsableDe,
    roleNames: roleNamesActifs,
    roleNamesActifs,
    rolePrincipal,
  };
}
