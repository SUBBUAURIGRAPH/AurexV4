import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface Notification {
  id: string;
  orgId: string | null;
  userId: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';
  title: string;
  body: string | null;
  resource: string | null;
  resourceId: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  data: Notification[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  unreadCount: number;
}

const KEYS = {
  list: (params: object) => ['notifications', params] as const,
  unread: () => ['notifications', 'unread-count'] as const,
};

export function useNotifications(params: { unreadOnly?: boolean; page?: number; pageSize?: number } = {}) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () =>
      api.get<NotificationsResponse>('/notifications', {
        unreadOnly: params.unreadOnly,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
      }),
    refetchInterval: 30_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: KEYS.unread(),
    queryFn: async () => {
      const result = await api.get<NotificationsResponse>('/notifications', { pageSize: 1 });
      return result.unreadCount;
    },
    refetchInterval: 30_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch<{ data: Notification }>(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ data: { updated: number } }>('/notifications/mark-all-read'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
