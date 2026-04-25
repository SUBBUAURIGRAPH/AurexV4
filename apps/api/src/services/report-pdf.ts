/**
 * AAT-10C (Wave 10c) — Single-page printable PDF summary for the
 * report download endpoint.
 *
 * We use `pdfkit` (small, ~70KB on disk) rather than a headless
 * browser. The layout is intentionally bare-bones: title + a label/
 * value table. The CSV/JSON formats remain the source of truth for
 * downstream automation; the PDF is just a printable cover page.
 */

import PDFDocument from 'pdfkit';
import type { SummaryItem } from './report-export.js';

export interface PdfRenderInput {
  reportType: string;
  reportId: string;
  summary: SummaryItem[];
}

/**
 * Render the cover page to a UTF-8 buffer. Resolves once pdfkit emits
 * the `end` event; no streaming because the route handler needs a
 * fixed-size buffer for `Content-Length`.
 */
export async function renderReportPdf(
  input: PdfRenderInput,
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 56,
        info: {
          Title: `Aurex Report — ${input.reportType.toUpperCase()}`,
          Author: 'Aurex Sustainability Platform',
          Subject: `Report ${input.reportId}`,
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
        .text(`Aurex ${input.reportType.toUpperCase()} Report`, { align: 'left' });
      doc.moveDown(0.5);
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#666')
        .text(`Report ID: ${input.reportId}`);
      doc.moveDown(1);
      doc.fillColor('#000');

      // Divider
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

      // Summary section heading
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .text('Summary', { align: 'left' });
      doc.moveDown(0.5);

      // label/value table — fixed column widths so long values wrap
      // without overflowing into the label column.
      const labelX = doc.page.margins.left;
      const valueX = labelX + 160;
      const valueWidth = doc.page.width - doc.page.margins.right - valueX;

      doc.font('Helvetica').fontSize(11);
      for (const item of input.summary) {
        const startY = doc.y;
        doc.fillColor('#555').text(item.label, labelX, startY, { width: 150 });
        const labelEndY = doc.y;
        doc
          .fillColor('#000')
          .text(item.value, valueX, startY, { width: valueWidth });
        const valueEndY = doc.y;
        // Move cursor below whichever column wrapped the most.
        doc.y = Math.max(labelEndY, valueEndY) + 4;
      }

      doc.moveDown(1);
      drawDivider();

      // Footer
      doc
        .font('Helvetica-Oblique')
        .fontSize(9)
        .fillColor('#888')
        .text(
          'This is a printable summary. The CSV / JSON exports contain the full report data.',
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
