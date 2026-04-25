import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

/* ============================================
   Types — match the AAT-V3PORT backend contract
   ============================================ */

export type TrialTier = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export type TrialStatus = 'ACTIVE' | 'EXPIRED' | 'CONVERTED' | 'CANCELLED';

export interface Coupon {
  id: string;
  couponCode: string;
  chapterName: string;
  organizationName: string;
  trialDurationDays: number;
  trialTier: TrialTier;
  maxRedemptions: number | null;
  currentRedemptions: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CouponWithCount extends Coupon {
  redemptionCount?: number;
}

export interface Redemption {
  id: string;
  couponId: string;
  userEmail: string;
  userIpAddress: string | null;
  userGeoCountry: string | null;
  trialStart: string;
  trialEnd: string;
  trialStatus: TrialStatus;
  converted: boolean;
  convertedPlan: string | null;
  convertedAt: string | null;
  createdAt: string;
}

export interface CouponsListResponse {
  items: CouponWithCount[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CouponFilters {
  search?: string;
  isActive?: boolean | undefined;
  page?: number;
  pageSize?: number;
}

export interface CreateCouponInput {
  couponCode: string;
  chapterName: string;
  organizationName: string;
  trialDurationDays: number;
  trialTier: TrialTier;
  maxRedemptions: number | null;
  validUntil: string | null;
  metadata?: Record<string, unknown>;
}

export type UpdateCouponInput = Partial<Omit<CreateCouponInput, 'couponCode'>>;

/* ============================================
   Public-side validate / redeem (for signup page)
   ============================================ */

export interface ValidateCouponResult {
  valid: boolean;
  reason?: string;
  coupon?: {
    code: string;
    chapterName: string;
    organizationName: string;
    trialDurationDays: number;
    trialTier: TrialTier;
    metadata?: Record<string, unknown>;
  };
}

export function useValidateCoupon() {
  return useMutation({
    mutationFn: ({ code, email }: { code: string; email?: string }) =>
      api.post<ValidateCouponResult>('/api/v1/coupons/validate', { code, email }),
  });
}

/* ============================================
   Admin CRUD
   ============================================ */

export function useAdminCoupons(filters: CouponFilters) {
  const params: Record<string, string | number | boolean | undefined> = {};
  if (filters.search) params.search = filters.search;
  if (filters.isActive !== undefined) params.isActive = filters.isActive;
  if (filters.page) params.page = filters.page;
  if (filters.pageSize) params.pageSize = filters.pageSize;

  return useQuery({
    queryKey: ['admin-coupons', filters],
    queryFn: () => api.get<CouponsListResponse>('/api/v1/admin/coupons', params),
    staleTime: 30_000,
  });
}

export function useAdminCoupon(id: string | undefined) {
  return useQuery({
    queryKey: ['admin-coupon', id],
    queryFn: () => api.get<{ data: CouponWithCount }>(`/api/v1/admin/coupons/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCouponInput) =>
      api.post<{ data: Coupon }>('/api/v1/admin/coupons', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coupons'] });
    },
  });
}

export function useUpdateCoupon(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCouponInput) =>
      api.patch<{ data: Coupon }>(`/api/v1/admin/coupons/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coupons'] });
      qc.invalidateQueries({ queryKey: ['admin-coupon', id] });
    },
  });
}

export function useDeactivateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ data: Coupon }>(`/api/v1/admin/coupons/${id}/deactivate`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coupons'] });
    },
  });
}

export interface RedemptionsListResponse {
  items: Redemption[];
  total: number;
  page: number;
  pageSize: number;
}

export function useCouponRedemptions(
  couponId: string | undefined,
  page = 1,
  pageSize = 25,
) {
  return useQuery({
    queryKey: ['coupon-redemptions', couponId, page, pageSize],
    queryFn: () =>
      api.get<RedemptionsListResponse>(`/api/v1/admin/coupons/${couponId}/redemptions`, {
        page,
        pageSize,
      }),
    enabled: Boolean(couponId),
  });
}

/* ============================================
   AAT-ONBOARD: caller's active redemption (for the onboarding wizard)
   ============================================ */

export interface MyActiveRedemption {
  redemptionId: string;
  couponCode: string;
  chapterName: string;
  organizationName: string;
  trialStart: string;
  trialEnd: string;
  trialTier: TrialTier;
  trialStatus: TrialStatus;
  trialDurationDays: number;
  daysRemaining: number;
  metadata: Record<string, unknown>;
}

export function useMyRedemption() {
  return useQuery({
    queryKey: ['coupons', 'redemptions', 'me'],
    queryFn: () =>
      api.get<{ data: MyActiveRedemption | null }>('/coupons/redemptions/me'),
    staleTime: 60_000,
  });
}
