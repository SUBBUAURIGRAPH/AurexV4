import { describe, it, expect } from 'vitest';
import { downloadReportUrl } from './useReports';

describe('downloadReportUrl', () => {
  it('builds the versioned API download path', () => {
    expect(downloadReportUrl('abc-123')).toBe('/api/v1/reports/abc-123/download');
  });
});
