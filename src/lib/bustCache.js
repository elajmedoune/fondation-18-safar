// Ajoute un paramètre unique à une URL d'image pour forcer le navigateur à
// retélécharger le fichier au lieu de servir sa copie en cache.
// Indispensable pour les photos de membres : un ré-import écrit toujours au
// MÊME chemin ("<membre_id>.jpg"), donc l'URL ne change pas et le navigateur
// afficherait indéfiniment l'ancienne image.
export function bustCache(url, rev = 0) {
  if (!url) return url;
  // Les URL "blob:" et "data:" n'acceptent pas de query string : les suffixer
  // produit une URL qui ne désigne plus rien (ERR_FILE_NOT_FOUND). Elles
  // sont déjà uniques par construction, donc elles sont renvoyées telles
  // quelles.
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}t=${Date.now()}-${rev}`;
}
