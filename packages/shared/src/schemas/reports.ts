import { z } from 'zod';

export const generateReportSchema = z.object({
  type: z.enum(['ghg', 'tcfd', 'cdp', 'custom']),
  year: z.number().int().min(1990).max(2100),
  scopes: z.array(z.enum(['SCOPE_1', 'SCOPE_2', 'SCOPE_3'])).min(1),
});

export type GenerateReportInput = z.infer<typeof generateReportSchema>;
