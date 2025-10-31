/**
 * Top Navigation Component
 * Professional navigation bar with dropdown menus
 * @version 1.0.0
 */

import React, { useState, useRef, useEffect } from 'react';
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

  // Navigation menus
  const navMenus: NavMenu[] = [
    {
      id: 'trading',
      label: 'Trading',
      icon: '⚡',
      items: [
        { id: 'new-trade', label: 'New Trade', icon: '➕', href: '#' },
        { id: 'orders', label: 'Orders', icon: '📋', href: '#' },
        { id: 'positions', label: 'Positions', icon: '📊', href: '#' },
        { divider: true, id: 'divider1', label: '' },
        { id: 'paper-trading', label: 'Paper Trading', icon: '📝', href: '#' }
      ]
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: '📈',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: '🏠', href: '#' },
        { id: 'performance', label: 'Performance', icon: '📊', href: '#' },
        { id: 'risk-analysis', label: 'Risk Analysis', icon: '⚠️', href: '#' },
        { divider: true, id: 'divider2', label: '' },
        { id: 'reports', label: 'Reports', icon: '📄', href: '#' },
        { id: 'export', label: 'Export Data', icon: '⬇️', href: '#' }
      ]
    },
    {
      id: 'tools',
      label: 'Tools',
      icon: '🔧',
      items: [
        { id: 'ai-signals', label: 'AI Signals', icon: '🤖', href: '#' },
        { id: 'alerts', label: 'Alerts', icon: '🔔', href: '#' },
        { id: 'portfolio-builder', label: 'Portfolio Builder', icon: '🏗️', href: '#' },
        { divider: true, id: 'divider3', label: '' },
        { id: 'settings', label: 'Settings', icon: '⚙️', href: '#' }
      ]
    },
    {
      id: 'help',
      label: 'Help',
      icon: '❓',
      items: [
        { id: 'documentation', label: 'Documentation', icon: '📚', href: '#' },
        { id: 'tutorials', label: 'Tutorials', icon: '🎓', href: '#' },
        { id: 'faq', label: 'FAQ', icon: '💬', href: '#' },
        { divider: true, id: 'divider4', label: '' },
        { id: 'support', label: 'Support', icon: '🆘', href: '#' }
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
    }
    setActiveDropdown(null);
  };

  return (
    <nav className={styles.topNav} ref={dropdownRef}>
      {/* Logo/Branding */}
      <div className={styles.navBrand}>
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
              <button className={styles.dropdownItem}>
                <span className={styles.itemIcon}>👤</span>
                <span className={styles.itemLabel}>Profile</span>
              </button>
              <button className={styles.dropdownItem}>
                <span className={styles.itemIcon}>⚙️</span>
                <span className={styles.itemLabel}>Settings</span>
              </button>
              <button className={styles.dropdownItem}>
                <span className={styles.itemIcon}>🔐</span>
                <span className={styles.itemLabel}>Security</span>
              </button>
              <div className={styles.divider} />
              <button className={styles.dropdownItem}>
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
