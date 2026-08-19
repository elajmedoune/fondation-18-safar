import { Navigate, Outlet } from 'react-router-dom';
import { useRole } from '../hooks/useRole.js';

// Usage: <Route element={<RoleRoute allowed={['tresorier', 'administrateur']} />}>...</Route>
export default function RoleRoute({ allowed }) {
  const { hasRole } = useRole();

  if (!hasRole(allowed)) return <Navigate to="/tableau-de-bord" replace />;

  return <Outlet />;
}
