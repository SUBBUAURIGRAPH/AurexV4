/**
 * OrgContext — single source of truth for the user's "active organisation"
 * across the dashboard. Drives:
 *
 *   - The topbar switcher (which org is bold + selected).
 *   - The api.ts request wrapper, which auto-injects `x-org-id` on every
 *     request based on `currentOrgId`. The backend `requireOrgScope`
 *     middleware (apps/api/src/middleware/org-scope.ts) honors this for
 *     multi-org members and SUPER_ADMIN.
 *
 * Lifecycle:
 *   1. Mount — load GET /api/v1/organizations (the user's accessible orgs).
 *   2. Restore the previously-selected org from localStorage if it's still
 *      in the visible list; else default to the first visible org.
 *   3. The context's `currentOrgId` is registered with api.ts as a getter
 *      via setActiveOrgIdGetter so non-React code can read it without a
 *      hook (the api wrapper is non-React; same pattern as the existing
 *      onboarding-incomplete handler).
 *
 * Notes:
 *   - The legacy `aurex_active_org` localStorage key (which stored a
 *     fake org *name*) is migrated/superseded — we now persist the *id*
 *     under `aurex_active_org_id`. The old key is left untouched but
 *     ignored.
 *   - Single-org users see no UI change: the switcher renders a static
 *     name; the header still injects, but the backend's no-header
 *     fallback would have produced the same result.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { setActiveOrgIdGetter } from '../lib/api';
import { useAuth } from './AuthContext';

const ACTIVE_ORG_LS_KEY = 'aurex_active_org_id';

export interface OrgSummary {
  id: string;
  name: string;
}

interface OrgContextValue {
  /** The currently active org id (the value injected as `x-org-id`).
   *  null until /organizations resolves on first mount. */
  currentOrgId: string | null;
  /** The full row for `currentOrgId`, looked up from `orgs`. */
  currentOrg: OrgSummary | null;
  /** All orgs the user can act on (returned by GET /organizations). */
  orgs: OrgSummary[];
  /** Switch the active org. Persists to localStorage and triggers any
   *  data-fetching hooks downstream that key on `currentOrgId`. */
  setCurrentOrgId: (id: string) => void;
  /** True until the initial /organizations fetch resolves. */
  isLoading: boolean;
}

const OrgContext = createContext<OrgContextValue | undefined>(undefined);

interface OrgsResponse {
  data?: Array<{ id?: string; name?: string }>;
}

async function fetchOrgs(): Promise<OrgSummary[]> {
  const token = localStorage.getItem('aurex_token');
  if (!token) return [];
  const res = await fetch('/api/v1/organizations', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const body = (await res.json().catch(() => ({}))) as OrgsResponse;
  const list = Array.isArray(body.data) ? body.data : [];
  return list
    .filter((o): o is { id: string; name: string } =>
      typeof o.id === 'string' && typeof o.name === 'string',
    )
    .map((o) => ({ id: o.id, name: o.name }));
}

export function OrgProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Stash the latest currentOrgId in a ref so the api.ts getter never
  // closes over a stale value (the getter is set once at mount).
  const currentOrgIdRef = useRef<string | null>(null);
  currentOrgIdRef.current = currentOrgId;

  // Load orgs whenever the user is authenticated. If they sign out and
  // back in we re-fetch — covers the federated re-login + reset paths.
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setOrgs([]);
      setCurrentOrgIdState(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetchOrgs()
      .then((list) => {
        if (cancelled) return;
        setOrgs(list);
        const cached = localStorage.getItem(ACTIVE_ORG_LS_KEY);
        const cachedStillVisible = cached && list.some((o) => o.id === cached);
        const next = cachedStillVisible ? cached! : list[0]?.id ?? null;
        setCurrentOrgIdState(next);
        if (next) {
          localStorage.setItem(ACTIVE_ORG_LS_KEY, next);
        } else {
          localStorage.removeItem(ACTIVE_ORG_LS_KEY);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading]);

  // Wire the live ref into api.ts so every request() call picks up the
  // current org without having to thread props through every caller.
  useEffect(() => {
    setActiveOrgIdGetter(() => currentOrgIdRef.current);
    return () => setActiveOrgIdGetter(null);
  }, []);

  const setCurrentOrgId = useCallback((id: string) => {
    setCurrentOrgIdState(id);
    localStorage.setItem(ACTIVE_ORG_LS_KEY, id);
  }, []);

  const currentOrg = useMemo(
    () => (currentOrgId ? orgs.find((o) => o.id === currentOrgId) ?? null : null),
    [currentOrgId, orgs],
  );

  const value = useMemo<OrgContextValue>(
    () => ({ currentOrgId, currentOrg, orgs, setCurrentOrgId, isLoading }),
    [currentOrgId, currentOrg, orgs, setCurrentOrgId, isLoading],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within OrgProvider');
  return ctx;
}
