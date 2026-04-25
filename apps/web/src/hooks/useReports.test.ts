import { describe, it, expect } from 'vitest';
import {
  downloadReportUrl,
  REPORT_DOWNLOAD_FORMATS,
} from './useReports';

describe('downloadReportUrl', () => {
  it('builds the versioned API download path (json default)', () => {
    expect(downloadReportUrl('abc-123')).toBe(
      '/api/v1/reports/abc-123/download',
    );
  });

  it('keeps the bare path when format is "json"', () => {
    expect(downloadReportUrl('abc-123', 'json')).toBe(
      '/api/v1/reports/abc-123/download',
    );
  });

  it('appends ?format=csv when format is "csv"', () => {
    expect(downloadReportUrl('abc-123', 'csv')).toBe(
      '/api/v1/reports/abc-123/download?format=csv',
    );
  });

  it('appends ?format=pdf when format is "pdf"', () => {
    expect(downloadReportUrl('abc-123', 'pdf')).toBe(
      '/api/v1/reports/abc-123/download?format=pdf',
    );
  });
});

describe('REPORT_DOWNLOAD_FORMATS', () => {
  it('matches the API-side AAT-10C contract', () => {
    expect(REPORT_DOWNLOAD_FORMATS).toEqual(['json', 'csv', 'pdf']);
  });
});
