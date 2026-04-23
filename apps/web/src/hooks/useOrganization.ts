import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

/* ============================================
   Types
   ============================================ */

export interface Organization {
  id: string;
  name: string;
  slug: string;
  isActive?: boolean;
  parentOrgId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  // Legacy snake_case echoes kept for compatibility with older callers.
  created_at?: string;
  updated_at?: string;
}

export interface OrganizationTreeNode extends Organization {
  children: OrganizationTreeNode[];
}

export interface CreateOrganizationInput {
  name: string;
  slug?: string;
  parentOrgId?: string | null;
}

export interface OrgMember {
  id: string;
  name: string;
  email: string;
  role: string;
  joined_at: string;
}

export interface OrgMembersResponse {
  data: OrgMember[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateOrgData {
  name: string;
}

export interface UpdateOrgData {
  id: string;
  name?: string;
}

export interface AddMemberData {
  org_id: string;
  email: string;
  role: string;
}

export interface UpdateMemberData {
  org_id: string;
  member_id: string;
  role: string;
}

export interface RemoveMemberData {
  org_id: string;
  member_id: string;
}

/* ============================================
   Hooks
   ============================================ */

export function useOrganization(id?: string) {
  const orgId = id || 'current';
  return useQuery<Organization>({
    queryKey: ['organization', orgId],
    queryFn: () => api.get<Organization>(`/organizations/${orgId}`),
  });
}

export function useOrgMembers(
  orgId?: string,
  opts?: { page?: number; pageSize?: number }
) {
  const resolvedId = orgId || 'current';
  const params: Record<string, string | number | boolean | undefined> = {};
  if (opts?.page) params.page = opts.page;
  if (opts?.pageSize) params.page_size = opts.pageSize;

  return useQuery<OrgMembersResponse>({
    queryKey: ['org-members', resolvedId, opts],
    queryFn: () =>
      api.get<OrgMembersResponse>(`/organizations/${resolvedId}/members`, params),
  });
}

export function useCreateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOrgData) =>
      api.post<Organization>('/organizations', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organization'] });
    },
  });
}

/* ============================================
   Multi-org (parent / subsidiary) hooks
   ============================================ */

export function useOrganizationsList(includeSubsidiaries = true) {
  return useQuery<{ data: Organization[] }>({
    queryKey: ['organizations-list', includeSubsidiaries],
    queryFn: () =>
      api.get<{ data: Organization[] }>('/organizations', {
        includeSubsidiaries,
      }),
  });
}

export function useOrganizationTree() {
  return useQuery<{ data: OrganizationTreeNode[] }>({
    queryKey: ['organizations-tree'],
    queryFn: () => api.get<{ data: OrganizationTreeNode[] }>('/organizations/tree'),
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOrganizationInput) =>
      api.post<{ data: Organization }>('/organizations', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations-list'] });
      qc.invalidateQueries({ queryKey: ['organizations-tree'] });
    },
  });
}

export function useUpdateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateOrgData) =>
      api.patch<Organization>(`/organizations/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organization'] });
    },
  });
}

export function useAddMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ org_id, ...data }: AddMemberData) =>
      api.post<OrgMember>(`/organizations/${org_id}/members`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-members'] });
    },
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ org_id, member_id, ...data }: UpdateMemberData) =>
      api.patch<OrgMember>(`/organizations/${org_id}/members/${member_id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-members'] });
    },
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ org_id, member_id }: RemoveMemberData) =>
      api.delete(`/organizations/${org_id}/members/${member_id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-members'] });
    },
  });
}
