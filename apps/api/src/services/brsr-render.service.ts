/**
 * AAT-10D (Wave 10d) — BRSR Core PDF + XBRL renderer.
 *
 * Backs the Generate button on the BRSR Builder page. Two outputs:
 *
 *   • renderBrsrPdf   — pdfkit-based PDF with cover page, table of
 *                       contents, one section per principle, page
 *                       numbers. Aimed at human review / regulator
 *                       submission alongside the XBRL.
 *
 *   • renderBrsrXbrl  — well-formed XBRL XML using the SEBI BRSR Core
 *                       taxonomy namespace. Element naming derives from
 *                       BrsrIndicator.code (P3-E-1 → brsr:P3_E_1).
 *
 * The XBRL output is *well-formed but not fully schema-valid* against
 * the SEBI BRSR Core XSD — see the `XBRL_TAXONOMY_GAPS` constant for
 * the explicit list of things a Wave 11+ certification gate would need
 * to add (label/reference linkbases, decimals, footnotes, dimension
 * hyperdimensional contexts for table rows, etc.).
 *
 * Usage:
 *   const pdfBuf = await renderBrsrPdf(orgId, 2025);
 *   const xbrlXml = await renderBrsrXbrl(orgId, 2025);
 *
 * Both functions are read-only — they pull existing BrsrResponse rows
 * via Prisma and never mutate state.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import PDFDocument from 'pdfkit';

import { prisma } from '@aurex/database';

import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/error-handler.js';

// ─── Types ─────────────────────────────────────────────────────────────

interface PrincipleRow {
  id: string;
  number: number;
  title: string;
  description: string | null;
}

interface IndicatorRow {
  id: string;
  principleId: string | null;
  section: string;
  indicatorType: string;
  code: string;
  title: string;
  description: string | null;
}

interface ResponseRow {
  id: string;
  orgId: string;
  indicatorId: string;
  fiscalYear: string;
  value: unknown;
  notes: string | null;
  indicator: IndicatorRow;
}

interface OrgRow {
  id: string;
  name: string;
  slug: string;
}

// ─── Public constants ──────────────────────────────────────────────────

/**
 * SEBI BRSR Core taxonomy namespace. The real taxonomy isn't published
 * under a stable URI yet — this is a placeholder URI consistent with
 * SEBI's other XBRL taxonomies (e.g. corporate filings) so the
 * generated XBRL stays trivially refactor-able once the canonical URI
 * lands.
 */
export const BRSR_XBRL_NAMESPACE =
  'http://www.sebi.gov.in/xbrl/2023/brsr-core';

export const BRSR_XBRL_PREFIX = 'brsr';

/**
 * Things the SEBI BRSR Core XSD certification gate would require but
 * which we don't emit yet. Surfaced inline so reviewers (and the next
 * wave) know exactly what's not covered. Returned alongside the XBRL
 * blob via `xbrlGapNotes` in the rendered XML as XML comments so the
 * file is self-documenting.
 */
export const XBRL_TAXONOMY_GAPS: string[] = [
  'No schemaRef linkbase wired (SEBI BRSR taxonomy XSD URI is not yet stable)',
  'No label/reference/presentation/calculation linkbases',
  'Tabular indicators emit one element per row but do not declare ' +
    'hyperdimensional contexts — full SEBI taxonomy uses xbrldi:explicitMember',
  'No `decimals`/`precision` attributes on numeric facts',
  'No footnote linkbase',
  'Validation against `xbrl-2.1` core schema not performed in this wave',
];

// ─── Shared helpers ────────────────────────────────────────────────────

/**
 * Convert an indicator code (e.g. "P3-E-1", "SA-VII-1") into a
 * QName-safe local name. XML Schema Part 2 NCName allows letters,
 * digits, `_`, `-`, and `.` but cannot start with a digit. We collapse
 * non-NCName chars to `_` to keep names predictable across the codebase.
 */
