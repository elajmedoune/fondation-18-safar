import { ROLES } from './roles.js';

export const NAV_ITEMS = {
  [ROLES.MEMBRE]: [
    { label: 'Accueil', to: '/tableau-de-bord', icon: 'Home' },
    { label: 'Ma carte', to: '/ma-carte', icon: 'CreditCard' },
    { label: 'Réunions', to: '/reunions', icon: 'Calendar' }
  ],
  [ROLES.TRESORIER]: [
    { label: 'Accueil', to: '/tableau-de-bord', icon: 'Home' },
    { label: 'Scan', to: '/scan', icon: 'QrCode' },
    { label: 'Cotisations', to: '/finances/cotisations', icon: 'Wallet' },
    { label: 'Dons', to: '/finances/dons', icon: 'HandHeart' },
    { label: 'Quêtes', to: '/finances/quetes', icon: 'Coins' },
    { label: 'Dépenses', to: '/finances/depenses', icon: 'Receipt' },
    { label: 'Objectifs', to: '/finances/objectifs', icon: 'Target' },
    { label: 'Réunions', to: '/reunions', icon: 'Calendar' },
    { label: 'Rapports', to: '/rapports', icon: 'FileText' },
    { label: 'Assistant IA', to: '/assistant-ia', icon: 'Bot' },
  ],
  [ROLES.SECRETAIRE]: [
    { label: 'Accueil', to: '/tableau-de-bord', icon: 'Home' },
    { label: 'Réunions', to: '/reunions', icon: 'Calendar' },
    { label: 'Membres', to: '/membres', icon: 'Users' },
    { label: 'Cartes', to: '/membres/cartes', icon: 'CreditCard' },
    { label: 'Rapports', to: '/rapports', icon: 'FileText' },
    { label: 'Assistant IA', to: '/assistant-ia', icon: 'Bot' },
  ],
  [ROLES.PRESIDENT]: [
    { label: 'Accueil', to: '/tableau-de-bord', icon: 'Home' },
    { label: 'Cotisations', to: '/finances/cotisations', icon: 'Wallet' },
    { label: 'Dons', to: '/finances/dons', icon: 'HandHeart' },
    { label: 'Quêtes', to: '/finances/quetes', icon: 'Coins' },
    { label: 'Dépenses', to: '/finances/depenses', icon: 'Receipt' },
    { label: 'Réunions', to: '/reunions', icon: 'Calendar' },
    { label: 'Cartes', to: '/membres/cartes', icon: 'CreditCard' },
    { label: 'Rapports', to: '/rapports', icon: 'FileText' },
    { label: 'Assistant IA', to: '/assistant-ia', icon: 'Bot' },
    { label: 'Administration', to: '/admin/utilisateurs', icon: 'Settings' },
    { label: 'Traçabilité', to: '/admin/traçabilite', icon: 'History' },
  ],
  [ROLES.ADMINISTRATEUR]: [
    { label: 'Accueil', to: '/tableau-de-bord', icon: 'Home' },
    { label: 'Scan', to: '/scan', icon: 'QrCode' },
    { label: 'Cotisations', to: '/finances/cotisations', icon: 'Wallet' },
    { label: 'Dons', to: '/finances/dons', icon: 'HandHeart' },
    { label: 'Quêtes', to: '/finances/quetes', icon: 'Coins' },
    { label: 'Dépenses', to: '/finances/depenses', icon: 'Receipt' },
    { label: 'Objectifs', to: '/finances/objectifs', icon: 'Target' },
    { label: 'Réunions', to: '/reunions', icon: 'Calendar' },
    { label: 'Rapports', to: '/rapports', icon: 'FileText' },
    { label: 'Membres', to: '/membres', icon: 'Users' },
    { label: 'Groupes', to: '/groupes', icon: 'Users2' },
    { label: 'Cartes', to: '/membres/cartes', icon: 'CreditCard' },
    { label: 'Assistant IA', to: '/assistant-ia', icon: 'Bot' },
    { label: 'Administration', to: '/admin/utilisateurs', icon: 'Settings' },
    { label: 'Traçabilité', to: '/admin/traçabilite', icon: 'History' },
  ]
};

export function getSidebarItems(userRoles = []) {
  const seen = new Map();
  userRoles.forEach((r) => {
    (NAV_ITEMS[r] || []).forEach((item) => seen.set(item.to, item));
  });
  return Array.from(seen.values());
}
// Action principale par rôle, affichée seule dans la bottom nav mobile.
export const PRIMARY_ACTION = {
  [ROLES.MEMBRE]: { label: 'Ma carte', to: '/ma-carte', icon: 'CreditCard' },
  [ROLES.TRESORIER]: { label: 'Scan', to: '/scan', icon: 'QrCode' },
  [ROLES.SECRETAIRE]: { label: 'Réunions', to: '/reunions', icon: 'Calendar' },
  [ROLES.PRESIDENT]: { label: 'Réunions', to: '/reunions', icon: 'Calendar' },
  [ROLES.ADMINISTRATEUR]: { label: 'Scan', to: '/scan', icon: 'QrCode' }
};