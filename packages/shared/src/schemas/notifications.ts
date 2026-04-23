import { z } from 'zod';

/**
 * Notifications API — list query schema.
 *
 * `unreadOnly` arrives as a string over the wire ("true"/"false") and is
 * coerced to a boolean. `page` and `pageSize` default to 1 / 20 and
 * `pageSize` is capped at 100 to bound response size.
 */
export const listNotificationsQuerySchema = z.object({
  unreadOnly: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  page: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1))
    .default('1'),
  pageSize: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .default('20'),
});

/**
 * Notification preferences — PATCH body schema.
 * All four booleans are optional so callers can patch a single flag.
 */
export const updatePrefsSchema = z.object({
  emailOnStatusChange: z.boolean().optional(),
  emailOnApprovalRequest: z.boolean().optional(),
  inAppOnStatusChange: z.boolean().optional(),
  inAppOnApprovalRequest: z.boolean().optional(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type UpdatePrefsInput = z.infer<typeof updatePrefsSchema>;
