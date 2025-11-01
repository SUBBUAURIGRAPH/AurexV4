/**
 * Main Application Component
 * React Router configuration and top-level app layout
 * @version 1.0.0
 */

import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HermesMainDashboard from './pages/Dashboard/HermesMainDashboard';
import NotImplemented from './pages/NotImplemented';
import LoadingSpinner from './components/common/LoadingSpinner';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Dashboard - Home Route */}
          <Route path="/" element={<HermesMainDashboard />} />

          {/* Trading Routes */}
          <Route path="/trading/new" element={<NotImplemented />} />
          <Route path="/trading/orders" element={<NotImplemented />} />
          <Route path="/trading/positions" element={<NotImplemented />} />
          <Route path="/trading/paper" element={<NotImplemented />} />

          {/* Analytics Routes */}
          <Route path="/analytics/performance" element={<NotImplemented />} />
          <Route path="/analytics/risk" element={<NotImplemented />} />
          <Route path="/analytics/reports" element={<NotImplemented />} />
          <Route path="/analytics/export" element={<NotImplemented />} />

          {/* Tools Routes */}
          <Route path="/tools/signals" element={<NotImplemented />} />
          <Route path="/tools/alerts" element={<NotImplemented />} />
          <Route path="/tools/portfolio" element={<NotImplemented />} />

          {/* Settings Routes */}
          <Route path="/settings" element={<NotImplemented />} />
          <Route path="/settings/security" element={<NotImplemented />} />

          {/* User Routes */}
          <Route path="/profile" element={<NotImplemented />} />
          <Route path="/logout" element={<NotImplemented />} />

          {/* Help Routes */}
          <Route path="/help/docs" element={<NotImplemented />} />
          <Route path="/help/tutorials" element={<NotImplemented />} />
          <Route path="/help/faq" element={<NotImplemented />} />
          <Route path="/help/support" element={<NotImplemented />} />

          {/* Catch-all for undefined routes */}
          <Route path="*" element={<NotImplemented />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
