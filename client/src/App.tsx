import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { KitchenDisplay } from './pages/KitchenDisplay';
import { CustomerOrder } from './pages/CustomerOrder';
import { AnalyticsDashboard } from './pages/AnalyticsDashboard';
import { OrderHistory } from './pages/OrderHistory';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<KitchenDisplay />} />
        <Route path="/order"     element={<CustomerOrder />} />
        <Route path="/analytics" element={<AnalyticsDashboard />} />
        <Route path="/history"   element={<OrderHistory />} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
