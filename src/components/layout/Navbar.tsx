import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Sparkles,
  Bell,
  Sun,
  Moon,
  Laptop,
  UserCheck,
  LogOut,
  ChevronDown,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useCopilot } from '../../contexts/CopilotContext';
import { useCommandPalette } from '../../contexts/CommandPaletteContext';

export const Navbar: React.FC = () => {
  const { user, role, logout } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { toggleOpen: toggleCopilot, isOpen: isCopilotOpen, activeCaseContext } = useCopilot();
  const { openPalette } = useCommandPalette();
  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  const unreadCount = 0;

  return (
    <header className="z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <div className="hidden min-w-0 lg:block">
          <div className="text-[13px] font-semibold text-foreground">Legal Vault</div>
          <div className="text-[11px] text-foreground-muted">Judicial Intelligence Platform</div>
        </div>
        {activeCaseContext?.caseNumber && (
          <div className="hidden min-w-0 items-center gap-2 rounded-[6px] border border-border bg-surface-subtle px-2.5 py-1 md:flex">
            <span className="lv-label !mb-0">Case</span>
            <span className="font-mono text-[11px] text-foreground">{activeCaseContext.caseNumber}</span>
            {activeCaseContext.title && (
              <span className="max-w-[220px] truncate text-[11px] text-foreground-muted">{activeCaseContext.title}</span>
            )}
          </div>
        )}
        <button
          onClick={openPalette}
          aria-label="Open global search"
          className="group flex w-36 items-center gap-2 rounded-[8px] border border-border bg-surface-subtle px-3 py-1.5 text-left text-xs text-foreground-muted transition-colors duration-150 hover:border-border-strong sm:w-56"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 truncate">Search…</span>
          <kbd className="hidden rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] sm:inline-flex">⌘K</kbd>
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        {(role === 'lawyer' || role === 'judge') && (
          <button
            onClick={toggleCopilot}
            className={`flex items-center gap-2 rounded-[7px] px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
              isCopilotOpen
                ? 'bg-ai-soft text-ai'
                : 'border border-border text-foreground hover:bg-surface-subtle'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Copilot</span>
          </button>
        )}

        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-[7px] p-2 text-foreground-muted transition-colors duration-150 hover:bg-surface-subtle hover:text-foreground"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-danger" />}
          </button>
          {showNotifications && (
            <div className="absolute right-0 z-50 mt-2 w-80 rounded-[10px] border border-border bg-surface-elevated p-3 shadow-lg">
              <div className="mb-2 flex items-center justify-between border-b border-border pb-2">
                <span className="text-xs font-semibold">Notifications</span>
                <Link to="/app/notifications" onClick={() => setShowNotifications(false)} className="text-[11px] text-primary">
                  View all
                </Link>
              </div>
              <p className="p-2 text-xs text-foreground-muted">
                No notification service is configured. Case activity is in each workspace.
              </p>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="rounded-[7px] p-2 text-foreground-muted transition-colors duration-150 hover:bg-surface-subtle hover:text-foreground"
            title="Theme"
          >
            {resolvedTheme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          {showThemeMenu && (
            <div className="absolute right-0 z-50 mt-2 w-36 rounded-[10px] border border-border bg-surface-elevated p-1 shadow-lg">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTheme(t);
                    setShowThemeMenu(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-[6px] px-3 py-1.5 text-xs capitalize transition-colors duration-150 ${
                    theme === t ? 'bg-primary-soft font-semibold text-foreground' : 'text-foreground-muted hover:bg-surface-subtle'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {t === 'light' && <Sun className="h-3.5 w-3.5" />}
                    {t === 'dark' && <Moon className="h-3.5 w-3.5" />}
                    {t === 'system' && <Laptop className="h-3.5 w-3.5" />}
                    {t}
                  </span>
                  {theme === t && <CheckCircle2 className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 rounded-[7px] py-1 pr-1 pl-2 transition-colors duration-150 hover:bg-surface-subtle"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
              {(user?.name || 'U')[0]}
            </div>
            <span className="hidden max-w-[120px] truncate text-xs font-semibold md:inline-block">{user?.name || 'Guest'}</span>
            <ChevronDown className="h-3.5 w-3.5 text-foreground-muted" />
          </button>
          {showProfileMenu && (
            <div className="absolute right-0 z-50 mt-2 w-56 rounded-[10px] border border-border bg-surface-elevated p-2 shadow-lg">
              <div className="border-b border-border p-2">
                <div className="text-xs font-semibold">{user?.name || 'Guest'}</div>
                <div className="truncate text-[11px] text-foreground-muted">{user?.email || 'Not signed in'}</div>
                <div className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-border bg-surface-subtle px-2 py-0.5 text-[10px] font-semibold capitalize">
                  <UserCheck className="h-3 w-3" />
                  {role}
                </div>
              </div>
              <div className="py-1">
                <Link
                  to="/app/settings"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center rounded-[6px] px-3 py-1.5 text-xs text-foreground-muted hover:bg-surface-subtle hover:text-foreground"
                >
                  Settings
                </Link>
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    logout();
                    navigate('/login');
                  }}
                  className="flex w-full items-center gap-2 rounded-[6px] px-3 py-1.5 text-left text-xs text-danger hover:bg-danger-soft"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
