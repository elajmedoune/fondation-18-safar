import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Wallet, Banknote, Calendar, Pencil, Trash2, Search, Filter } from 'lucide-react';
import { useCampagneContext } from '../../contexts/CampagneContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useRole } from '../../hooks/useRole.js';
import { membresService } from '../../services/membres.service.js';
import { bustCache } from '../../lib/bustCache.js';
import { cotisationsService } from '../../services/cotisations.service.js';
import { invalidateAll } from '../../lib/invalidateAll.js';
import { preloadPhotos, drawCirclePhoto } from '../../lib/pdfPhoto.js';
import {
  INDEX_PHOTO, COLUMN_STYLES, STYLES, HEAD_STYLES,
  MARGES, ALTERNATE_ROW_STYLES, buildHead, TAILLE_PHOTO
} from '../../lib/pdfTableLayout.js';
import usePersistedState from '../../hooks/usePersistedState.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import ExportMenu from '../../components/ui/ExportMenu.jsx';

const MODES_PAIEMENT = [
  { value: 'especes', label: 'Espèces' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'virement', label: 'Virement' },
  { value: 'cheque', label: 'Chèque' },
  { value: 'autre', label: 'Autre' }
];

function formatFCFA(n) {
  return new Intl.NumberFormat('fr-FR').format(Number(n || 0)) + ' FCFA';
}

