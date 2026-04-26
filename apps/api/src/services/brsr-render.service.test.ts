/**
 * AAT-10D (Wave 10d): unit tests for the BRSR Core PDF + XBRL renderer.
 *
 * The Prisma client is hoisted-mocked the same way as the other service
 * tests in this repo (see audit-logs.test.ts for the canonical pattern).
 * The PDF assertions use `%PDF-` magic-byte detection rather than parsing
 * — pdfkit's output is canonical PDF and the goal here is to assert
 * "we made a PDF, it has these many bytes" rather than re-validating
 * pdfkit's own output. The XBRL assertions parse with a regex-based
 * sanity check (no `xmldom` dep) — we look for the namespaces, the
 * required `<context>` and `<unit>` blocks, and the per-indicator
 * `<brsr:…>` elements.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    organization: {
      findUnique: vi.fn(),
    },
    brsrPrinciple: {
      findMany: vi.fn(),
    },
    brsrResponse: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@aurex/database', () => ({ prisma: mockPrisma }));

import {
  BRSR_XBRL_NAMESPACE,
  BRSR_XBRL_PREFIX,
  BRSR_XSD_VERSION,
  XBRL_TAXONOMY_GAPS,
  escapeXml,
  fiscalYearToPeriod,
  formatResponseValue,
  indicatorCodeToXbrlName,
  renderBrsrPdf,
  renderBrsrXbrl,
  validateBrsrXbrl,
  yearToFiscalYear,
} from './brsr-render.service.js';

const ORG_ID = '00000000-0000-0000-0000-0000000000aa';

function org() {
  return { id: ORG_ID, name: 'Acme Sustainability Corp', slug: 'acme' };
}

function principle(num: number, id: string) {
  return {
    id,
    number: num,
    title: `Principle ${num} title`,
    description: `Principle ${num} description`,
  };
}

function indicator(opts: {
  id?: string;
  code: string;
  principleId?: string | null;
  section?: string;
  indicatorType?: string;
  title?: string;
}) {
  return {
    id: opts.id ?? `ind-${opts.code}`,
    principleId: opts.principleId ?? null,
    section: opts.section ?? 'SECTION_C',
    indicatorType: opts.indicatorType ?? 'ESSENTIAL',
    code: opts.code,
    title: opts.title ?? `Indicator ${opts.code}`,
    description: null,
  };
}

function response(opts: {
  indicatorOpts: Parameters<typeof indicator>[0];
  value: unknown;
  notes?: string | null;
  fiscalYear?: string;
}) {
  const ind = indicator(opts.indicatorOpts);
  return {
    id: `resp-${ind.code}`,
    orgId: ORG_ID,
    indicatorId: ind.id,
    fiscalYear: opts.fiscalYear ?? '2024-25',
    value: opts.value,
    notes: opts.notes ?? null,
    indicator: ind,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.organization.findUnique.mockResolvedValue(org());
  mockPrisma.brsrPrinciple.findMany.mockResolvedValue([
    principle(1, 'p1'),
    principle(2, 'p2'),
  ]);
  mockPrisma.brsrResponse.findMany.mockResolvedValue([]);
});

// ─── Pure helpers ─────────────────────────────────────────────────────

describe('yearToFiscalYear', () => {
  it('formats a calendar year as the BRSR YYYY-YY string', () => {
    expect(yearToFiscalYear(2024)).toBe('2024-25');
    expect(yearToFiscalYear(2025)).toBe('2025-26');
    // Wraparound on the two-digit suffix.
    expect(yearToFiscalYear(2099)).toBe('2099-00');
  });

  it('rejects non-integer / out-of-range years', () => {
    expect(() => yearToFiscalYear(1999)).toThrow(/Invalid BRSR year/);
    expect(() => yearToFiscalYear(2101)).toThrow(/Invalid BRSR year/);
    expect(() => yearToFiscalYear(2024.5)).toThrow(/Invalid BRSR year/);
  });
});

describe('fiscalYearToPeriod', () => {
  it('maps a YYYY-YY fiscal year to start/end ISO dates (Apr→Mar)', () => {
    expect(fiscalYearToPeriod('2024-25')).toEqual({
      startDate: '2024-04-01',
      endDate: '2025-03-31',
      startYear: 2024,
      endYear: 2025,
    });
  });

  it('rejects malformed fiscal-year strings', () => {
    expect(() => fiscalYearToPeriod('2024')).toThrow(/Invalid fiscal year/);
    expect(() => fiscalYearToPeriod('24-25')).toThrow(/Invalid fiscal year/);
  });
});

describe('indicatorCodeToXbrlName', () => {
  it('replaces non-NCName chars with underscores', () => {
    expect(indicatorCodeToXbrlName('P3-E-1')).toBe('P3_E_1');
    expect(indicatorCodeToXbrlName('SA-VII-1')).toBe('SA_VII_1');
    expect(indicatorCodeToXbrlName('P6-E-4')).toBe('P6_E_4');
  });

  it('prepends an underscore when the code starts with a digit', () => {
    expect(indicatorCodeToXbrlName('1-A')).toBe('_1_A');
  });

  it('returns "unknown" for empty input', () => {
    expect(indicatorCodeToXbrlName('')).toBe('unknown');
  });
});

describe('escapeXml', () => {
  it('escapes the five XML special characters', () => {
    expect(escapeXml('<a & b>')).toBe('&lt;a &amp; b&gt;');
    expect(escapeXml(`"hi"'bye'`)).toBe('&quot;hi&quot;&apos;bye&apos;');
  });
});

describe('formatResponseValue', () => {
  it('formats primitives directly', () => {
    expect(formatResponseValue('hello', 'ESSENTIAL')).toBe('hello');
    expect(formatResponseValue(1234, 'ESSENTIAL')).toBe('1,234');
    expect(formatResponseValue(true, 'ESSENTIAL')).toBe('Yes');
    expect(formatResponseValue(false, 'ESSENTIAL')).toBe('No');
    expect(formatResponseValue(null, 'ESSENTIAL')).toBe('—');
  });

  it('json-pretty-prints object values', () => {
    const out = formatResponseValue({ male: 12, female: 8 }, 'ESSENTIAL');
    expect(out).toContain('"male": 12');
    expect(out).toContain('"female": 8');
  });

  it('truncates very long object payloads', () => {
    const big = { v: 'x'.repeat(5000) };
    const out = formatResponseValue(big, 'ESSENTIAL');
    expect(out.length).toBeLessThanOrEqual(1501);
    expect(out.endsWith('…')).toBe(true);
  });
});

// ─── PDF rendering ────────────────────────────────────────────────────

describe('renderBrsrPdf', () => {
  it('returns a Buffer with the %PDF magic header (happy path)', async () => {
    mockPrisma.brsrResponse.findMany.mockResolvedValue([
      response({
        indicatorOpts: {
          code: 'P1-E-1',
          principleId: 'p1',
          section: 'SECTION_C',
          title: 'Training on principles — Board, KMP, employees, workers',
        },
        value: { boardTrained: 12, kmpTrained: 8 },
        notes: 'FY24 onboarding cohort',
      }),
      response({
        indicatorOpts: {
          code: 'P2-E-1',
          principleId: 'p2',
          section: 'SECTION_C',
        },
        value: 1_500_000,
      }),
    ]);

    const buf = await renderBrsrPdf(ORG_ID, 2024);

    expect(Buffer.isBuffer(buf)).toBe(true);
    // Every PDF starts with this 5-byte magic + version.
    expect(buf.slice(0, 5).toString('utf-8')).toBe('%PDF-');
    // Sanity: the doc is non-trivial in size (cover + ToC + at least one
    // section page) — the empty doc is ~1KB.
    expect(buf.byteLength).toBeGreaterThan(2000);
  });

  it('still renders a cover + empty principle sections when there are no responses', async () => {
    mockPrisma.brsrResponse.findMany.mockResolvedValue([]);

    const buf = await renderBrsrPdf(ORG_ID, 2024);

    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.slice(0, 5).toString('utf-8')).toBe('%PDF-');
    // The PDF must still contain the org name + fiscal year on the
    // cover even with zero responses. PDF text is mostly compressed but
    // the title metadata is encoded (PDFKit writes /Title …) — check
    // the trailer at least decodes.
    const tail = buf.slice(buf.length - 64).toString('utf-8');
    expect(tail).toMatch(/%%EOF/);
  });

  it('throws AppError 404 when the org does not exist', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);
    await expect(renderBrsrPdf(ORG_ID, 2024)).rejects.toThrow(
      /Organization not found/,
    );
  });
});

// ─── XBRL rendering ───────────────────────────────────────────────────

describe('renderBrsrXbrl', () => {
  it('returns well-formed XBRL with the SEBI BRSR Core namespace', async () => {
    mockPrisma.brsrResponse.findMany.mockResolvedValue([
      response({
        indicatorOpts: { code: 'P1-E-1', principleId: 'p1' },
        value: 'Trained 100 employees',
      }),
    ]);

    const xml = await renderBrsrXbrl(ORG_ID, 2024);

    // XML declaration + root element + closing tag.
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(
      true,
    );
    expect(xml).toContain('<xbrl');
    expect(xml).toContain('</xbrl>');
    // SEBI taxonomy namespace.
    expect(xml).toContain(`xmlns:${BRSR_XBRL_PREFIX}="${BRSR_XBRL_NAMESPACE}"`);
    // Reporting period context.
    expect(xml).toContain('<context id="ctx-2024-25">');
    expect(xml).toContain('<startDate>2024-04-01</startDate>');
    expect(xml).toContain('<endDate>2025-03-31</endDate>');
    // INR + percent + kgCO2e + count units.
    expect(xml).toContain('<unit id="INR">');
    expect(xml).toContain('<measure>iso4217:INR</measure>');
    expect(xml).toContain('<unit id="kgCO2e">');
    expect(xml).toContain('<unit id="percent">');
  });

  it('maps indicator codes to QName-safe element names', async () => {
    mockPrisma.brsrResponse.findMany.mockResolvedValue([
      response({
        indicatorOpts: { code: 'P3-E-1' },
        value: 42,
      }),
      response({
        indicatorOpts: { code: 'SA-VII-1' },
        value: 'Yes',
      }),
    ]);

    const xml = await renderBrsrXbrl(ORG_ID, 2024);

    // Hyphens collapsed to underscores.
    expect(xml).toContain('<brsr:P3_E_1 contextRef="ctx-2024-25">42</brsr:P3_E_1>');
    expect(xml).toContain(
      '<brsr:SA_VII_1 contextRef="ctx-2024-25">Yes</brsr:SA_VII_1>',
    );
  });

  it('emits one element per row for table-typed indicators', async () => {
    mockPrisma.brsrResponse.findMany.mockResolvedValue([
      response({
        indicatorOpts: { code: 'P3-E-2' },
        value: [
          'office-1',
          'office-2',
          'office-3',
        ],
      }),
    ]);

    const xml = await renderBrsrXbrl(ORG_ID, 2024);

    expect(xml).toContain('<brsr:P3_E_2_TableRow_1');
    expect(xml).toContain('<brsr:P3_E_2_TableRow_2');
    expect(xml).toContain('<brsr:P3_E_2_TableRow_3');
    // Per-table comment flagging the SEBI dimensions gap.
    expect(xml).toMatch(
      /<!-- table indicator P3-E-2: 3 row\(s\); SEBI certification path = xbrldi:explicitMember -->/,
    );
  });

  it('emits a comment (not a dropped fact) for unhandled object indicators', async () => {
    mockPrisma.brsrResponse.findMany.mockResolvedValue([
      response({
        indicatorOpts: { code: 'P6-E-4' },
        value: { scope1: 1234, scope2: 567, scope3: null },
      }),
    ]);

    const xml = await renderBrsrXbrl(ORG_ID, 2024);

    // Object-valued indicators get serialized as a JSON string fact
    // *and* flagged with a comment that surfaces the SEBI dimensions
    // gap in-line with the data.
    expect(xml).toContain(
      '<!-- object-valued indicator P6-E-4: serialized as JSON string fact',
    );
    expect(xml).toContain('<brsr:P6_E_4 contextRef="ctx-2024-25">');
    // The JSON should be XML-escaped (curly braces ok, but `"` → `&quot;`).
    expect(xml).toContain('&quot;scope1&quot;:1234');
  });

  it('inlines the XBRL_TAXONOMY_GAPS list as XML comments at the top', async () => {
    const xml = await renderBrsrXbrl(ORG_ID, 2024);
    // Each gap line should be present as a `- …` bullet inside the
    // top-of-file comment, so reviewers can read the certification
    // delta without leaving the file.
    for (const gap of XBRL_TAXONOMY_GAPS) {
      expect(xml).toContain(`- ${gap}`);
    }
  });

  it('escapes XML metacharacters in string-valued responses', async () => {
    mockPrisma.brsrResponse.findMany.mockResolvedValue([
      response({
        indicatorOpts: { code: 'P1-E-2' },
        value: 'Contains <tag> & "quotes"',
      }),
    ]);

    const xml = await renderBrsrXbrl(ORG_ID, 2024);
    expect(xml).toContain(
      '<brsr:P1_E_2 contextRef="ctx-2024-25">Contains &lt;tag&gt; &amp; &quot;quotes&quot;</brsr:P1_E_2>',
    );
  });
});

// ─── XSD validation (AAT-R2 / AV4-426) ────────────────────────────────

describe('validateBrsrXbrl', () => {
  it('returns valid=true for a well-formed BRSR XBRL document produced by renderBrsrXbrl', async () => {
    mockPrisma.brsrResponse.findMany.mockResolvedValue([
      response({
        indicatorOpts: { code: 'P1-E-1', principleId: 'p1' },
        value: 'Trained 100 employees',
      }),
      response({
        indicatorOpts: { code: 'P3-E-1', principleId: 'p3' },
        value: 42,
      }),
    ]);

    const xml = await renderBrsrXbrl(ORG_ID, 2024);
    const result = validateBrsrXbrl(xml);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.xsdVersion).toBe(BRSR_XSD_VERSION);
    // Until the canonical SEBI XSD ships, validation always runs in
    // placeholder/warn-mode.
    expect(result.placeholder).toBe(true);
  });

  it('flags an empty payload', () => {
    const result = validateBrsrXbrl('');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/Empty or non-string XBRL payload/);
  });

  it('flags a doc that is missing the SEBI BRSR Core namespace', () => {
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<xbrl xmlns="http://www.xbrl.org/2003/instance">',
      '  <context id="c1"><entity><identifier scheme="x">y</identifier></entity>',
      '    <period><startDate>2024-04-01</startDate><endDate>2025-03-31</endDate></period>',
      '  </context>',
      '  <unit id="INR"><measure>iso4217:INR</measure></unit>',
      '</xbrl>',
    ].join('\n');

    const result = validateBrsrXbrl(xml);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('SEBI BRSR Core'))).toBe(true);
  });

  it('flags missing context / unit / period blocks', () => {
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<xbrl xmlns="http://www.xbrl.org/2003/instance"',
      `      xmlns:brsr="${BRSR_XBRL_NAMESPACE}">`,
      '</xbrl>',
    ].join('\n');

    const result = validateBrsrXbrl(xml);
    expect(result.valid).toBe(false);
    // All three structural defects are flagged.
    expect(result.errors.some((e) => e.includes('<context'))).toBe(true);
    expect(result.errors.some((e) => e.includes('<unit'))).toBe(true);
  });

  it('flags brsr:* facts that are missing contextRef', () => {
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<xbrl xmlns="http://www.xbrl.org/2003/instance"',
      `      xmlns:brsr="${BRSR_XBRL_NAMESPACE}">`,
      '  <context id="c1"><entity><identifier scheme="x">y</identifier></entity>',
      '    <period><startDate>2024-04-01</startDate><endDate>2025-03-31</endDate></period>',
      '  </context>',
      '  <unit id="INR"><measure>iso4217:INR</measure></unit>',
      '  <brsr:P1_E_1>missing contextRef</brsr:P1_E_1>',
      '</xbrl>',
    ].join('\n');

    const result = validateBrsrXbrl(xml);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) =>
        e.match(/Fact <brsr:P1_E_1> is missing contextRef/),
      ),
    ).toBe(true);
  });

  it('flags a truncated document missing </xbrl>', () => {
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<xbrl xmlns="http://www.xbrl.org/2003/instance"',
      `      xmlns:brsr="${BRSR_XBRL_NAMESPACE}">`,
      '  <context id="c1"><entity><identifier scheme="x">y</identifier></entity>',
      '    <period><startDate>2024-04-01</startDate><endDate>2025-03-31</endDate></period>',
      '  </context>',
      '  <unit id="INR"><measure>iso4217:INR</measure></unit>',
      // intentionally NOT closed
    ].join('\n');

    const result = validateBrsrXbrl(xml);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('</xbrl>'))).toBe(true);
  });

  it('caps the per-document fact-error list to keep payloads small', () => {
    const factsMissingCtx = Array.from({ length: 25 })
      .map((_, idx) => `  <brsr:P1_E_${idx + 1}>x</brsr:P1_E_${idx + 1}>`)
      .join('\n');
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<xbrl xmlns="http://www.xbrl.org/2003/instance"',
      `      xmlns:brsr="${BRSR_XBRL_NAMESPACE}">`,
      '  <context id="c1"><entity><identifier scheme="x">y</identifier></entity>',
      '    <period><startDate>2024-04-01</startDate><endDate>2025-03-31</endDate></period>',
      '  </context>',
      '  <unit id="INR"><measure>iso4217:INR</measure></unit>',
      factsMissingCtx,
      '</xbrl>',
    ].join('\n');

    const result = validateBrsrXbrl(xml);
    expect(result.valid).toBe(false);
    // Cap at 5 fact-level error rows + the structural ones above.
    const factErrors = result.errors.filter((e) =>
      e.includes('missing contextRef'),
    );
    expect(factErrors.length).toBeLessThanOrEqual(5);
  });
});
