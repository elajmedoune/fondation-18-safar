import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_BASE = "https://api.groq.com/openai/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function fmtName(m: any): string {
  if (!m) return "[Membre inconnu]";
  const p = m.prenom || "";
  const n = m.nom || "";
  const full = `${p} ${n}`.trim();
  return full || "[Membre inconnu]";
}

function fmtPct(part: number, total: number): string {
  if (total <= 0) return "0%";
  return Math.round(part / total * 100) + "%";
}

const PAGE_SIZE = 1000;

// PostgREST renvoie 1000 lignes max par requête. fetchAll pagine avec
// .range() pour récupérer TOUTES les lignes, sans limite.
async function fetchAll(buildQuery: () => any): Promise<any[]> {
  const out: any[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data || [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}

// IDs des administrateurs GLOBAUX (campagne_id = null) : comptes techniques,
// ils ne sont PAS des membres de la fondation.
async function getGlobalAdminUserIds(supabaseAdmin: any): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "administrateur")
    .is("campagne_id", null);
  return new Set((data || []).map((r: any) => r.user_id));
}

// Roster UNIFIÉ et COMPLET des membres, identique au front (Dashboard +
// MembresList) :
//  - TOUS les membres de la table "membres" : membres simples ET membres du
//    bureau (président/trésorier/secrétaire). Le total correspond donc
//    EXACTEMENT au chiffre affiché dans l'application.
//  - SAUF les comptes liés à un administrateur GLOBAL (campagne_id = null) :
//    comptes techniques, ils ne font PAS partie des membres.
//  - Chaque membre est enrichi de son rattachement campagne (groupe/fonction)
//    s'il existe ; sinon fiche virtuelle sans groupe.
//  - Paginé : aucune limite sur le nombre de membres.
async function getRosterCampagne(supabaseAdmin: any, campagneId: string): Promise<any[]> {
  const adminIds = await getGlobalAdminUserIds(supabaseAdmin);

  const [fiches, membres] = await Promise.all([
    fetchAll(() =>
      supabaseAdmin
        .from("campagne_membres")
        .select("id, membre_id, fonction, statut, groupe:groupes(nom)")
        .eq("campagne_id", campagneId)
        .order("membre_id")
    ),
    fetchAll(() =>
      supabaseAdmin
        .from("membres")
        .select("id,nom,prenom,sexe,telephone,numero_membre,user_id")
        .order("nom")
        .order("prenom")
    ),
  ]);

  const ficheByMembreId = new Map(fiches.map((f: any) => [f.membre_id, f]));

  return membres
    .filter((m: any) => !adminIds.has(m.user_id))
    .map((m: any) => {
      const f = ficheByMembreId.get(m.id);
      return {
        id: f?.id ?? null,
        campagne_id: campagneId,
        membre_id: m.id,
        groupe_id: null,
        fonction: f?.fonction ?? null,
        statut: f?.statut ?? null,
        membre: m,
        groupe: f?.groupe ?? null,
      };
    });
}

