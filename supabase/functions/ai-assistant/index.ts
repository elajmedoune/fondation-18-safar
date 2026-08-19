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
        // Requête SANS limite pour les agrégations (membres, cotisations)
        const [cotisationsAll, depensesAll, donsAll, quetesAll, reunionsAll, membresCampagne, campagne, objectifs, groupes] = await Promise.all([
          supabaseAdmin.from("cotisations").select("*, membre:membres(nom,prenom,numero_membre)").eq("campagne_id", campagneId),
          supabaseAdmin.from("depenses").select("*").eq("campagne_id", campagneId),
          supabaseAdmin.from("dons").select("*").eq("campagne_id", campagneId),
          supabaseAdmin.from("quetes").select("*, collecteur:collecteurs(*, membre:membres(nom,prenom))").eq("campagne_id", campagneId),
          supabaseAdmin.from("reunions").select("*").eq("campagne_id", campagneId).order("date_reunion", { ascending: false }),
          supabaseAdmin.from("campagne_membres").select("*, membre:membres(nom,prenom,sexe,telephone,numero_membre), groupe:groupes(nom)").eq("campagne_id", campagneId).eq("statut", "actif"),
          supabaseAdmin.from("campagnes").select("*").eq("id", campagneId).single(),
          supabaseAdmin.from("objectifs").select("*").eq("campagne_id", campagneId),
          supabaseAdmin.from("groupes").select("*").eq("actif", true),
        ]);

        const cotisations = cotisationsAll.data || [];
        const depenses = depensesAll.data || [];
        const dons = donsAll.data || [];
        const quetes = quetesAll.data || [];
        const reunions = reunionsAll.data || [];
        const membres = membresCampagne.data || [];

        const tc = cotisations.reduce((s: number, c: any) => s + Number(c.montant), 0);
        const td = depenses.reduce((s: number, d: any) => s + Number(d.montant), 0);
        const tdon = dons.reduce((s: number, d: any) => s + Number(d.montant), 0);
        const tq = quetes.reduce((s: number, q: any) => s + Number(q.montant), 0);
        const solde = tc + tdon + tq - td;
        const objectif = Number(campagne.data?.objectif_global || 0);

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

        // Récupérer les rôles des membres de la campagne
        const membresIds = membres.map((m: any) => m.membre_id);
        const { data: membresRoles } = await supabaseAdmin
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", membresIds);

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
          const userRoles = rolesByUser[m.membre_id] || [];
          const isBureau = userRoles.some((r: string) => ["president", "tresorier", "secretaire", "responsable"].includes(r));
          const roleTag = isBureau ? ` [Bureau: ${userRoles.join(", ")}]` : "";
          membresByGroupe[g].push(`${name}${roleTag}`);
        });

        // Registre exhaustif des noms (anti-hallucination)
        const allNames = new Set<string>();
        membres.forEach((m: any) => { if (m.membre?.prenom || m.membre?.nom) allNames.add(fmtName(m.membre)); });
        cotisations.forEach((c: any) => { if (c.membre?.prenom || c.membre?.nom) allNames.add(fmtName(c.membre)); });

        const { count: totalMembres } = await supabaseAdmin
          .from("membres").select("id", { count: "exact", head: true }).eq("actif", true);

        contextData = `[ADMIN - ACCÈS COMPLET] Fondation 18 Safar
Campagne: ${campagne.data?.nom || ""} (${campagne.data?.annee || ""}) | Statut: ${campagne.data?.statut || ""}
Objectif: ${objectif}FCFA | Cotisation H: ${campagne.data?.cotisation_homme || 0}FCFA | F: ${campagne.data?.cotisation_femme || 0}FCFA

CHIFFRES:
- Cotisations: ${tc}FCFA (${cotisations.length} ops)
- Dépenses: ${td}FCFA (${depenses.length} ops)
- Dons: ${tdon}FCFA (${dons.length} ops)
- Quêtes: ${tq}FCFA (${quetes.length} ops)
- Solde: ${solde}FCFA | Objectif: ${fmtPct(tc + tdon + tq, objectif)} atteint
- Membres total (base): ${totalMembres || 0} | Campagne: ${membres.length}
- NOTE: Les membres du bureau (président, trésorier, secrétaire, responsable) font partie des membres de la campagne. Les administrateurs n'en font PAS partie.

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
${reunions.map((r: any) => `- ${r.titre || "Sans titre"} du ${new Date(r.date_reunion).toLocaleDateString("fr-FR")}${r.lieu ? ` à ${r.lieu}` : ""} ${r.compte_rendu ? "✅" : "❌"}`).join("\n") || "Aucune"}

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
        const [cotisations, depenses, dons, quetes, reunions, membresCampagne, campagne, objectifs] = await Promise.all([
          supabaseAdmin.from("cotisations").select("montant").eq("campagne_id", campagneId),
          supabaseAdmin.from("depenses").select("montant").eq("campagne_id", campagneId),
          supabaseAdmin.from("dons").select("montant").eq("campagne_id", campagneId),
          supabaseAdmin.from("quetes").select("montant").eq("campagne_id", campagneId),
          supabaseAdmin.from("reunions").select("id, compte_rendu").eq("campagne_id", campagneId),
          supabaseAdmin.from("campagne_membres").select("id").eq("campagne_id", campagneId).eq("statut", "actif"),
          supabaseAdmin.from("campagnes").select("*").eq("id", campagneId).single(),
          supabaseAdmin.from("objectifs").select("*").eq("campagne_id", campagneId),
        ]);

        const tc = (cotisations.data || []).reduce((s: number, c: any) => s + Number(c.montant), 0);
        const td = (depenses.data || []).reduce((s: number, d: any) => s + Number(d.montant), 0);
        const tdon = (dons.data || []).reduce((s: number, d: any) => s + Number(d.montant), 0);
        const tq = (quetes.data || []).reduce((s: number, q: any) => s + Number(q.montant), 0);
        const objectif = Number(campagne.data?.objectif_global || 0);

        const objectifsText = (objectifs.data || []).map((o: any) => `${o.activite_nom || "Global"}: ${o.montant_cible}FCFA`).join(", ");
        const reunionsAvecCR = (reunions.data || []).filter((r: any) => r.compte_rendu).length;

        contextData = `[PRÉSIDENT - VUE D'ENSEMBLE] Fondation 18 Safar
Campagne: ${campagne.data?.nom || ""} (${campagne.data?.annee || ""}) | Objectif: ${objectif}FCFA

CHIFFRES:
- Cotisations: ${tc}FCFA (${(cotisations.data || []).length} ops)
- Dépenses: ${td}FCFA (${(depenses.data || []).length} ops)
- Dons: ${tdon}FCFA (${(dons.data || []).length} ops)
- Quêtes: ${tq}FCFA (${(quetes.data || []).length} ops)
- Solde: ${tc + tdon + tq - td}FCFA
- Objectif: ${fmtPct(tc + tdon + tq, objectif)} atteint
- Membres: ${(membresCampagne.data || []).length}
- Réunions: ${(reunions.data || []).length} (${reunionsAvecCR} avec CR)

OBJECTIFS: ${objectifsText || "Aucun"}`;
      }

      // ============================================================
      // TRÉSORIER : finances uniquement
      // ============================================================
      else if (isTresorier) {
        const [cotisationsAll, depensesAll, donsAll, quetesAll, campagne] = await Promise.all([
          supabaseAdmin.from("cotisations").select("*, membre:membres(nom,prenom)").eq("campagne_id", campagneId),
          supabaseAdmin.from("depenses").select("*").eq("campagne_id", campagneId),
          supabaseAdmin.from("dons").select("*").eq("campagne_id", campagneId),
          supabaseAdmin.from("quetes").select("*, collecteur:collecteurs(*, membre:membres(nom,prenom))").eq("campagne_id", campagneId),
          supabaseAdmin.from("campagnes").select("*").eq("id", campagneId).single(),
        ]);

        const cotisations = cotisationsAll.data || [];
        const depenses = depensesAll.data || [];
        const dons = donsAll.data || [];
        const quetes = quetesAll.data || [];

        const tc = cotisations.reduce((s: number, c: any) => s + Number(c.montant), 0);
        const td = depenses.reduce((s: number, d: any) => s + Number(d.montant), 0);
        const tdon = dons.reduce((s: number, d: any) => s + Number(d.montant), 0);
        const tq = quetes.reduce((s: number, q: any) => s + Number(q.montant), 0);
        const solde = tc + tdon + tq - td;
        const objectif = Number(campagne.data?.objectif_global || 0);

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

        contextData = `[TRÉSORIER - FINANCES] Campagne: ${campagne.data?.nom || ""} | Objectif: ${objectif}FCFA

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
        const [reunions, membresCampagne, campagne] = await Promise.all([
          supabaseAdmin.from("reunions").select("*").eq("campagne_id", campagneId).order("date_reunion", { ascending: false }),
          supabaseAdmin.from("campagne_membres").select("*, membre:membres(nom,prenom,sexe,telephone,numero_membre), groupe:groupes(nom)").eq("campagne_id", campagneId).eq("statut", "actif"),
          supabaseAdmin.from("campagnes").select("*").eq("id", campagneId).single(),
        ]);

        const membres = membresCampagne.data || [];

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

        contextData = `[SECRÉTAIRE - RÉUNIONS & MEMBRES] Campagne: ${campagne.data?.nom || ""}

MEMBRES (${membres.length}):
${Object.entries(membresByGroupe).map(([g, ms]) => `- ${g} (${ms.length}):\n  ${ms.join("\n  ")}`).join("\n") || "Aucun membre"}

RÉUNIONS (${(reunions.data || []).length}):
${(reunions.data || []).map((r: any) => `- ${r.titre || "Sans titre"} du ${new Date(r.date_reunion).toLocaleDateString("fr-FR")}${r.lieu ? ` à ${r.lieu}` : ""} ${r.compte_rendu ? "✅ CR dispo" : "❌ Pas de CR"}`).join("\n") || "Aucune réunion"}

---
REGISTRE DES NOMS (liste exhaustive - utilise UNIQUEMENT ces noms):
${[...allNames].map(n => `- ${n}`).join("\n") || "Aucun"}`;
      }

      // ============================================================
      // AUTRES RÔLES : données de base
      // ============================================================
      else {
        const [campagne, membresCampagne] = await Promise.all([
          supabaseAdmin.from("campagnes").select("*").eq("id", campagneId).single(),
          supabaseAdmin.from("campagne_membres").select("id").eq("campagne_id", campagneId).eq("statut", "actif"),
        ]);

        contextData = `[MEMBRE] Campagne: ${campagne.data?.nom || ""} (${campagne.data?.annee || ""})
Objectif: ${campagne.data?.objectif_global || 0}FCFA
Membres: ${(membresCampagne.data || []).length}
Statut: ${campagne.data?.statut || ""}`;
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

IMPORTANT - RÔLES:
- Les membres du bureau (président, trésorier, secrétaire, responsable) font PARTIE des membres de la campagne.
- Les administrateurs NE font PAS partie des membres de la campagne. Ce sont des comptes techniques avec accès complet, pas des membres actifs.

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
      max_tokens: 2048,
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
