import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { useCampagneContext } from '../../contexts/CampagneContext.jsx';
import { membresService } from '../../services/membres.service.js';
import CarteMembre from '../../components/membres/CarteMembre.jsx';

export default function MaCarte() {
  const { membre } = useAuth();
  const { campagneActive } = useCampagneContext();
  const [fiche, setFiche] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!membre?.id || !campagneActive?.id) { setLoading(false); return; }
    membresService.getFicheMembre(membre.id, campagneActive.id)
      .then(setFiche)
      .finally(() => setLoading(false));
  }, [membre?.id, campagneActive?.id]);

  if (!membre) return <p className="text-sm text-gray-500">Profil membre introuvable.</p>;
  if (loading) return <p className="text-sm text-gray-500 text-center">Chargement de la carte...</p>;

  const cm = fiche?.campagne_membres?.[0];

  return (
    <div className="max-w-sm mx-auto">
      <CarteMembre membre={membre} groupeNom={cm?.groupe?.nom} fonction={cm?.fonction} annee={campagneActive?.annee} />
    </div>
  );
}