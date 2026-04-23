import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

/* ============================================
   Types
   ============================================ */

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface UsersResponse {
  data: User[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateUserData {
  name: string;
  email: string;
  role: string;
}

export interface UpdateUserData {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
}

export interface UsersFilters {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

/* ============================================
   Hooks
   ============================================ */

export function useUsers(filters: UsersFilters) {
  const params: Record<string, string | number | boolean | undefined> = {};
  if (filters.search) params.search = filters.search;
  if (filters.role) params.role = filters.role;
  if (filters.status) params.status = filters.status;
  if (filters.page) params.page = filters.page;
  if (filters.pageSize) params.page_size = filters.pageSize;

  return useQuery<UsersResponse>({
    queryKey: ['users', filters],
    queryFn: () => api.get<UsersResponse>('/users', params),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserData) =>
      api.post<User>('/users', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateUserData) =>
      api.patch<User>(`/users/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
