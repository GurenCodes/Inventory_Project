import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, endpoints } from '../services/api';

export interface Product {
  id: number;
  name: string;
  category: string | null;
  unitPrice: number;
  crateSize: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stock?: {
    quantityBottles: number;
    quantityCrates: number;
    reorderLevel: number;
  };
}

export interface CreateProductData {
  name: string;
  category?: string | null;
  unitPrice: number;
  crateSize?: number | null;
  reorderLevel?: number | null;
}

export interface UpdateProductData {
  name?: string;
  category?: string | null;
  unitPrice?: number;
  crateSize?: number | null;
}

export function useProducts(category?: string, includeInactive = false) {
  return useQuery<Product[]>({
    queryKey: ['products', category, includeInactive],
    queryFn: async () => {
      const endpoint = endpoints.products.list({ category, includeInactive });
      const res = await apiClient.get<Product[]>(endpoint.url, endpoint.params);
      return res.data || [];
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

export function useProduct(id: number) {
  return useQuery<Product>({
    queryKey: ['products', id],
    queryFn: async () => {
      const endpoint = endpoints.products.get(id);
      const res = await apiClient.get<Product>(endpoint.url, endpoint.params);
      return res.data;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateProductData) => {
      const endpoint = endpoints.products.create(data);
      const res = await apiClient.post(endpoint.url, endpoint.data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateProductData }) => {
      const endpoint = endpoints.products.update(id, data);
      const res = await apiClient.put(endpoint.url, endpoint.data);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products', id] });
    },
  });
}

export function useDiscontinueProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const endpoint = endpoints.products.discontinue(id);
      const res = await apiClient.post(endpoint.url, endpoint.params);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useReactivateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const endpoint = endpoints.products.reactivate(id);
      const res = await apiClient.post(endpoint.url, endpoint.params);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}