export function indicatorCodeToXbrlName(code: string): string {
  if (!code) return 'unknown';
  // Replace any character that's not [A-Za-z0-9_] with '_'.
  let safe = code.replace(/[^A-Za-z0-9_]/g, '_');
  // NCName cannot start with a digit. Pad with an underscore if so.
  if (/^[0-9]/.test(safe)) safe = `_${safe}`;
  return safe;
}

/**
 * RFC-style escape for XML text + attribute content. We intentionally
 * keep this self-contained rather than pulling in a full XML library —
 * the output is small + write-only.
 */
export function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Indian fiscal year `YYYY-YY` (e.g. `2024-25`) → the calendar
 * start/end dates in ISO-8601 (1 Apr → 31 Mar). For an `endYear`
 * derivation we add 1 to the start year because BRSR fiscal years
 * always span two calendar years.
 */
export function fiscalYearToPeriod(fiscalYear: string): {
  startDate: string;
  endDate: string;
  startYear: number;
  endYear: number;
} {
  const m = /^(\d{4})-(\d{2})$/.exec(fiscalYear);
  if (!m) {
    throw new AppError(
      400,
      'Bad Request',
      `Invalid fiscal year format: "${fiscalYear}" (expected YYYY-YY)`,
    );
  }
  const startYear = Number(m[1]);
  const endYear = startYear + 1;
  return {
    startDate: `${startYear}-04-01`,
    endDate: `${endYear}-03-31`,
    startYear,
    endYear,
  };
}

/**
 * Look up the org row, throw 404 if missing, otherwise return only the
 * fields we care about for rendering.
 */
async function loadOrg(orgId: string): Promise<OrgRow> {
  const row = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, slug: true },
  });
  if (!row) throw new AppError(404, 'Not Found', 'Organization not found');
  return row;
}

/**
 * Load the full BRSR principle catalogue (P1..P9).
 */
async function loadPrinciples(): Promise<PrincipleRow[]> {
  const rows = await prisma.brsrPrinciple.findMany({
    where: { isActive: true },
    orderBy: { number: 'asc' },
    select: { id: true, number: true, title: true, description: true },
  });
  return rows;
}

/**
 * Load all responses + their indicator metadata for an org/year.
 */
async function loadResponses(
  orgId: string,
  fiscalYear: string,
): Promise<ResponseRow[]> {
  const rows = await prisma.brsrResponse.findMany({
    where: { orgId, fiscalYear },
    include: { indicator: true },
    orderBy: [{ indicator: { code: 'asc' } }],
  });
  return rows as unknown as ResponseRow[];
}

/**
 * Convert a fiscal-year *year* number (e.g. 2025) into the canonical
 * BRSR fiscal-year string (`2025-26`). The Generate button on the
 * builder passes a single year; the downstream service stores the
 * full string, so we normalize here.
 */
export function yearToFiscalYear(year: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new AppError(
      400,
      'Bad Request',
      `Invalid BRSR year: ${year} (expected 2000..2100)`,
    );
  }
  const next = (year + 1) % 100;
  return `${year}-${String(next).padStart(2, '0')}`;
}

/**
 * Format an indicator response value for inclusion in the human-readable
 * PDF. Object/array values get JSON-pretty-printed; primitives are
 * stringified directly. `null`/`undefined` becomes a literal em-dash
 * so rows aren't blank.
 */
export function formatResponseValue(
  value: unknown,
  indicatorType: string,
): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value || '—';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toLocaleString('en-IN') : '—';
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  // Tables / nested objects → indented JSON for legibility. Cap to
  // ~1500 chars so a malformed response can't blow a single page.
  let json: string;
  try {
    json = JSON.stringify(value, null, 2);
  } catch {
    json = '[unserializable]';
  }
  if (json.length > 1500) json = `${json.slice(0, 1500)}…`;
  // Hint for human readers — not load-bearing.
  return indicatorType === 'LEADERSHIP' ? json : json;
}

// ─── PDF rendering ─────────────────────────────────────────────────────

