/**
 * Not Implemented Page
 * Placeholder for pages under development
 * @version 1.0.0
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const NotImplemented: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const getPageTitle = (pathname: string): string => {
    const segments = pathname.split('/').filter(Boolean);
    const titles: Record<string, string> = {
      'trading': 'Trading',
      'new': 'New Trade',
      'orders': 'Orders',
      'positions': 'Positions',
      'paper': 'Paper Trading',
      'analytics': 'Analytics',
      'performance': 'Performance Analysis',
      'risk': 'Risk Analysis',
      'reports': 'Reports',
      'export': 'Data Export',
      'tools': 'Tools',
      'signals': 'AI Signals',
      'alerts': 'Alerts',
      'portfolio': 'Portfolio Builder',
      'settings': 'Settings',
      'security': 'Security Settings',
      'profile': 'Profile',
      'help': 'Help Center',
      'docs': 'Documentation',
      'tutorials': 'Tutorials',
      'faq': 'FAQ',
      'support': 'Support',
      'logout': 'Logout'
    };

    return titles[segments[segments.length - 1]] || 'Page';
  };

  const pageTitle = getPageTitle(location.pathname);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #000000 0%, #0f0f23 50%, #1a0033 100%)',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '3rem',
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        maxWidth: '500px'
      }}>
        <h1 style={{
          fontSize: '3rem',
          marginBottom: '1rem',
          color: '#667eea'
        }}>
          🚧
        </h1>
        <h2 style={{
          fontSize: '1.5rem',
          marginBottom: '0.5rem',
          color: '#ffffff'
        }}>
          {pageTitle}
        </h2>
        <p style={{
          fontSize: '0.95rem',
          color: '#a1a1a1',
          marginBottom: '2rem'
        }}>
          This page is under development. The feature will be available soon!
        </p>
        <p style={{
          fontSize: '0.85rem',
          color: '#888888',
          marginBottom: '2rem'
        }}>
          Path: <code style={{ color: '#667eea' }}>{location.pathname}</code>
        </p>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            color: '#ffffff',
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: '500',
            transition: 'all 0.3s ease',
            marginRight: '1rem'
          }}
          onMouseOver={(e) => {
            (e.target as HTMLButtonElement).style.transform = 'translateY(-2px)';
            (e.target as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.4)';
          }}
          onMouseOut={(e) => {
            (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.target as HTMLButtonElement).style.boxShadow = 'none';
          }}
        >
          ← Back to Dashboard
        </button>
        <button
          onClick={() => window.history.back()}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#ffffff',
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: '500',
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => {
            (e.target as HTMLButtonElement).style.background = 'rgba(255, 255, 255, 0.15)';
          }}
          onMouseOut={(e) => {
            (e.target as HTMLButtonElement).style.background = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          Go Back
        </button>
      </div>
    </div>
  );
};

export default NotImplemented;
