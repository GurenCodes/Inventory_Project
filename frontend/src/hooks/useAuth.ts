import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const { user, isAuthenticated, isLoading, isInitialized, login, logout, setLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const loginWithRedirect = async (email: string, password: string, redirectTo = '/') => {
    await login(email, password);
    navigate(redirectTo, { replace: true });
  };

  const requireAuth = () => {
    if (!isAuthenticated && !isLoading) {
      navigate('/login', { state: { from: location.pathname }, replace: true });
      return false;
    }
    return true;
  };

  const requireRole = (roles: string[]) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location.pathname }, replace: true });
      return false;
    }
    if (!user || !roles.includes(user.role)) {
      navigate('/', { replace: true });
      return false;
    }
    return true;
  };

  return {
    user,
    token: user ? 'authenticated' : null,
    isAuthenticated,
    isLoading,
    isInitialized,
    login,
    logout,
    loginWithRedirect,
    requireAuth,
    requireRole,
    setLoading,
  };
}

export default useAuth;