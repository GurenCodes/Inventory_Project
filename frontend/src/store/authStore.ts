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
  logout: () => Promise<void>;
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

          // Token is now stored in HttpOnly cookie by the backend
          // We only store user info in sessionStorage for display purposes
          sessionStorage.setItem('user', JSON.stringify(user));

          set({
            user,
            token: 'authenticated', // Token is in HttpOnly cookie, we just mark as authenticated
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        // Clear session storage
        sessionStorage.removeItem('user');
        
        // Call backend logout to clear the cookie
        try {
          await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://inventory-project-6szy.onrender.com'}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
          });
        } catch (e) {
          // Ignore errors
        }

        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      setToken: (token: string) => {
        // Token is now in HttpOnly cookie, this is kept for compatibility
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
        // Token is in HttpOnly cookie, don't persist it
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;