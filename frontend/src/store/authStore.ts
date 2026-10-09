import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'MANAGER';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://inventory-project-6szy.onrender.com'}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Login failed');
          }

          const data = await response.json();
          const { token, user } = data;

          // Store token in memory and sessionStorage for tab restore
          sessionStorage.setItem('token', token);
          sessionStorage.setItem('user', JSON.stringify(user));

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        
        // Also call backend logout if cookie-based auth is implemented
        fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://inventory-project-6szy.onrender.com'}/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        }).catch(() => {}); // Ignore errors

        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      setToken: (token: string) => {
        sessionStorage.setItem('token', token);
        set({ token, isAuthenticated: true });
      },

      setUser: (user) => {
        sessionStorage.setItem('user', JSON.stringify(user));
        set({ user, isAuthenticated: true });
      },

      setLoading: (isLoading: boolean) => {
        set({ isLoading });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;