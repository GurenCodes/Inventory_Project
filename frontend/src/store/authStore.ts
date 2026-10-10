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
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  setLoading: (loading: boolean) => void;
  initializeAuth: () => Promise<void>;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://inventory-project-6szy.onrender.com';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await fetch(`${API_BASE_URL}/auth/login`, {
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
          const { token: _token, user } = data;

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
          await fetch(`${API_BASE_URL}/auth/logout`, {
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

initializeAuth: async () => {
        // If already initialized, skip
        if (get().isInitialized) return;
        
        set({ isLoading: true });
        
        try {
          // Try to verify the session by calling a protected endpoint
          // Use a timeout to prevent hanging
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          try {
            const response = await fetch(`${API_BASE_URL}/products`, {
              method: 'GET',
              credentials: 'include',
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
              // Session is valid, but we need user info
              // Check sessionStorage for cached user data
              const storedUser = sessionStorage.getItem('user');
              if (storedUser) {
                const user = JSON.parse(storedUser);
                set({
                  user,
                  isAuthenticated: true,
                  isLoading: false,
                  isInitialized: true,
                });
                return;
              }
              
              // Session is valid but no cached user - we need user info
              // For now, mark as authenticated but we'll need to fetch user details
              // This would require a /auth/me endpoint which doesn't exist yet
              set({ isAuthenticated: true, isLoading: false, isInitialized: true });
              return;
            }
          } catch (fetchError) {
            clearTimeout(timeoutId);
            // Network error or timeout - treat as unauthenticated
          }
          
          // No valid session or network error
          sessionStorage.removeItem('user');
          set({ isLoading: false, isInitialized: true, isAuthenticated: false });
        } catch (error) {
          // If any error, just mark as initialized and not authenticated
          set({ isLoading: false, isInitialized: true, isAuthenticated: false });
        }
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