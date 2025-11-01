/**
 * Sidebar Component
 * Navigation and branding
 * @version 1.0.0
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Sidebar.module.css';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeTab?: string;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/dashboard' },
  { id: 'portfolio', label: 'Portfolio', icon: '💼', path: '/portfolio' },
  { id: 'trading', label: 'Trading', icon: '⚡', path: '/trading' },
  { id: 'analytics', label: 'Analytics', icon: '📈', path: '/analytics' },
  { id: 'signals', label: 'AI Signals', icon: '🤖', path: '/signals' },
  { id: 'alerts', label: 'Alerts', icon: '🔔', path: '/alerts' },
];

const FOOTER_ITEMS = [
  { id: 'settings', label: 'Settings', icon: '⚙️', path: '/settings' },
  { id: 'help', label: 'Help', icon: '❓', path: '/help' },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, activeTab = 'dashboard' }) => {
  const navigate = useNavigate();

  const handleNavClick = (path: string) => {
    navigate(path);
  };

  return (
    <>
      {/* Sidebar Overlay (Mobile) */}
      {isOpen && <div className={styles.overlay} onClick={onToggle} />}

      {/* Sidebar */}
      <div className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.icon}>📈</span>
            <span className={styles.title}>HERMES</span>
          </div>
          <p className={styles.subtitle}>Trading Platform</p>
          <button className={styles.closeButton} onClick={onToggle}>
            ✕
          </button>
        </div>

        {/* Navigation */}
        <nav className={styles.nav}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`${styles.navItem} ${activeTab === item.id ? styles.active : ''}`}
              onClick={() => handleNavClick(item.path)}
            >
              <span className={styles.icon}>{item.icon}</span>
              <span className={styles.label}>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer Navigation */}
        <div className={styles.footer}>
          <nav className={styles.footerNav}>
            {FOOTER_ITEMS.map(item => (
              <button
                key={item.id}
                className={styles.navItem}
                onClick={() => handleNavClick(item.path)}
              >
                <span className={styles.icon}>{item.icon}</span>
                <span className={styles.label}>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
