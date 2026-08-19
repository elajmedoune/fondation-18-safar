import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Pencil } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { useRole } from '../../hooks/useRole.js';
import { membresService } from '../../services/membres.service.js';

const ROLE_LABELS = {
  membre: 'Membre',
  tresorier: 'Trésorier',
  secretaire: 'Secrétaire',
  president: 'Président',
  administrateur: 'Administrateur'
};

const inputCls = "w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm";

export default function MonProfil() {
  const { user, membre } = useAuth();
  const { roleNames } = useRole();
  const queryClient = useQueryClient();

  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [nom, setNom] = useState(membre?.nom || '');
  const [prenom, setPrenom] = useState(membre?.prenom || '');
  const [telephone, setTelephone] = useState(membre?.telephone || '');

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !membre) return;
    setUploading(true);
    setFeedback(null);
    try {
      const photo_url = await membresService.uploadPhoto(file, membre.id);
      await membresService.update(membre.id, { photo_url }, { userId: user.id });
      setFeedback({ type: 'success', message: 'Photo mise à jour.' });
      queryClient.invalidateQueries();
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: "Erreur lors de l'envoi de la photo." });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await membresService.update(membre.id, { nom, prenom, telephone: telephone || null }, { userId: user.id });
      setFeedback({ type: 'success', message: 'Profil mis à jour.' });
      setEditing(false);
      queryClient.invalidateQueries();
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: 'Erreur lors de la mise à jour.' });
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setNom(membre.nom); setPrenom(membre.prenom); setTelephone(membre.telephone || '');
    setEditing(false);
  };

  if (!membre) {
    return (
      <div className="max-w-md mx-auto rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-6 text-center">
        <p className="text-sm text-gray-500">
          Ce compte n'a pas de profil membre associé (compte administrateur technique).
        </p>
        <p className="text-sm text-gray-400 mt-2">{user?.email}</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Mon profil</h1>

      <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-6 text-center space-y-4">
        <div className="relative inline-block">
          {membre.photo_url ? (
            <img src={membre.photo_url} alt="" className="h-24 w-24 rounded-full object-cover mx-auto" />
          ) : (
            <div className="h-24 w-24 rounded-full bg-primary-700 text-white flex items-center justify-center text-2xl font-semibold mx-auto">
              {membre.prenom?.[0]}{membre.nom?.[0]}
            </div>
          )}
          <label className="absolute bottom-0 right-0 h-8 w-8 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
            <Camera size={14} className="text-gray-600 dark:text-gray-300" />
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={uploading} />
          </label>
        </div>

        {!editing ? (
          <div>
            <p className="font-semibold text-lg text-gray-900 dark:text-white">{membre.prenom} {membre.nom}</p>
            <p className="text-sm text-gray-500">N° {membre.numero_membre}</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-2 text-left">
            <input value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Prénom" required className={inputCls} />
            <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" required className={inputCls} />
            <input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Téléphone" className={inputCls} />
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={cancelEdit} className="flex-1 rounded-xl border border-gray-300 dark:border-gray-700 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800">
                Annuler
              </button>
              <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-primary-700 text-white py-2 text-sm font-medium hover:bg-primary-800 disabled:opacity-50">
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap justify-center gap-1.5">
          {roleNames.map((r) => (
            <span key={r} className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
              {ROLE_LABELS[r] || r}
            </span>
          ))}
        </div>

        {uploading && <p className="text-xs text-gray-500">Envoi de la photo...</p>}
        {feedback && (
          <p className={`text-sm ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{feedback.message}</p>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-500">Informations</h2>
          {!editing && (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs font-medium text-primary-700 dark:text-primary-400 hover:underline">
              <Pencil size={12} /> Modifier
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <span className="text-gray-500">Email</span>
          <span className="col-span-2 text-gray-900 dark:text-white">{user?.email}</span>
          <span className="text-gray-500">Téléphone</span>
          <span className="col-span-2 text-gray-900 dark:text-white">{membre.telephone || '—'}</span>
        </div>
      </div>
    </div>
  );
}