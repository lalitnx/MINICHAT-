/**
 * services/api.js — Axios instance with auth interceptor
 *
 * WHY a centralised Axios instance:
 * Instead of writing `axios.get('http://localhost:5000/api/...')` everywhere,
 * we create one pre-configured instance with the base URL and auth header.
 * Every API call in the app uses this instance, so if the URL or auth
 * logic changes, we only update it here.
 *
 * The request interceptor automatically attaches the JWT token from
 * localStorage to every outgoing request.
 */

import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('minichat_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — handle 401 (expired/invalid token) globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear it and redirect to login
      localStorage.removeItem('minichat_token');
      localStorage.removeItem('minichat_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
