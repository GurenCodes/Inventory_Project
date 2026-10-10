import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, endpoints } from '../services/api';

export interface AppUser {
  id: number;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'MANAGER';
}

export function useUsers(role?: string) {
  return useQuery<AppUser[]>({
    queryKey: ['users', role || 'all'],
    queryFn: async () => {
      const endpoint = endpoints.users.list(role || undefined);
      const res = await apiClient.get<AppUser[]>(endpoint.url, endpoint.params);
      return res.data || [];
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { fullName: string; email: string; password: string; role: string }) => {
      const endpoint = endpoints.users.create(data);
      const res = await apiClient.post(endpoint.url, endpoint.data);
      return res.data as AppUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdatePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const endpoint = endpoints.users.updatePassword(id, password);
      const res = await apiClient.put(endpoint.url, endpoint.data);
      return res.data as AppUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
