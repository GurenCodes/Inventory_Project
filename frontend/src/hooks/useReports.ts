import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, endpoints } from '../services/api';

export interface DailyReport {
  id: number;
  reportDate: string;
  generatedById: number;
  totalSalesAmount: number | string;
  generatedBy?: { id: number; fullName: string };
}

export function useReports(start: string, end: string) {
  return useQuery<DailyReport[]>({
    queryKey: ['reports', start, end],
    queryFn: async () => {
      const endpoint = endpoints.reports.list({ start, end });
      const res = await apiClient.get<DailyReport[]>(endpoint.url, endpoint.params);
      return res.data || [];
    },
    enabled: !!start && !!end,
  });
}

export function useDailyReport(date: string) {
  return useQuery<DailyReport>({
    queryKey: ['reports', 'day', date],
    queryFn: async () => {
      const endpoint = endpoints.reports.get(date);
      const res = await apiClient.get<DailyReport>(endpoint.url, endpoint.params);
      return res.data;
    },
    enabled: !!date,
    retry: false,
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (date: string) => {
      const endpoint = endpoints.reports.daily({ date });
      const res = await apiClient.post(endpoint.url, endpoint.data);
      return res.data as DailyReport;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
