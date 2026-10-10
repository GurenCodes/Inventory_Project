import { useQuery } from '@tanstack/react-query';
import { apiClient, endpoints } from '../services/api';

export interface DashboardStats {
  totalProducts: number;
  lowStockCount: number;
  todaySalesAmount: number;
  lowStockAlertsCount: number;
}

export interface LowStockItem {
  productId: number;
  productName: string;
  category: string | null;
  quantityBottles: number;
  reorderLevel: number;
  status: 'critical' | 'low' | 'ok';
}

export interface RecentSale {
  id: number;
  customerName: string;
  itemCount: number;
  totalAmount: number;
  status: string;
  createdAt: string;
  soldByName: string;
}

interface ProductResponse {
  id: number;
  name: string;
  category?: string | null;
  unitPrice: number;
  crateSize?: number | null;
  isActive: boolean;
}

interface StockResponse {
  productId: number;
  quantityBottles: number;
  quantityCrates: number;
  reorderLevel: number;
  product?: ProductResponse;
}

interface SaleResponse {
  id: number;
  totalAmount: number | string;
  status: string;
  createdAt: string;
  soldBy?: { fullName: string };
  items?: Array<{ productId: number; quantityBottles: number }>;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async (): Promise<DashboardStats> => {
      const [productsRes, lowStockRes, salesRes] = await Promise.all([
        apiClient.get<ProductResponse[]>(endpoints.products.list({ includeInactive: false }).url, endpoints.products.list({ includeInactive: false }).params),
        apiClient.get<StockResponse[]>(endpoints.stock.low().url, endpoints.stock.low().params),
        apiClient.get<SaleResponse[]>(endpoints.sales.list({ status: 'completed' }).url, endpoints.sales.list({ status: 'completed' }).params),
      ]);

      const products = productsRes.data || [];
      const lowStock = lowStockRes.data || [];
      const sales = salesRes.data || [];

      const today = new Date().toISOString().split('T')[0];
      const todaySales = sales.filter((s) => s.createdAt?.startsWith(today));
      const todaySalesAmount = todaySales.reduce((sum: number, s) => sum + Number(s.totalAmount || 0), 0);

      return {
        totalProducts: products.length,
        lowStockCount: lowStock.length,
        todaySalesAmount,
        lowStockAlertsCount: lowStock.filter((s) => s.quantityBottles <= s.reorderLevel * 0.5).length,
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: false,
  });
}

export function useLowStockItems() {
  return useQuery({
    queryKey: ['dashboard', 'lowStock'],
    queryFn: async (): Promise<LowStockItem[]> => {
      const endpoint = endpoints.stock.low();
      const res = await apiClient.get<StockResponse[]>(endpoint.url, endpoint.params);
      const items = res.data || [];
      return items.map((item) => ({
        productId: item.productId,
        productName: item.product?.name || 'Unknown',
        category: item.product?.category || null,
        quantityBottles: item.quantityBottles,
        reorderLevel: item.reorderLevel,
        status:
          item.quantityBottles === 0
            ? 'critical'
            : item.quantityBottles <= item.reorderLevel * 0.5
            ? 'critical'
            : item.quantityBottles <= item.reorderLevel
            ? 'low'
            : 'ok',
      }));
    },
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });
}

export function useRecentSales(limit = 5) {
  return useQuery({
    queryKey: ['dashboard', 'recentSales', limit],
    queryFn: async (): Promise<RecentSale[]> => {
      const endpoint = endpoints.sales.list({ status: 'completed' });
      const res = await apiClient.get<SaleResponse[]>(endpoint.url, endpoint.params);
      const sales = res.data || [];
      return sales
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit)
        .map((s) => ({
          id: s.id,
          customerName: s.soldBy?.fullName || 'Unknown',
          itemCount: s.items?.length || 0,
          totalAmount: Number(s.totalAmount || 0),
          status: s.status,
          createdAt: s.createdAt,
          soldByName: s.soldBy?.fullName || 'Unknown',
        }));
    },
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });
}

export function useDashboardData() {
  const stats = useDashboardStats();
  const lowStock = useLowStockItems();
  const recentSales = useRecentSales();

  return {
    stats: stats.data,
    lowStock: lowStock.data,
    recentSales: recentSales.data,
    isLoading: stats.isLoading || lowStock.isLoading || recentSales.isLoading,
    isError: stats.isError || lowStock.isError || recentSales.isError,
    error: stats.error || lowStock.error || recentSales.error,
    refetch: () => {
      stats.refetch();
      lowStock.refetch();
      recentSales.refetch();
    },
  };
}