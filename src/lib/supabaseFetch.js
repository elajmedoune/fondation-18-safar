// Supabase (PostgREST) renvoie 1000 lignes maximum par requête.
// fetchAllPages récupère TOUTES les lignes en paginant avec .range(),
// donc sans limite sur le nombre de membres / lignes renvoyés.
export async function fetchAllPages(buildQuery, pageSize = 1000) {
  const all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
