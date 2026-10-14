/**
 * context/AuthContext.jsx — Authentication state management
 *
 * WHY Context: React Context lets us share the user's auth state (logged in?,
 * who is the user?, JWT token) across the entire component tree without
 * passing props down manually through every level ("prop drilling").
 *
 * HOW IT WORKS:
 * 1. On mount, checks localStorage for an existing token + user
 * 2. Provides `login()`, `register()`, `logout()` functions
 * 3. Any component can call `useAuth()` to read auth state or trigger auth actions
 *
 * DESIGN DECISION: We store the JWT in localStorage (not httpOnly cookies) because
 * Socket.io needs to read the token on the client side to pass it during the
 * WebSocket handshake. httpOnly cookies would be more secure against XSS, but
 * they make Socket.io auth significantly more complex. For a college project,
 * this is an acceptable trade-off — mention it in your viva.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true); // true until initial check completes

  // ─── On mount: restore session from localStorage ────────────────
  useEffect(() => {
    const savedToken = localStorage.getItem('minichat_token');
    const savedUser = localStorage.getItem('minichat_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        connectSocket(savedToken);
      } catch {
        // Corrupted data — clear it
        localStorage.removeItem('minichat_token');
        localStorage.removeItem('minichat_user');
      }
    }
    setLoading(false);
  }, []);

  // ─── Login ──────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    const { token: newToken, user: newUser } = data;

    localStorage.setItem('minichat_token', newToken);
    localStorage.setItem('minichat_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    connectSocket(newToken);

    return newUser;
  }, []);

  // ─── Register ───────────────────────────────────────────────────
  const register = useCallback(async (username, email, password) => {
    const { data } = await api.post('/auth/register', {
      username,
      email,
      password,
    });
    const { token: newToken, user: newUser } = data;

    localStorage.setItem('minichat_token', newToken);
    localStorage.setItem('minichat_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    connectSocket(newToken);

    return newUser;
  }, []);

  // ─── Logout ─────────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem('minichat_token');
    localStorage.removeItem('minichat_user');
    setToken(null);
    setUser(null);
    disconnectSocket();
  }, []);

  // ─── Update user profile locally ───────────────────────────────
  const updateUser = useCallback((updates) => {
    setUser((prev) => {
      const updated = { ...prev, ...updates };
      localStorage.setItem('minichat_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token,
    login,
    register,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth() — Custom hook to access auth context
 *
 * Usage in any component:
 *   const { user, login, logout, isAuthenticated } = useAuth();
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return context;
}
