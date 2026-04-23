import { useMemo, useState } from 'react';
import {
  useFrameworks,
  useOrgFrameworkMappings,
  useMapFramework,
  useUnmapFramework,
} from '../../../hooks/useFrameworks';
import { FrameworkCard } from '../../../components/frameworks/FrameworkCard';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';

export function FrameworksHubPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'mapped' | 'available'>('all');

  const { data: frameworksData, isLoading } = useFrameworks();
  const { data: mappingsData } = useOrgFrameworkMappings();
  const map = useMapFramework();
  const unmap = useUnmapFramework();
  const { success: toastSuccess, error: toastError } = useToast();
  const { user } = useAuth();

  const canManage = ['org_admin', 'super_admin', 'administrator'].includes(user?.role ?? '');

  const mappedIds = useMemo(
    () => new Set((mappingsData?.data ?? []).map((f) => f.id)),
    [mappingsData],
  );

  const frameworks = frameworksData?.data ?? [];

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return frameworks.filter((f) => {
      if (filter === 'mapped' && !mappedIds.has(f.id)) return false;
      if (filter === 'available' && mappedIds.has(f.id)) return false;
      if (!q) return true;
      return (
        f.code.toLowerCase().includes(q) ||
        f.name.toLowerCase().includes(q) ||
        (f.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [frameworks, mappedIds, filter, search]);

  const handleMap = (id: string) => {
    map.mutate(id, {
      onSuccess: () => toastSuccess('Framework mapped to organisation'),
      onError: (e: Error) => toastError(e.message),
    });
  };

  const handleUnmap = (id: string) => {
    unmap.mutate(id, {
      onSuccess: () => toastSuccess('Framework unmapped'),
      onError: (e: Error) => toastError(e.message),
    });
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          ESG Frameworks
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          Browse disclosure frameworks and map them to your organisation. Mapped frameworks appear in reports and the BRSR builder.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search frameworks..."
          style={{
            flex: '1 1 240px', minWidth: '200px',
            padding: '0.5rem 0.875rem', borderRadius: '0.5rem',
            border: '1px solid var(--border-primary)',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: '0.875rem', fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          {(['all', 'mapped', 'available'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '0.4375rem 0.875rem', borderRadius: '0.5rem',
                border: '1px solid var(--border-primary)',
                cursor: 'pointer', fontFamily: 'inherit',
                fontSize: '0.8125rem', fontWeight: 500,
                backgroundColor: filter === f ? '#1a5d3d' : 'var(--bg-card)',
                color: filter === f ? '#fff' : 'var(--text-secondary)',
                textTransform: 'capitalize',
                transition: 'all 150ms',
              }}
            >
              {f}
              {f === 'mapped' && mappedIds.size > 0 && (
                <span style={{ marginLeft: '0.375rem', fontSize: '0.6875rem', opacity: 0.85 }}>
                  ({mappedIds.size})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <p style={{ color: 'var(--text-tertiary)', padding: '2rem', textAlign: 'center' }}>
          Loading frameworks…
        </p>
      ) : visible.length === 0 ? (
        <div style={{
          padding: '3rem 2rem', textAlign: 'center',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-primary)',
          borderRadius: '0.75rem',
          color: 'var(--text-tertiary)',
        }}>
          {frameworks.length === 0 ? (
            <>
              <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                No frameworks available yet
              </p>
              <p style={{ fontSize: '0.8125rem', margin: 0 }}>
                Your platform admin can seed frameworks via the API.
              </p>
            </>
          ) : (
            <p style={{ fontSize: '0.875rem', margin: 0 }}>
              No frameworks match your filters.
            </p>
          )}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem',
        }}>
          {visible.map((fw) => (
            <FrameworkCard
              key={fw.id}
              framework={fw}
              isMapped={mappedIds.has(fw.id)}
              onMap={() => handleMap(fw.id)}
              onUnmap={() => handleUnmap(fw.id)}
              isPending={map.isPending || unmap.isPending}
              canManage={canManage}
            />
          ))}
        </div>
      )}
    </div>
  );
}
