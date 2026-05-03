import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export type TeamStatus = 'ACTIVE' | 'IN_REVIEW' | 'ARCHIVED';

export interface TeamSummary {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  ownerName: string;
  defaultRole: string;
  status: TeamStatus;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  addedAt: string;
}

export interface TeamDetail extends TeamSummary {
  members: TeamMember[];
}

export interface CreateTeamInput {
  name: string;
  description?: string | null;
  defaultRole?: string;
  status?: TeamStatus;
  memberUserIds?: string[];
}

export interface UpdateTeamInput {
  name?: string;
  description?: string | null;
  defaultRole?: string;
  status?: TeamStatus;
}

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: () => api.get<{ data: TeamSummary[] }>('/teams').then((r) => r.data),
  });
}

export function useTeam(id: string | undefined) {
  return useQuery({
    queryKey: ['teams', id],
    enabled: !!id,
    queryFn: () => api.get<{ data: TeamDetail }>(`/teams/${id}`).then((r) => r.data),
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTeamInput) =>
      api.post<{ data: TeamSummary }>('/teams', input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });
}

export function useUpdateTeam(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTeamInput) =>
      api.patch<{ data: TeamSummary }>(`/teams/${id}`, input).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      qc.invalidateQueries({ queryKey: ['teams', id] });
    },
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/teams/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });
}

export function useAddTeamMember(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api
        .post<{ data: TeamDetail }>(`/teams/${teamId}/members`, { userId })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      qc.invalidateQueries({ queryKey: ['teams', teamId] });
    },
  });
}

export function useRemoveTeamMember(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api.delete<{ data: TeamDetail }>(`/teams/${teamId}/members/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      qc.invalidateQueries({ queryKey: ['teams', teamId] });
    },
  });
}
