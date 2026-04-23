import { useCallback, useRef, useState } from 'react';
import { useImportJobs, useUploadCsv, type ImportJob, type ImportRowError } from '../../../hooks/useImports';
import { useToast } from '../../../contexts/ToastContext';

const TEMPLATE_CSV = `scope,category,source,value,unit,periodStart,periodEnd
SCOPE_1,Stationary Combustion,Natural Gas Boiler,125.4,tCO2e,2025-01-01,2025-03-31
SCOPE_2,Purchased Electricity,Grid Electricity,87.2,tCO2e,2025-01-01,2025-03-31
SCOPE_3,Business Travel,Flights,45.8,tCO2e,2025-01-01,2025-03-31`;

type StatusKey = 'PROCESSING' | 'COMPLETED' | 'FAILED';

const STATUS_STYLES: Record<StatusKey, { bg: string; color: string }> = {
  COMPLETED: { bg: 'rgba(16,185,129,0.1)', color: '#10b981' },
  PROCESSING: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
  FAILED: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
};

type Step = 'upload' | 'result';

function DownloadTemplate() {
  const handleDownload = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'emissions_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleDownload}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.5rem 1rem', borderRadius: '0.5rem',
        border: '1px solid var(--border-primary)',
        background: 'none', cursor: 'pointer',
        fontSize: '0.8125rem', color: 'var(--text-secondary)',
        fontFamily: 'inherit', fontWeight: 500,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Download Template
    </button>
  );
}

interface DropZoneProps {
  onFile: (name: string, content: string) => void;
  disabled: boolean;
}

