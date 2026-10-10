import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, endpoints } from '../services/api';

export interface SaleItem {
  id: number;
  productId: number;
  quantityBottles: number;
  unitPrice: number | string;
  lineTotal: number | string;
  product?: {
    id: number;
    name: string;
    unitPrice: number;
    crateSize: number | null;
  };
}

export interface Sale {
  id: number;
  soldById: number;
  totalAmount: number | string;
  status: string;
  createdAt: string;
  soldBy?: { id: number; fullName: string };
  items: SaleItem[];
}

export interface CreateSaleItem {
  productId: number;
  quantityBottles: number;
}

export function useSales(status?: string) {
  return useQuery<Sale[]>({
    queryKey: ['sales', status || 'all'],
    queryFn: async () => {
      const endpoint = endpoints.sales.list(status ? { status } : undefined);
      const res = await apiClient.get<Sale[]>(endpoint.url, endpoint.params);
      return res.data || [];
    },
  });
}

export function useSale(id: number) {
  return useQuery<Sale>({
    queryKey: ['sales', id],
    queryFn: async () => {
      const endpoint = endpoints.sales.get(id);
      const res = await apiClient.get<Sale>(endpoint.url, endpoint.params);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: CreateSaleItem[]) => {
      const endpoint = endpoints.sales.create({ items });
      const res = await apiClient.post(endpoint.url, endpoint.data);
      return res.data as Sale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCancelSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const endpoint = endpoints.sales.cancel(id);
      const res = await apiClient.post(endpoint.url);
      return res.data as Sale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
