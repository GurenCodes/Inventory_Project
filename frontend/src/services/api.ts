import axios, { AxiosError } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getStoredToken, useAuthStore } from '../store/authStore';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:3000' : 'https://inventory-project-6szy.onrender.com');

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
      timeout: 30000,
    });

    // Attach the fallback Authorization header when a token exists in
    // sessionStorage. The HttpOnly cookie remains the primary credential.
    this.client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      const token = getStoredToken();
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor: pass errors through, but on 401 reset the
    // local session so an expired/invalid credential never leaves the UI
    // showing an authenticated state. (Login failures don't go through
    // this client — authStore uses fetch — so a 401 here always means a
    // previously-authenticated request was rejected.)
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          useAuthStore.getState().clearSession();
        }
        return Promise.reject(error);
      }
    );
  }

  get<T>(url: string, params?: object) {
    return this.client.get<T>(url, { params });
  }

  post<T>(url: string, data?: unknown) {
    return this.client.post<T>(url, data);
  }

  put<T>(url: string, data?: unknown) {
    return this.client.put<T>(url, data);
  }

  patch<T>(url: string, data?: unknown) {
    return this.client.patch<T>(url, data);
  }

  delete<T>(url: string) {
    return this.client.delete<T>(url);
  }
}

export const apiClient = new ApiClient();

// API Endpoints
export const endpoints = {
  auth: {
    login: { url: '/auth/login', params: {} },
    logout: { url: '/auth/logout', params: {} },
  },
  products: {
    list: (params?: { category?: string; includeInactive?: boolean }) => ({
      url: '/products',
      params,
    }),
    get: (id: number) => ({ url: `/products/${id}`, params: {} }),
    create: (data: any) => ({ url: '/products', data }),
    update: (id: number, data: any) => ({ url: `/products/${id}`, data }),
    discontinue: (id: number) => ({ url: `/products/${id}/discontinue`, params: {} }),
    reactivate: (id: number) => ({ url: `/products/${id}/reactivate`, params: {} }),
  },
  stock: {
    low: () => ({ url: '/stock/low', params: {} }),
    get: (productId: number) => ({ url: `/stock/${productId}`, params: {} }),
    receive: (data: any) => ({ url: '/stock/receive', data }),
    adjustReorderLevel: (productId: number, reorderLevel: number) => ({
      url: `/stock/${productId}/reorder-level`,
      data: { reorderLevel },
    }),
  },
  sales: {
    list: (params?: { status?: string }) => ({ url: '/sales', params }),
    get: (id: number) => ({ url: `/sales/${id}`, params: {} }),
    create: (data: any) => ({ url: '/sales', data }),
    cancel: (id: number) => ({ url: `/sales/${id}/cancel`, params: {} }),
  },
  reports: {
    daily: (data: { date: string }) => ({ url: '/reports/daily', data }),
    get: (date: string) => ({ url: `/reports/${date}`, params: {} }),
    list: (params: { start: string; end: string }) => ({ url: '/reports', params }),
  },
  users: {
    list: (role?: string) => ({ url: '/users', params: { role } }),
    get: (id: number) => ({ url: `/users/${id}`, params: {} }),
    create: (data: any) => ({ url: '/users', data }),
    updatePassword: (id: number, password: string) => ({
      url: `/users/${id}/password`,
      data: { password },
    }),
  },
};

export default apiClient;