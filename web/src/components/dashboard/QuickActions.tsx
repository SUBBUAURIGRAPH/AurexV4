/**
 * Quick Actions Component
 * 4 action buttons for common dashboard actions
 * @version 1.0.0
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './QuickActions.module.css';

interface ActionButton {
  id: string;
  label: string;
  icon: string;
  description: string;
  action: () => void;
}

const QuickActions: React.FC = () => {
  const navigate = useNavigate();

  const handleNewTrade = () => {
    navigate('/trading/new');
  };

  const handleViewSignals = () => {
    navigate('/tools/signals');
  };

  const handleConfigureAI = () => {
    navigate('/settings');
  };

  const handleMobileApp = () => {
    // Open mobile app link in new tab
    window.open('https://apps.apple.com/app/hermes-trading', '_blank');
  };

  const actions: ActionButton[] = [
    {
      id: 'new-trade',
      label: 'New Trade',
      icon: '⚡',
      description: 'Execute a new trade',
      action: handleNewTrade
    },
    {
      id: 'view-signals',
      label: 'View AI Signals',
      icon: '🤖',
      description: 'Check AI trading signals',
      action: handleViewSignals
    },
    {
      id: 'configure-ai',
      label: 'Configure AI',
      icon: '⚙️',
      description: 'Customize AI settings',
      action: handleConfigureAI
    },
    {
      id: 'mobile-app',
      label: 'Mobile App',
      icon: '📱',
      description: 'Access on mobile',
      action: handleMobileApp
    }
  ];

  return (
    <div className={styles.quickActionsContainer}>
      <div className={styles.header}>
        <h2 className={styles.title}>Quick Actions</h2>
      </div>

      <div className={styles.buttonsGrid}>
        {actions.map(action => (
          <button
            key={action.id}
            className={styles.actionButton}
            onClick={action.action}
            title={action.description}
          >
            <div className={styles.icon}>{action.icon}</div>
            <div className={styles.label}>{action.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
