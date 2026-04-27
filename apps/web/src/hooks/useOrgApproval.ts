import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

/**
 * FLOW-REWORK / Sprint 5 — org-approval workflow hooks.
 */

export type OrgApprovalStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

export interface OrgApprovalRow {
  id: string;
  name: string;
  slug: string;
  approvalStatus: OrgApprovalStatus;
  approvalRequestedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectedReason: string | null;
  parentOrgId: string | null;
  createdAt: string;
  registeredBy?: { id: string; name: string; email: string } | null;
}

export function useMyOrgApprovalStatus() {
  return useQuery<{ data: { orgId: string; approvalStatus: OrgApprovalStatus } | null }>({
    queryKey: ['my-org-approval-status'],
    queryFn: () =>
      api.get<{ data: { orgId: string; approvalStatus: OrgApprovalStatus } | null }>(
        '/me/org/approval-status',
      ),
  });
}

export function usePendingOrgApprovals(all = false) {
  return useQuery<{ data: OrgApprovalRow[] }>({
    queryKey: ['admin-org-approvals', all],
    queryFn: () =>
      api.get<{ data: OrgApprovalRow[] }>('/admin/org-approvals', all ? { all: true } : undefined),
  });
}

export function useApproveOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orgId: string) =>
      api.post<{ data: OrgApprovalRow }>(`/admin/org-approvals/${orgId}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-org-approvals'] });
      qc.invalidateQueries({ queryKey: ['my-org-approval-status'] });
    },
  });
}

export function useRejectOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, reason }: { orgId: string; reason: string }) =>
      api.post<{ data: OrgApprovalRow }>(`/admin/org-approvals/${orgId}/reject`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-org-approvals'] });
      qc.invalidateQueries({ queryKey: ['my-org-approval-status'] });
    },
  });
}
