import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://inventory-project-6szy.onrender.com';

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

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const { token } = useAuthStore.getState();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          // Try to refresh token if we have a refresh mechanism
          // For now, just redirect to login
          if (window.location.pathname !== '/login') {
            const { logout } = useAuthStore.getState();
            logout();
            window.location.href = '/login';
          }
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
    login: '/auth/login',
    logout: '/auth/logout',
  },
  products: {
    list: (params?: { category?: string; includeInactive?: boolean }) => ({
      url: '/products',
      params,
    }),
    get: (id: number) => ({ url: `/products/${id}` }),
    create: (data: any) => ({ url: '/products', data }),
    update: (id: number, data: any) => ({ url: `/products/${id}`, data }),
    discontinue: (id: number) => ({ url: `/products/${id}/discontinue` }),
    reactivate: (id: number) => ({ url: `/products/${id}/reactivate` }),
  },
  stock: {
    low: () => ({ url: '/stock/low' }),
    get: (productId: number) => ({ url: `/stock/${productId}` }),
    receive: (data: any) => ({ url: '/stock/receive', data }),
    adjustReorderLevel: (productId: number, reorderLevel: number) => ({
      url: `/stock/${productId}/reorder-level`,
      data: { reorderLevel },
    }),
  },
  sales: {
    list: (params?: { status?: string }) => ({ url: '/sales', params }),
    get: (id: number) => ({ url: `/sales/${id}` }),
    create: (data: any) => ({ url: '/sales', data }),
    cancel: (id: number) => ({ url: `/sales/${id}/cancel` }),
  },
  reports: {
    daily: (data: { date: string }) => ({ url: '/reports/daily', data }),
    get: (date: string) => ({ url: `/reports/${date}` }),
    list: (params: { start: string; end: string }) => ({ url: '/reports', params }),
  },
  users: {
    list: (role?: string) => ({ url: '/users', params: { role } }),
    get: (id: number) => ({ url: `/users/${id}` }),
    create: (data: any) => ({ url: '/users', data }),
    updatePassword: (id: number, password: string) => ({
      url: `/users/${id}/password`,
      data: { password },
    }),
  },
};

export default apiClient;