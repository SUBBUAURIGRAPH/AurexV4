/**
 * Asset Allocation Component
 * Displays portfolio asset allocation with progress bars
 * @version 1.0.0
 */

import React, { useMemo } from 'react';
import styles from './AssetAllocation.module.css';

interface AllocationItem {
  assetClass: string;
  percentage: number;
  value: number;
  icon: string;
  color: string;
}

interface AssetAllocationProps {
  portfolio?: {
    allocation?: Array<{
      assetClass: string;
      percentage: number;
      value: number;
    }>;
  };
}

const AssetAllocation: React.FC<AssetAllocationProps> = ({ portfolio }) => {
  // Default allocation data
  const defaultAllocation: AllocationItem[] = [
    {
      assetClass: 'US Equities',
      percentage: 45,
      value: 56452.73,
      icon: '🇺🇸',
      color: '#667eea'
    },
    {
      assetClass: 'International',
      percentage: 20,
      value: 25090.10,
      icon: '🌍',
      color: '#764ba2'
    },
    {
      assetClass: 'Bonds',
      percentage: 20,
      value: 25090.10,
      icon: '📊',
      color: '#f093fb'
    },
    {
      assetClass: 'Cash & Other',
      percentage: 15,
      value: 18817.58,
      icon: '💵',
      color: '#4facfe'
    }
  ];

  const allocationData = portfolio?.allocation ?
    portfolio.allocation.map((item, index) => ({
      ...item,
      icon: defaultAllocation[index]?.icon || '📈',
      color: defaultAllocation[index]?.color || '#667eea'
    })) :
    defaultAllocation;

  // Calculate total to verify allocation
  const totalPercentage = useMemo(() => {
    return allocationData.reduce((sum, item) => sum + item.percentage, 0);
  }, [allocationData]);

  // Calculate total value
  const totalValue = useMemo(() => {
    return allocationData.reduce((sum, item) => sum + item.value, 0);
  }, [allocationData]);

  return (
    <div className={styles.allocationContainer}>
      <div className={styles.header}>
        <h3 className={styles.title}>Asset Allocation</h3>
        <p className={styles.subtitle}>Portfolio breakdown by asset class</p>
      </div>

      <div className={styles.allocationItems}>
        {allocationData.map((item, index) => {
          const itemValue = item.value || (totalValue * (item.percentage / 100));
          return (
            <div key={index} className={styles.allocationItem}>
              {/* Asset Class Header */}
              <div className={styles.itemHeader}>
                <div className={styles.assetInfo}>
                  <span className={styles.icon}>{item.icon}</span>
                  <div className={styles.assetDetails}>
                    <p className={styles.assetClass}>{item.assetClass}</p>
                    <p className={styles.assetValue}>
                      ${itemValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                <div className={styles.percentage}>{item.percentage}%</div>
              </div>

              {/* Progress Bar */}
              <div className={styles.progressBarContainer}>
                <div
                  className={styles.progressBar}
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: item.color
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Allocation Summary */}
      <div className={styles.summary}>
        <div className={styles.summaryItem}>
          <span className={styles.label}>Total Allocated</span>
          <span className={styles.value}>{totalPercentage}%</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.label}>Total Value</span>
          <span className={styles.value}>
            ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Rebalance Suggestion */}
      {totalPercentage !== 100 && (
        <div className={styles.warning}>
          <span className={styles.warningIcon}>⚠️</span>
          <span className={styles.warningText}>
            Allocation differs from target. Consider rebalancing.
          </span>
        </div>
      )}

      {/* Rebalance Button */}
      <button className={styles.rebalanceButton}>
        📊 Suggest Rebalancing
      </button>
    </div>
  );
};

export default AssetAllocation;