/**
 * Render a BRSR Core PDF for a single org/year. Returns the full PDF
 * bytes as a Buffer so the caller can `res.send(buf)` directly.
 *
 * Layout:
 *   1. Cover page: org name, BRSR year, generated date.
 *   2. Table of contents: Section A, B, P1..P9 + page numbers.
 *   3. Section A indicators (if any).
 *   4. Section B indicators (if any).
 *   5. One section per principle (P1..P9), with Essential and
 *      Leadership indicators interleaved by code.
 *
 * Empty sections still render their heading + a "no responses
 * submitted" placeholder so the document structure matches the form
 * layout regardless of completion state.
 */
export async function renderBrsrPdf(
  orgId: string,
  year: number,
): Promise<Buffer> {
  const fiscalYear = yearToFiscalYear(year);
  const [org, principles, responses] = await Promise.all([
    loadOrg(orgId),
    loadPrinciples(),
    loadResponses(orgId, fiscalYear),
  ]);

  logger.info(
    {
      orgId,
      fiscalYear,
      principleCount: principles.length,
      responseCount: responses.length,
    },
    'BRSR PDF render started',
  );

  // Group responses by principle and Section A/B for stable ordering.
  const sectionA = responses
    .filter((r) => r.indicator.section === 'SECTION_A')
    .sort((a, b) => a.indicator.code.localeCompare(b.indicator.code));
  const sectionB = responses
    .filter((r) => r.indicator.section === 'SECTION_B')
    .sort((a, b) => a.indicator.code.localeCompare(b.indicator.code));
  const byPrinciple = new Map<string, ResponseRow[]>();
  for (const r of responses) {
    if (r.indicator.principleId) {
      const list = byPrinciple.get(r.indicator.principleId) ?? [];
      list.push(r);
      byPrinciple.set(r.indicator.principleId, list);
    }
  }
  for (const list of byPrinciple.values()) {
    list.sort((a, b) => a.indicator.code.localeCompare(b.indicator.code));
  }

  // ── Build the PDF ──────────────────────────────────────────────────
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: 'A4',
      margin: 56,
      info: {
        Title: `BRSR Core Disclosure ${fiscalYear} — ${org.name}`,
        Author: org.name,
        Subject: 'Business Responsibility & Sustainability Report (BRSR Core)',
        Keywords: `BRSR, SEBI, sustainability, ${fiscalYear}, ${org.slug}`,
        CreationDate: new Date(),
      },
    });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    // ── Cover page ───────────────────────────────────────────────────
    doc
      .fontSize(28)
      .fillColor('#1a5d3d')
      .text('BRSR Core Disclosure', { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(14)
      .fillColor('#374151')
      .text('Business Responsibility & Sustainability Report', {
        align: 'center',
      });
    doc.moveDown(2);
    doc
      .fontSize(20)
      .fillColor('#111827')
      .text(org.name, { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .fillColor('#6b7280')
      .text(`Organisation slug: ${org.slug}`, { align: 'center' });
    doc.moveDown(2);
    doc
      .fontSize(16)
      .fillColor('#111827')
      .text(`Fiscal Year ${fiscalYear}`, { align: 'center' });
    doc.moveDown(1);
    doc
      .fontSize(10)
      .fillColor('#6b7280')
      .text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
    doc.moveDown(0.25);
    doc
      .fontSize(10)
      .fillColor('#6b7280')
      .text(
        `${responses.length} indicator response${
          responses.length === 1 ? '' : 's'
        } across ${principles.length} principle${
          principles.length === 1 ? '' : 's'
        }`,
        { align: 'center' },
      );
    doc.moveDown(4);
    doc
      .fontSize(9)
      .fillColor('#9ca3af')
      .text(
        'Generated by Aurex (AurexV4) — SEBI BRSR Core (NGRBC, ' +
          '9 principles, Sections A/B/C). This document is for human ' +
          'review; the machine-readable XBRL counterpart is available ' +
          'via the same Generate menu.',
        { align: 'center' },
      );

    // ── Table of contents ────────────────────────────────────────────
    doc.addPage();
    doc.fontSize(20).fillColor('#1a5d3d').text('Table of Contents');
    doc.moveDown(0.75);
    doc.fontSize(11).fillColor('#111827');
    const tocItems: Array<{ label: string; count: number }> = [
      {
        label: 'Section A · General Disclosures',
        count: sectionA.length,
      },
      {
        label: 'Section B · Management & Process',
        count: sectionB.length,
      },
      ...principles.map((p) => ({
        label: `Principle ${p.number} · ${p.title}`,
        count: byPrinciple.get(p.id)?.length ?? 0,
      })),
    ];
    for (const item of tocItems) {
      doc
        .fillColor('#111827')
        .text(item.label, { continued: true })
        .fillColor('#6b7280')
        .text(`   (${item.count} response${item.count === 1 ? '' : 's'})`);
      doc.moveDown(0.25);
    }

    // ── Section A ────────────────────────────────────────────────────
    renderPdfSection(
      doc,
      'Section A · General Disclosures',
      'Entity-level disclosures: identity, business, employees, governance.',
      sectionA,
    );

    // ── Section B ────────────────────────────────────────────────────
    renderPdfSection(
      doc,
      'Section B · Management & Process Disclosures',
      'Policy coverage, governance, board oversight across the 9 principles.',
      sectionB,
    );

    // ── Section C: principles ────────────────────────────────────────
    for (const p of principles) {
      const items = byPrinciple.get(p.id) ?? [];
      renderPdfSection(
        doc,
        `Principle ${p.number} · ${p.title}`,
        p.description ?? '',
        items,
      );
    }

    // ── Page numbers footer (post-process) ──────────────────────────
    // pdfkit lets us iterate pages after writing all content. Add a
    // footer at the bottom of every page except the cover.
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      // Reset to a non-fancy font + size for the footer.
      doc
        .fontSize(8)
        .fillColor('#9ca3af')
        .text(
          `${org.name} · BRSR Core ${fiscalYear} · Page ${i + 1} of ${
            range.count
          }`,
          56,
          doc.page.height - 36,
          { align: 'center', width: doc.page.width - 112 },
        );
    }

    doc.end();
  });
}

