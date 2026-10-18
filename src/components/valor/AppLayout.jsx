import { Outlet, NavLink } from 'react-router-dom';
import { Sparkles, LayoutDashboard, History as HistoryIcon, Settings as SettingsIcon } from 'lucide-react';

const NAV = [
  { to: '/', label: 'Assistant', icon: Sparkles, end: true },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: false },
  { to: '/history', label: 'History', icon: HistoryIcon, end: false },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, end: false }
];

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-white/10 bg-slate-950/80 backdrop-blur md:flex">
        <div className="flex items-center gap-2 px-6 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500">
            <Sparkles size={18} className="text-slate-950" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide">VALOR</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Your AI. Your Way.
            </div>
          </div>
        </div>
        <nav className="mt-2 flex-1 space-y-1 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive
                    ? 'bg-white/10 text-cyan-300'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-6 py-4 text-[10px] text-slate-600">Version 0.1</div>
      </aside>

      {/* Main content */}
      <div className="md:pl-60">
        <main className="flex min-h-screen flex-col pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-around border-t border-white/10 bg-slate-950/90 backdrop-blur md:hidden">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-3 text-[10px] ${
                isActive ? 'text-cyan-300' : 'text-slate-500'
              }`
            }
          >
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}