function DropZone({ onFile, disabled }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        onFile(file.name, content);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }, [disabled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
    e.target.value = '';
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? '#1a5d3d' : 'var(--border-primary)'}`,
        borderRadius: '0.75rem',
        padding: '3rem 2rem',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: dragging ? 'rgba(26,93,61,0.04)' : 'var(--bg-secondary)',
        transition: 'all 200ms',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={handleChange}
        disabled={disabled}
      />
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={dragging ? '#1a5d3d' : 'var(--text-tertiary)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 1rem' }}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.375rem' }}>
        Drop your CSV here, or click to browse
      </p>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', margin: 0 }}>
        CSV files up to 20 MB · Required columns: scope, category, source, value, unit, periodStart, periodEnd
      </p>
    </div>
  );
}

interface ResultPanelProps {
  job: ImportJob;
  onReset: () => void;
}

function ResultPanel({ job, onReset }: ResultPanelProps) {
  const isPartial = job.successRows > 0 && job.errorRows > 0;
  const allFailed = job.successRows === 0 && job.errorRows > 0;
  const allGood = job.errorRows === 0;

  const summaryColor = allGood ? '#10b981' : allFailed ? '#ef4444' : '#f59e0b';
  const summaryBg = allGood ? 'rgba(16,185,129,0.08)' : allFailed ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)';
  const summaryIcon = allGood ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={summaryColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ) : (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={summaryColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );

  return (
    <div>
      {/* Summary banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        padding: '1.25rem 1.5rem',
        backgroundColor: summaryBg,
        border: `1px solid ${summaryColor}33`,
        borderRadius: '0.75rem',
        marginBottom: '1.5rem',
      }}>
        {summaryIcon}
        <div>
          <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {allGood ? 'Import successful' : isPartial ? 'Import completed with errors' : 'Import failed'}
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
            {job.totalRows} rows processed · <span style={{ color: '#10b981', fontWeight: 600 }}>{job.successRows} imported</span>
            {job.errorRows > 0 && <> · <span style={{ color: '#ef4444', fontWeight: 600 }}>{job.errorRows} errors</span></>}
          </p>
        </div>
      </div>

      {/* Error table */}
      {job.errors && job.errors.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            Row Errors ({job.errors.length})
          </p>
          <div style={{
            border: '1px solid var(--border-primary)',
            borderRadius: '0.5rem',
            overflow: 'hidden',
            maxHeight: '300px',
            overflowY: 'auto',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '60px' }}>Row</th>
                  <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Error</th>
                </tr>
              </thead>
              <tbody>
                {(job.errors as ImportRowError[]).map((err, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border-primary)' }}>
                    <td style={{ padding: '0.625rem 0.875rem', fontSize: '0.8125rem', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                      {err.row}
                    </td>
                    <td style={{ padding: '0.625rem 0.875rem', fontSize: '0.8125rem', color: '#ef4444' }}>
                      {err.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={onReset}
          style={{
            padding: '0.625rem 1.25rem', borderRadius: '0.5rem',
            border: 'none', cursor: 'pointer',
            backgroundColor: '#1a5d3d', color: '#fff',
            fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit',
          }}
        >
          Import Another File
        </button>
      </div>
    </div>
  );
}

export function BulkUploadPage() {
  const [step, setStep] = useState<Step>('upload');
  const [result, setResult] = useState<ImportJob | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ name: string; csv: string } | null>(null);
  const [page, setPage] = useState(1);

  const upload = useUploadCsv();
  const { data: jobsData } = useImportJobs(page);
  const { success: toastSuccess, error: toastError } = useToast();

  const handleFile = (name: string, csv: string) => {
    setSelectedFile({ name, csv });
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    upload.mutate(
      { filename: selectedFile.name, csv: selectedFile.csv },
      {
        onSuccess: (res) => {
          setResult(res.data);
          setStep('result');
          if (res.data.errorRows === 0) {
            toastSuccess(`${res.data.successRows} rows imported successfully`);
          } else if (res.data.successRows > 0) {
            toastSuccess(`${res.data.successRows} rows imported, ${res.data.errorRows} errors`);
          } else {
            toastError(`Import failed — ${res.data.errorRows} row errors`);
          }
        },
        onError: (e: Error) => {
          toastError(e.message);
        },
      },
    );
  };

  const handleReset = () => {
    setStep('upload');
    setResult(null);
    setSelectedFile(null);
  };

  const jobs = jobsData?.data ?? [];
  const pagination = jobsData?.pagination;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Bulk Upload
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Import multiple emissions records from a CSV file
          </p>
        </div>
        <DownloadTemplate />
      </div>

      {/* Upload card */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        marginBottom: '2rem',
      }}>
        {step === 'upload' ? (
          <>
            <DropZone onFile={handleFile} disabled={upload.isPending} />

            {selectedFile && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginTop: '1rem',
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(26,93,61,0.06)',
                border: '1px solid rgba(26,93,61,0.2)',
                borderRadius: '0.5rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a5d3d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {selectedFile.name}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.625rem' }}>
                  <button
                    onClick={() => setSelectedFile(null)}
                    disabled={upload.isPending}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '0.8125rem', color: 'var(--text-tertiary)',
                      fontFamily: 'inherit', padding: '0.25rem 0.5rem',
                    }}
                  >
                    Remove
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={upload.isPending}
                    style={{
                      padding: '0.4375rem 1rem', borderRadius: '0.5rem',
                      border: 'none', cursor: 'pointer',
                      backgroundColor: '#1a5d3d', color: '#fff',
                      fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit',
                      opacity: upload.isPending ? 0.6 : 1,
                    }}
                  >
                    {upload.isPending ? 'Uploading…' : 'Upload & Import'}
                  </button>
                </div>
              </div>
            )}

            {/* CSV format hint */}
            <div style={{
              marginTop: '1.25rem',
              padding: '0.875rem 1rem',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-primary)',
            }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>
                Expected CSV Format
              </p>
              <code style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', lineHeight: 1.6 }}>
                scope, category, source, value, unit, periodStart, periodEnd [, metadata]
              </code>
              <div style={{ marginTop: '0.625rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                {[
                  ['scope', 'SCOPE_1 | SCOPE_2 | SCOPE_3'],
                  ['value', 'Numeric CO2e amount'],
                  ['periodStart/End', 'ISO date (YYYY-MM-DD)'],
                  ['metadata', 'Optional JSON object'],
                ].map(([label, hint]) => (
                  <div key={label}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{label}</span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', marginLeft: '0.375rem' }}>{hint}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : result ? (
          <ResultPanel job={result} onReset={handleReset} />
        ) : null}
      </div>

      {/* Import history */}
      {jobs.length > 0 && (
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.875rem' }}>
            Import History
          </h2>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            borderRadius: '0.75rem',
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}>
                  {['File', 'Status', 'Imported', 'Errors', 'Date'].map((h) => (
                    <th key={h} style={{
                      padding: '0.625rem 1rem', textAlign: 'left',
                      fontSize: '0.75rem', fontWeight: 600,
                      color: 'var(--text-tertiary)', textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, i) => {
                  const s = STATUS_STYLES[job.status as StatusKey] ?? STATUS_STYLES.PROCESSING;
                  return (
                    <tr key={job.id} style={{ borderBottom: i < jobs.length - 1 ? '1px solid var(--border-primary)' : 'none' }}>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {job.filename}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center',
                          padding: '0.2rem 0.625rem', borderRadius: '9999px',
                          fontSize: '0.75rem', fontWeight: 600,
                          backgroundColor: s.bg, color: s.color,
                        }}>
                          {job.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: '#10b981', fontWeight: 600 }}>
                        {job.successRows}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: job.errorRows > 0 ? '#ef4444' : 'var(--text-tertiary)', fontWeight: job.errorRows > 0 ? 600 : 400 }}>
                        {job.errorRows}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
                        {new Date(job.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {pagination && pagination.totalPages > 1 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                borderTop: '1px solid var(--border-primary)',
                backgroundColor: 'var(--bg-secondary)',
              }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                    style={{ padding: '0.375rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--border-primary)', background: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontFamily: 'inherit', opacity: page <= 1 ? 0.4 : 1 }}>
                    Prev
                  </button>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}
                    style={{ padding: '0.375rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--border-primary)', background: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontFamily: 'inherit', opacity: page >= pagination.totalPages ? 0.4 : 1 }}>
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
