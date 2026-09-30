import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCampagneContext } from '../../contexts/CampagneContext.jsx';
import { membresService } from '../../services/membres.service.js';
import CarteMembre from '../../components/membres/CarteMembre.jsx';
import { CreditCard, AlertCircle } from 'lucide-react';

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
            <div key={f.id ?? `${f.membre?.id}-${i}`} className="w-full sm:w-[calc(50%-12px)] flex flex-col items-center gap-2">
              {/* Etiquette devant chaque carte a imprimer : sans elle on
                  risque de remettre une carte en main a un membre qui ne l'a
                  pas achetee. */}
              <span
                title={f.membre?.carte_vendue
                  ? 'Carte achetee : membre officiel'
                  : "Carte NON achetee : ne pas remettre de carte"}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
                  f.membre?.carte_vendue
                    ? 'border-emerald-300/70 bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-800 dark:border-emerald-700 dark:from-emerald-900/40 dark:to-emerald-800/30 dark:text-emerald-300'
                    : 'border-dashed border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700/80 dark:bg-amber-950/40 dark:text-amber-400'
                }`}
              >
                {f.membre?.carte_vendue
                  ? <CreditCard className="h-3 w-3 shrink-0" strokeWidth={2.5} />
                  : <AlertCircle className="h-3 w-3 shrink-0" />}
                {f.membre?.carte_vendue ? 'Carte achetée' : "N'a pas acheté sa carte — ne pas imprimer"}
              </span>
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