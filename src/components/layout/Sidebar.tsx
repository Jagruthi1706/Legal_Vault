import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  BookOpen,
  Sparkles,
  ShieldCheck,
  BarChart3,
  Bell,
  Settings,
  Calendar,
  Users,
  ChevronLeft,
  ChevronRight,
  Gavel,
  FileCheck,
  Scale,
  Shield,
  KeyRound,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { clsx } from 'clsx';
import { can } from '../../utils/permissions';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export const Sidebar: React.FC = () => {
  const { role, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const lawyerGroups: NavGroup[] = [
    {
      label: 'Work',
      items: [
        { label: 'Dashboard', href: '/app', icon: LayoutDashboard },
        { label: 'Cases', href: '/app/cases', icon: Briefcase },
        { label: 'Evidence', href: '/app/evidence', icon: FileText },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        { label: 'Legal Research', href: '/app/research', icon: BookOpen },
        { label: 'AI Copilot', href: '/app/ai-copilot', icon: Sparkles, badge: 'AI' },
          { label: 'Legal Research', href: '/app/research', icon: BookOpen },
        { label: 'Draft Generator', href: '/app/draft-generator', icon: FileCheck },
      ],
    },
    {
      label: 'Integrity',
      items: [
        { label: 'Blockchain Ledger', href: '/app/blockchain', icon: ShieldCheck },
        { label: 'Audit & Verification', href: '/app/blockchain-logs', icon: Shield },
      ],
    },
    {
      label: 'System',
      items: [
        { label: 'Calendar', href: '/app/calendar', icon: Calendar },
        { label: 'Notifications', href: '/app/notifications', icon: Bell },
        { label: 'Analytics', href: '/app/analytics', icon: BarChart3 },
        { label: 'Settings', href: '/app/settings', icon: Settings },
      ],
    },
  ];

  const getRoleNavItems = (): NavItem[] => {
    switch (role) {
      case 'client':
        return [
          { label: 'Dashboard', href: '/app', icon: LayoutDashboard },
          { label: 'My Cases', href: '/app/cases', icon: Briefcase },
          { label: 'Upload Documents', href: '/app/evidence', icon: Upload },
          { label: 'My Documents', href: '/app/documents', icon: FileText },
          { label: 'AI Assistant', href: '/app/ai-copilot', icon: Sparkles, badge: 'AI' },
          { label: 'Calendar', href: '/app/calendar', icon: Calendar },
          { label: 'Notifications', href: '/app/notifications', icon: Bell },
          { label: 'Settings', href: '/app/settings', icon: Settings },
        ];
      case 'judge':
        return [
          { label: 'Judicial Dashboard', href: '/app', icon: LayoutDashboard },
          { label: 'Assigned Cases', href: '/app/cases', icon: Gavel },
          { label: 'Document Review', href: '/app/documents', icon: FileText },
          { label: 'AI Precedent Insights', href: '/app/ai-copilot', icon: Sparkles, badge: 'AI' },
          { label: 'Legal Research', href: '/app/research', icon: BookOpen },
          { label: 'Judgment Draft', href: '/app/judgment-draft', icon: Scale },
          { label: 'Blockchain Verification', href: '/app/blockchain', icon: ShieldCheck },
          { label: 'Court Analytics', href: '/app/analytics', icon: BarChart3 },
          { label: 'Notifications', href: '/app/notifications', icon: Bell },
          { label: 'Settings', href: '/app/settings', icon: Settings },
        ];
      case 'admin':
        return [
          { label: 'Admin Dashboard', href: '/app', icon: LayoutDashboard },
          ...(can(user, 'manageUsers') ? [{ label: 'User Directory', href: '/app/users', icon: Users }] : []),
          { label: 'Roles & Permissions', href: '/app/roles', icon: KeyRound },
          { label: 'Case Management', href: '/app/cases', icon: Briefcase },
          { label: 'AI System Monitoring', href: '/app/ai-monitoring', icon: Sparkles },
          { label: 'Blockchain Audit Logs', href: '/app/blockchain-logs', icon: Shield },
          { label: 'System Analytics', href: '/app/analytics', icon: BarChart3 },
          { label: 'Notifications', href: '/app/notifications', icon: Bell },
          { label: 'Settings', href: '/app/settings', icon: Settings },
        ];
      default:
        return [];
    }
  };

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={`${item.href}-${item.label}`}
        to={item.href}
        end={item.href === '/app'}
        aria-label={item.label}
        className={({ isActive }) =>
          clsx(
            'relative flex items-center gap-3 rounded-[8px] px-3 py-2 text-xs font-medium transition-colors duration-150',
            isActive
              ? 'bg-primary-soft font-semibold text-foreground before:absolute before:inset-y-1 before:left-0 before:w-[2px] before:rounded-full before:bg-primary'
              : 'text-foreground-muted hover:bg-surface-subtle hover:text-foreground',
          )
        }
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {!collapsed && item.badge && (
          <span className="ml-auto rounded bg-ai-soft px-1.5 py-0.5 font-mono text-[10px] text-ai">{item.badge}</span>
        )}
      </NavLink>
    );
  };

  return (
    <aside
      className={clsx(
        'relative z-20 flex h-screen shrink-0 select-none flex-col border-r border-border bg-surface transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-border px-3">
        {!collapsed && (
          <NavLink to="/app" className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-primary text-white">
              <Scale className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-foreground">Legal Vault</div>
              <div className="lv-label !normal-case tracking-normal">Judicial platform</div>
            </div>
          </NavLink>
        )}
        {collapsed && (
          <NavLink to="/app" className="mx-auto flex h-8 w-8 items-center justify-center rounded-[8px] bg-primary text-white" aria-label="Legal Vault home">
            <Scale className="h-4 w-4" />
          </NavLink>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={clsx('rounded-[7px] p-1.5 text-foreground-muted hover:bg-surface-subtle hover:text-foreground', collapsed && 'mx-auto mt-2')}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <div className="border-b border-border px-3 py-2.5">
        {!collapsed ? (
          <div className="rounded-[6px] border border-border bg-surface-subtle px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide text-foreground-secondary">
            {role}
          </div>
        ) : (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white" title={`Role: ${role}`}>
            {role[0].toUpperCase()}
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto p-2">
        {role === 'lawyer'
          ? lawyerGroups.map((group) => (
              <div key={group.label}>
                {!collapsed && <div className="lv-label px-3 pb-1.5">{group.label}</div>}
                <div className="space-y-0.5">{group.items.map(renderItem)}</div>
              </div>
            ))
          : getRoleNavItems().map(renderItem)}
      </nav>

      <div className="border-t border-border p-3">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
              {(user?.name || 'U')[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-foreground">{user?.name || 'Guest'}</div>
              <div className="truncate text-[10px] capitalize text-foreground-muted">{role}</div>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
            {(user?.name || 'U')[0]}
          </div>
        )}
      </div>
    </aside>
  );
};
