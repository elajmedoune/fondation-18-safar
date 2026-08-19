# Fondation 18 Safar

Application web (PWA) de gestion de la Fondation autour de l'événement annuel du 18 Safar.
React + Vite + Tailwind CSS + Supabase.

## Démarrage

```bash
npm install
cp .env.example .env   # renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm run dev
```

## Base de données

Le schéma complet (tables, RLS, fonctions) est dans `supabase/schema.sql`.
À exécuter dans l'éditeur SQL de votre projet Supabase.

Il inclut une table `system_heartbeat` + fonction `fn_ping_heartbeat()` : à appeler
via un cron externe (GitHub Actions par ex.) toutes les quelques jours pour éviter
la mise en pause automatique du projet Supabase Free après 7 jours d'inactivité.

## Structure

- `src/contexts/` — Auth, Thème (clair/sombre), Campagne active
- `src/routes/` — routing + gardes d'accès (`ProtectedRoute`, `RoleRoute`)
- `src/constants/navConfig.js` — navigation adaptée par rôle (bottom nav mobile)
- `src/pages/` — une page par écran, organisées par domaine
- `src/services/` — appels Supabase regroupés par domaine (voir `membres.service.js`)

## État actuel

Squelette fonctionnel : auth, routing, navigation par rôle, thème, sélecteur de
campagne, page "Ma carte" avec QR code. Les pages métier (finances, réunions,
groupes, admin...) sont en placeholder — à brancher aux services Supabase.

## À faire ensuite

- Brancher chaque page placeholder à son service Supabase (React Query)
- Scanner QR fonctionnel (`@zxing/browser`) avec actions contextuelles par rôle
- Formulaires finances (cotisations, dons, quêtes, dépenses)
- Tableau de bord avec vraies statistiques (vue `v_recettes`)
