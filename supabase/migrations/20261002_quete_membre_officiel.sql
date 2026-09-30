-- ============================================================================
-- MEMBRE OFFICIEL : EXTENSION AUX QUETES
-- ============================================================================
-- Meme regle que les cotisations : une quete est realisee par un membre, via
-- collecteurs.membre_id. Ce collecteur doit donc detenir une carte.
-- Aucune donnee existante n'est modifiee : seules les nouvelles quetes sont
-- controlees.
-- ============================================================================

create or replace function refuser_quete_sans_carte()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- une quete sans collecteur n'implique aucun membre : rien a verifier
  if new.collecteur_id is not null and not exists (
    select 1
    from collecteurs c
    join membres m on m.id = c.membre_id
    where c.id = new.collecteur_id and m.carte_vendue
  ) then
    raise exception 'Membre non officiel : carte non achetee, quete impossible'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_quete_exige_carte on quetes;

create trigger trg_quete_exige_carte
  before insert or update of collecteur_id on quetes
  for each row execute function refuser_quete_sans_carte();
