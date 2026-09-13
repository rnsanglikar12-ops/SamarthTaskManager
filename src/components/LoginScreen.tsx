import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, LogIn, KeyRound } from 'lucide-react';
import { AuthUser, Role, hashPassword, setSession } from '../utils/auth';
import { loginUser, changePassword, isGoogleSheetConnected } from '../utils/googleSheetsService';

interface LoginScreenProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set when the server reports mustChangePassword=true — forces a password
  // reset before the session is allowed to proceed.
  const [pendingUser, setPendingUser] = useState<AuthUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isGoogleSheetConnected()) {
      setErrorMsg('The application backend is not configured. Contact your administrator.');
      return;
    }

    setIsSubmitting(true);
    try {
      const passwordHash = await hashPassword(password);
      const result = await loginUser(username.trim(), passwordHash);
      if (!result) {
        setErrorMsg('Invalid username or password.');
        return;
      }

      // Defensive fallback: if the deployed Apps Script hasn't been updated
      // to the multi-department schema yet, it still returns the old singular
      // `department` field instead of `departments`. Wrap it into a one-item
      // array rather than silently treating every dept-scoped user as
      // plant-wide (which is what `departments: undefined` would do).
      const legacyDepartment = (result as any).department as string | null | undefined;
      const departments = result.departments !== undefined
        ? result.departments
        : (legacyDepartment ? [legacyDepartment] : null);

      const user: AuthUser = {
        username: result.username,
        displayName: result.displayName,
        role: result.role as Role,
        departments,
        mustChangePassword: result.mustChangePassword
      };

      if (user.mustChangePassword) {
        setPendingUser(user);
      } else {
        setSession(user);
        onLoginSuccess(user);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to reach the login service. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!pendingUser) return;
    if (newPassword.trim().length < 4) {
      setErrorMsg('New password must be at least 4 characters long.');
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      setErrorMsg('Password confirmation does not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newHash = await hashPassword(newPassword.trim());
      const success = await changePassword(pendingUser.username, newHash);
      if (!success) {
        setErrorMsg('Failed to update password. Please try again.');
        return;
      }
      const finalizedUser: AuthUser = { ...pendingUser, mustChangePassword: false };
      setSession(finalizedUser);
      onLoginSuccess(finalizedUser);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-slate-50/80 text-center">
          <img
            src="/samarth_logo.png"
            alt="Samarth Industries"
            className="h-11 w-auto max-w-[210px] object-contain mx-auto mb-3"
          />
          <h1 className="font-bold text-base text-slate-900">Operational Excellence Platform</h1>
          <p className="text-xs text-slate-500 mt-0.5">Sign in to continue</p>
        </div>

        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {pendingUser ? (
            <form onSubmit={handleSetNewPassword} className="space-y-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Set a new password to continue, {pendingUser.displayName}.</span>
              </div>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min. 4 characters)..."
                className="w-full py-2.5 px-3.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 outline-none shadow-2xs font-mono"
                autoFocus
                required
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password..."
                className="w-full py-2.5 px-3.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 outline-none shadow-2xs font-mono"
                required
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Saving...' : 'Save Password & Continue'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username..."
                  className="w-full py-2.5 px-3.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 outline-none shadow-2xs"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password..."
                    className="w-full py-2.5 pl-3.5 pr-10 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 outline-none shadow-2xs font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Signing in...' : 'Sign In'}</span>
              </button>

              <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1 pt-1">
                <Lock className="w-3 h-3" />
                <span>Accounts are provisioned by your administrator</span>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
