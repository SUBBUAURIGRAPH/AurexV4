/**
 * Metrics Grid Component
 * Displays 4 key portfolio metrics in card format
 * @version 1.0.0
 */

import React from 'react';
import styles from './MetricsGrid.module.css';

interface MetricsGridProps {
  portfolio?: {
    totalValue?: number;
    availableBalance?: number;
    todayReturn?: number;
    ytdReturn?: number;
  };
}

interface MetricCard {
  id: string;
  label: string;
  value: string;
  change?: number;
  changePercent?: number;
  icon: string;
  color: string;
}

const MetricsGrid: React.FC<MetricsGridProps> = ({ portfolio }) => {
  // Default values for demo
  const totalValue = portfolio?.totalValue || 125450.50;
  const availableBalance = portfolio?.availableBalance || 24680.30;
  const todayReturn = portfolio?.todayReturn || 1245.75;
  const ytdReturn = portfolio?.ytdReturn || 15320.00;

  // Calculate percentage changes
  const todayReturnPercent = ((todayReturn / totalValue) * 100).toFixed(2);
  const ytdReturnPercent = ((ytdReturn / totalValue) * 100).toFixed(2);

  const metrics: MetricCard[] = [
    {
      id: 'portfolio-value',
      label: 'Portfolio Value',
      value: `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: '💰',
      color: 'primary'
    },
    {
      id: 'available-balance',
      label: 'Available Balance',
      value: `$${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: '💳',
      color: 'secondary'
    },
    {
      id: 'today-return',
      label: "Today's Return",
      value: `$${todayReturn.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      changePercent: parseFloat(todayReturnPercent),
      icon: '📈',
      color: todayReturn >= 0 ? 'success' : 'danger'
    },
    {
      id: 'ytd-return',
      label: 'YTD Return',
      value: `$${ytdReturn.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      changePercent: parseFloat(ytdReturnPercent),
      icon: '📊',
      color: ytdReturn >= 0 ? 'success' : 'danger'
    }
  ];

  return (
    <div className={styles.metricsGrid}>
      {metrics.map(metric => (
        <div
          key={metric.id}
          className={`${styles.metricCard} ${styles[metric.color]}`}
        >
          <div className={styles.cardContent}>
            <div className={styles.iconArea}>
              <span className={styles.icon}>{metric.icon}</span>
            </div>

            <div className={styles.metricInfo}>
              <p className={styles.label}>{metric.label}</p>
              <h3 className={styles.value}>{metric.value}</h3>

              {metric.changePercent !== undefined && (
                <p className={`${styles.change} ${metric.changePercent >= 0 ? styles.positive : styles.negative}`}>
                  {metric.changePercent >= 0 ? '+' : ''}{metric.changePercent.toFixed(2)}%
                </p>
              )}
            </div>
          </div>

          <div className={styles.cardBorder} />
        </div>
      ))}
    </div>
  );
};

export default MetricsGrid;
