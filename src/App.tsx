import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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

import UserManager from './pages/admin/UserManager';

import CategoryManager from './pages/admin/CategoryManager';



import AdminDashboard from './pages/admin/AdminDashboard';
function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* User Routes */}
          <Route element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }>
            <Route path="/" element={<Navigate to="/hub" replace />} />
            <Route path="/hub" element={<LearningHub />} />
            <Route path="/account" element={<Account />} />
            <Route path="/team-tasks" element={<TeamTasks />} />
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
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
