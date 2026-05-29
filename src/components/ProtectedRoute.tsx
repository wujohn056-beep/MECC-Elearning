import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAdmin?: boolean;
    requireLeader?: boolean;
    requireTaskAccess?: boolean;
    requireDashboardAccess?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false, requireLeader = false, requireTaskAccess = false, requireDashboardAccess = false }: ProtectedRouteProps) {
    const { user, profile, loading, hasAnyAdminPermission, isLeader, canAccessTasks, canAccessDashboard } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!user || profile?.role === 'blocked') {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (requireAdmin && !hasAnyAdminPermission) {
        // Redirect non-admins to home or a specific "unauthorized" page
        return <Navigate to="/" replace />;
    }
    
    if (requireLeader && !isLeader) {
        return <Navigate to="/" replace />;
    }

    if (requireTaskAccess && !canAccessTasks) {
        return <Navigate to="/" replace />;
    }

    if (requireDashboardAccess && !canAccessDashboard) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}
