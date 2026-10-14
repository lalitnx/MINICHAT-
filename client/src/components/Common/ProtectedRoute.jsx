/**
 * components/Common/ProtectedRoute.jsx — Route guard
 *
 * WHAT: A wrapper component that checks if the user is authenticated.
 * If yes → renders the child page. If no → redirects to /login.
 *
 * WHY: This prevents unauthenticated users from accessing the chat
 * by typing the URL directly in the browser. It's a client-side check —
 * the server-side auth middleware provides the real security.
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  // While checking localStorage for saved auth, show nothing
  // (prevents flash of login page before redirect to chat)
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        color: 'var(--text-secondary)',
      }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
