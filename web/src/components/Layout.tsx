import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth';

const NAV = [
  { to: '/projects', label: 'Projects', icon: '📋', permission: 'projects.view' },
  { to: '/sessions', label: 'My Work', icon: '⏱️', permission: 'sessions.create' },
  { to: '/dashboard', label: 'Dashboard', icon: '📊', permission: 'dashboard.view' },
  { to: '/intelligence', label: 'Intelligence', icon: '🧠', permission: 'intelligence.view' },
  { to: '/reports', label: 'Reports', icon: '📄', permission: 'reports.view' },
  { to: '/admin', label: 'Admin', icon: '⚙️', permission: 'users.view' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, can, logout } = useAuth();
  const navigate = useNavigate();
  const items = NAV.filter((n) => can(n.permission));

  return (
    <div className="min-h-full flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 bg-ink-800 border-r border-ink-600 p-4 gap-1 no-print">
        <div className="px-2 pb-4 border-b border-ink-600 mb-3 flex items-center gap-3">
          <img src="/logo.png" alt="3D Labor" className="w-11 h-11 rounded-xl" />
          <div className="text-[11px] uppercase tracking-widest text-slate-400 leading-tight">Labor<br />Intelligence</div>
        </div>
        {items.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition ${
                isActive ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-ink-700'
              }`
            }
          >
            <span>{n.icon}</span> {n.label}
          </NavLink>
        ))}
        <div className="mt-auto pt-3 border-t border-ink-600">
          <button onClick={() => navigate('/settings')} className="w-full text-left px-3 py-2 rounded-xl hover:bg-ink-700">
            <div className="text-sm font-semibold text-slate-200">{user?.fullName}</div>
            <div className="text-xs text-gold-500">{user?.role}</div>
          </button>
          <button onClick={logout} className="w-full mt-1 px-3 py-2 text-left text-sm text-slate-400 hover:text-red-400 rounded-xl hover:bg-ink-700">
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden sticky top-0 z-20 bg-ink-800/95 backdrop-blur border-b border-ink-600 px-4 py-3 flex items-center justify-between no-print">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="3D Labor" className="w-8 h-8 rounded-lg" />
          <span className="text-slate-400 font-medium text-xs uppercase tracking-widest">Labor Intelligence</span>
        </div>
        <button onClick={() => navigate('/settings')} className="text-sm text-slate-300 font-medium">
          {user?.fullName?.split(' ')[0]} <span className="text-gold-500">▾</span>
        </button>
      </header>

      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 max-w-6xl w-full mx-auto">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-ink-800/95 backdrop-blur border-t border-ink-600 flex no-print">
        {items.slice(0, 5).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `flex-1 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] text-center text-[10px] font-medium ${
                isActive ? 'text-brand-400' : 'text-slate-400'
              }`
            }
          >
            <div className="text-lg leading-none mb-0.5">{n.icon}</div>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
