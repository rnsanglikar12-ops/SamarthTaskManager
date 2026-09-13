import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Unlock, 
  KeyRound, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  EyeOff,
  RotateCcw
} from 'lucide-react';
import { 
  verifySecretPassword, 
  isSecretControlUnlocked, 
  setSecretControlUnlocked, 
  getStoredMasterPassword, 
  setStoredMasterPassword,
  getStoredPlantHeadPassword,
  setStoredPlantHeadPassword,
  resetAllPasswordsToDefault,
  getActiveRole,
  setActiveRole,
  ExecutiveRole
} from '../utils/security';

interface SecretControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlockedChange: (unlocked: boolean) => void;
}

export const SecretControlModal: React.FC<SecretControlModalProps> = ({
  isOpen,
  onClose,
  onUnlockedChange
}) => {
  if (!isOpen) return null;

  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passTarget, setPassTarget] = useState<'master' | 'planthead'>('master');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  const unlocked = isSecretControlUnlocked();
  const currentRole = getActiveRole();

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifySecretPassword(passwordInput)) {
      setSecretControlUnlocked(true);
      setErrorMsg(null);
      setSuccessMsg('Secret Control Unlocked. Executive Authority Granted.');
      onUnlockedChange(true);
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1200);
    } else {
      setErrorMsg('Incorrect Password. Please check your credentials.');
    }
  };

  const handleLock = () => {
    setSecretControlUnlocked(false);
    onUnlockedChange(false);
    setSuccessMsg('Secret Control Locked.');
    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 800);
  };

  const handleSaveNewPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassInput.trim().length < 4) {
      setErrorMsg('New password must be at least 4 characters long.');
      return;
    }
    if (newPassInput.trim() !== confirmPassInput.trim()) {
      setErrorMsg('Password confirmation does not match.');
      return;
    }

    if (passTarget === 'master') {
      setStoredMasterPassword(newPassInput.trim());
      setSuccessMsg('Master Secret Password (Mentor) updated successfully.');
    } else {
      setStoredPlantHeadPassword(newPassInput.trim());
      setSuccessMsg('Plant Head Passcode (Awari B.) updated successfully.');
    }

    setIsChangingPass(false);
    setNewPassInput('');
    setConfirmPassInput('');
    setErrorMsg(null);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleResetToDefault = () => {
    resetAllPasswordsToDefault();
    setShowResetConfirm(false);
    setIsChangingPass(false);
    setSuccessMsg('All passwords have been reset to factory defaults.');
    setErrorMsg(null);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleSwitchRole = (role: ExecutiveRole) => {
    setActiveRole(role);
    setSuccessMsg(`Active profile switched to ${role}.`);
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div 
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              unlocked ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
            }`}>
              {unlocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Secret Master Control
              </h3>
              <p className="text-xs text-slate-500">
                Executive Administration & Security Panel
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
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

          {showResetConfirm && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <RotateCcw className="w-4 h-4 text-amber-700" />
                <span>Confirm Password Reset to Factory Defaults</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                This will reset both the Master Password and Plant Head Passcode back to the factory defaults. Do you wish to proceed?
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-2xs"
                >
                  Yes, Reset Passwords
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {unlocked ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Master Authority Active</span>
                </div>
                <p className="text-emerald-700">
                  Authorized executive privileges enabled:
                </p>
                <ul className="list-disc list-inside space-y-1 text-emerald-800 font-medium">
                  <li>Authority to revise target deadlines</li>
                  <li>Authority to delete or reassign shopfloor tasks</li>
                  <li>Access to generated direct links for all 15 Dept Heads</li>
                  <li>Full plant oversight across all operations</li>
                </ul>
              </div>

              {/* Role Perspective Switcher */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Active Executive Profile
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Plant Head', 'MD', 'Secret Admin'] as ExecutiveRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleSwitchRole(r)}
                      className={`p-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                        currentRole === r
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {r === 'MD' ? 'MD (Sangram J.)' : r === 'Plant Head' ? 'Plant Head (Awari B.)' : 'Secret Admin'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Password Management */}
              <div className="pt-2 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Password Administration
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(true)}
                    className="text-[11px] text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1 hover:underline"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset to Defaults</span>
                  </button>
                </div>

                {!isChangingPass ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPassTarget('master');
                        setIsChangingPass(true);
                      }}
                      className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                      <span>Change Master Pass</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPassTarget('planthead');
                        setIsChangingPass(true);
                      }}
                      className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                      <span>Change Plant Head PIN</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSaveNewPassword} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        {passTarget === 'master' ? 'Set New Master Password' : 'Set New Plant Head Passcode'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsChangingPass(false)}
                        className="text-[11px] text-slate-500 hover:text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>

                    <input
                      type="password"
                      value={newPassInput}
                      onChange={(e) => setNewPassInput(e.target.value)}
                      placeholder="Enter new password (min. 4 characters)..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono outline-none focus:border-blue-500"
                      required
                    />

                    <input
                      type="password"
                      value={confirmPassInput}
                      onChange={(e) => setConfirmPassInput(e.target.value)}
                      placeholder="Confirm new password..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono outline-none focus:border-blue-500"
                      required
                    />

                    <button
                      type="submit"
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors"
                    >
                      Save New Password
                    </button>
                  </form>
                )}
              </div>

              {/* Lock Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleLock}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4 text-slate-500" />
                  <span>Lock Secret Control</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleUnlock} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Enter Authorized Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="Enter password..."
                    className="w-full py-2.5 pl-3.5 pr-10 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 outline-none shadow-2xs font-mono"
                    autoFocus
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
                <div className="flex items-center justify-between mt-2 pt-1 text-[11px]">
                  <span className="text-slate-500">
                    Restricted executive authorization
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(true)}
                    className="text-slate-500 hover:text-slate-800 underline"
                  >
                    Reset password?
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-2"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Unlock Access</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
