/**
 * Hermes Main Dashboard
 * React migration from HTML dashboard
 * Real-time portfolio, analytics, and trading information
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { fetchPortfolio, fetchTrades, fetchHoldings } from '../../store/dashboardSlice';
import Sidebar from '../../components/dashboard/Sidebar';
import DashboardHeader from '../../components/dashboard/DashboardHeader';
import QuickActions from '../../components/dashboard/QuickActions';
import MetricsGrid from '../../components/dashboard/MetricsGrid';
import PerformanceChart from '../../components/dashboard/PerformanceChart';
import AssetAllocation from '../../components/dashboard/AssetAllocation';
import RecentTradesTable from '../../components/dashboard/RecentTradesTable';
import HoldingsTable from '../../components/dashboard/HoldingsTable';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import styles from './HermesMainDashboard.module.css';

interface DashboardState {
  portfolio: any;
  trades: any[];
  holdings: any[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const HermesMainDashboard: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector(state => state.auth);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds
  const [state, setState] = useState<DashboardState>({
    portfolio: null,
    trades: [],
    holdings: [],
    loading: true,
    error: null,
    lastUpdated: null
  });

  /**
   * Load dashboard data
   */
  const loadDashboardData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      await Promise.all([
        dispatch(fetchPortfolio()),
        dispatch(fetchTrades()),
        dispatch(fetchHoldings())
      ]);

      setState(prev => ({
        ...prev,
        loading: false,
        lastUpdated: new Date()
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load dashboard'
      }));
    }
  }, [dispatch]);

  /**
   * Load data on mount
   */
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  /**
   * Setup auto-refresh
   */
  useEffect(() => {
    const interval = setInterval(() => {
      loadDashboardData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, loadDashboardData]);

  /**
   * Handle sidebar toggle
   */
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  /**
   * Handle refresh
   */
  const handleRefresh = useCallback(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (state.error) {
    return (
      <ErrorBoundary>
        <div className={styles.errorContainer}>
          <div className={styles.errorContent}>
            <h2>Error Loading Dashboard</h2>
            <p>{state.error}</p>
            <button
              onClick={handleRefresh}
              className={styles.retryButton}
            >
              🔄 Retry
            </button>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className={styles.dashboardContainer}>
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={toggleSidebar}
          activeTab="dashboard"
        />

        {/* Main Content */}
        <div className={`${styles.mainContent} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed}`}>
          {/* Header */}
          <div className={styles.topBar}>
            <button
              onClick={toggleSidebar}
              className={styles.toggleButton}
              aria-label="Toggle sidebar"
            >
              ☰
            </button>
            <div className={styles.refreshInfo}>
              {state.lastUpdated && (
                <span className={styles.lastUpdated}>
                  Updated: {state.lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
            <button
              onClick={handleRefresh}
              className={styles.refreshButton}
              disabled={state.loading}
            >
              🔄
            </button>
          </div>

          {/* Loading State */}
          {state.loading && !state.portfolio && (
            <LoadingSpinner message="Loading dashboard..." />
          )}

          {/* Dashboard Content */}
          {!state.loading || state.portfolio && (
            <div className={styles.content}>
              {/* Welcome Header */}
              <DashboardHeader
                userName={user?.name || 'User'}
                marketStatus="OPEN"
                aiRiskScore={8}
              />

              {/* Quick Actions */}
              <QuickActions />

              {/* Metrics Grid */}
              <MetricsGrid portfolio={state.portfolio} />

              {/* Charts Section */}
              <div className={styles.chartsGrid}>
                <PerformanceChart portfolio={state.portfolio} />
                <AssetAllocation portfolio={state.portfolio} />
              </div>

              {/* Recent Trades Table */}
              {state.trades.length > 0 && (
                <RecentTradesTable trades={state.trades} />
              )}

              {/* Holdings Table */}
              {state.holdings.length > 0 && (
                <HoldingsTable holdings={state.holdings} />
              )}

              {/* Empty State */}
              {!state.portfolio && !state.loading && (
                <div className={styles.emptyState}>
                  <p>No data available. Please check back later.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default HermesMainDashboard;
