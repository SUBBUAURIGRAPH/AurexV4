/**
 * Dashboard Header Component
 * Welcome message and user info
 * @version 1.0.0
 */

import React from 'react';
import styles from './DashboardHeader.module.css';

interface DashboardHeaderProps {
  userName: string;
  marketStatus: 'OPEN' | 'CLOSED';
  aiRiskScore: number;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  userName,
  marketStatus,
  aiRiskScore
}) => {
  const currentTime = new Date();
  const dayName = currentTime.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = currentTime.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const getRiskLevel = (score: number): string => {
    if (score <= 3) return 'LOW';
    if (score <= 6) return 'MEDIUM';
    return 'HIGH';
  };

  const getRiskColor = (score: number): string => {
    if (score <= 3) return '#22c55e'; // Green
    if (score <= 6) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  return (
    <div className={styles.header}>
      <div className={styles.greeting}>
        <h1 className={styles.title}>Welcome back, {userName}! 👋</h1>
        <p className={styles.subtitle}>
          {dayName}, {dateStr} | Markets: <span className={styles.status}>{marketStatus}</span> |
          AI Risk Score: <span className={styles.riskScore} style={{ color: getRiskColor(aiRiskScore) }}>
            {getRiskLevel(aiRiskScore)} ({aiRiskScore}%)
          </span>
        </p>
      </div>

      <div className={styles.userInfo}>
        <p className={styles.userName}>{userName}</p>
        <p className={styles.memberStatus}>Premium Member • Active 4 yrs</p>
      </div>
    </div>
  );
};

export default DashboardHeader;
