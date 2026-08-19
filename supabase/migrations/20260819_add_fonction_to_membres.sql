-- Ajouter le champ fonction global au profil membre (pour les membres du bureau sans accès app,
-- ou tout membre ayant une fonction cumulée qui doit figurer partout)

alter table membres add column if not exists fonction text;
