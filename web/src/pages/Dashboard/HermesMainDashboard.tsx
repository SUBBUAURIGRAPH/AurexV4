/**
 * Hermes Main Dashboard
 * React migration from HTML dashboard
 * Real-time portfolio, analytics, and trading information
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import {
  fetchPortfolio,
  fetchTrades,
  fetchHoldings,
  selectPortfolio,
  selectTrades,
  selectHoldings,
  selectDashboardLoading,
  selectDashboardError,
  selectLastUpdated,
  clearError
} from '../../store/dashboardSlice';
import TopNavigation from '../../components/common/TopNavigation';
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

const HermesMainDashboard: React.FC = () => {
  const dispatch = useAppDispatch();

  // Redux state selectors
  const portfolio = useAppSelector(selectPortfolio);
  const trades = useAppSelector(selectTrades);
  const holdings = useAppSelector(selectHoldings);
  const loading = useAppSelector(selectDashboardLoading);
  const error = useAppSelector(selectDashboardError);
  const lastUpdated = useAppSelector(selectLastUpdated);

  // Local component state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds
  const [marketStatus, setMarketStatus] = useState<'OPEN' | 'CLOSED'>('OPEN');
  const [aiRiskScore, setAiRiskScore] = useState(8);
  const [userName] = useState('John Doe'); // Would come from auth context

  /**
   * Load dashboard data
   */
  const loadDashboardData = useCallback(async () => {
    try {
      // Dispatch all async thunks in parallel
      await Promise.all([
        dispatch(fetchPortfolio()),
        dispatch(fetchTrades()),
        dispatch(fetchHoldings())
      ]);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
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

  /**
   * Handle error dismissal
   */
  const handleDismissError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  if (error && !portfolio) {
    return (
      <ErrorBoundary>
        <div className={styles.errorContainer}>
          <div className={styles.errorContent}>
            <h2>⚠️ Error Loading Dashboard</h2>
            <p>{error}</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={handleRefresh}
                className={styles.retryButton}
              >
                🔄 Retry
              </button>
              <button
                onClick={handleDismissError}
                className={styles.retryButton}
                style={{ background: 'rgba(255, 255, 255, 0.1)' }}
              >
                ✕ Dismiss
              </button>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Format last updated time
  const lastUpdatedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString()
    : null;

  return (
    <ErrorBoundary>
      {/* Top Navigation Bar */}
      <TopNavigation />

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
              {lastUpdatedTime && (
                <span className={styles.lastUpdated}>
                  Updated: {lastUpdatedTime}
                </span>
              )}
            </div>
            <button
              onClick={handleRefresh}
              className={styles.refreshButton}
              disabled={loading}
              title="Refresh dashboard"
            >
              🔄
            </button>
          </div>

          {/* Loading State */}
          {loading && !portfolio && (
            <LoadingSpinner message="Loading dashboard..." />
          )}

          {/* Dashboard Content */}
          {!loading || portfolio && (
            <div className={styles.content}>
              {/* Welcome Header */}
              <DashboardHeader
                userName={userName}
                marketStatus={marketStatus}
                aiRiskScore={aiRiskScore}
              />

              {/* Quick Actions */}
              <QuickActions />

              {/* Metrics Grid */}
              <MetricsGrid portfolio={portfolio || undefined} />

              {/* Charts Section */}
              <div className={styles.chartsGrid}>
                <PerformanceChart portfolio={portfolio || undefined} />
                <AssetAllocation portfolio={portfolio || undefined} />
              </div>

              {/* Recent Trades Table */}
              {trades && trades.length > 0 && (
                <RecentTradesTable trades={trades} />
              )}

              {/* Holdings Table */}
              {holdings && holdings.length > 0 && (
                <HoldingsTable holdings={holdings} />
              )}

              {/* Empty State */}
              {!portfolio && !loading && (
                <div className={styles.emptyState}>
                  <p>ℹ️ No data available. Please check your connection or try refreshing.</p>
                </div>
              )}

              {/* Error Alert (non-blocking) */}
              {error && portfolio && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginTop: '2rem',
                  color: '#ef4444',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>⚠️ {error}</span>
                  <button
                    onClick={handleDismissError}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontSize: '1.25rem'
                    }}
                  >
                    ✕
                  </button>
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
