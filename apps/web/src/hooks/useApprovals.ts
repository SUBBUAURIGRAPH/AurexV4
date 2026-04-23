import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface ApprovalComment {
  id: string;
  requestId: string;
  userId: string;
  userEmail: string | null;
  body: string;
  createdAt: string;
}

export interface ApprovalRequest {
  id: string;
  orgId: string;
  resource: string;
  resourceId: string;
  requestedBy: string;
  requesterEmail: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  decidedBy: string | null;
  deciderEmail: string | null;
  decidedAt: string | null;
  reason: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  comments?: ApprovalComment[];
}

interface ApprovalsResponse {
  data: ApprovalRequest[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const KEYS = {
  list: (params: object) => ['approvals', params] as const,
  detail: (id: string) => ['approvals', id] as const,
};

export function useApprovals(params: {
  status?: string;
  resource?: string;
  requestedBy?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () =>
      api.get<ApprovalsResponse>('/approvals', {
        status: params.status,
        resource: params.resource,
        requestedBy: params.requestedBy,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
      }),
  });
}

export function useApproval(id: string | null) {
  return useQuery({
    queryKey: KEYS.detail(id ?? ''),
    queryFn: () => api.get<{ data: ApprovalRequest }>(`/approvals/${id}`),
    enabled: !!id,
  });
}

export function useDecideApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: 'APPROVED' | 'REJECTED'; reason?: string }) =>
      api.patch<{ data: ApprovalRequest }>(`/approvals/${id}/decide`, { status, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] });
    },
  });
}

export function useSubmitApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { resource: string; resourceId: string; payload?: Record<string, unknown> }) =>
      api.post<{ data: ApprovalRequest }>('/approvals', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] });
    },
  });
}

export function useAddApprovalComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, body }: { requestId: string; body: string }) =>
      api.post<{ data: ApprovalComment }>(`/approvals/${requestId}/comments`, { body }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.requestId) });
    },
  });
}
