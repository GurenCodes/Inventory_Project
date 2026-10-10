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

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:3000' : 'https://inventory-project-6szy.onrender.com');

// Fallback token storage (per-tab). The primary credential is the HttpOnly
// cookie set by the backend; this token from the login response body is only
// used as an Authorization-header fallback if the cookie is unavailable
// (e.g. browser blocks third-party cookies). Never use localStorage.
const TOKEN_KEY = 'auth-token';

export function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore storage failures (private mode etc.)
  }
}

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
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Login failed');
          }

          const data = await response.json();
          const { token, user } = data;

          // Primary auth: HttpOnly cookie set by the backend.
          // Keep the body token as a per-tab fallback for Authorization header.
          storeToken(token);

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

      logout: async () => {
        storeToken(null);

        // Call backend logout to clear the cookie
        try {
          await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
          });
        } catch {
          // Ignore errors - local logout proceeds either way
        }

        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      setToken: (token: string) => {
        storeToken(token);
        set({ token, isAuthenticated: true });
      },

      setUser: (user) => {
        set({ user, isAuthenticated: true });
      },

      setLoading: (isLoading: boolean) => {
        set({ isLoading });
      },

      initializeAuth: async () => {
        if (get().isInitialized) return;
        set({ isLoading: true });

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);

          try {
            // /auth/me validates the HttpOnly cookie (or fallback token, which
            // the API client attaches automatically) and returns the user.
            const headers: Record<string, string> = {};
            const fallbackToken = getStoredToken();
            if (fallbackToken) headers['Authorization'] = `Bearer ${fallbackToken}`;

            const response = await fetch(`${API_BASE_URL}/auth/me`, {
              method: 'GET',
              credentials: 'include',
              headers,
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (response.ok) {
              const user: User = await response.json();
              set({
                user,
                isAuthenticated: true,
                isLoading: false,
                isInitialized: true,
              });
              return;
            }
          } catch {
            clearTimeout(timeoutId);
            // Network error or timeout - treat as unauthenticated
          }

          // No valid session
          storeToken(null);
          set({ user: null, token: null, isLoading: false, isInitialized: true, isAuthenticated: false });
        } catch {
          set({ user: null, token: null, isLoading: false, isInitialized: true, isAuthenticated: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        // Never persist the token; the HttpOnly cookie is the credential.
        // User info is re-fetched from /auth/me on startup.
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
