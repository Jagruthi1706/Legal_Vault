import React, { useEffect, useState } from 'react';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { useAuth } from '../../contexts/AuthContext';
import { can } from '../../utils/permissions';
import { usersApi, DirectoryUser } from '../../services/usersApi';

export const UsersPage: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!can(user, 'manageUsers')) return;
    void usersApi.list()
      .then((res) => setUsers(res.data || []))
      .catch((err: Error) => setError(err.message));
  }, [user]);

  if (!can(user, 'manageUsers')) {
    return <div className="p-6 text-xs text-foreground-muted">User management is available only to authenticated administrators.</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Breadcrumb items={[{ label: 'User Directory' }]} />
      <div className="p-6 bg-surface border rounded-xl">
        <h1 className="text-xl font-extrabold font-heading">Registered users</h1>
        <p className="text-xs text-foreground-muted mt-1">Directory from the authenticated admin API. Roles cannot be switched from the client.</p>
      </div>
      {error && <div className="p-3 border border-red-300 text-red-700 text-xs rounded">{error}</div>}
      <div className="bg-surface border rounded-xl divide-y">
        {users.map((item) => (
          <div key={item.id} className="p-4 flex items-center justify-between text-xs">
            <div>
              <div className="font-extrabold">{item.name}</div>
              <div className="text-foreground-muted">{item.email}</div>
            </div>
            <span className="px-2.5 py-1 rounded bg-surface-subtle font-mono uppercase">{item.role}</span>
          </div>
        ))}
        {users.length === 0 && !error && <div className="p-4 text-xs text-foreground-muted">No users were returned.</div>}
      </div>
    </div>
  );
};