/**
 * Render one labelled section of the BRSR PDF — used for Section A,
 * Section B, and each Section-C principle. Pulled out to keep the
 * top-level renderer readable.
 */
function renderPdfSection(
  doc: PDFKit.PDFDocument,
  title: string,
  description: string,
  responses: ResponseRow[],
): void {
  doc.addPage();
  doc.fontSize(18).fillColor('#1a5d3d').text(title);
  if (description) {
    doc.moveDown(0.25);
    doc.fontSize(10).fillColor('#6b7280').text(description, {
      width: doc.page.width - 112,
    });
  }
  doc.moveDown(0.75);

  if (responses.length === 0) {
    doc
      .fontSize(10)
      .fillColor('#9ca3af')
      .font('Helvetica-Oblique')
      .text(
        'No responses submitted for this section in the selected fiscal year.',
      )
      .font('Helvetica');
    return;
  }

  for (const r of responses) {
    // Force a page break if we're getting close to the bottom — keeps
    // an indicator's label + value on the same page when feasible.
    if (doc.y > doc.page.height - 200) doc.addPage();

    doc
      .fontSize(11)
      .fillColor('#111827')
      .text(`${r.indicator.code} — ${r.indicator.title}`, {
        width: doc.page.width - 112,
      });
    doc.moveDown(0.1);
    doc
      .fontSize(8)
      .fillColor('#9ca3af')
      .text(
        `${r.indicator.indicatorType.toLowerCase()} · ${r.indicator.section.toLowerCase()}`,
      );
    doc.moveDown(0.25);

    const formatted = formatResponseValue(r.value, r.indicator.indicatorType);
    doc
      .fontSize(10)
      .fillColor('#111827')
      .font('Courier')
      .text(formatted, {
        width: doc.page.width - 112,
      })
      .font('Helvetica');

    if (r.notes && r.notes.trim().length > 0) {
      doc.moveDown(0.25);
      doc
        .fontSize(9)
        .fillColor('#6b7280')
        .text(`Notes: ${r.notes}`, { width: doc.page.width - 112 });
    }
    doc.moveDown(0.5);
    // Soft separator between indicators.
    doc
      .strokeColor('#e5e7eb')
      .lineWidth(0.5)
      .moveTo(56, doc.y)
      .lineTo(doc.page.width - 56, doc.y)
      .stroke();
    doc.moveDown(0.5);
  }
}

