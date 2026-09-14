import { useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home, Users, Store, PlaySquare, Bookmark, Calendar,
  Moon, Sun, Settings, LogOut,
} from 'lucide-react';
import { Avatar } from '@/components/UI/Avatar';
import { useAuthStore, useUIStore } from '@/store';
import { cn } from '@/utils';

const NAV_ITEMS = [
  { to: '/',            icon: Home,       label: 'Home',        exact: true  },
  { to: '/friends',     icon: Users,      label: 'Friends',     exact: false },
  { to: '/watch',       icon: PlaySquare, label: 'Watch',       exact: false },
  { to: '/marketplace', icon: Store,      label: 'Marketplace', exact: false },
  { to: '/saved',       icon: Bookmark,   label: 'Saved',       exact: false },
  { to: '/events',      icon: Calendar,   label: 'Events',      exact: false },
];

export function LeftSidebar() {
  const { user, logout } = useAuthStore();
  const { darkMode, toggleDarkMode } = useUIStore();
  const navigate = useNavigate();

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  return (
    <aside className="w-72 h-[calc(100vh-56px)] sticky top-14 overflow-y-auto scrollbar-hide py-2 px-2 flex flex-col gap-0.5">
      {/* Profile link */}
      {user && (
        <NavLink
          to={`/profile/${user.username}`}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-2 py-2 rounded-xl transition-colors',
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/20'
                : 'hover:bg-gray-100 dark:hover:bg-surface-dark-3'
            )
          }
        >
          <Avatar src={user.avatar} name={user.fullName} size="md" isOnline />
          <div className="min-w-0">
            <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{user.fullName}</p>
            <p className="text-xs text-gray-500 truncate">@{user.username}</p>
          </div>
        </NavLink>
      )}

      {/* Nav links */}
      {NAV_ITEMS.map(({ to, icon: Icon, label, exact }) => (
        <NavLink
          key={to}
          to={to}
          end={exact}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-2 py-2 rounded-xl transition-colors',
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 text-brand-500'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-dark-3'
            )
          }
        >
          {({ isActive }) => (
            <>
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
                  isActive
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-200 dark:bg-surface-dark-3 text-gray-600 dark:text-gray-400'
                )}
              >
                <Icon size={18} />
              </div>
              <span className="font-medium text-sm truncate">{label}</span>
            </>
          )}
        </NavLink>
      ))}

      <div className="my-2 border-t border-gray-200 dark:border-gray-700" />

      {/* Dark mode toggle */}
      <button
        onClick={toggleDarkMode}
        className="flex items-center gap-3 px-2 py-2 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-surface-dark-3 flex items-center justify-center text-gray-600 dark:text-gray-400 flex-shrink-0">
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </div>
        <span className="font-medium text-sm">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
      </button>

      {/* Settings */}
      <NavLink
        to="/settings"
        className="flex items-center gap-3 px-2 py-2 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-surface-dark-3 flex items-center justify-center text-gray-600 dark:text-gray-400 flex-shrink-0">
          <Settings size={18} />
        </div>
        <span className="font-medium text-sm">Settings</span>
      </NavLink>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-2 py-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
          <LogOut size={18} />
        </div>
        <span className="font-medium text-sm">Log Out</span>
      </button>

      {/* Footer */}
      <div className="mt-auto pt-4 px-2 text-xs text-gray-400 dark:text-gray-600 leading-relaxed">
        <p>Privacy · Terms · Advertising · Ad choices · Cookies</p>
        <p className="mt-1">PluseConnect © {new Date().getFullYear()}</p>
      </div>
    </aside>
  );
}
