/**
 * App.jsx — Root component with routing
 *
 * WHAT: Sets up React Router with two main routes:
 * - /login → Login/Register screen (with 3D background)
 * - /chat  → Main chat interface (protected, requires auth)
 *
 * Also wraps the app in our AuthProvider context so any component
 * can access the current user and auth state.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/Common/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';


function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
        {/* Toast notifications — appears in top-right corner */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
            },
            success: {
              iconTheme: {
                primary: 'var(--color-success)',
                secondary: 'var(--bg-elevated)',
              },
            },
            error: {
              iconTheme: {
                primary: 'var(--color-error)',
                secondary: 'var(--bg-elevated)',
              },
            },
          }}
        />

        <Routes>
          {/* Public route — login/register */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected route — chat (redirects to /login if not authed) */}
          <Route
            path="/chat/*"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </ThemeProvider>
  );
}

export default App;
