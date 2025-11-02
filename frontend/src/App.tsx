import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import GalleryPage from './pages/GalleryPage';
import TagManagementPage from './pages/TagManagementPage';
import StatsPage from './pages/StatsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-aura-darker flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-aura-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-aura-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/gallery"
            element={
              <ProtectedRoute>
                <GalleryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tags"
            element={
              <ProtectedRoute>
                <TagManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stats"
            element={
              <ProtectedRoute>
                <StatsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/gallery" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;