import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { AuthProvider } from './contexts/AuthContext';
import AppLayout from './components/AppLayout';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import RecordingsManager from './pages/admin/RecordingsManager';

// Temporary placeholders for pages
import LearningHub from './pages/LearningHub';
import Account from './pages/Account';
import TeamTasks from './pages/TeamTasks';
import PoliciesShowcase from './pages/PoliciesShowcase';
import ReferralShowcase from './pages/ReferralShowcase';

import UserManager from './pages/admin/UserManager';
import CategoryManager from './pages/admin/CategoryManager';
import AdminDashboard from './pages/admin/AdminDashboard';
import CommentManager from './pages/admin/CommentManager';
import PolicyManager from './pages/admin/PolicyManager';
import ReferralManager from './pages/admin/ReferralManager';

const Router = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/portal" element={<Login />} />

          {/* User Routes */}
          <Route element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }>
            <Route path="/" element={<Navigate to="/hub" replace />} />
            <Route path="/hub" element={<LearningHub />} />
            <Route path="/policies" element={<PoliciesShowcase section="policy" />} />
            <Route path="/brands" element={<PoliciesShowcase section="brand" />} />
            <Route path="/referrals" element={<ReferralShowcase />} />
            <Route path="/account" element={<Account />} />
            <Route path="/team-tasks" element={
              <ProtectedRoute requireTaskAccess={true}>
                <TeamTasks />
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute requireDashboardAccess={true}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
                  <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/60 p-6 md:p-8">
                    <AdminDashboard />
                  </div>
                </div>
              </ProtectedRoute>
            } />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={
            <ProtectedRoute requireAdmin={true}>
              <AdminLayout />
            </ProtectedRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="categories" element={<CategoryManager />} />
            <Route path="recordings" element={<RecordingsManager />} />
            <Route path="users" element={<UserManager />} />
            <Route path="comments" element={<CommentManager />} />
            <Route path="policies" element={<PolicyManager />} />
            <Route path="referrals" element={<ReferralManager />} />

          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
