import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import ProjectSelect from './pages/ProjectSelect';
import Track from './pages/Track';
import ActiveSession from './pages/ActiveSession';
import Sessions from './pages/Sessions';
import Dashboard from './pages/Dashboard';
import Intelligence from './pages/Intelligence';
import Reports from './pages/Reports';
import Admin from './pages/Admin';
import Settings from './pages/Settings';
import Guide from './pages/Guide';

export default function App() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-brand-400 text-lg font-semibold animate-pulse">3DTSI Labor Intelligence Platform</div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <Layout key={location.pathname.split('/')[1]}>
      <Routes>
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="/projects" element={<ProjectSelect />} />
        <Route path="/track/:projectId" element={<Track />} />
        <Route path="/session/:sessionId" element={<ActiveSession />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/intelligence" element={<Intelligence />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </Layout>
  );
}
