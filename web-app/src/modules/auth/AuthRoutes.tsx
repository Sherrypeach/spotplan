import { useLayoutEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AppFooter } from '@components/AppFooter';
import { LoadingScreen } from '@components/LoadingScreen';
import { useAuth } from '@context/auth';
import { Login } from '@modules/auth/Login';
import { ResetPassword } from '@modules/auth/reset/ResetPassword';
import { applyTheme } from '@shared/theme';
import { useTheme } from '@shared/themeContext';

export function AuthRoutes() {
  const { status } = useAuth();
  const { theme } = useTheme();
  const { pathname } = useLocation();
  // Signing in is always light (applyTheme sees the path); leaving brings the teacher's own theme back.
  useLayoutEffect(() => {
    applyTheme(theme);
    return () => applyTheme(theme);
  }, [theme, pathname]);

  // Wait for the first session check, so a late answer can't undo a fresh sign-in.
  if (status === 'checking') return <LoadingScreen />;

  return (
    <main className="bg-dots flex min-h-dvh flex-col items-center justify-center p-4">
      <Routes>
        <Route path="login" element={status === 'signedIn' ? <Navigate to="/" replace /> : <Login />} />
        {/* The reset email links to /auth/reset. */}
        <Route path="reset" element={<ResetPassword />} />
        <Route path="forgot" element={<Navigate to="/auth/reset" replace />} />
        <Route path="*" element={<Navigate to="login" replace />} />
      </Routes>
      <AppFooter />
    </main>
  );
}
