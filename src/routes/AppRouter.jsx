import { Routes, Route } from 'react-router-dom';
import MonProfil from '../pages/profil/MonProfil.jsx';
import Parametres from '../pages/profil/Parametres.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';
import CartesMembres from '../pages/membres/CartesMembres.jsx';
import RoleRoute from './RoleRoute.jsx';
import AppLayout from '../components/layout/AppLayout.jsx';
import Landing from '../pages/landing/Landing.jsx';
import Login from '../pages/auth/Login.jsx';
import ForgotPassword from '../pages/auth/ForgotPassword.jsx';
import ResetPassword from '../pages/auth/ResetPassword.jsx';
import Dashboard from '../pages/dashboard/Dashboard.jsx';
import MembresList from '../pages/membres/MembresList.jsx';
import MembreProfil from '../pages/membres/MembreProfil.jsx';
import MaCarte from '../pages/membres/MaCarte.jsx';
import GroupesList from '../pages/groupes/GroupesList.jsx';
import GroupeDetail from '../pages/groupes/GroupeDetail.jsx';
import ScanQR from '../pages/scan/ScanQR.jsx';
import Cotisations from '../pages/finances/Cotisations.jsx';
import Dons from '../pages/finances/Dons.jsx';
import Quetes from '../pages/finances/Quetes.jsx';
import Depenses from '../pages/finances/Depenses.jsx';
import Objectifs from '../pages/finances/Objectifs.jsx';
import ReunionsList from '../pages/reunions/ReunionsList.jsx';
import ReunionDetail from '../pages/reunions/ReunionDetail.jsx';
import Rapports from '../pages/rapports/Rapports.jsx';
import Utilisateurs from '../pages/admin/Utilisateurs.jsx';
import AuditTrail from '../pages/admin/AuditTrail.jsx';
import CampagnesList from '../pages/campagnes/CampagnesList.jsx';
import AIAssistant from '../pages/ai/AIAssistant.jsx';

const FINANCE_ROLES = ['tresorier', 'president', 'administrateur'];
const REUNION_WRITE_ROLES = ['secretaire', 'president', 'administrateur'];

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
      <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/tableau-de-bord" element={<Dashboard />} />
          <Route path="/ma-carte" element={<MaCarte />} />
          <Route path="/mon-profil" element={<MonProfil />} />
          <Route path="/parametres" element={<Parametres />} />
          <Route path="/membres" element={<MembresList />} />

          <Route element={<RoleRoute allowed={['secretaire', 'president', 'administrateur']} />}>
            <Route path="/membres/cartes" element={<CartesMembres />} />
          </Route>

          <Route path="/membres/:id" element={<MembreProfil />} />
          <Route path="/reunions" element={<ReunionsList />} />
          <Route path="/reunions/:id" element={<ReunionDetail />} />

          <Route element={<RoleRoute allowed={['administrateur']} />}>
            <Route path="/groupes" element={<GroupesList />} />
            <Route path="/groupes/:id" element={<GroupeDetail />} />
          </Route>

          <Route element={<RoleRoute allowed={['tresorier', 'secretaire', 'president', 'administrateur']} />}>
            <Route path="/scan" element={<ScanQR />} />
          </Route>

          <Route element={<RoleRoute allowed={FINANCE_ROLES} />}>
            <Route path="/finances/cotisations" element={<Cotisations />} />
            <Route path="/finances/dons" element={<Dons />} />
            <Route path="/finances/quetes" element={<Quetes />} />
            <Route path="/finances/depenses" element={<Depenses />} />
            <Route path="/finances/objectifs" element={<Objectifs />} />
          </Route>

          <Route element={<RoleRoute allowed={REUNION_WRITE_ROLES} />}>
            <Route path="/rapports" element={<Rapports />} />
          </Route>

          <Route element={<RoleRoute allowed={['administrateur', 'president']} />}>
            <Route path="/admin/utilisateurs" element={<Utilisateurs />} />
            <Route path="/admin/campagnes" element={<CampagnesList />} />
            <Route path="/admin/traçabilite" element={<AuditTrail />} />
          </Route>

          <Route element={<RoleRoute allowed={['tresorier', 'secretaire', 'president', 'administrateur']} />}>
            <Route path="/assistant-ia" element={<AIAssistant />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
