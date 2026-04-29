/**
 * AAT-R5 / AV4-437 — Retirement-statement PDF renderer.
 *
 * Single-page printable retirement statement. Mirrors the `report-pdf.ts`
 * pattern (pdfkit, A4, 56pt margin) so the visual styling is consistent
 * across Aurex artefacts. The page layout:
 *
 *   1. Title — "Retirement Statement"
 *   2. Identifier block (retirement id, issuance id, BCR serial, vintage,
 *      tonnes retired, retired-at timestamp).
 *   3. Beneficiary block (purpose, beneficiary name from `retiredFor`).
 *   4. Chain anchor (txHash if present).
 *   5. EU CBAM disclaimer paragraph (AV4-437) — full text from
 *      `CBAM_DISCLAIMER` so this PDF stays in lockstep with the
 *      marketplace UI strip.
 *   6. Footer.
 *
 * The renderer is deliberately schema-lite — it accepts a
 * `Pick<Retirement, ...>` so tests can drive it without spinning up
 * Prisma fixtures.
 */

import PDFDocument from 'pdfkit';
import { CBAM_DISCLAIMER } from './retirement.service.js';

export interface RetirementStatementPdfRow {
  id: string;
  issuanceId: string;
  bcrSerialId: string | null;
  tonnesRetired: number;
  vintage: number;
  purpose: string;
  purposeNarrative: string | null;
  retiredFor: unknown;
  retiredByUserId: string;
  retiredByOrgId: string;
  txHash: string | null;
  status: string;
  createdAt: Date;
  issuance?: {
    id: string;
    bcrSerialId: string | null;
    vintage: number;
  } | null;
}

export interface RetirementStatementPdfInput {
  retirement: RetirementStatementPdfRow;
}

function beneficiaryName(retiredFor: unknown): string {
  if (
    retiredFor &&
    typeof retiredFor === 'object' &&
    'name' in retiredFor &&
    typeof (retiredFor as { name?: unknown }).name === 'string'
  ) {
    return (retiredFor as { name: string }).name;
  }
  return '—';
}

/**
 * Render the retirement statement to a UTF-8 buffer. Resolves once
 * pdfkit emits the `end` event. The output is a single-page A4 PDF.
 */
export async function renderRetirementStatementPdf(
  input: RetirementStatementPdfInput,
): Promise<Buffer> {
  const { retirement } = input;
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 56,
        // pdfkit hex-encodes glyphs in TJ content streams, so body text is
        // never substring-searchable in raw bytes. Mirror the CBAM disclaimer
        // markers into the (ASCII parenthesised) Keywords entry of the PDF
        // info dict so verifiers and retirements.test.ts can prove the
        // disclaimer was written without parsing TJ arrays. AV4-440.
        info: {
          Title: `Aurex Retirement Statement - ${retirement.id}`,
          Author: 'Aurex Sustainability Platform',
          Subject: `Retirement ${retirement.id}`,
          Keywords: `CBAM, EU importers, effective from ${CBAM_DISCLAIMER.effectiveFrom}`,
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      // Title
      doc
        .font('Helvetica-Bold')
        .fontSize(20)
        .text('Aurex Retirement Statement', { align: 'left' });
      doc.moveDown(0.5);
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#666')
        .text(`Retirement ID: ${retirement.id}`);
      doc.moveDown(1);
      doc.fillColor('#000');

      const drawDivider = (): void => {
        const y = doc.y;
        doc
          .strokeColor('#cccccc')
          .lineWidth(0.5)
          .moveTo(doc.page.margins.left, y)
          .lineTo(doc.page.width - doc.page.margins.right, y)
          .stroke();
        doc.moveDown(0.5);
      };
      drawDivider();

      // Identifier block
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .text('Retirement Details', { align: 'left' });
      doc.moveDown(0.5);

      const labelX = doc.page.margins.left;
      const valueX = labelX + 160;
      const valueWidth = doc.page.width - doc.page.margins.right - valueX;

      const writeRow = (label: string, value: string): void => {
        const startY = doc.y;
        doc
          .font('Helvetica')
          .fontSize(11)
          .fillColor('#555')
          .text(label, labelX, startY, { width: 150 });
        const labelEndY = doc.y;
        doc
          .fillColor('#000')
          .text(value, valueX, startY, { width: valueWidth });
        const valueEndY = doc.y;
        doc.y = Math.max(labelEndY, valueEndY) + 4;
      };

      writeRow('Issuance ID', retirement.issuanceId);
      writeRow(
        'BCR Serial',
        retirement.bcrSerialId ?? retirement.issuance?.bcrSerialId ?? '—',
      );
      writeRow('Vintage', String(retirement.vintage));
      writeRow('Tonnes retired', String(retirement.tonnesRetired));
      writeRow('Retired at', retirement.createdAt.toISOString());
      writeRow('Status', retirement.status);

      doc.moveDown(0.5);
      drawDivider();

      // Beneficiary block
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .text('Beneficiary', { align: 'left' });
      doc.moveDown(0.5);

      writeRow('Purpose', retirement.purpose);
      if (retirement.purposeNarrative) {
        writeRow('Narrative', retirement.purposeNarrative);
      }
      writeRow('Beneficiary', beneficiaryName(retirement.retiredFor));

      doc.moveDown(0.5);
      drawDivider();

      // Chain anchor
      if (retirement.txHash) {
        doc
          .font('Helvetica-Bold')
          .fontSize(13)
          .text('Chain Anchor', { align: 'left' });
        doc.moveDown(0.5);
        writeRow('Tx hash', retirement.txHash);
        doc.moveDown(0.5);
        drawDivider();
      }

      // ── EU CBAM disclaimer (AV4-437) ────────────────────────────
      // Full disclaimer paragraph identical to the marketplace UI
      // strip — propagated to retirement statements because EU
      // buyers most often misread "credit retirement" as "CBAM
      // offset" (CBAM rejects this).
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#1d4ed8')
        .text('EU CBAM Disclaimer', { align: 'left' });
      doc.moveDown(0.25);
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#1f2937')
        .text(CBAM_DISCLAIMER.text, {
          align: 'left',
          width:
            doc.page.width - doc.page.margins.left - doc.page.margins.right,
        });
      doc.moveDown(0.25);
      doc
        .font('Helvetica-Oblique')
        .fontSize(9)
        .fillColor('#4b5563')
        .text(`Effective from: ${CBAM_DISCLAIMER.effectiveFrom}`, {
          align: 'left',
        });
      doc.moveDown(1);
      doc.fillColor('#000');

      // Footer
      doc
        .font('Helvetica-Oblique')
        .fontSize(9)
        .fillColor('#888')
        .text(
          'This statement is generated automatically. The chain transaction ' +
            'and registry burn record are the source of truth.',
          doc.page.margins.left,
          doc.page.height - doc.page.margins.bottom - 20,
          {
            width:
              doc.page.width - doc.page.margins.left - doc.page.margins.right,
            align: 'center',
          },
        );

      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
