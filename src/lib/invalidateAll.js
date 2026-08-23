// À appeler après CHAQUE écriture réussie (create/update/delete).
// Invalide toutes les requêtes React Query : les volumes de données sont
// modestes, donc tout refetcher en arrière-plan est négligeable et garantit
// que chaque écran (même les autres pages) reflète instantanément la dernière
// action — sans jamais avoir à recharger la page manuellement.
export const invalidateAll = (queryClient) => {
  queryClient.invalidateQueries();
};
