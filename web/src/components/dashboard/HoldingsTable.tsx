/**
 * Holdings Table Component
 * Displays current portfolio positions with gain/loss and risk metrics
 * @version 1.0.0
 */

import React, { useMemo } from 'react';
import styles from './HoldingsTable.module.css';

interface Position {
  id: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  totalValue: number;
  gainLoss: number;
  gainLossPercent: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  sector?: string;
}

interface HoldingsTableProps {
  holdings?: Position[];
}

const HoldingsTable: React.FC<HoldingsTableProps> = ({ holdings }) => {
  // Default sample holdings
  const defaultHoldings: Position[] = [
    {
      id: '1',
      symbol: 'AAPL',
      quantity: 50,
      entryPrice: 165.00,
      currentPrice: 175.50,
      totalValue: 8775.00,
      gainLoss: 525.00,
      gainLossPercent: 6.36,
      riskLevel: 'LOW',
      sector: 'Technology'
    },
    {
      id: '2',
      symbol: 'GOOGL',
      quantity: 20,
      entryPrice: 138.00,
      currentPrice: 140.25,
      totalValue: 2805.00,
      gainLoss: 45.00,
      gainLossPercent: 1.64,
      riskLevel: 'LOW',
      sector: 'Technology'
    },
    {
      id: '3',
      symbol: 'TSLA',
      quantity: 15,
      entryPrice: 245.00,
      currentPrice: 242.15,
      totalValue: 3632.25,
      gainLoss: -42.75,
      gainLossPercent: -1.17,
      riskLevel: 'MEDIUM',
      sector: 'Automotive'
    },
    {
      id: '4',
      symbol: 'MSFT',
      quantity: 30,
      entryPrice: 370.00,
      currentPrice: 380.00,
      totalValue: 11400.00,
      gainLoss: 300.00,
      gainLossPercent: 2.70,
      riskLevel: 'LOW',
      sector: 'Technology'
    },
    {
      id: '5',
      symbol: 'NVDA',
      quantity: 10,
      entryPrice: 820.00,
      currentPrice: 875.30,
      totalValue: 8753.00,
      gainLoss: 553.00,
      gainLossPercent: 6.75,
      riskLevel: 'HIGH',
      sector: 'Semiconductors'
    },
    {
      id: '6',
      symbol: 'META',
      quantity: 25,
      entryPrice: 200.00,
      currentPrice: 195.80,
      totalValue: 4895.00,
      gainLoss: -105.00,
      gainLossPercent: -2.10,
      riskLevel: 'MEDIUM',
      sector: 'Technology'
    }
  ];

  const displayHoldings = holdings || defaultHoldings;

  // Calculate portfolio totals
  const totals = useMemo(() => {
    return displayHoldings.reduce(
      (acc, position) => ({
        totalValue: acc.totalValue + position.totalValue,
        totalGainLoss: acc.totalGainLoss + position.gainLoss,
        totalQuantity: acc.totalQuantity + position.quantity
      }),
      { totalValue: 0, totalGainLoss: 0, totalQuantity: 0 }
    );
  }, [displayHoldings]);

  const portfolioGainLossPercent = (totals.totalGainLoss / (totals.totalValue - totals.totalGainLoss)) * 100;

  // Get risk color
  const getRiskColor = (risk: Position['riskLevel']): string => {
    switch (risk) {
      case 'LOW':
        return 'success';
      case 'MEDIUM':
        return 'warning';
      case 'HIGH':
        return 'danger';
      default:
        return 'secondary';
    }
  };

  // Get risk icon
  const getRiskIcon = (risk: Position['riskLevel']): string => {
    switch (risk) {
      case 'LOW':
        return '✓';
      case 'MEDIUM':
        return '⚠';
      case 'HIGH':
        return '!';
      default:
        return '•';
    }
  };

  return (
    <div className={styles.holdingsContainer}>
      <div className={styles.header}>
        <h3 className={styles.title}>Current Holdings</h3>
        <a href="#" className={styles.viewAll}>View All →</a>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Quantity</th>
              <th>Entry Price</th>
              <th>Current Price</th>
              <th>Total Value</th>
              <th>Gain / Loss</th>
              <th>%</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {displayHoldings.map(position => (
              <tr key={position.id} className={styles.holdingRow}>
                <td className={styles.symbol}>
                  <strong>{position.symbol}</strong>
                  {position.sector && <p className={styles.sector}>{position.sector}</p>}
                </td>
                <td className={styles.quantity}>{position.quantity}</td>
                <td className={styles.entryPrice}>
                  ${position.entryPrice.toFixed(2)}
                </td>
                <td className={styles.currentPrice}>
                  ${position.currentPrice.toFixed(2)}
                </td>
                <td className={styles.totalValue}>
                  ${position.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className={`${styles.gainLoss} ${position.gainLoss >= 0 ? styles.positive : styles.negative}`}>
                  ${position.gainLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className={`${styles.percentage} ${position.gainLossPercent >= 0 ? styles.positive : styles.negative}`}>
                  {position.gainLossPercent >= 0 ? '+' : ''}{position.gainLossPercent.toFixed(2)}%
                </td>
                <td className={styles.risk}>
                  <span className={`${styles.riskBadge} ${styles[getRiskColor(position.riskLevel)]}`}>
                    {getRiskIcon(position.riskLevel)} {position.riskLevel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Portfolio Summary */}
      <div className={styles.summary}>
        <div className={styles.summaryGroup}>
          <div className={styles.summaryItem}>
            <span className={styles.label}>Total Value</span>
            <span className={styles.value}>
              ${totals.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.label}>Total Gain/Loss</span>
            <span className={`${styles.value} ${totals.totalGainLoss >= 0 ? styles.positive : styles.negative}`}>
              ${totals.totalGainLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.label}>Return %</span>
            <span className={`${styles.value} ${portfolioGainLossPercent >= 0 ? styles.positive : styles.negative}`}>
              {portfolioGainLossPercent >= 0 ? '+' : ''}{portfolioGainLossPercent.toFixed(2)}%
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.label}>Positions</span>
            <span className={styles.value}>{displayHoldings.length}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className={styles.actions}>
        <button className={styles.actionButton}>🔄 Rebalance</button>
        <button className={styles.actionButton}>📊 Analyze</button>
      </div>
    </div>
  );
};

export default HoldingsTable;
