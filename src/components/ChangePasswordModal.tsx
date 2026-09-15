import React, { useState } from 'react';
import { X, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { hashPassword } from '../utils/auth';
import { loginUser, changePassword } from '../utils/dataService';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, username }) => {
  if (!isOpen) return null;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

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
      const currentHash = await hashPassword(currentPassword);
      const verified = await loginUser(username, currentHash);
      if (!verified) {
        setErrorMsg('Current password is incorrect.');
        return;
      }

      const newHash = await hashPassword(newPassword.trim());
      const success = await changePassword(username, newHash, false);
      if (!success) {
        setErrorMsg('Failed to update password. Please try again.');
        return;
      }

      setSuccessMsg('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <KeyRound className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900">Change Password</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3">
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

          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className="w-full py-2.5 px-3.5 bg-white border border-slate-300 rounded-xl text-xs font-mono outline-none focus:border-blue-500 shadow-2xs"
            autoFocus
            required
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min. 4 characters)"
            className="w-full py-2.5 px-3.5 bg-white border border-slate-300 rounded-xl text-xs font-mono outline-none focus:border-blue-500 shadow-2xs"
            required
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="w-full py-2.5 px-3.5 bg-white border border-slate-300 rounded-xl text-xs font-mono outline-none focus:border-blue-500 shadow-2xs"
            required
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};
