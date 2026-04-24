import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export type SupplierStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED';
export type SupplierRequestStatus = 'PENDING' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

export interface Supplier {
  id: string;
  orgId: string;
  name: string;
  email: string;
  contactPerson: string | null;
  category: string | null;
  externalId: string | null;
  status: SupplierStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierRequest {
  id: string;
  supplierId: string;
  orgId: string;
  title: string;
  description: string | null;
  dataScope: string;
  periodStart: string;
  periodEnd: string;
  dueBy: string | null;
  status: SupplierRequestStatus;
  submittedValue: unknown;
  submittedAt: string | null;
  reviewNotes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  supplier?: Supplier;
}

interface Paginated<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const KEYS = {
  suppliers: (params: object) => ['suppliers', params] as const,
  supplier: (id: string) => ['supplier', id] as const,
  requests: (params: object) => ['supplier-requests', params] as const,
};

export function useSuppliers(params: { status?: string; search?: string; page?: number } = {}) {
  return useQuery({
    queryKey: KEYS.suppliers(params),
    queryFn: () =>
      api.get<Paginated<Supplier>>('/suppliers', {
        status: params.status,
        search: params.search,
        page: params.page ?? 1,
        pageSize: 25,
      }),
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      email: string;
      contactPerson?: string;
      category?: string;
      externalId?: string;
      status?: SupplierStatus;
    }) => api.post<{ data: Supplier }>('/suppliers', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Supplier> }) =>
      api.patch<{ data: Supplier }>(`/suppliers/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ message: string }>(`/suppliers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function useSupplierRequests(params: { status?: string; supplierId?: string; page?: number } = {}) {
  return useQuery({
    queryKey: KEYS.requests(params),
    queryFn: () =>
      api.get<Paginated<SupplierRequest>>('/suppliers/requests', {
        status: params.status,
        supplierId: params.supplierId,
        page: params.page ?? 1,
        pageSize: 25,
      }),
  });
}

export function useCreateDataRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      supplierId,
      data,
    }: {
      supplierId: string;
      data: {
        title: string;
        description?: string;
        dataScope: string;
        periodStart: string;
        periodEnd: string;
        dueBy?: string;
      };
    }) => api.post<{ data: SupplierRequest }>(`/suppliers/${supplierId}/requests`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplier-requests'] }),
  });
}

export function useDecideSupplierRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      reviewNotes,
    }: {
      id: string;
      status: 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
      reviewNotes?: string;
    }) =>
      api.patch<{ data: SupplierRequest }>(`/suppliers/requests/${id}/decide`, { status, reviewNotes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplier-requests'] }),
  });
}
