import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import SecurityDashboard from './pages/SecurityDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Settings from './pages/Settings';
import './App.css';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Загрузка...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
      <Route path="/forgot-password" element={!user ? <ForgotPassword /> : <Navigate to="/dashboard" />} />
      <Route path="/reset-password" element={!user ? <ForgotPassword /> : <Navigate to="/dashboard" />} />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            {user?.role === 'security' ? (
              <SecurityDashboard />
            ) : user?.role === 'admin' ? (
              <AdminDashboard />
            ) : (
              <Dashboard />
            )}
          </PrivateRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <PrivateRoute>
            {user?.role === 'admin' ? <Settings /> : <Navigate to="/dashboard" />}
          </PrivateRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;