// ─── XBRL rendering ────────────────────────────────────────────────────

/**
 * Render the org/year's BRSR Core responses as well-formed XBRL XML.
 *
 * Output structure (simplified — see XBRL_TAXONOMY_GAPS for the full
 * delta vs. SEBI's certification-grade XSD):
 *
 *   <xbrl xmlns="…xbrl-instance-2003" xmlns:brsr="…brsr-core" …>
 *     <!-- gap notes (XML comments) -->
 *     <context id="ctx-2024-25">
 *       <entity>
 *         <identifier scheme="aurex">{orgSlug}</identifier>
 *       </entity>
 *       <period>
 *         <startDate>2024-04-01</startDate>
 *         <endDate>2025-03-31</endDate>
 *       </period>
 *     </context>
 *     <unit id="INR"><measure>iso4217:INR</measure></unit>
 *     <unit id="kgCO2e"><measure>brsr:kgCO2e</measure></unit>
 *     <unit id="percent"><measure>xbrli:pure</measure></unit>
 *     <brsr:P1_E_1 contextRef="ctx-2024-25">…value…</brsr:P1_E_1>
 *     …
 *   </xbrl>
 *
 * Tabular indicators (where indicator type signals a table — currently
 * detected by `value` being a JSON array) emit one element per row,
 * suffixed with `_TableRow_N`. This is *not* the full XBRL Dimensions
 * (xbrldi) treatment — see XBRL_TAXONOMY_GAPS — but gives row-level
 * traceability without breaking schema validation.
 */
