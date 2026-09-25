import React from 'react';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { PageHeader } from '../../components/common/PageHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../../components/common/Button';
import toast from 'react-hot-toast';

export const SettingsPage: React.FC = () => {
  const { user, role } = useAuth();
  const { theme, setTheme } = useTheme();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Theme preference updated in this browser. HSM and 2FA settings are not configured.');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Breadcrumb items={[{ label: 'Settings' }]} />
      <PageHeader
        title="Settings"
        description="Theme and profile display only. Hardware Security Module keys and 2FA enrollment are not configured."
      />

      <form onSubmit={handleSave} className="space-y-6">
        <div className="space-y-3">
          <div className="lv-label">Profile</div>
          <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">Full name</label>
              <input type="text" defaultValue={user?.name || ''} className="lv-input" readOnly />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Official email</label>
              <input type="email" defaultValue={user?.email || ''} className="lv-input" readOnly />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Role</label>
              <input type="text" defaultValue={role} className="lv-input capitalize" readOnly />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="lv-label">Interface theme</div>
          <div className="flex gap-2">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`rounded-[7px] border px-4 py-2 text-xs font-medium capitalize transition-colors duration-150 ${
                  theme === t
                    ? 'border-primary bg-primary-soft text-foreground'
                    : 'border-border text-foreground-muted hover:bg-surface-subtle'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="primary" type="submit">
            Save browser theme
          </Button>
        </div>
      </form>
    </div>
  );
};
