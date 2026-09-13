import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  X,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  Trash2,
  KeyRound,
  Users as UsersIcon,
  Loader2
} from 'lucide-react';
import { Role, hashPassword } from '../utils/auth';
import {
  AppsScriptUserRecord,
  fetchUsers,
  createUser,
  deleteUser,
  changePassword
} from '../utils/googleSheetsService';
import { SAMARTH_ORG_STRUCTURE } from '../data/orgStructure';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUsername: string;
}

const ROLES: Role[] = ['Viewer', 'DeptHead', 'PlantHead', 'MD', 'Admin'];
const DEPARTMENTS = SAMARTH_ORG_STRUCTURE.map((d) => d.deptName);

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  currentUsername
}) => {
  if (!isOpen) return null;

  const [users, setUsers] = useState<AppsScriptUserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  // Tracks which user row has a reset-password or delete request in flight,
  // so both of that row's buttons disable and a spinner shows — prevents a
  // double-click from firing a duplicate request.
  const [busyUser, setBusyUser] = useState<{ username: string; action: 'reset' | 'delete' } | null>(null);

  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newTempPassword, setNewTempPassword] = useState('');
  const [newRole, setNewRole] = useState<Role>('DeptHead');
  // One person can head multiple departments, so this is a set, not a single select.
  const [newDepartments, setNewDepartments] = useState<string[]>([DEPARTMENTS[0]]);

  const toggleNewDepartment = (dept: string) => {
    setNewDepartments((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  };

  const loadUsers = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const list = await fetchUsers();
      setUsers(list);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDeptScoped = newRole === 'Viewer' || newRole === 'DeptHead';

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!newUsername.trim() || !newDisplayName.trim() || newTempPassword.trim().length < 4) {
      setErrorMsg('Username, display name, and a temp password (min. 4 characters) are required.');
      return;
    }
    if (isDeptScoped && newDepartments.length === 0) {
      setErrorMsg('Select at least one department for this role.');
      return;
    }
    if (isCreating) return;

    setIsCreating(true);
    try {
      const passwordHash = await hashPassword(newTempPassword.trim());
      const success = await createUser({
        username: newUsername.trim(),
        displayName: newDisplayName.trim(),
        passwordHash,
        role: newRole,
        departments: isDeptScoped ? newDepartments : null
      });
      if (!success) {
        setErrorMsg('Failed to create user. The username may already exist.');
        return;
      }
      setSuccessMsg(`User "${newUsername.trim()}" created.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      setNewUsername('');
      setNewDisplayName('');
      setNewTempPassword('');
      setNewDepartments([DEPARTMENTS[0]]);
      setIsAdding(false);
      loadUsers();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create user.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleResetPassword = async (username: string) => {
    if (busyUser) return;
    const tempPassword = window.prompt(`Enter a new temporary password for "${username}":`);
    if (!tempPassword || tempPassword.trim().length < 4) {
      if (tempPassword !== null) setErrorMsg('Password must be at least 4 characters long.');
      return;
    }
    setBusyUser({ username, action: 'reset' });
    try {
      const passwordHash = await hashPassword(tempPassword.trim());
      const success = await changePassword(username, passwordHash, true);
      if (!success) {
        setErrorMsg('Failed to reset password.');
        return;
      }
      setSuccessMsg(`Password reset for "${username}". They'll be asked to set a new one at next login.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      loadUsers();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to reset password.');
    } finally {
      setBusyUser(null);
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (busyUser) return;
    if (username === currentUsername) {
      setErrorMsg('You cannot delete your own account while signed in.');
      return;
    }
    if (!window.confirm(`Remove user "${username}"? This cannot be undone.`)) return;
    setBusyUser({ username, action: 'delete' });
    try {
      const success = await deleteUser(username);
      if (!success) {
        setErrorMsg('Failed to remove user.');
        return;
      }
      setSuccessMsg(`User "${username}" removed.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      loadUsers();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to remove user.');
    } finally {
      setBusyUser(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">User Management</h3>
              <p className="text-xs text-slate-500">Admin-only: manage accounts, roles &amp; passwords</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {!isAdding ? (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add New User</span>
            </button>
          ) : (
            <form onSubmit={handleAddUser} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">New User</span>
                <button type="button" onClick={() => setIsAdding(false)} className="text-[11px] text-slate-500 hover:text-slate-700">
                  Cancel
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Username"
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                  required
                />
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="Display Name"
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                  required
                />
              </div>
              <input
                type="text"
                value={newTempPassword}
                onChange={(e) => setNewTempPassword(e.target.value)}
                placeholder="Temporary password (min. 4 characters)"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono outline-none focus:border-blue-500"
                required
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Department{isDeptScoped ? 's (select 1 or more — one person can head several)' : ''}
                </label>
                <div
                  className={`max-h-32 overflow-y-auto border border-slate-300 rounded-lg p-2 grid grid-cols-2 gap-x-2 gap-y-1 ${
                    isDeptScoped ? 'bg-white' : 'bg-slate-100 opacity-60 pointer-events-none'
                  }`}
                >
                  {DEPARTMENTS.map((d) => (
                    <label key={d} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newDepartments.includes(d)}
                        onChange={() => toggleNewDepartment(d)}
                        disabled={!isDeptScoped}
                        className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                      <span className="truncate">{d}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-2xs flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isCreating ? 'Creating...' : 'Create User'}</span>
              </button>
            </form>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <UsersIcon className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Loading users...' : `${users.length} Users`}</span>
            </div>
            {users.map((u) => (
              <div
                key={u.username}
                className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {u.displayName} <span className="text-slate-400 font-normal">@{u.username}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {u.role}{u.departments?.length ? ` • ${u.departments.join(', ')}` : ' • Plant-wide'}
                    {u.mustChangePassword && <span className="text-amber-600"> • Password reset pending</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleResetPassword(u.username)}
                    disabled={busyUser?.username === u.username}
                    title="Reset password"
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {busyUser?.username === u.username && busyUser.action === 'reset' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(u.username)}
                    disabled={busyUser?.username === u.username}
                    title="Remove user"
                    className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {busyUser?.username === u.username && busyUser.action === 'delete' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold text-xs hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
