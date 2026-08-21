import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCampagneContext } from '../../contexts/CampagneContext.jsx';
import { membresService } from '../../services/membres.service.js';
import CarteMembre from '../../components/membres/CarteMembre.jsx';

export default function CartesMembres() {
  const { campagneActive } = useCampagneContext();
  const queryClient = useQueryClient();

  const queryKey = ['cartes-membres', campagneActive?.id];

  const { data: fiches = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => membresService.getByCampagneAvecRoles(campagneActive.id),
    enabled: !!campagneActive?.id
  });

  const handlePhotoUpdated = (membreId, photo_url) => {
    queryClient.setQueryData(queryKey, (old = []) =>
      old.map((f) => (f.membre?.id === membreId ? { ...f, membre: { ...f.membre, photo_url } } : f))
    );
  };

  if (!campagneActive) return <p className="text-sm text-gray-500">Aucune campagne active.</p>;
  if (isLoading) return <p className="text-sm text-gray-500">Chargement des cartes...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Cartes des membres — {campagneActive.annee}</h1>

      {fiches.length === 0 ? (
        <p className="text-sm text-gray-500">Aucun membre pour cette campagne.</p>
      ) : (
        <div className="flex flex-wrap gap-6 justify-center items-start">
          {fiches.map((f, i) => (
            <div key={f.id ?? `${f.membre?.id}-${i}`} className="w-full sm:w-[calc(50%-12px)] flex justify-center">
              <CarteMembre
                membre={f.membre}
                groupeNom={f.groupe?.nom}
                fonction={f.fonctionAffichee}
                annee={campagneActive.annee}
                onPhotoUpdated={handlePhotoUpdated}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}