import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { useUsers, useCreateUser, useUpdatePassword, AppUser } from '../hooks/useUsers';
import {
  UsersIcon,
  PlusIcon,
  AlertTriangleIcon,
  XIcon,
  RefreshIcon,
} from '../components/ui/Icons';

export default function Users() {
  const { user: currentUser } = useAuth();
  const [roleFilter, setRoleFilter] = useState('');
  const { data: users, isLoading, isError, error, refetch } = useUsers(roleFilter || undefined);
  const createUser = useCreateUser();
  const updatePassword = useUpdatePassword();

  const [showCreate, setShowCreate] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('MANAGER');

  const [passwordTarget, setPasswordTarget] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password) {
      toast.error('All fields are required');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    try {
      await createUser.mutateAsync({ fullName, email, password, role });
      toast.success(`${fullName.trim()} created`);
      setShowCreate(false);
      setFullName('');
      setEmail('');
      setPassword('');
      setRole('MANAGER');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  const handleResetPassword = async () => {
    if (!passwordTarget) return;
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    try {
      await updatePassword.mutateAsync({ id: passwordTarget.id, password: newPassword });
      toast.success(`Password updated for ${passwordTarget.fullName}`);
      setPasswordTarget(null);
      setNewPassword('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update password');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="text-gray-600 mt-1">Manage staff accounts and roles</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <PlusIcon className="w-4 h-4 mr-2" />
          Add User
        </button>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="relative">
            <label htmlFor="role-filter" className="sr-only">Filter by role</label>
            <select
              id="role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="select-field w-auto pr-10"
            >
              <option value="">All roles</option>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
            </select>
          </div>
          <button
            onClick={() => refetch()}
            className="btn-secondary text-sm py-1.5 px-3 sm:ml-auto"
            aria-label="Refresh users"
          >
            <RefreshIcon className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="card animate-pulse h-48" />
      ) : isError ? (
        <div className="card text-center py-12">
          <AlertTriangleIcon className="w-12 h-12 text-danger mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to load users</h2>
          <p className="text-gray-500 mb-4">{error instanceof Error ? error.message : 'An unexpected error occurred'}</p>
          <button onClick={() => refetch()} className="btn-primary">Retry</button>
        </div>
      ) : (
        <div className="card">
          {users && users.length > 0 ? (
            <div className="table-container">
              <table className="table-base">
                <thead className="table-header">
                  <tr>
                    <th className="table-header-cell">Name</th>
                    <th className="table-header-cell">Email</th>
                    <th className="table-header-cell">Role</th>
                    <th className="table-header-cell">Actions</th>
                  </tr>
                </thead>
                <tbody className="table-body divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors duration-100 ease-out">
                      <td className="table-cell font-medium">
                        {u.fullName}
                        {u.id === currentUser?.id && (
                          <span className="badge-gray ml-2">You</span>
                        )}
                      </td>
                      <td className="table-cell text-gray-600">{u.email}</td>
                      <td className="table-cell">
                        <span className={u.role === 'ADMIN' ? 'badge-info' : 'badge-gray'}>
                          {u.role === 'ADMIN' ? 'Admin' : 'Manager'}
                        </span>
                      </td>
                      <td className="table-cell">
                        <button
                          onClick={() => {
                            setPasswordTarget(u);
                            setNewPassword('');
                          }}
                          className="text-primary hover:text-primary-hover text-sm font-medium transition-colors duration-150 ease-out"
                        >
                          Reset password
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <UsersIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No users found</h3>
              <p className="text-gray-500 mb-4">Create the first staff account to get started.</p>
              <button onClick={() => setShowCreate(true)} className="btn-primary">
                <PlusIcon className="w-4 h-4 mr-2" />
                Add User
              </button>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Create user">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Add user</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close dialog">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} noValidate>
              <div className="space-y-4">
                <div>
                  <label htmlFor="user-name" className="label-field">Full name</label>
                  <input
                    id="user-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input-field"
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="user-email" className="label-field">Email</label>
                  <input
                    id="user-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="user-password" className="label-field">Password</label>
                  <input
                    id="user-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field"
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum 8 characters.</p>
                </div>
                <div>
                  <label htmlFor="user-role" className="label-field">Role</label>
                  <select
                    id="user-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="select-field"
                  >
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={createUser.isPending}>
                  {createUser.isPending ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {passwordTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Reset password">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPasswordTarget(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Reset password</h2>
              <button onClick={() => setPasswordTarget(null)} className="text-gray-400 hover:text-gray-600" aria-label="Close dialog">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Set a new password for <span className="font-medium text-gray-900">{passwordTarget.fullName}</span>.
            </p>
            <label htmlFor="reset-password" className="label-field">New password</label>
            <input
              id="reset-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input-field mb-1"
              autoFocus
              autoComplete="new-password"
            />
            <p className="text-xs text-gray-500 mb-4">Minimum 8 characters.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPasswordTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
              >
                Cancel
              </button>
              <button onClick={handleResetPassword} className="btn-primary" disabled={updatePassword.isPending}>
                {updatePassword.isPending ? 'Saving...' : 'Save Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
