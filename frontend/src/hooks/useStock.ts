import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, endpoints } from '../services/api';

export interface StockLevel {
  id: number;
  productId: number;
  quantityBottles: number;
  quantityCrates: number;
  reorderLevel: number;
  product?: {
    id: number;
    name: string;
    category: string | null;
    unitPrice: number;
    crateSize: number | null;
    isActive: boolean;
  };
}

export interface ReceiveStockData {
  productId: number;
  crateCount?: number;
  bottleCount?: number;
  costPerUnit: number;
  expiryDate?: string;
}

export function useStock(productId: number) {
  return useQuery<StockLevel>({
    queryKey: ['stock', productId],
    queryFn: async () => {
      const endpoint = endpoints.stock.get(productId);
      const res = await apiClient.get<StockLevel>(endpoint.url, endpoint.params);
      return res.data;
    },
    enabled: !!productId,
  });
}

export function useLowStock() {
  return useQuery<StockLevel[]>({
    queryKey: ['stock', 'low'],
    queryFn: async () => {
      const endpoint = endpoints.stock.low();
      const res = await apiClient.get<StockLevel[]>(endpoint.url, endpoint.params);
      return res.data || [];
    },
  });
}

export function useReceiveStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ReceiveStockData) => {
      const endpoint = endpoints.stock.receive(data);
      const res = await apiClient.post(endpoint.url, endpoint.data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useAdjustReorderLevel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, reorderLevel }: { productId: number; reorderLevel: number }) => {
      const endpoint = endpoints.stock.adjustReorderLevel(productId, reorderLevel);
      const res = await apiClient.put(endpoint.url, endpoint.data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