export async function renderBrsrXbrl(
  orgId: string,
  year: number,
): Promise<string> {
  const fiscalYear = yearToFiscalYear(year);
  const [org, responses] = await Promise.all([
    loadOrg(orgId),
    loadResponses(orgId, fiscalYear),
  ]);

  const period = fiscalYearToPeriod(fiscalYear);
  const contextId = `ctx-${fiscalYear}`;

  logger.info(
    { orgId, fiscalYear, responseCount: responses.length },
    'BRSR XBRL render started',
  );

  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  // Self-document the wave's known taxonomy gaps so reviewers can see
  // them without digging into TypeScript.
  lines.push('<!--');
  lines.push('  Generated by Aurex AAT-10D / Wave 10d.');
  lines.push('  Well-formed XBRL — see XBRL_TAXONOMY_GAPS for delta vs. SEBI XSD:');
  for (const gap of XBRL_TAXONOMY_GAPS) {
    lines.push(`    - ${gap}`);
  }
  lines.push('-->');

  lines.push(
    [
      '<xbrl',
      'xmlns="http://www.xbrl.org/2003/instance"',
      'xmlns:xbrli="http://www.xbrl.org/2003/instance"',
      'xmlns:link="http://www.xbrl.org/2003/linkbase"',
      'xmlns:xlink="http://www.w3.org/1999/xlink"',
      'xmlns:iso4217="http://www.xbrl.org/2003/iso4217"',
      `xmlns:${BRSR_XBRL_PREFIX}="${BRSR_XBRL_NAMESPACE}"`,
      '>',
    ].join(' '),
  );

  // ── context ────────────────────────────────────────────────────────
  lines.push(`  <context id="${contextId}">`);
  lines.push('    <entity>');
  lines.push(
    `      <identifier scheme="https://aurex.in/orgs">${escapeXml(
      org.slug,
    )}</identifier>`,
  );
  lines.push('    </entity>');
  lines.push('    <period>');
  lines.push(`      <startDate>${period.startDate}</startDate>`);
  lines.push(`      <endDate>${period.endDate}</endDate>`);
  lines.push('    </period>');
  lines.push('  </context>');

  // ── units ──────────────────────────────────────────────────────────
  lines.push('  <unit id="INR">');
  lines.push('    <measure>iso4217:INR</measure>');
  lines.push('  </unit>');
  lines.push('  <unit id="kgCO2e">');
  lines.push(`    <measure>${BRSR_XBRL_PREFIX}:kgCO2e</measure>`);
  lines.push('  </unit>');
  lines.push('  <unit id="percent">');
  lines.push('    <measure>xbrli:pure</measure>');
  lines.push('  </unit>');
  lines.push('  <unit id="count">');
  lines.push(`    <measure>${BRSR_XBRL_PREFIX}:count</measure>`);
  lines.push('  </unit>');

  // ── facts (one element per indicator-response) ─────────────────────
  for (const r of responses) {
    const baseName = indicatorCodeToXbrlName(r.indicator.code);
    const qname = `${BRSR_XBRL_PREFIX}:${baseName}`;
    const value = r.value;

    if (Array.isArray(value)) {
      // Tabular indicator → emit one element per row. SEBI certification
      // would model these as xbrldi:explicitMember dimensions; we emit
      // a `<comment>` flag per the task spec so the gap is visible in
      // the file itself, not just in the gap notes header.
      lines.push(
        `  <!-- table indicator ${escapeXml(
          r.indicator.code,
        )}: ${value.length} row(s); SEBI certification path = xbrldi:explicitMember -->`,
      );
      value.forEach((row, idx) => {
        const rowName = `${baseName}_TableRow_${idx + 1}`;
        const rowQName = `${BRSR_XBRL_PREFIX}:${rowName}`;
        const serialized = serializeXbrlScalar(row);
        lines.push(
          `  <${rowQName} contextRef="${contextId}">${serialized}</${rowQName}>`,
        );
      });
    } else if (
      value !== null &&
      typeof value === 'object' &&
      !(value instanceof Date)
    ) {
      // Object-valued indicator types are reasonably common for BRSR
      // (e.g. `{ male: 12, female: 8 }`). Serialize via JSON → XBRL
      // string fact. Long-term these would be stringItemType + child
      // dimensions per SEBI taxonomy.
      lines.push(
        `  <!-- object-valued indicator ${escapeXml(
          r.indicator.code,
        )}: serialized as JSON string fact (SEBI taxonomy uses dimensional decomposition) -->`,
      );
      lines.push(
        `  <${qname} contextRef="${contextId}">${escapeXml(
          JSON.stringify(value),
        )}</${qname}>`,
      );
    } else if (
      value === null ||
      value === undefined ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      const serialized = serializeXbrlScalar(value);
      lines.push(
        `  <${qname} contextRef="${contextId}">${serialized}</${qname}>`,
      );
    } else {
      // Future-proof: any indicator type we haven't taught the renderer
      // about lands here. Per the task spec we emit it as a `<comment>`
      // rather than dropping it silently so reviewers can see the gap.
      const safe = escapeXml(String(value));
      lines.push(
        `  <!-- UNHANDLED indicator type for ${escapeXml(
          r.indicator.code,
        )}: ${safe} -->`,
      );
    }
  }

  lines.push('</xbrl>');
  lines.push('');

  return lines.join('\n');
}

// ─── XSD validation (AAT-R2 / AV4-426) ────────────────────────────────

/**
 * SEBI BRSR Core XSD bundled-schema version. Bumped whenever the
 * vendored XSD at `./brsr/sebi-brsr-core.xsd` is replaced. The
 * placeholder ships as `0.0.0-placeholder` so downstream filters can
 * spot warn-mode validation in the API response.
 *
 * IMPORTANT: when the canonical SEBI XSD is dropped in, change this
 * constant to the SEBI taxonomy version (e.g. `2024-04`) and flip
 * `validateBrsrXbrl` from warn-mode to hard-fail (see route).
 */
export const BRSR_XSD_VERSION = '0.0.0-placeholder';

/**
 * Filesystem path to the vendored SEBI BRSR Core XSD. Resolved off
 * `import.meta.url` so the lookup works both in dev (tsx) and after
 * tsc emits to `dist/` (the file is copied alongside via the loader
 * fallback below).
 */
