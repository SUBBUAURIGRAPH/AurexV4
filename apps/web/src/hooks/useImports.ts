import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface ImportRowError {
  row: number;
  message: string;
  raw?: Record<string, string>;
}

export interface ImportJob {
  id: string;
  orgId: string;
  createdBy: string;
  filename: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  totalRows: number;
  processedRows: number;
  successRows: number;
  errorRows: number;
  errors: ImportRowError[] | null;
  createdAt: string;
  updatedAt: string;
}

interface ImportJobsResponse {
  data: ImportJob[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export function useImportJobs(page = 1) {
  return useQuery({
    queryKey: ['imports', page],
    queryFn: () => api.get<ImportJobsResponse>('/imports/emissions', { page, pageSize: 20 }),
  });
}

export function useUploadCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ filename, csv }: { filename: string; csv: string }) =>
      api.post<{ data: ImportJob }>('/imports/emissions', { filename, csv }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['imports'] });
    },
  });
}
