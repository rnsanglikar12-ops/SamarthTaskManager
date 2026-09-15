import React, { useState } from 'react';
import { X, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ActionItem } from '../types';

interface BulkDeleteCompletedModalProps {
  isOpen: boolean;
  onClose: () => void;
  actions: ActionItem[];
  onDeleteBefore: (cutoffDate: string) => Promise<number>;
}

export const BulkDeleteCompletedModal: React.FC<BulkDeleteCompletedModalProps> = ({
  isOpen,
  onClose,
  actions,
  onDeleteBefore
}) => {
  if (!isOpen) return null;

  const [cutoffDate, setCutoffDate] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Same lexicographic 'before this date' comparison the backend uses
  // (see deleteCompletedTasksBefore in supabaseService.ts) — computed
  // locally against already-loaded data just for the preview count, no
  // extra network round trip.
  const matchCount = cutoffDate
    ? actions.filter(a => a.status === 'Completed' && a.timestamp < cutoffDate).length
    : 0;

  const handleClose = () => {
    setCutoffDate('');
    setIsConfirming(false);
    setSuccessMsg(null);
    onClose();
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const deletedCount = await onDeleteBefore(cutoffDate);
      setSuccessMsg(`Permanently deleted ${deletedCount} completed task${deletedCount === 1 ? '' : 's'}.`);
      setIsConfirming(false);
      setTimeout(handleClose, 1500);
    } finally {
      setIsDeleting(false);
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
            <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900">Delete Completed Tasks</h3>
          </div>
          <button onClick={handleClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {successMsg ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          ) : isConfirming ? (
            <>
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>
                  This will <strong>permanently delete {matchCount} completed task{matchCount === 1 ? '' : 's'}</strong> created
                  before {cutoffDate}. This cannot be undone.
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsConfirming(false)}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 disabled:opacity-60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                >
                  {isDeleting ? 'Deleting...' : `Yes, Delete ${matchCount} Task${matchCount === 1 ? '' : 's'}`}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-500">
                Permanently removes every <strong>Completed</strong> task created before the date you choose.
                Pending, In process, Under Verification, and Hold tasks are never touched.
              </p>
              <label className="block">
                <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Delete completed tasks created before
                </span>
                <input
                  type="date"
                  value={cutoffDate}
                  onChange={(e) => setCutoffDate(e.target.value)}
                  className="w-full py-2.5 px-3.5 bg-white border border-slate-300 rounded-xl text-xs outline-none focus:border-blue-500 shadow-2xs"
                  autoFocus
                />
              </label>
              {cutoffDate && (
                <div className="text-xs text-slate-600">
                  <strong>{matchCount}</strong> completed task{matchCount === 1 ? '' : 's'} match{matchCount === 1 ? 'es' : ''} this cutoff.
                </div>
              )}
              <button
                onClick={() => setIsConfirming(true)}
                disabled={!cutoffDate || matchCount === 0}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                Review & Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