// Présences par réunion (présents/absents) — nécessaires pour rédiger
// des comptes rendus factuels sans inventer de participants.
async function getParticipantsParReunion(supabaseAdmin: any, reunionIds: string[]): Promise<Record<string, { presents: string[]; absents: string[] }>> {
  const map: Record<string, { presents: string[]; absents: string[] }> = {};
  if (!reunionIds || reunionIds.length === 0) return map;
  const data = await fetchAll(() =>
    supabaseAdmin
      .from("reunion_participants")
      .select("reunion_id, statut_presence, membre:membres(nom,prenom)")
      .in("reunion_id", reunionIds)
      .order("id")
  );
  (data || []).forEach((p: any) => {
    if (!map[p.reunion_id]) map[p.reunion_id] = { presents: [], absents: [] };
    const name = fmtName(p.membre);
    if (!name || name === "[Membre inconnu]") return;
    if (p.statut_presence === "present" || p.statut_presence === "retard") map[p.reunion_id].presents.push(name);
    else if (p.statut_presence === "excuse") map[p.reunion_id].absents.push(`${name} (excusé)`);
    else map[p.reunion_id].absents.push(name);
  });
  return map;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message, campagneId } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: "Missing message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role, campagne_id")
      .eq("user_id", user.id);

    const isAdmin = roles?.some((r: any) => r.role === "administrateur");
    const isPresident = roles?.some((r: any) => r.role === "president");
    const isTresorier = roles?.some((r: any) => r.role === "tresorier");
    const isSecretaire = roles?.some((r: any) => r.role === "secretaire");

    const { data: membre } = await supabaseAdmin
      .from("membres")
      .select("prenom, nom")
      .eq("user_id", user.id)
      .maybeSingle();

    const userName = membre ? `${membre.prenom} ${membre.nom}` : user.email;
    const roleLabel = isAdmin ? "Administrateur" : isPresident ? "Président" : isTresorier ? "Trésorier" : isSecretaire ? "Secrétaire" : "Membre";

    let contextData = "";

    if (campagneId) {
      // ============================================================
      // ADMIN : accès à TOUTES les données
      // ============================================================
      if (isAdmin) {
        // Requêtes PAGINÉES : aucune limite sur le nombre de lignes
        const [cotisations, depenses, dons, quetes, reunions, campagneRes, objectifs, groupes] = await Promise.all([
          fetchAll(() => supabaseAdmin.from("cotisations").select("*, membre:membres(nom,prenom,numero_membre)").eq("campagne_id", campagneId).order("created_at")),
          fetchAll(() => supabaseAdmin.from("depenses").select("*").eq("campagne_id", campagneId).order("created_at")),
          fetchAll(() => supabaseAdmin.from("dons").select("*").eq("campagne_id", campagneId).order("created_at")),
          fetchAll(() => supabaseAdmin.from("quetes").select("*, collecteur:collecteurs(*, membre:membres(nom,prenom))").eq("campagne_id", campagneId).order("created_at")),
          fetchAll(() => supabaseAdmin.from("reunions").select("*").eq("campagne_id", campagneId).order("date_reunion", { ascending: false }).order("id")),
          supabaseAdmin.from("campagnes").select("*").eq("id", campagneId).single(),
          fetchAll(() => supabaseAdmin.from("objectifs").select("*").eq("campagne_id", campagneId).order("created_at")),
          supabaseAdmin.from("groupes").select("*").eq("actif", true),
        ]);
        const membres = await getRosterCampagne(supabaseAdmin, campagneId);
        const campagne = campagneRes.data;

        const tc = cotisations.reduce((s: number, c: any) => s + Number(c.montant), 0);
        const td = depenses.reduce((s: number, d: any) => s + Number(d.montant), 0);
        const tdon = dons.reduce((s: number, d: any) => s + Number(d.montant), 0);
        const tq = quetes.reduce((s: number, q: any) => s + Number(q.montant), 0);
        const solde = tc + tdon + tq - td;
        const objectif = Number(campagne?.objectif_global || 0);

        const depensesByCat: Record<string, number> = {};
        depenses.forEach((d: any) => { depensesByCat[d.categorie] = (depensesByCat[d.categorie] || 0) + Number(d.montant); });

        const cotisationsByMois: Record<string, { total: number; count: number }> = {};
        cotisations.forEach((c: any) => {
          const m = c.mois_cotisation || "Non précisé";
          if (!cotisationsByMois[m]) cotisationsByMois[m] = { total: 0, count: 0 };
          cotisationsByMois[m].total += Number(c.montant);
          cotisationsByMois[m].count++;
        });

        const membresAyantCotise = new Set(cotisations.map((c: any) => c.membre_id));

        // Rôles bureau par user_id (les fiches virtuelles du roster ont membre.user_id)
        const rosterUserIds = membres.map((m: any) => m.membre?.user_id).filter(Boolean);
        const { data: membresRoles } = rosterUserIds.length > 0
          ? await supabaseAdmin
              .from("user_roles")
              .select("user_id, role")
              .in("user_id", rosterUserIds)
          : { data: [] };

        const rolesByUser: Record<string, string[]> = {};
        (membresRoles || []).forEach((r: any) => {
          if (!rolesByUser[r.user_id]) rolesByUser[r.user_id] = [];
          rolesByUser[r.user_id].push(r.role);
        });

        const membresNonCotisants = membres
          .filter((m: any) => !membresAyantCotise.has(m.membre_id))
          .map((m: any) => fmtName(m.membre));

        const membresByGroupe: Record<string, string[]> = {};
        membres.forEach((m: any) => {
          const g = m.groupe?.nom || "Sans groupe";
          if (!membresByGroupe[g]) membresByGroupe[g] = [];
          const name = fmtName(m.membre);
          const userRoles = rolesByUser[m.membre?.user_id] || [];
          const isBureau = userRoles.some((r: string) => ["president", "tresorier", "secretaire", "responsable"].includes(r));
          const roleTag = isBureau ? ` [Bureau: ${userRoles.join(", ")}]` : "";
          membresByGroupe[g].push(`${name}${roleTag}`);
        });

        // Registre exhaustif des noms (anti-hallucination)
        const allNames = new Set<string>();
        membres.forEach((m: any) => { if (m.membre?.prenom || m.membre?.nom) allNames.add(fmtName(m.membre)); });
        cotisations.forEach((c: any) => { if (c.membre?.prenom || c.membre?.nom) allNames.add(fmtName(c.membre)); });

        const participantsParReunion = await getParticipantsParReunion(supabaseAdmin, reunions.map((r: any) => r.id));
        const reunionsText = reunions.map((r: any) => {
          const p = participantsParReunion[r.id];
          const pres = p && p.presents.length > 0 ? ` — Présents (${p.presents.length}): ${p.presents.slice(0, 15).join(", ")}` : "";
          const abs = p && p.absents.length > 0 ? ` — Absents: ${p.absents.slice(0, 10).join(", ")}` : "";
          const odj = r.ordre_du_jour ? ` — ODJ: ${String(r.ordre_du_jour).slice(0, 150)}` : "";
          return `- ${r.titre || "Sans titre"} du ${new Date(r.date_reunion).toLocaleDateString("fr-FR")}${r.lieu ? ` à ${r.lieu}` : ""}${r.heure ? ` à ${r.heure}` : ""} ${r.compte_rendu ? "✅ CR rédigé" : "❌ CR manquant"}${odj}${pres}${abs}`;
        }).join("\n") || "Aucune";

        contextData = `[ADMIN - ACCÈS COMPLET] Fondation 18 Safar
Campagne: ${campagne?.nom || ""} (${campagne?.annee || ""}) | Statut: ${campagne?.statut || ""}
Objectif: ${objectif}FCFA | Cotisation H: ${campagne?.cotisation_homme || 0}FCFA | F: ${campagne?.cotisation_femme || 0}FCFA

CHIFFRES:
- Cotisations: ${tc}FCFA (${cotisations.length} ops)
- Dépenses: ${td}FCFA (${depenses.length} ops)
- Dons: ${tdon}FCFA (${dons.length} ops)
- Quêtes: ${tq}FCFA (${quetes.length} ops)
- Solde: ${solde}FCFA | Objectif: ${fmtPct(tc + tdon + tq, objectif)} atteint
- Membres de la fondation: ${membres.length}
- NOTE: Ce total est la liste officielle et complète des membres (membres simples ET membres du bureau). Les administrateurs sont des comptes techniques et ne font PAS partie des membres.

DÉPENSES PAR CATÉGORIE:
${Object.entries(depensesByCat).sort((a, b) => b[1] - a[1]).map(([cat, m]) => `- ${cat}: ${m}FCFA (${fmtPct(m, td)})`).join("\n") || "Aucune"}

COTISATIONS PAR MOIS:
${Object.entries(cotisationsByMois).map(([mois, v]) => `- ${mois}: ${v.total}FCFA (${v.count} ops)`).join("\n") || "Aucune"}

MEMBRES PAR GROUPE (les membres du bureau sont indiqués entre crochets - ils font partie des membres):
${Object.entries(membresByGroupe).map(([g, ms]) => `- ${g} (${ms.length}): ${ms.join(", ")}`).join("\n") || "Aucun"}

MEMBRES AYANT COTISÉ (${membresAyantCotise.size}):
${cotisations.map((c: any) => `- ${fmtName(c.membre)}: ${c.montant}FCFA (${c.mois_cotisation || ""})`).join("\n") || "Aucun"}

MEMBRES SANS COTISATION (${membresNonCotisants.length}):
${membresNonCotisants.length > 0 ? membresNonCotisants.map(n => `- ${n}`).join("\n") : "Aucun"}

QUÊTES (${quetes.length}):
${quetes.slice(0, 10).map((q: any) => `- ${q.lieu}: ${q.montant}FCFA${q.collecteur?.membre ? ` (${fmtName(q.collecteur.membre)})` : ""}`).join("\n") || "Aucune"}

RÉUNIONS (${reunions.length}, ${reunions.filter((r: any) => r.compte_rendu).length} avec CR):
${reunionsText}

DERNIÈRES OPÉRATIONS:
${cotisations.slice(0, 5).map((c: any) => `Cotisation: ${fmtName(c.membre)} — ${c.montant}FCFA (${c.mois_cotisation || ""})`).join("\n")}
${depenses.slice(0, 5).map((d: any) => `Dépense: ${d.categorie} — ${d.montant}FCFA ${d.description ? `(${d.description})` : ""}`).join("\n")}

---
REGISTRE DES NOMS (liste exhaustive - utilise UNIQUEMENT ces noms):
${[...allNames].map(n => `- ${n}`).join("\n") || "Aucun"}`;
      }

      // ============================================================
      // PRÉSIDENT : vue d'ensemble (tous les totaux, pas de détails individuels)
      // ============================================================
      else if (isPresident) {
        // Requêtes PAGINÉES : aucune limite sur le nombre de lignes
        const [cotisationsRes, depensesRes, donsRes, quetesRes, reunionsRes, campagneRes, objectifs] = await Promise.all([
          fetchAll(() => supabaseAdmin.from("cotisations").select("montant").eq("campagne_id", campagneId).order("created_at")),
          fetchAll(() => supabaseAdmin.from("depenses").select("montant").eq("campagne_id", campagneId).order("created_at")),
          fetchAll(() => supabaseAdmin.from("dons").select("montant").eq("campagne_id", campagneId).order("created_at")),
          fetchAll(() => supabaseAdmin.from("quetes").select("montant").eq("campagne_id", campagneId).order("created_at")),
          fetchAll(() => supabaseAdmin.from("reunions").select("id, compte_rendu").eq("campagne_id", campagneId).order("id")),
          supabaseAdmin.from("campagnes").select("*").eq("id", campagneId).single(),
          fetchAll(() => supabaseAdmin.from("objectifs").select("*").eq("campagne_id", campagneId).order("created_at")),
        ]);
        const membres = await getRosterCampagne(supabaseAdmin, campagneId);

        const cotisations = cotisationsRes;
        const depenses = depensesRes;
        const dons = donsRes;
        const quetes = quetesRes;
        const reunions = reunionsRes;
        const campagne = campagneRes.data;

        const tc = cotisations.reduce((s: number, c: any) => s + Number(c.montant), 0);
        const td = depenses.reduce((s: number, d: any) => s + Number(d.montant), 0);
        const tdon = dons.reduce((s: number, d: any) => s + Number(d.montant), 0);
        const tq = quetes.reduce((s: number, q: any) => s + Number(q.montant), 0);
        const objectif = Number(campagne?.objectif_global || 0);

        const objectifsText = objectifs.map((o: any) => `${o.activite_nom || "Global"}: ${o.montant_cible}FCFA`).join(", ");
        const reunionsAvecCR = reunions.filter((r: any) => r.compte_rendu).length;

        contextData = `[PRÉSIDENT - VUE D'ENSEMBLE] Fondation 18 Safar
Campagne: ${campagne?.nom || ""} (${campagne?.annee || ""}) | Objectif: ${objectif}FCFA

CHIFFRES:
- Cotisations: ${tc}FCFA (${cotisations.length} ops)
- Dépenses: ${td}FCFA (${depenses.length} ops)
- Dons: ${tdon}FCFA (${dons.length} ops)
- Quêtes: ${tq}FCFA (${quetes.length} ops)
- Solde: ${tc + tdon + tq - td}FCFA
- Objectif: ${fmtPct(tc + tdon + tq, objectif)} atteint
- Membres de la fondation: ${membres.length}
- Réunions: ${reunions.length} (${reunionsAvecCR} avec CR)

OBJECTIFS: ${objectifsText || "Aucun"}`;
      }

      // ============================================================
      // TRÉSORIER : finances uniquement
      // ============================================================
      else if (isTresorier) {
        // Requêtes PAGINÉES : aucune limite sur le nombre de lignes
        const [cotisations, depenses, dons, quetes, campagneRes] = await Promise.all([
          fetchAll(() => supabaseAdmin.from("cotisations").select("*, membre:membres(nom,prenom)").eq("campagne_id", campagneId).order("created_at")),
          fetchAll(() => supabaseAdmin.from("depenses").select("*").eq("campagne_id", campagneId).order("created_at")),
          fetchAll(() => supabaseAdmin.from("dons").select("*").eq("campagne_id", campagneId).order("created_at")),
          fetchAll(() => supabaseAdmin.from("quetes").select("*, collecteur:collecteurs(*, membre:membres(nom,prenom))").eq("campagne_id", campagneId).order("created_at")),
          supabaseAdmin.from("campagnes").select("*").eq("id", campagneId).single(),
        ]);
        const campagne = campagneRes.data;

        const tc = cotisations.reduce((s: number, c: any) => s + Number(c.montant), 0);
        const td = depenses.reduce((s: number, d: any) => s + Number(d.montant), 0);
        const tdon = dons.reduce((s: number, d: any) => s + Number(d.montant), 0);
        const tq = quetes.reduce((s: number, q: any) => s + Number(q.montant), 0);
        const solde = tc + tdon + tq - td;
        const objectif = Number(campagne?.objectif_global || 0);

        const depensesByCat: Record<string, number> = {};
        depenses.forEach((d: any) => { depensesByCat[d.categorie] = (depensesByCat[d.categorie] || 0) + Number(d.montant); });

        const cotisationsByMois: Record<string, { total: number; count: number }> = {};
        cotisations.forEach((c: any) => {
          const m = c.mois_cotisation || "Non précisé";
          if (!cotisationsByMois[m]) cotisationsByMois[m] = { total: 0, count: 0 };
          cotisationsByMois[m].total += Number(c.montant);
          cotisationsByMois[m].count++;
        });

        const allNames = new Set<string>();
        cotisations.forEach((c: any) => { if (c.membre?.prenom || c.membre?.nom) allNames.add(fmtName(c.membre)); });

        contextData = `[TRÉSORIER - FINANCES] Campagne: ${campagne?.nom || ""} | Objectif: ${objectif}FCFA

CHIFFRES:
- Cotisations: ${tc}FCFA (${cotisations.length} ops)
- Dépenses: ${td}FCFA (${depenses.length} ops)
- Dons: ${tdon}FCFA (${dons.length} ops)
- Quêtes: ${tq}FCFA (${quetes.length} ops)
- Solde: ${solde}FCFA | Objectif: ${fmtPct(tc + tdon + tq, objectif)} atteint

DÉPENSES PAR CATÉGORIE:
${Object.entries(depensesByCat).sort((a, b) => b[1] - a[1]).map(([cat, m]) => `- ${cat}: ${m}FCFA (${fmtPct(m, td)})`).join("\n") || "Aucune"}

COTISATIONS PAR MOIS:
${Object.entries(cotisationsByMois).map(([mois, v]) => `- ${mois}: ${v.total}FCFA (${v.count} ops)`).join("\n") || "Aucune"}

DERNIÈRES COTISATIONS:
${cotisations.slice(0, 10).map((c: any) => `- ${fmtName(c.membre)}: ${c.montant}FCFA (${c.mois_cotisation || ""})`).join("\n")}

DERNIÈRES DÉPENSES:
${depenses.slice(0, 10).map((d: any) => `- ${d.categorie}: ${d.montant}FCFA ${d.description ? `(${d.description})` : ""}`).join("\n")}

DONS:
${dons.map((d: any) => `- ${d.type}: ${d.montant}FCFA ${d.donateur_nom ? `(${d.donateur_nom})` : "(anonyme)"}`).join("\n") || "Aucun"}

QUÊTES:
${quetes.map((q: any) => `- ${q.lieu}: ${q.montant}FCFA${q.collecteur?.membre ? ` (${fmtName(q.collecteur.membre)})` : ""}`).join("\n") || "Aucune"}

---
REGISTRE DES NOMS (liste exhaustive - utilise UNIQUEMENT ces noms):
${[...allNames].map(n => `- ${n}`).join("\n") || "Aucun"}`;
      }

      // ============================================================
      // SECRÉTAIRE : réunions + membres
      // ============================================================
      else if (isSecretaire) {
        // Requêtes PAGINÉES : aucune limite sur le nombre de lignes
        const [reunions, campagneRes] = await Promise.all([
          fetchAll(() => supabaseAdmin.from("reunions").select("*").eq("campagne_id", campagneId).order("date_reunion", { ascending: false }).order("id")),
          supabaseAdmin.from("campagnes").select("*").eq("id", campagneId).single(),
        ]);
        const membres = await getRosterCampagne(supabaseAdmin, campagneId);
        const campagne = campagneRes.data;

        const membresByGroupe: Record<string, string[]> = {};
        membres.forEach((m: any) => {
          const g = m.groupe?.nom || "Sans groupe";
          if (!membresByGroupe[g]) membresByGroupe[g] = [];
          const name = fmtName(m.membre);
          const extras = [m.membre?.sexe, m.fonction].filter(Boolean).join(" - ");
          membresByGroupe[g].push(extras ? `${name} (${extras})` : name);
        });

        const allNames = new Set<string>();
        membres.forEach((m: any) => { if (m.membre?.prenom || m.membre?.nom) allNames.add(fmtName(m.membre)); });

        const reunionsData = reunions;
        const participantsParReunion = await getParticipantsParReunion(supabaseAdmin, reunionsData.map((r: any) => r.id));
        const reunionsText = reunionsData.map((r: any) => {
          const p = participantsParReunion[r.id];
          const pres = p && p.presents.length > 0 ? ` — Présents (${p.presents.length}): ${p.presents.slice(0, 15).join(", ")}` : "";
          const abs = p && p.absents.length > 0 ? ` — Absents: ${p.absents.slice(0, 10).join(", ")}` : "";
          const odj = r.ordre_du_jour ? ` — ODJ: ${String(r.ordre_du_jour).slice(0, 150)}` : "";
          return `- ${r.titre || "Sans titre"} du ${new Date(r.date_reunion).toLocaleDateString("fr-FR")}${r.lieu ? ` à ${r.lieu}` : ""}${r.heure ? ` à ${r.heure}` : ""} ${r.compte_rendu ? "✅ CR rédigé" : "❌ CR manquant"}${odj}${pres}${abs}`;
        }).join("\n") || "Aucune réunion";

        contextData = `[SECRÉTAIRE - RÉUNIONS & MEMBRES] Campagne: ${campagne?.nom || ""}

MEMBRES (${membres.length}) - liste officielle complète : membres simples ET membres du bureau (les administrateurs n'en font pas partie):
${Object.entries(membresByGroupe).map(([g, ms]) => `- ${g} (${ms.length}):\n  ${ms.join("\n  ")}`).join("\n") || "Aucun membre"}

RÉUNIONS (${reunionsData.length}):
${reunionsText}

---
REGISTRE DES NOMS (liste exhaustive - utilise UNIQUEMENT ces noms):
${[...allNames].map(n => `- ${n}`).join("\n") || "Aucun"}`;
      }

      // ============================================================
      // AUTRES RÔLES : données de base
      // ============================================================
      else {
        const campagneRes = await supabaseAdmin.from("campagnes").select("*").eq("id", campagneId).single();
        const membres = await getRosterCampagne(supabaseAdmin, campagneId);
        const campagne = campagneRes.data;

        contextData = `[MEMBRE] Campagne: ${campagne?.nom || ""} (${campagne?.annee || ""})
Objectif: ${campagne?.objectif_global || 0}FCFA
Membres de la fondation: ${membres.length}
Statut: ${campagne?.statut || ""}`;
      }
    } else {
      contextData = `Aucune campagne active sélectionnée.`;
    }

    const systemPrompt = `Tu es l'assistant IA de la Fondation 18 Safar, une association caritative de gestion communautaire.

IDENTITÉ: Tu es ${userName}, ${roleLabel} de la Fondation 18 Safar.

STYLE:
- Réponds en français, ton professionnel mais chaleureux
- Sois DIRECT et CONCIS
- Utilise les données chiffrées pour étayer tes réponses
- NE RÉPÈTE JAMAIS la même information deux fois

FORMAT (adapte selon la question):
- **📊 Résumé** pour les synthèses financières
- **📋 Détail** pour les listes
- **💡 Recommandation** pour les conseils
- Listes à puces avec **gras** pour les chiffres importants
- Séparateurs --- entre les sections
- 10-15 lignes max par réponse

Tu peux:
- Répondre sur les finances, membres, réunions, groupes (selon tes accès)
- Faire des calculs (moyennes, pourcentages, projections)
- Suggérer des actions concrètes
- Analyser les tendances et identifier les problèmes

IMPORTANT - RÔLES ET MEMBRES:
- Le nombre officiel de membres est celui indiqué dans "Membres de la fondation" du contexte. Utilise TOUJOURS ce chiffre, il est EXACT et complet (aucune limite, liste exhaustive).
- TOUS les membres font partie du total : les membres simples ET les membres du bureau (président, trésorier, secrétaire, responsables). Le bureau n'est pas compté à part.
- Les administrateurs NE font PAS partie des membres de la fondation. Ce sont des comptes techniques avec accès complet, pas des membres actifs. Ne les compte JAMAIS et ne les cite JAMAIS comme membres.

TÂCHES DE RÉDACTION — RAPPORTS ET COMPTES RENDUS (très important):
Quand on te demande un rapport, une synthèse officielle ou un compte rendu, produis un document STRUCTURÉ, COMPLET et prêt à copier dans l'application. Suis EXACTEMENT ces modèles:

MODÈLE 1 — RAPPORT FINANCIER:
# RAPPORT FINANCIER — <nom de la campagne>
## 1. Synthèse
(2-3 phrases: recettes totales, dépenses, solde, progression de l'objectif)
## 2. Recettes
- Cotisations: <montant> FCFA (<n> opérations)
- Dons: <montant> FCFA (<n> dons)
- Quêtes: <montant> FCFA (<n> quêtes)
- **TOTAL RECETTES: <somme> FCFA**
## 3. Dépenses par catégorie
(liste triée de la plus grosse à la plus petite avec montants et pourcentages)
- **TOTAL DÉPENSES: <somme> FCFA**
## 4. Solde
**Solde disponible: <montant> FCFA**
## 5. Objectif
<recettes> / <objectif> FCFA soit <x>% atteint.
## 6. Observations et recommandations
(2-4 puces factuelles basées sur les données: catégories qui pesent le plus, taux de participation aux cotisations, etc.)

MODÈLE 2 — RAPPORT GÉNÉRAL OU D'ACTIVITÉ:
# RAPPORT <GÉNÉRAL | D'ACTIVITÉ> — <titre>
## 1. Contexte et période
## 2. Activités réalisées
## 3. Résultats chiffrés
(chiffres du contexte uniquement)
## 4. Difficultés rencontrées
## 5. Recommandations et prochaines étapes

MODÈLE 3 — COMPTE RENDU DE RÉUNION:
# COMPTE RENDU — <titre ou date de la réunion>
**Date:** <date> | **Heure:** <heure> | **Lieu:** <lieu>
**Présents (<n>):** <liste des noms du contexte> | **Absents:** <liste>
## 1. Ordre du jour
(reprendre l'ODJ réel si présent dans le contexte)
## 2. Discussions
(point par point de l'ODJ; si les échanges ne sont pas connus, indiquer "[À compléter]")
## 3. Décisions prises
("[À compléter]" si non connu - ne JAMAIS inventer une décision)
## 4. Actions à mener
(tableau ou liste: action — responsable — échéance)

RÈGLES DE RÉDACTION:
- Utilise UNIQUEMENT les chiffres, noms et faits présents dans le contexte. N'invente AUCUN chiffre ni nom.
- Si une information est manquante (date, lieu, décisions, discussions), écris explicitement "[À compléter]" à sa place plutôt que d'inventer.
- Reste factuel, précis et professionnel. Chiffres en FCFA formatés avec séparateurs de milliers.
- Formatage markdown strict: titres avec ##, valeurs importantes en **gras**, listes à puces.
- Pour un compte rendu, utilise la réunion demandée (la plus récente sans CR si aucune n'est précisée).

SI ON TE POSE UNE QUESTION HORS DU CONTEXTE DE L'APPLICATION (politique, sport, musique, actualités, etc.), réponds poliment:
"Je suis l'assistant de la Fondation 18 Safar. Je peux t'aider avec les données de l'association (cotisations, dépenses, membres, réunions, etc.). Pour autre chose, je ne suis pas équipé."

IMPORTANT - ANTI-HALLUCINATION:
- Tu dois UNIQUEMENT citer les noms de personnes qui apparaissent EXPLICITEMENT dans le "REGISTRE DES NOMS" du contexte.
- NE JAMAIS inventer, déduire, ou compléter un nom de membre.
- Si on te demande un nom que tu ne vois pas dans les données, réponds: "Ce nom ne figure pas dans les données dont je dispose."
- Copie les noms EXACTEMENT tels qu'ils apparaissent.
- Ne remplace JAMAIS "undefined" ou "[Membre inconnu]" par un nom inventé.
- Tu ne peux parler que des données dans le contexte. Si on te demande quelque chose hors de ton rôle, explique que tu n'as pas accès.`;

    if (!GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: "Clé IA non configurée" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = {
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextData ? `${contextData}\n\n---\nQuestion: ${message}` : message },
      ],
      temperature: 0.3,
      max_tokens: 3500,
    };

    console.log("[ai] user:", userName, "role:", roleLabel, "msg:", message.slice(0, 80));

    const groqRes = await fetch(GROQ_BASE, {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const groqData = await groqRes.json();

    if (!groqRes.ok) {
      console.error("[groq] error:", groqRes.status, JSON.stringify(groqData));
      return new Response(JSON.stringify({ error: "Erreur IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reply = groqData.choices?.[0]?.message?.content || "Pas de réponse.";

    return new Response(JSON.stringify({ reply }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ai] fatal:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
