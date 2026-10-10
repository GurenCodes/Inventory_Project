import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface ProtectedRouteProps {
  allowedRoles?: string[];
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  allowedRoles = ['ADMIN', 'MANAGER'],
  fallback,
}: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading, isInitialized } = useAuth();
  const location = useLocation();

  // Wait for auth initialization to complete
  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (user && !allowedRoles.includes(user.role)) {
    return fallback ?? <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;