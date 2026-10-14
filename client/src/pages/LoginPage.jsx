import React from 'react';
import LoginScene from '../components/Login/LoginScene';
import AuthForm from '../components/Login/AuthForm';
import ThemeToggle from '../components/Common/ThemeToggle';

export default function LoginPage() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', zIndex: 100 }}>
        <ThemeToggle />
      </div>
      <LoginScene />
      <AuthForm />
    </div>
  );
}
