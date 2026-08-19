// Doit rester synchronisé avec l'enum "role_systeme" du schéma Supabase.
export const ROLES = {
  MEMBRE: 'membre',
  RESPONSABLE: 'responsable',
  TRESORIER: 'tresorier',
  SECRETAIRE: 'secretaire',
  PRESIDENT: 'president',
  ADMINISTRATEUR: 'administrateur'
};

export const ROLE_PRIORITY = [
  ROLES.ADMINISTRATEUR,
  ROLES.PRESIDENT,
  ROLES.TRESORIER,
  ROLES.SECRETAIRE,
  ROLES.RESPONSABLE,
  ROLES.MEMBRE
];

export function getRolePrioritaire(roles = []) {
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) return r;
  }
  return ROLES.MEMBRE;
}