const _moduleDir = dirname(fileURLToPath(import.meta.url));
export const BRSR_XSD_PATH = resolvePath(
  _moduleDir,
  'brsr',
  'sebi-brsr-core.xsd',
);

/**
 * Result returned by `validateBrsrXbrl`. `valid === true` means *no*
 * structural errors were detected by the placeholder validator; it
 * does **NOT** imply SEBI-certified compliance — see XBRL_TAXONOMY_GAPS
 * + the placeholder XSD docblock for the full caveat.
 */
export interface BrsrXsdValidationResult {
  valid: boolean;
  errors: string[];
  /**
   * Bundled XSD version used for the validation pass. Surfaced in the
   * API response so dashboards can flag warn-mode filings.
   */
  xsdVersion: string;
  /**
   * `true` until the canonical SEBI XSD replaces the vendored
   * placeholder. Operators should treat any `placeholder: true`
   * validation result as advisory only.
   */
  placeholder: boolean;
}

/**
 * Lazily load the vendored XSD body. We never use it for *real* XSD
 * validation (that would require libxmljs2, which isn't installed in
 * this monorepo's API image — adding a native dep is out of scope for
 * the warn-mode gate); instead we keep the load behind a try so a
 * missing-file misdeploy doesn't break the render path.
 *
 * Cached after first read because the file is small and the render
 * route can be hammered by Generate-button retries.
 */
let _cachedXsd: string | null = null;
function loadVendoredXsd(): string | null {
  if (_cachedXsd !== null) return _cachedXsd;
  try {
    _cachedXsd = readFileSync(BRSR_XSD_PATH, 'utf-8');
    return _cachedXsd;
  } catch (err) {
    logger.warn(
      { err, path: BRSR_XSD_PATH },
      'BRSR XSD not found on disk — running structural-only validation',
    );
    return null;
  }
}

/**
 * Structural / pure-JS validation pass for a BRSR XBRL document.
 *
 * AAT-R2 / AV4-426: SEBI mandates BRSR Core XBRL filings validate
 * against the SEBI XSD. The canonical XSD wasn't fetchable in this
 * build environment, so this validator runs a regex/structural-grade
 * check that detects the most common malformation modes (missing
 * namespace, missing context/unit blocks, missing contextRef on facts).
 * It is NOT a substitute for true XSD validation — when the canonical
 * SEBI XSD is vendored at `./brsr/sebi-brsr-core.xsd` and a real XSD
 * validator (e.g. libxmljs2, native dep) is wired in, replace the body
 * of this function. The route consumer (`apps/api/src/routes/brsr.ts`)
 * is wired to surface errors in the API response without blocking the
 * download (warn-mode); flip to hard-fail by changing the route to
 * return 422 on `valid === false`.
 *
 * Returns:
 *   - `valid: true`  when no structural defect detected.
 *   - `valid: false` + `errors[]` when defects are present. Errors are
 *     human-readable and ordered by appearance in the doc.
 */
