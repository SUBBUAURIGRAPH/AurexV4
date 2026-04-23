import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@aurigraph/aurex-theme-kit';
import { AuthProvider } from './contexts/AuthContext';
import { App } from './App';
import '@aurigraph/aurex-theme-kit/src/styles/aurex-theme.css';
import '@aurigraph/aurex-theme-kit/src/styles/design-tokens.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
