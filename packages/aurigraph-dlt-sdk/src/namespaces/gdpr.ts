/**
 * GDPR namespace — Data export, download, and erasure requests.
 *
 * Wraps:
 *   - GET    /api/v11/gdpr/export/{userId}
 *   - GET    /api/v11/gdpr/download/{userId}
 *   - DELETE /api/v11/gdpr/erasure/{userId}
 */

import type { GdprExportPayload, ErasureReceipt } from '../types.js';

export interface GdprTransport {
  get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
}

export class GdprApi {
  constructor(private readonly transport: GdprTransport) {}

  /** Export all user data as a structured payload (GDPR Article 20). */
  async exportUserData(userId: string): Promise<GdprExportPayload> {
    return this.transport.get<GdprExportPayload>(
      `/gdpr/export/${encodeURIComponent(userId)}`,
    );
  }

  /** Download user data as a binary blob (GDPR Article 20 portable format). */
  async downloadUserData(userId: string): Promise<Blob> {
    // The transport returns raw JSON; for binary downloads the caller may need
    // to use a raw fetch. This wrapper returns what the server provides.
    return this.transport.get<Blob>(
      `/gdpr/download/${encodeURIComponent(userId)}`,
    );
  }

  /** Request erasure of all personal data (GDPR Article 17 — right to be forgotten). */
  async requestErasure(userId: string): Promise<ErasureReceipt> {
    return this.transport.delete<ErasureReceipt>(
      `/gdpr/erasure/${encodeURIComponent(userId)}`,
    );
  }
}