export function validateBrsrXbrl(xml: string): BrsrXsdValidationResult {
  const errors: string[] = [];

  if (typeof xml !== 'string' || xml.length === 0) {
    return {
      valid: false,
      errors: ['Empty or non-string XBRL payload'],
      xsdVersion: BRSR_XSD_VERSION,
      placeholder: true,
    };
  }

  // Force the XSD load attempt so misdeploys (XSD missing) get logged
  // even though we don't currently use the contents. Surfacing a hint
  // when the file is missing helps operators diagnose container builds.
  const xsdBody = loadVendoredXsd();
  if (xsdBody === null) {
    errors.push(
      `Vendored SEBI BRSR Core XSD not found at ${BRSR_XSD_PATH} — ` +
        'falling back to structural validation. Replace the placeholder ' +
        'XSD when the canonical SEBI taxonomy is published.',
    );
  }

  // ── 1. Well-formed XML preamble ───────────────────────────────────────
  if (!xml.trimStart().startsWith('<?xml')) {
    errors.push('Missing XML declaration (`<?xml version="1.0" …?>`)');
  }

  // ── 2. Root element + xbrl-instance-2003 namespace ────────────────────
  const xbrlOpen = /<xbrl[\s>]/.exec(xml);
  if (!xbrlOpen) {
    errors.push('Missing root <xbrl> element');
  }
  if (!xml.includes('xmlns="http://www.xbrl.org/2003/instance"')) {
    errors.push(
      'Missing default xbrl-instance-2003 namespace declaration ' +
        '(`xmlns="http://www.xbrl.org/2003/instance"`)',
    );
  }

  // ── 3. SEBI BRSR Core namespace ───────────────────────────────────────
  if (!xml.includes(BRSR_XBRL_NAMESPACE)) {
    errors.push(
      `Missing SEBI BRSR Core namespace declaration (${BRSR_XBRL_NAMESPACE})`,
    );
  }

  // ── 4. At least one <context> with start/end period ──────────────────
  const contextMatch = /<context\b[^>]*\bid="([^"]+)"/i.exec(xml);
  if (!contextMatch) {
    errors.push('Missing <context id="…"> block');
  } else {
    if (!/<startDate>\s*\d{4}-\d{2}-\d{2}\s*<\/startDate>/.test(xml)) {
      errors.push('Missing or malformed <startDate> in reporting context');
    }
    if (!/<endDate>\s*\d{4}-\d{2}-\d{2}\s*<\/endDate>/.test(xml)) {
      errors.push('Missing or malformed <endDate> in reporting context');
    }
    if (!/<entity>[\s\S]*?<identifier\b[^>]*>[^<]+<\/identifier>/i.test(xml)) {
      errors.push('Missing <entity><identifier> in reporting context');
    }
  }

  // ── 5. At least one <unit> declaration ───────────────────────────────
  if (!/<unit\b[^>]*\bid=/.test(xml)) {
    errors.push('Missing <unit id="…"> declaration');
  }

  // ── 6. All <brsr:…> facts must carry contextRef ──────────────────────
  // We deliberately accept the comment lines (which start with `<!--`)
  // and only flag genuine element opening tags. Self-closing tags are
  // accepted as long as they carry contextRef.
  const factPattern = new RegExp(
    `<${BRSR_XBRL_PREFIX}:([A-Za-z0-9_]+)\\b([^>]*)>`,
    'g',
  );
  const seenFactNames = new Set<string>();
  let factCount = 0;
  let m: RegExpExecArray | null;
  while ((m = factPattern.exec(xml)) !== null) {
    factCount += 1;
    const elementName = m[1] ?? 'unknown';
    const attrChunk = m[2] ?? '';
    if (!/\bcontextRef\s*=\s*"[^"]+"/i.test(attrChunk)) {
      // Cap the per-doc error list so a malformed render doesn't blow
      // the response payload — first 5 are typically enough to root-cause.
      if (seenFactNames.size < 5) {
        seenFactNames.add(elementName);
        errors.push(
          `Fact <${BRSR_XBRL_PREFIX}:${elementName}> is missing contextRef attribute`,
        );
      }
    }
  }

  // ── 7. Closing root tag ──────────────────────────────────────────────
  if (xbrlOpen && !xml.includes('</xbrl>')) {
    errors.push('Missing closing </xbrl> tag (truncated document?)');
  }

  // Warn — but don't error — when the doc has zero facts. Some orgs file
  // empty-shell BRSR placeholders during the initial reporting cycle.
  if (factCount === 0) {
    logger.info(
      'BRSR XBRL has zero brsr:* facts — likely an empty-shell placeholder',
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    xsdVersion: BRSR_XSD_VERSION,
    placeholder: true,
  };
}

/**
 * Serialize a scalar value (string/number/boolean/null) for an XBRL
 * fact body. `null`/`undefined` round-trip to an empty element so the
 * facts stay well-formed.
 */
function serializeXbrlScalar(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return escapeXml(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  // Fallback (defensive — caller should already have routed away from
  // here for objects/arrays).
  return escapeXml(String(value));
}
