import React, { useEffect, useState } from 'react';
import {
  UserCheck,
  X,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  Trash2,
  Loader2
} from 'lucide-react';
import {
  Supervisor,
  fetchSupervisors,
  createSupervisor,
  deleteSupervisor
} from '../utils/googleSheetsService';
import { TASK_DEPARTMENTS } from '../data/orgStructure';

interface SupervisorManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Plant-wide roles (Admin/PlantHead/MD) can add a supervisor to any
  // department; a DeptHead is locked to their own department(s).
  lockedDepts?: string[] | null;
  // Called after a successful add/delete so the caller (App) can refresh
  // its own supervisor list used by the Assignee dropdowns.
  onSupervisorsChanged: () => void;
}

export const SupervisorManagementModal: React.FC<SupervisorManagementModalProps> = ({
  isOpen,
  onClose,
  lockedDepts = null,
  onSupervisorsChanged
}) => {
  if (!isOpen) return null;

  const departmentOptions = lockedDepts && lockedDepts.length > 0 ? lockedDepts : TASK_DEPARTMENTS;

  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [busy, setBusy] = useState<Supervisor | null>(null);

  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState(departmentOptions[0] || '');

  const load = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const list = await fetchSupervisors();
      setSupervisors(list);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load supervisors.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scoped view: a DeptHead only ever sees/manages their own department(s).
  const visibleSupervisors = lockedDepts
    ? supervisors.filter((s) => lockedDepts.includes(s.dept))
    : supervisors;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!newName.trim() || !newDept) {
      setErrorMsg('Name and department are required.');
      return;
    }
    if (isCreating) return;

    setIsCreating(true);
    try {
      const result = await createSupervisor({ name: newName.trim(), dept: newDept });
      if (!result.success) {
        setErrorMsg(result.message || 'Failed to add supervisor.');
        return;
      }
      setSuccessMsg(`"${newName.trim()}" added to ${newDept}.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      setNewName('');
      setIsAdding(false);
      await load();
      onSupervisorsChanged();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to add supervisor.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (supervisor: Supervisor) => {
    if (busy) return;
    if (!window.confirm(`Remove "${supervisor.name}" from ${supervisor.dept}?`)) return;
    setBusy(supervisor);
    try {
      const success = await deleteSupervisor(supervisor);
      if (!success) {
        setErrorMsg('Failed to remove supervisor.');
        return;
      }
      setSuccessMsg(`"${supervisor.name}" removed.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      await load();
      onSupervisorsChanged();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to remove supervisor.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className="bg-white rounded-2xl max-w-xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Manage Supervisors</h3>
              <p className="text-xs text-slate-500">
                {lockedDepts ? `Names available as Assignee for ${lockedDepts.join(', ')}` : 'Names available as Assignee across every department'}
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
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Supervisor</span>
            </button>
          ) : (
            <form onSubmit={handleAdd} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">New Supervisor</span>
                <button type="button" onClick={() => setIsAdding(false)} className="text-[11px] text-slate-500 hover:text-slate-700">
                  Cancel
                </button>
              </div>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                required
              />
              <select
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
              >
                {departmentOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isCreating ? 'Adding...' : 'Add Supervisor'}</span>
              </button>
            </form>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <UserCheck className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Loading supervisors...' : `${visibleSupervisors.length} Supervisors`}</span>
            </div>
            {visibleSupervisors.map((s) => (
              <div
                key={`${s.dept}::${s.name}`}
                className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900">{s.name}</div>
                  <div className="text-[11px] text-slate-500">{s.dept}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(s)}
                  disabled={!!busy}
                  title="Remove supervisor"
                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {busy?.name === s.name && busy?.dept === s.dept ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
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
