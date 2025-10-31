/**
 * Recent Trades Table Component
 * Displays recent trading activity with status and signal type
 * @version 1.0.0
 */

import React from 'react';
import styles from './RecentTradesTable.module.css';

interface Trade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  status: 'FILLED' | 'PENDING' | 'CANCELLED';
  quantity: number;
  price: number;
  total: number;
  signalType: 'AI' | 'MANUAL' | 'SIGNAL';
  timestamp: Date;
}

interface RecentTradesTableProps {
  trades?: Trade[];
}

const RecentTradesTable: React.FC<RecentTradesTableProps> = ({ trades }) => {
  // Default sample trades
  const defaultTrades: Trade[] = [
    {
      id: '1',
      symbol: 'AAPL',
      type: 'BUY',
      status: 'FILLED',
      quantity: 10,
      price: 175.50,
      total: 1755.00,
      signalType: 'AI',
      timestamp: new Date(Date.now() - 3600000)
    },
    {
      id: '2',
      symbol: 'GOOGL',
      type: 'SELL',
      status: 'FILLED',
      quantity: 5,
      price: 140.25,
      total: 701.25,
      signalType: 'SIGNAL',
      timestamp: new Date(Date.now() - 7200000)
    },
    {
      id: '3',
      symbol: 'MSFT',
      type: 'BUY',
      status: 'PENDING',
      quantity: 8,
      price: 380.00,
      total: 3040.00,
      signalType: 'MANUAL',
      timestamp: new Date(Date.now() - 10800000)
    },
    {
      id: '4',
      symbol: 'TSLA',
      type: 'BUY',
      status: 'FILLED',
      quantity: 3,
      price: 242.15,
      total: 726.45,
      signalType: 'AI',
      timestamp: new Date(Date.now() - 14400000)
    },
    {
      id: '5',
      symbol: 'META',
      type: 'SELL',
      status: 'FILLED',
      quantity: 6,
      price: 195.80,
      total: 1174.80,
      signalType: 'SIGNAL',
      timestamp: new Date(Date.now() - 18000000)
    },
    {
      id: '6',
      symbol: 'NVDA',
      type: 'BUY',
      status: 'FILLED',
      quantity: 4,
      price: 875.30,
      total: 3501.20,
      signalType: 'AI',
      timestamp: new Date(Date.now() - 21600000)
    },
    {
      id: '7',
      symbol: 'AMD',
      type: 'SELL',
      status: 'CANCELLED',
      quantity: 2,
      price: 165.00,
      total: 330.00,
      signalType: 'MANUAL',
      timestamp: new Date(Date.now() - 25200000)
    }
  ];

  const displayTrades = trades || defaultTrades;

  // Get status badge color
  const getStatusColor = (status: Trade['status']): string => {
    switch (status) {
      case 'FILLED':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'CANCELLED':
        return 'danger';
      default:
        return 'secondary';
    }
  };

  // Get signal type icon
  const getSignalIcon = (signalType: Trade['signalType']): string => {
    switch (signalType) {
      case 'AI':
        return '🤖';
      case 'SIGNAL':
        return '📡';
      case 'MANUAL':
        return '👤';
      default:
        return '📊';
    }
  };

  // Format time
  const formatTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className={styles.tradesContainer}>
      <div className={styles.header}>
        <h3 className={styles.title}>Recent Trades</h3>
        <a href="#" className={styles.viewAll}>View All →</a>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Type</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Total</th>
              <th>Signal</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {displayTrades.map(trade => (
              <tr key={trade.id} className={styles.tradeRow}>
                <td className={styles.symbol}>
                  <strong>{trade.symbol}</strong>
                </td>
                <td className={styles.type}>
                  <span className={`${styles.badge} ${styles[trade.type.toLowerCase()]}`}>
                    {trade.type}
                  </span>
                </td>
                <td className={styles.quantity}>{trade.quantity}</td>
                <td className={styles.price}>
                  ${trade.price.toFixed(2)}
                </td>
                <td className={styles.total}>
                  ${trade.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className={styles.signal}>
                  <span className={styles.signalBadge}>
                    {getSignalIcon(trade.signalType)} {trade.signalType}
                  </span>
                </td>
                <td className={styles.status}>
                  <span className={`${styles.statusBadge} ${styles[getStatusColor(trade.status)]}`}>
                    {trade.status}
                  </span>
                </td>
                <td className={styles.timestamp}>
                  {formatTime(trade.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.footer}>
        <p className={styles.tradeCount}>Showing {displayTrades.length} recent trades</p>
      </div>
    </div>
  );
};

export default RecentTradesTable;
