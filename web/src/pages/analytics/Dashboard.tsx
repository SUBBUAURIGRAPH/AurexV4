/**
 * Analytics Dashboard
 * Real-time analytics visualization and monitoring
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { AnalyticsClient } from '@/services/analyticsClient';
import DashboardHeader from '@/components/analytics/DashboardHeader';
import PerformanceWidget from '@/components/analytics/PerformanceWidget';
import RiskWidget from '@/components/analytics/RiskWidget';
import PortfolioWidget from '@/components/analytics/PortfolioWidget';
import AlertsWidget from '@/components/analytics/AlertsWidget';
import ChartWidget from '@/components/analytics/ChartWidget';
import SummaryCard from '@/components/analytics/SummaryCard';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import './Dashboard.css';

interface DashboardState {
  summary: any;
  performance: any[];
  risk: any[];
  portfolio: any;
  alerts: any[];
  loading: boolean;
  error: string | null;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { socket, isConnected } = useWebSocket();
  const [state, setState] = useState<DashboardState>({
    summary: null,
    performance: [],
    risk: [],
    portfolio: null,
    alerts: [],
    loading: true,
    error: null
  });

  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds
  const client = AnalyticsClient.getInstance(user?.id);

  /**
   * Load initial data
   */
  useEffect(() => {
    loadAnalyticsData();
  }, [selectedStrategy]);

  /**
   * Setup WebSocket subscriptions
   */
  useEffect(() => {
    if (!isConnected || !socket) return;

    // Subscribe to updates
    socket.emit('subscribe:performance', { strategyId: selectedStrategy });
    socket.emit('subscribe:risk', { strategyId: selectedStrategy });
    socket.emit('subscribe:portfolio', {});
    socket.emit('subscribe:alerts', { strategyId: selectedStrategy });

    // Listen for updates
    socket.on('performance:update', handlePerformanceUpdate);
    socket.on('risk:update', handleRiskUpdate);
    socket.on('portfolio:update', handlePortfolioUpdate);
    socket.on('alert:new', handleNewAlert);

    return () => {
      socket.off('performance:update');
      socket.off('risk:update');
      socket.off('portfolio:update');
      socket.off('alert:new');
    };
  }, [isConnected, selectedStrategy]);

  /**
   * Setup auto-refresh interval
   */
  useEffect(() => {
    const interval = setInterval(loadAnalyticsData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, selectedStrategy]);

  /**
   * Load analytics data
   */
  const loadAnalyticsData = async (): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const [summary, performance, risk, portfolio, alerts] = await Promise.all([
        client.getSummary(selectedStrategy),
        client.getPerformanceMetrics(selectedStrategy, 100),
        client.getRiskMetrics(selectedStrategy),
        client.getPortfolioAnalytics(),
        client.getAlerts({ strategyId: selectedStrategy, limit: 10 })
      ]);

      setState(prev => ({
        ...prev,
        summary,
        performance,
        risk,
        portfolio,
        alerts: alerts.alerts,
        loading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to load analytics: ${error}`,
        loading: false
      }));
    }
  };

  /**
   * Handle real-time performance update
   */
  const handlePerformanceUpdate = (data: any): void => {
    setState(prev => ({
      ...prev,
      performance: [...prev.performance, data.data]
    }));
  };

  /**
   * Handle real-time risk update
   */
  const handleRiskUpdate = (data: any): void => {
    setState(prev => ({
      ...prev,
      risk: [...prev.risk, data.data]
    }));
  };

  /**
   * Handle real-time portfolio update
   */
  const handlePortfolioUpdate = (data: any): void => {
    setState(prev => ({
      ...prev,
      portfolio: data.data
    }));
  };

  /**
   * Handle new alert
   */
  const handleNewAlert = (data: any): void => {
    setState(prev => ({
      ...prev,
      alerts: [data.alert, ...prev.alerts]
    }));
  };

  /**
   * Acknowledge alert
   */
  const acknowledgeAlert = async (alertId: number): Promise<void> => {
    try {
      await client.acknowledgeAlert(alertId);
      setState(prev => ({
        ...prev,
        alerts: prev.alerts.filter(a => a.id !== alertId)
      }));
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  if (state.loading && !state.summary) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <ErrorBoundary>
      <div className="analytics-dashboard">
        <DashboardHeader
          selectedStrategy={selectedStrategy}
          onStrategyChange={setSelectedStrategy}
          isConnected={isConnected}
          onRefresh={loadAnalyticsData}
          refreshInterval={refreshInterval}
          onRefreshIntervalChange={setRefreshInterval}
        />

        {state.error && (
          <div className="error-banner">
            <p>{state.error}</p>
            <button onClick={loadAnalyticsData}>Retry</button>
          </div>
        )}

        <div className="dashboard-content">
          {/* Summary Section */}
          <div className="summary-section">
            <div className="summary-grid">
              {state.summary && (
                <>
                  <SummaryCard
                    label="Total Value"
                    value={state.summary.summary.totalValue}
                    icon="📊"
                  />
                  <SummaryCard
                    label="Return"
                    value={state.summary.summary.return}
                    trend="up"
                    icon="📈"
                  />
                  <SummaryCard
                    label="Sharpe Ratio"
                    value={state.summary.summary.sharpeRatio}
                    icon="🎯"
                  />
                  <SummaryCard
                    label="Risk Level"
                    value={state.summary.summary.riskLevel}
                    icon="⚠️"
                  />
                </>
              )}
            </div>
          </div>

          {/* Charts Section */}
          <div className="charts-section">
            <ChartWidget
              title="Performance Over Time"
              data={state.performance}
              type="line"
              dataKey="portfolioValue"
              height={300}
            />

            <ChartWidget
              title="Return Distribution"
              data={state.performance}
              type="area"
              dataKey="dailyReturn"
              height={300}
            />
          </div>

          {/* Widgets Section */}
          <div className="widgets-section">
            <div className="widgets-grid">
              {state.performance.length > 0 && (
                <PerformanceWidget
                  data={state.performance[state.performance.length - 1]}
                />
              )}

              {state.risk.length > 0 && (
                <RiskWidget
                  data={state.risk[state.risk.length - 1]}
                />
              )}

              {state.portfolio && (
                <PortfolioWidget
                  data={state.portfolio}
                />
              )}
            </div>
          </div>

          {/* Alerts Section */}
          <div className="alerts-section">
            <AlertsWidget
              alerts={state.alerts}
              onAcknowledge={acknowledgeAlert}
              limit={5}
            />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default Dashboard;
