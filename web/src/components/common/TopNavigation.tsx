/**
 * Top Navigation Component
 * Professional navigation bar with dropdown menus
 * @version 1.0.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './TopNavigation.module.css';

interface NavDropdownItem {
  id: string;
  label: string;
  icon?: string;
  href?: string;
  action?: () => void;
  divider?: boolean;
}

interface NavMenu {
  id: string;
  label: string;
  icon: string;
  items: NavDropdownItem[];
}

const TopNavigation: React.FC = () => {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Navigation routes mapping
  const routeMap: Record<string, string> = {
    'new-trade': '/trading/new',
    'orders': '/trading/orders',
    'positions': '/trading/positions',
    'paper-trading': '/trading/paper',
    'dashboard': '/',
    'performance': '/analytics/performance',
    'risk-analysis': '/analytics/risk',
    'reports': '/analytics/reports',
    'export': '/analytics/export',
    'ai-signals': '/tools/signals',
    'alerts': '/tools/alerts',
    'portfolio-builder': '/tools/portfolio',
    'settings': '/settings',
    'documentation': '/help/docs',
    'tutorials': '/help/tutorials',
    'faq': '/help/faq',
    'support': '/help/support',
    'profile': '/profile',
    'security': '/settings/security',
    'logout': '/logout'
  };

  // Navigation menus
  const navMenus: NavMenu[] = [
    {
      id: 'trading',
      label: 'Trading',
      icon: '⚡',
      items: [
        { id: 'new-trade', label: 'New Trade', icon: '➕', href: '/trading/new' },
        { id: 'orders', label: 'Orders', icon: '📋', href: '/trading/orders' },
        { id: 'positions', label: 'Positions', icon: '📊', href: '/trading/positions' },
        { divider: true, id: 'divider1', label: '' },
        { id: 'paper-trading', label: 'Paper Trading', icon: '📝', href: '/trading/paper' }
      ]
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: '📈',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: '🏠', href: '/' },
        { id: 'performance', label: 'Performance', icon: '📊', href: '/analytics/performance' },
        { id: 'risk-analysis', label: 'Risk Analysis', icon: '⚠️', href: '/analytics/risk' },
        { divider: true, id: 'divider2', label: '' },
        { id: 'reports', label: 'Reports', icon: '📄', href: '/analytics/reports' },
        { id: 'export', label: 'Export Data', icon: '⬇️', href: '/analytics/export' }
      ]
    },
    {
      id: 'tools',
      label: 'Tools',
      icon: '🔧',
      items: [
        { id: 'ai-signals', label: 'AI Signals', icon: '🤖', href: '/tools/signals' },
        { id: 'alerts', label: 'Alerts', icon: '🔔', href: '/tools/alerts' },
        { id: 'portfolio-builder', label: 'Portfolio Builder', icon: '🏗️', href: '/tools/portfolio' },
        { divider: true, id: 'divider3', label: '' },
        { id: 'settings', label: 'Settings', icon: '⚙️', href: '/settings' }
      ]
    },
    {
      id: 'help',
      label: 'Help',
      icon: '❓',
      items: [
        { id: 'documentation', label: 'Documentation', icon: '📚', href: '/help/docs' },
        { id: 'tutorials', label: 'Tutorials', icon: '🎓', href: '/help/tutorials' },
        { id: 'faq', label: 'FAQ', icon: '💬', href: '/help/faq' },
        { divider: true, id: 'divider4', label: '' },
        { id: 'support', label: 'Support', icon: '🆘', href: '/help/support' }
      ]
    }
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Toggle dropdown
  const toggleDropdown = (menuId: string) => {
    setActiveDropdown(activeDropdown === menuId ? null : menuId);
  };

  // Handle menu item click
  const handleMenuItemClick = (item: NavDropdownItem) => {
    if (item.action) {
      item.action();
    } else if (item.href && item.href !== '#') {
      // Navigate using React Router
      navigate(item.href);
    }
    setActiveDropdown(null);
  };

  return (
    <nav className={styles.topNav} ref={dropdownRef}>
      {/* Logo/Branding */}
      <div
        className={styles.navBrand}
        onClick={() => navigate('/')}
        style={{ cursor: 'pointer' }}
        title="Back to Dashboard"
      >
        <span className={styles.logo}>📈</span>
        <span className={styles.brandName}>HERMES</span>
      </div>

      {/* Main Navigation */}
      <div className={styles.navMenu}>
        {navMenus.map((menu) => (
          <div key={menu.id} className={styles.navGroup}>
            {/* Menu Button */}
            <button
              className={`${styles.navButton} ${activeDropdown === menu.id ? styles.active : ''}`}
              onClick={() => toggleDropdown(menu.id)}
              title={menu.label}
            >
              <span className={styles.icon}>{menu.icon}</span>
              <span className={styles.label}>{menu.label}</span>
              <span className={styles.chevron}>▼</span>
            </button>

            {/* Dropdown Menu */}
            {activeDropdown === menu.id && (
              <div className={styles.dropdown}>
                {menu.items.map((item) => (
                  item.divider ? (
                    <div key={item.id} className={styles.divider} />
                  ) : (
                    <button
                      key={item.id}
                      className={styles.dropdownItem}
                      onClick={() => handleMenuItemClick(item)}
                    >
                      {item.icon && <span className={styles.itemIcon}>{item.icon}</span>}
                      <span className={styles.itemLabel}>{item.label}</span>
                    </button>
                  )
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Right Side Actions */}
      <div className={styles.navRight}>
        {/* Notifications */}
        <button className={styles.iconButton} title="Notifications">
          <span className={styles.badge}>3</span>
          🔔
        </button>

        {/* User Menu */}
        <div className={styles.navGroup}>
          <button
            className={`${styles.navButton} ${activeDropdown === 'user' ? styles.active : ''}`}
            onClick={() => toggleDropdown('user')}
            title="User Menu"
          >
            <span className={styles.userAvatar}>👤</span>
            <span className={styles.userName}>John Doe</span>
            <span className={styles.chevron}>▼</span>
          </button>

          {activeDropdown === 'user' && (
            <div className={styles.dropdown} style={{ right: 0 }}>
              <button
                className={styles.dropdownItem}
                onClick={() => {
                  navigate('/profile');
                  setActiveDropdown(null);
                }}
              >
                <span className={styles.itemIcon}>👤</span>
                <span className={styles.itemLabel}>Profile</span>
              </button>
              <button
                className={styles.dropdownItem}
                onClick={() => {
                  navigate('/settings');
                  setActiveDropdown(null);
                }}
              >
                <span className={styles.itemIcon}>⚙️</span>
                <span className={styles.itemLabel}>Settings</span>
              </button>
              <button
                className={styles.dropdownItem}
                onClick={() => {
                  navigate('/settings/security');
                  setActiveDropdown(null);
                }}
              >
                <span className={styles.itemIcon}>🔐</span>
                <span className={styles.itemLabel}>Security</span>
              </button>
              <div className={styles.divider} />
              <button
                className={styles.dropdownItem}
                onClick={() => {
                  navigate('/logout');
                  setActiveDropdown(null);
                }}
              >
                <span className={styles.itemIcon}>🚪</span>
                <span className={styles.itemLabel}>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default TopNavigation;
