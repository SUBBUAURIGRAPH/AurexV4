/**
 * Compliance namespace — Framework listing and asset compliance assessments.
 *
 * Wraps:
 *   - GET  /api/v11/compliance/frameworks
 *   - GET  /api/v11/compliance/frameworks/{code}
 *   - POST /api/v11/compliance/assess
 *   - GET  /api/v11/compliance/assessments/{assetId}
 */

import type {
  ComplianceFramework,
  AssessmentResult,
} from '../types.js';

export interface ComplianceTransport {
  get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  unwrapList<T>(p: Promise<unknown>, key: string): Promise<T[]>;
}

export class ComplianceApi {
  constructor(private readonly transport: ComplianceTransport) {}

  /** List all available compliance frameworks. */
  async listFrameworks(): Promise<ComplianceFramework[]> {
    return this.transport.unwrapList<ComplianceFramework>(
      this.transport.get<unknown>('/compliance/frameworks'),
      'frameworks',
    );
  }

  /** Get a single compliance framework by code. */
  async getFramework(code: string): Promise<ComplianceFramework> {
    return this.transport.get<ComplianceFramework>(
      `/compliance/frameworks/${encodeURIComponent(code)}`,
    );
  }

  /** Run a compliance assessment against an asset for a given framework. */
  async assess(
    assetId: string,
    frameworkCode: string,
    metadata?: Record<string, unknown>,
  ): Promise<AssessmentResult> {
    return this.transport.post<AssessmentResult>('/compliance/assess', {
      assetId,
      framework: frameworkCode,
      metadata,
    });
  }

  /** Get assessment results for an asset. */
  async getAssessments(assetId: string): Promise<AssessmentResult[]> {
    return this.transport.unwrapList<AssessmentResult>(
      this.transport.get<unknown>(
        `/compliance/assessments/${encodeURIComponent(assetId)}`,
      ),
      'assessments',
    );
  }
}