function formatFCFApdf(n) {
  // On formate a la main (sans Intl/toLocaleString) car les separateurs de
  // milliers renvoyes par la locale fr-FR (espace insecable fine, \u202F)
  // ne sont pas geres par la police standard de jsPDF : ils s'affichaient
  // comme un "/" et decalaient l'espacement de tout le texte.
  const num = Math.round(Number(n) || 0);
  const withSpaces = Math.abs(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (num < 0 ? '-' : '') + withSpaces + ' FCFA';
}

function getObjectifMembre(sexe, campagne) {
  return sexe === 'feminin' ? Number(campagne?.cotisation_femme || 0) : Number(campagne?.cotisation_homme || 0);
}

function getMonthLabel(yyyymm) {
  if (!yyyymm || yyyymm === 'Non daté') return 'Non daté';
  const [y, m] = yyyymm.split('-');
  const date = new Date(Number(y), Number(m) - 1);
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function loadLogoBase64() {
  try {
    const res = await fetch('/logo.jpeg');
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

const inputCls = "rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 w-full focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all";
const selectCls = "rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 w-full focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all";

export default function Cotisations() {
  const { campagneActive: ca } = useCampagneContext();
  const { user } = useAuth();
  const { hasRole } = useRole();
  // Consultation + export pour tous ; saisie/modification/suppression réservées au trésorier et à l'admin
  const canManage = hasRole(['tresorier', 'administrateur']);
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = usePersistedState('cot-showForm', false);
  const [query, setQuery] = usePersistedState('cot-query', '');
  const [resultats, setResultats] = useState([]);
  // Membres trouvés par la recherche mais dont la carte n'a pas été achetée :
  // sans ce message, taper leur nom donne une liste vide sans explication.
  const [sansCarte, setSansCarte] = useState([]);
  const [membreSelectionne, setMembreSelectionne] = usePersistedState('cot-membre', null);
  const [montant, setMontant] = usePersistedState('cot-montant', '');
  const [modePaiement, setModePaiement] = usePersistedState('cot-mode', 'especes');
  const [moisCotisation, setMoisCotisation] = usePersistedState('cot-mois', getCurrentMonth());
  const [note, setNote] = usePersistedState('cot-note', '');
  // Filtres de la liste. Discrets mais suffisants : un tresorier cherche
  // toujours "le mois de X" ou "qui doit encore payer".
  // Defaut : le mois en cours. C'est la question que le tresorier se pose en
  // premier ("qu'ai-je encaisse ce mois-ci ?"). Un defaut "tous les mois" oblige
  // a aller chercher le mois dans le filtre a chaque consultation.
  // La cle change : l'ancienne contenait deja "" (l'ancien defaut), memorise dans
  // le navigateur, qui primerait sur le nouveau defaut.
  const [filtreMois, setFiltreMois] = usePersistedState('cot-fmois-defaut', getCurrentMonth());
  const [filtreObjectif, setFiltreObjectif] = usePersistedState('cot-fobj', 'tous');
  const [filtreTexte, setFiltreTexte] = usePersistedState('cot-ftexte', '');
  const [showFilters, setShowFilters] = usePersistedState('cot-showFilters', false);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [editing, setEditing] = useState(null);
  const [editMontant, setEditMontant] = useState('');
  const [editMode, setEditMode] = useState('especes');
  const [editMois, setEditMois] = useState('');
  const [editNote, setEditNote] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);


  const invalidate = () => {
    invalidateAll(queryClient);
  };

  const { data: cotisations = [], isLoading: loadingList } = useQuery({
    queryKey: ['cotisations', ca?.id],
    queryFn: () => cotisationsService.listByCampagne(ca.id),
    enabled: !!ca
  });

  const { data: total = 0 } = useQuery({
    queryKey: ['cotisations-total', ca?.id],
    queryFn: () => cotisationsService.totalByCampagne(ca.id),
    enabled: !!ca
  });

  const { data: allCotisations = [] } = useQuery({
    queryKey: ['cotisations-all', ca?.id],
    queryFn: () => cotisationsService.listAllByCampagne(ca.id),
    enabled: !!ca
  });

  // Cumul par membre : c'est ce qui permet de repondre a "a-t-il atteint son
  // objectif ?", la page ne listant que des paiements.
  const cumulParMembre = useMemo(() => {
    const map = {};
    for (const c of allCotisations) {
      if (!c.membre_id) continue;
      map[c.membre_id] = (map[c.membre_id] || 0) + Number(c.montant || 0);
    }
    return map;
  }, [allCotisations]);

  const filtreActif = filtreMois !== '' || filtreObjectif !== 'tous' || filtreTexte.trim() !== '';
  // Mois en cours vide : le defaut ne doit pas laisser croire a une perte de
  // donnees. On propose de revenir a la vue complete.
  const moisCourantVide = filtreMois === getCurrentMonth() && cotisationsFiltrees.length === 0 && allCotisations.length > 0;
  // La recherche texte reste dans la barre, elle est un usage different d'un
  // filtre : elle se tape en continu. Le compteur ne compte que les deux
  // vrais filtres.
  // Le mois courant est la vue par defaut, pas un filtre : le compter ferait
  // afficher "1 filtre actif" en permanence. Il est compte des que la vue
  // quitte le mois en cours.
  const moisEstDefaut = filtreMois === '' || filtreMois === getCurrentMonth();
  const activeFilterCount = (moisEstDefaut ? 0 : 1) + (filtreObjectif !== 'tous' ? 1 : 0);

  // Fonction partagee : l'ecran affiche `cotisations` (50 derniers paiements)
  // et les exports utilisent `allCotisations`. Sans le meme filtre sur les
  // deux, l'ecran et le PDF montreraient des choses differentes.
  const appliquerFiltres = useCallback((list) => {
    let out = list;
    if (filtreMois) {
      out = out.filter((c) => (c.mois_cotisation || c.date_paiement?.slice(0, 7) || 'Non daté') === filtreMois);
    }
    const terme = filtreTexte.trim().toLowerCase();
    if (terme) {
      out = out.filter((c) => {
        const m = c.membre;
        return (
          (m?.nom || '').toLowerCase().includes(terme) ||
          (m?.prenom || '').toLowerCase().includes(terme) ||
          (m?.numero_membre || '').toLowerCase().includes(terme) ||
          (c.lieu || '').toLowerCase().includes(terme) ||
          (c.note || '').toLowerCase().includes(terme)
        );
      });
    }
    if (filtreObjectif !== 'tous') {
      out = out.filter((c) => {
        const objectif = getObjectifMembre(c.membre?.sexe, ca);
        const cumul = cumulParMembre[c.membre_id] || 0;
        // Sans objectif renseigne (campagne non configuree), on ne classe pas.
        if (objectif <= 0) return true;
        return filtreObjectif === 'atteint' ? cumul >= objectif : cumul < objectif;
      });
    }
    return out;
  }, [filtreMois, filtreObjectif, filtreTexte, cumulParMembre, ca]);

  const cotisationsFiltrees = useMemo(() => appliquerFiltres(allCotisations), [appliquerFiltres, allCotisations]);
  const cotisationsAffichees = useMemo(() => appliquerFiltres(cotisations), [appliquerFiltres, cotisations]);

  const totalFiltre = useMemo(
    () => cotisationsFiltrees.reduce((s, r) => s + Number(r.montant || 0), 0),
    [cotisationsFiltrees]
  );

  const cotisationsParMois = useMemo(() => {
    const map = {};
    cotisationsFiltrees.forEach((c) => {
      const key = c.mois_cotisation || c.date_paiement?.slice(0, 7) || 'Non daté';
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    // A l'interieur d'un mois : du premier cotisant au dernier (ordre
    // chronologique), pour que la lecture de l'export suive la saisie.
    Object.values(map).forEach((rows) => {
      rows.sort((a, b) => {
        const da = a.date_paiement || a.created_at || '';
        const db = b.date_paiement || b.created_at || '';
        if (da !== db) return da < db ? -1 : 1;
        return (a.created_at || '') < (b.created_at || '') ? -1 : 1;
      });
    });
    // Ordre chronologique des mois : le plus ancien en haut. Le tri etait
    // decroissant, ce qui inversait l'ordre des cotisations dans les exports.
    return Object.entries(map).sort(([a], [b]) => {
      if (a === 'Non daté') return 1;
      if (b === 'Non daté') return -1;
      return a < b ? -1 : a > b ? 1 : 0;
    });
  }, [cotisationsFiltrees]);

  const resetForm = () => { setMembreSelectionne(null); setQuery(''); setSansCarte([]); setMontant(''); setModePaiement('especes'); setMoisCotisation(getCurrentMonth()); setNote(''); setFeedback(null); };

  const handleSearch = async (e) => {
    const value = e.target.value;
    setQuery(value);
    setMembreSelectionne(null);
    if (value.trim().length < 2) { setResultats([]); setSansCarte([]); return; }
    setSearching(true);
    try {
      // Seuls les membres ayant acheté leur carte peuvent cotiser : c'est la
      // règle appliquée par le trigger en base (trg_cotisation_exige_carte).
      const res = await membresService.searchInCampagne(ca.id, value, 8, true);
      setResultats(res);
      if (res.length === 0) {
        // Aucun officiel trouvé : on cherche sans filtre pour distinguer
        // « personne de ce nom » de « trouvé, mais pas de carte ».
        const tous = await membresService.searchInCampagne(ca.id, value, 8, false);
        setSansCarte(tous.filter((m) => !m.carte_vendue));
      } else {
        setSansCarte([]);
      }
    } catch (err) { console.error(err); } finally { setSearching(false); }
  };

  const selectMembre = (m) => { setMembreSelectionne(m); setResultats([]); setQuery(`${m.prenom} ${m.nom} — ${m.numero_membre}`); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!membreSelectionne || !montant || Number(montant) <= 0) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await cotisationsService.create({
        campagneId: ca.id, membreId: membreSelectionne.id, montant: Number(montant),
        modePaiement, note: note || null, userId: user.id, moisCotisation: moisCotisation || null
      });
      setFeedback({ type: 'success', message: `Cotisation de ${formatFCFA(montant)} enregistrée.` });
      resetForm();
      invalidate();
    } catch (err) { console.error(err); setFeedback({ type: 'error', message: "Erreur lors de l'enregistrement." }); }
    finally { setSubmitting(false); }
  };

  const startEdit = (c) => {
    setEditing(c);
    setEditMontant(c.montant);
    setEditMode(c.mode_paiement || 'especes');
    setEditMois(c.mois_cotisation || '');
    setEditNote(c.note || '');
  };

  const handleSaveEdit = async () => {
    if (!editMontant || Number(editMontant) <= 0) return;
    setSavingEdit(true);
    try {
      await cotisationsService.update(editing.id, {
        montant: Number(editMontant),
        modePaiement: editMode,
        moisCotisation: editMois || null,
        note: editNote || null
      }, { userId: user.id, campagneId: ca.id });
      setEditing(null);
      invalidate();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la modification.");
    } finally { setSavingEdit(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette cotisation ?')) return;
    try {
      await cotisationsService.remove(id, { userId: user.id, campagneId: ca.id });
      invalidate();
    } catch (err) { console.error(err); alert("Erreur lors de la suppression."); }
  };

  // Colonne 0 = photo circulaire, dessinée via didDrawCell (voir drawTable).
  const buildTableRows = (rows) => rows.map((c, i) => [
    '',
    i + 1,
    `${c.membre?.prenom} ${c.membre?.nom}`,
    c.membre?.numero_membre || '',
    formatFCFApdf(c.montant),
    MODES_PAIEMENT.find((m) => m.value === c.mode_paiement)?.label || '',
    c.date_paiement ? new Date(c.date_paiement).toLocaleDateString('fr-FR') : '',
    c.note || ''
  ]);

  // Clé de ligne : deux cotisations du même membre ne doivent pas partager la
  // même entrée de cache, sinon la seconde hériterait de la photo de la
  // première après un changement.
  const photoKey = (c) => c.id;

  // Les largeurs de colonnes vivent dans src/lib/pdfTableLayout.js, importées
  // par ce composant ET par scripts/generate-test-pdf.mjs : le PDF de test ne
  // peut donc pas diverger du PDF réellement produit.


  /**
   * Construit la configuration autoTable et dessine les photos circulaires.
   * Les photos sont chargées avant l'appel : le rendu de didDrawCell est
   * synchrone, on ne peut donc pas déclencher un fetch pendant le tracé.
   *
   * L'en-tête de la colonne photo est vide (et non "Photo") : la cellule reste
   * peinte comme les autres, donc la bande verte est continue, mais aucun mot
   * n'est écrit sur 10 mm. Les mots d'en-tête sont volontairement courts pour
   * tenir sur une seule ligne.
   */
  const buildTableConfig = async (rows, head, { startY }) => {
    const photos = await preloadPhotos(rows, photoKey, (c) => c.membre?.photo_url);
    const body = buildTableRows(rows);
    // Les photos sont indexées par identité du tableau de ligne (WeakMap) et
    // non par numéro de ligne : data.row.raw est l'instance exacte passée à
    // autoTable, alors que data.row.index disparaît quand une ligne est
    // coupée par un saut de page — cas réel dans l'export global, où les
    // derniers mois démarrent près du bas de page.
    const photoParLigne = new WeakMap();
    rows.forEach((c, i) => photoParLigne.set(body[i], photos.get(photoKey(c))));

    return {
      startY,
      head: buildHead(head),
      body,
      styles: STYLES,
      headStyles: HEAD_STYLES,
      alternateRowStyles: ALTERNATE_ROW_STYLES,
      margin: MARGES,
      columnStyles: COLUMN_STYLES,
      didDrawCell: (data) => {
        if (data.section !== 'body' || data.column.index !== INDEX_PHOTO) return;
        const { x, y, width, height } = data.cell;
        // On lit le nom dans data.row.raw et non dans rows[data.row.index] :
        // quand une ligne est coupée par un saut de page, autoTable la
        // réimprime sans "index", et l'indexation renvoyait undefined (puis
        // une TypeError sur .membre, qui cassait l'export entier).
        const nomComplet = String(data.row?.raw?.[2] || '').trim();
        const initiales = nomComplet
          .split(/\s+/)
          .slice(0, 2)
          .map((mot) => mot[0] || '')
          .join('')
          .toUpperCase();
        // Borné par la hauteur de ligne : c'est elle qui fixe le diamètre réel.
        const d = Math.min(width - 2, height - 2, TAILLE_PHOTO);
        drawCirclePhoto(
          data.doc,
          x + (width - d) / 2,
          y + (height - d) / 2,
          d,
          photoParLigne.get(data.row?.raw),
          initiales
        );
      }
    };
  };

  const renderPdfFooter = (doc, caNom) => {
    for (let i = 1; i <= doc.internal.getNumberOfPages(); i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(150);
      doc.text(`Fondation 18 Safar - ${caNom || ''}`, 14, doc.internal.pageSize.height - 10);
      doc.text(`Page ${i}/${doc.internal.getNumberOfPages()}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
    }
  };

  const addLogoToDoc = (doc, logo) => {
    if (logo) { try { doc.addImage(logo, 'JPEG', 178, 10, 18, 18); } catch {} }
  };

  const handleExportAllPDF = async () => {
    const [logo, { default: jsPDF }, { default: autoTable }] = await Promise.all([
      loadLogoBase64(), import('jspdf'), import('jspdf-autotable')
    ]);

    // L'export suit les filtres : un PDF qui sort des chiffres Different de
    // l'ecran envoie le tresorier dans de mauvaises directions.
    const totalAll = totalFiltre;
    const doc = new jsPDF();

    addLogoToDoc(doc, logo);
    doc.setFontSize(16); doc.setTextColor(15, 118, 110);
    doc.text(`Cotisations - ${ca.nom || ca.annee}`, 14, 18);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`${cotisationsFiltrees.length} cotisation(s) - Total : ${formatFCFApdf(totalAll)}`, 14, 25);
    doc.setDrawColor(15, 118, 110); doc.setLineWidth(0.5); doc.line(14, 30, 196, 30);

    let startY = 40;
    // Boucle for...of et non forEach : le chargement des photos est asynchrone
    // (await), impossible dans un callback synchrone.
    for (const [mois, rows] of cotisationsParMois) {
      const moisTotal = rows.reduce((s, r) => s + Number(r.montant), 0);
      if (startY > 250) { doc.addPage(); startY = 15; }
      doc.setFontSize(11); doc.setTextColor(15, 118, 110);
      doc.text(`${getMonthLabel(mois)} - ${formatFCFApdf(moisTotal)} (${rows.length})`, 14, startY);
      startY += 2;

      autoTable(doc, await buildTableConfig(
        rows,
        ['#', 'Membre', 'N°', 'Montant', 'Mode', 'Date', 'Note'],
        { startY }
      ));
      startY = doc.lastAutoTable.finalY + 8;
    }

    renderPdfFooter(doc, ca.nom);
    doc.save(`cotisations-${ca.annee}.pdf`);
  };

  const handleExportMonthPDF = async (mois, rows) => {
    const [logo, { default: jsPDF }, { default: autoTable }] = await Promise.all([
      loadLogoBase64(), import('jspdf'), import('jspdf-autotable')
    ]);

    const moisTotal = rows.reduce((s, r) => s + Number(r.montant), 0);
    const doc = new jsPDF();

    addLogoToDoc(doc, logo);
    doc.setFontSize(16); doc.setTextColor(15, 118, 110);
    doc.text(`Cotisations - ${getMonthLabel(mois)}`, 14, 18);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`Campagne ${ca.nom || ca.annee} - ${rows.length} cotisation(s) - Total : ${formatFCFApdf(moisTotal)}`, 14, 25);
    doc.setDrawColor(15, 118, 110); doc.setLineWidth(0.5); doc.line(14, 30, 196, 30);

    autoTable(doc, await buildTableConfig(
      rows,
      // "Date" et non "Date paiement" : l'en-tête complet ne tient pas dans
      // la largeur de colonne et serait coupé caractère par caractère.
      ['#', 'Membre', 'N°', 'Montant', 'Mode', 'Date', 'Note'],
      { startY: 32 }
    ));

    renderPdfFooter(doc, ca.nom);
    const slug = mois === 'Non daté' ? 'non-date' : mois;
    doc.save(`cotisations-${slug}.pdf`);
  };

  const handleExportMonthExcel = async (mois, rows) => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows.map((c, i) => ({
      '#': i + 1,
      'Membre': `${c.membre?.prenom} ${c.membre?.nom}`,
      'N° membre': c.membre?.numero_membre,
      'Montant': Number(c.montant),
      'Mode': MODES_PAIEMENT.find((m) => m.value === c.mode_paiement)?.label || '',
      'Date paiement': c.date_paiement ? new Date(c.date_paiement).toLocaleDateString('fr-FR') : '',
      'Note': c.note || ''
    })));
    ws['!cols'] = [{ wch: 4 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, getMonthLabel(mois).slice(0, 31));
    const slug = mois === 'Non daté' ? 'non-date' : mois;
    XLSX.writeFile(wb, `cotisations-${slug}.xlsx`);
  };

  const handleExportAllExcel = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    cotisationsParMois.forEach(([mois, rows]) => {
      const ws = XLSX.utils.json_to_sheet(rows.map((c, i) => ({
        '#': i + 1,
        'Membre': `${c.membre?.prenom} ${c.membre?.nom}`,
        'N°': c.membre?.numero_membre,
        'Montant': Number(c.montant),
        'Mode': MODES_PAIEMENT.find((m) => m.value === c.mode_paiement)?.label || '',
        'Date': c.date_paiement ? new Date(c.date_paiement).toLocaleDateString('fr-FR') : '',
        'Note': c.note || ''
      })));
      ws['!cols'] = [{ wch: 4 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 }];
      const label = mois === 'Non daté' ? 'Non daté' : getMonthLabel(mois).slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, label);
    });

    XLSX.writeFile(wb, `cotisations-${ca.annee}.xlsx`);
  };

  if (!ca) return <p className="text-sm text-gray-500">Aucune campagne active.</p>;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cotisations"
        subtitle={`${cotisationsFiltrees.length} cotisation${cotisationsFiltrees.length !== 1 ? 's' : ''} · Total ${formatFCFA(filtreActif ? totalFiltre : total)}`}
        action={
          <div className={`grid gap-2 w-full sm:flex sm:w-auto sm:flex-wrap sm:items-center ${canManage ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <ExportMenu
              label="PDF"
              wrapperClassName="relative"
              buttonClassName="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-800 px-2.5 sm:px-3 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
              menuWidth={224}
              items={[
                { label: 'Tous les mois', onClick: handleExportAllPDF, bold: true },
                ...cotisationsParMois.map(([mois, rows]) => ({
                  label: <>{getMonthLabel(mois)} <span className="text-gray-400 text-xs">({rows.length})</span></>,
                  onClick: () => handleExportMonthPDF(mois, rows)
                }))
              ]}
            />
            <ExportMenu
              label="Excel"
              wrapperClassName="relative"
              buttonClassName="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-800 px-2.5 sm:px-3 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
              menuWidth={224}
              items={[
                { label: 'Tous les mois', onClick: handleExportAllExcel, bold: true },
                ...cotisationsParMois.map(([mois, rows]) => ({
                  label: <>{getMonthLabel(mois)} <span className="text-gray-400 text-xs">({rows.length})</span></>,
                  onClick: () => handleExportMonthExcel(mois, rows)
                }))
              ]}
            />
            {canManage && (
              <button onClick={() => { setShowForm(!showForm); resetForm(); }} className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-700 text-white px-2.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold hover:bg-primary-800 shadow-sm shadow-primary-700/20 transition-all">
                {showForm ? <X className="h-4 w-4 shrink-0" /> : <Plus className="h-4 w-4 shrink-0" />}
                <span>{showForm ? 'Annuler' : 'Nouvelle'}</span>
              </button>
            )}
          </div>
        }
      />

      {/* Stats */}
      {cotisationsFiltrees.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              Total{filtreActif ? ' (filtré)' : ''}
            </p>
            <p className="text-lg font-bold text-green-600 mt-1">{formatFCFA(filtreActif ? totalFiltre : total)}</p>
          </div>
          <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Cotisants</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{new Set(cotisationsFiltrees.map(c => c.membre_id)).size}</p>
          </div>
          <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Moyenne</p>
            <p className="text-lg font-bold text-primary-600 mt-1">{formatFCFA(new Set(cotisationsFiltrees.map(c => c.membre_id)).size > 0 ? (filtreActif ? totalFiltre : total) / new Set(cotisationsFiltrees.map(c => c.membre_id)).size : 0)}</p>
          </div>
        </div>
      )}

      {showForm && canManage && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-5 space-y-3 shadow-sm">
          <div className="relative">
            <label className="text-xs text-gray-500 font-medium">Membre</label>
            <input type="text" value={query} onChange={handleSearch} placeholder="Nom, prénom, n° membre ou téléphone..." className={`mt-1.5 ${inputCls}`} />
            {searching && <p className="text-xs text-gray-500 mt-1">Recherche...</p>}
            {resultats.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl max-h-56 overflow-auto">
                {resultats.map((m) => (
                  <li key={m.id}><button type="button" onClick={() => selectMembre(m)} className="w-full text-left px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm transition-colors">
                    {m.prenom} {m.nom} <span className="text-gray-500">— {m.numero_membre}</span>
                    {m.telephone && <span className="text-gray-400 text-xs ml-1">· {m.telephone}</span>}
                  </button></li>
                ))}
              </ul>
            )}
          </div>
            {sansCarte.length > 0 && (
              <div className="mt-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-3 py-2">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  {sansCarte.length} membre(s) sans carte achetée
                </p>
                {sansCarte.map((m) => (
                  <p key={m.id} className="text-xs text-amber-700 dark:text-amber-400">
                    {m.prenom} {m.nom} <span className="opacity-70">— {m.numero_membre}</span>
                  </p>
                ))}
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  Pas de cotisation possible : un membre doit avoir acheté sa carte.
                </p>
              </div>
            )}
          {membreSelectionne && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input type="number" min="1" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="Montant (FCFA)" required className={inputCls} />
                <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)} className={selectCls}>
                  {MODES_PAIEMENT.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <input type="month" value={moisCotisation} onChange={(e) => setMoisCotisation(e.target.value)} className={inputCls} title="Mois couvert par cette cotisation" />
              </div>
              <p className="text-xs text-gray-400 -mt-1">Le mois couvert permet de pointer une cotisation en retard.</p>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optionnel)" className={inputCls} />
              <button type="submit" disabled={submitting} className="w-full rounded-xl bg-primary-700 text-white py-2.5 text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 shadow-sm shadow-primary-700/20 transition-all">
                {submitting ? 'Enregistrement...' : 'Enregistrer la cotisation'}
              </button>
            </>
          )}
          {feedback && <p className={`text-sm ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{feedback.message}</p>}
        </form>
      )}

      {editing && canManage && (
        <div className="rounded-2xl border border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/20 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary-800 dark:text-primary-300 truncate">Modifier — {editing.membre?.prenom} {editing.membre?.nom}</h3>
            <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 shrink-0"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input type="number" min="1" value={editMontant} onChange={(e) => setEditMontant(e.target.value)} className={inputCls} />
            <select value={editMode} onChange={(e) => setEditMode(e.target.value)} className={selectCls}>
              {MODES_PAIEMENT.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <input type="month" value={editMois} onChange={(e) => setEditMois(e.target.value)} className={inputCls} />
          </div>
          <input type="text" value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Note (optionnel)" className={inputCls} />
          <button onClick={handleSaveEdit} disabled={savingEdit} className="w-full rounded-xl bg-primary-700 text-white py-2.5 text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 shadow-sm shadow-primary-700/20 transition-all">
            {savingEdit ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>
        </div>
      )}

      {/* Meme presentation que la page Membres : un bouton qui ouvre un
          panneau. La recherche reste dans la barre de titre, un filtre ne se
          tape pas en continu. */}
      {allCotisations.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={filtreTexte}
              onChange={(e) => setFiltreTexte(e.target.value)}
              placeholder="Rechercher un membre, un lieu, une note..."
              className={`w-full pl-10 pr-9 rounded-xl border bg-white/70 dark:bg-gray-900/50 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all ${
                filtreTexte
                  ? 'border-primary-300 dark:border-primary-700 focus:ring-primary-500/40'
                  : 'border-gray-200 dark:border-gray-800 focus:border-primary-400'
              }`}
            />
            {filtreTexte && (
              <button
                onClick={() => setFiltreTexte('')}
                title="Effacer la recherche"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all shrink-0 ${
              showFilters || activeFilterCount > 0
                ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                : 'border-gray-200 dark:border-gray-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filtres
            {activeFilterCount > 0 && (
              <span className="ml-0.5 h-4 w-4 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
        </div>
      )}

      {showFilters && allCotisations.length > 0 && (
        <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Filtres avancés</span>
            {activeFilterCount > 0 && (
              <button onClick={() => { setFiltreMois(getCurrentMonth()); setFiltreObjectif('tous'); }} className="text-xs text-primary-600 hover:underline">
                Tout effacer
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-gray-500">Mois de cotisation</span>
              <select
                value={filtreMois}
                onChange={(e) => setFiltreMois(e.target.value)}
                className={`mt-1 text-xs py-2 ${selectCls} ${
                  filtreMois ? 'border-primary-300 dark:border-primary-700' : ''
                }`}
              >
                <option value="">Tous les mois</option>
                {cotisationsParMois.map(([mois, rows]) => (
                  <option key={mois} value={mois}>{getMonthLabel(mois)} ({rows.length})</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">Objectif du membre</span>
              <select
                value={filtreObjectif}
                onChange={(e) => setFiltreObjectif(e.target.value)}
                className={`mt-1 text-xs py-2 ${selectCls} ${
                  filtreObjectif !== 'tous' ? 'border-primary-300 dark:border-primary-700' : ''
                }`}
              >
                <option value="tous">Tous</option>
                <option value="atteint">Objectif atteint</option>
                <option value="restant">Objectif restant</option>
              </select>
            </label>
          </div>
          <p className="text-[10px] text-gray-400">
            Les filtres s'appliquent aussi à l'export PDF et Excel. Sur une campagne
            dont les objectifs ne sont pas renseignés, le filtre objectif ne classe personne.
          </p>
        </div>
      )}

      {loadingList ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-700 border-t-transparent" />
        </div>
      ) : cotisationsAffichees.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Wallet className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {moisCourantVide
              ? `Aucune cotisation enregistrée en ${getMonthLabel(getCurrentMonth())}.`
              : filtreActif
                ? 'Aucune cotisation ne correspond aux filtres.'
                : 'Aucune cotisation enregistrée.'}
          </p>
          {moisCourantVide && (
            <button
              onClick={() => setFiltreMois('')}
              className="mt-2 inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs text-primary-700 dark:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Voir les autres mois ({allCotisations.length} cotisations)
            </button>
          )}
          {filtreActif && (
            <p className="text-xs mt-1.5">
              Filtres :{' '}
              {[
                filtreMois && getMonthLabel(filtreMois),
                filtreObjectif === 'atteint' && 'objectif atteint',
                filtreObjectif === 'restant' && 'objectif restant',
                filtreTexte.trim() && `"${filtreTexte.trim()}"`,
              ].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800/50 rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 shadow-sm overflow-hidden">
          {cotisationsAffichees.map((c) => {
            const moisLabel = c.mois_cotisation ? getMonthLabel(c.mois_cotisation) : null;
            const isLate = moisLabel && c.date_paiement && c.mois_cotisation !== c.date_paiement?.slice(0, 7);
            return (
              <li key={c.id} className="flex items-center justify-between px-4 py-3.5 text-sm hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  {c.membre?.photo_url ? (
                    <img
                      src={bustCache(c.membre.photo_url, 0)}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover ring-1 ring-gray-100 dark:ring-gray-800 shrink-0"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/40 dark:to-primary-800/40 flex items-center justify-center text-primary-700 dark:text-primary-400 text-xs font-bold shrink-0">
                      {c.membre?.prenom?.[0]}{c.membre?.nom?.[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{c.membre?.prenom} {c.membre?.nom}</p>
                    <p className="text-gray-500 text-xs truncate">
                      {new Date(c.date_paiement).toLocaleDateString('fr-FR')} · {MODES_PAIEMENT.find((m) => m.value === c.mode_paiement)?.label}
                      {c.note ? ` · ${c.note}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <div className="text-right">
                    <span className="font-bold text-green-600">+{formatFCFA(c.montant)}</span>
                    {isLate && (
                      <p className="text-xs text-amber-600 flex items-center gap-1 justify-end">
                        <Calendar className="h-3 w-3" /> {moisLabel}
                      </p>
                    )}
                    {!isLate && moisLabel && (
                      <p className="text-xs text-gray-400">{moisLabel}</p>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex flex-col gap-1">
                      <button onClick={() => startEdit(c)} className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors" title="Modifier">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="text-gray-400 hover:text-red-600 transition-colors" title="Supprimer">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}