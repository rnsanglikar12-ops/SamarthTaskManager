import React, { useState, useEffect } from 'react';
import { ActionItem, Priority, Recurrence } from '../types';
import { TASK_DEPARTMENTS, combineAssigneesForDept, getDefaultAssignee } from '../data/orgStructure';
import { Supervisor } from '../utils/dataService';
import { uploadPhotoToGoogleSheet } from '../utils/dataService';
import { compressImage } from '../utils/imageUtils';
import {
  X,
  Plus,
  Camera,
  Upload,
  Calendar,
  CheckSquare,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  Lock,
  Loader2,
  ExternalLink
} from 'lucide-react';

interface NewActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (newItem: Omit<ActionItem, 'id'>) => Promise<boolean>;
  lockedDepts?: string[] | null;
  supervisors?: Supervisor[];
  defaultIsMOM?: boolean;
}

const MOM_TRIGGER = '📋 Saturday MOM Operational Action';

export const NewActionModal: React.FC<NewActionModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  lockedDepts = null,
  supervisors = [],
  defaultIsMOM = false
}) => {
  if (!isOpen) return null;

  // One person can head multiple departments: a single dept stays a hard,
  // non-interactive lock; more than one becomes a dropdown constrained to
  // just their own departments (instead of every department in the plant).
  const isDeptScoped = !!lockedDepts;
  const isSingleDept = (lockedDepts?.length ?? 0) === 1;
  const isMultiDept = (lockedDepts?.length ?? 0) > 1;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [desc, setDesc] = useState('');
  const [originTrigger, setOriginTrigger] = useState(
    defaultIsMOM ? MOM_TRIGGER : '💡 General Kaizen (Continuous Improvement)'
  );
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [priority, setPriority] = useState<Priority>('B');
  const [recurrenceOption, setRecurrenceOption] = useState<string>('One-Time Action');
  const [machineEqNo, setMachineEqNo] = useState('PDC-02');
  const [targetDeadline, setTargetDeadline] = useState('2026-09-18');
  // Responsible (executing) department — freely selectable even for a
  // DeptHead, so they can raise a CFT Handshake task to another department.
  // Defaults to the signed-in user's own (first) department.
  const [dept, setDept] = useState(lockedDepts?.[0] || 'Quality');
  // Originating department — who raised the task. Locked to the signed-in
  // DeptHead's own department (that's what makes dept !== originatorDept a
  // real CFT handshake); if they head several, pick among just those; freely
  // selectable for plant-wide roles too (e.g. Plant Head raising an issue
  // against Quality), defaulting to "no handshake" (same as the responsible
  // department) until explicitly changed — see originatorDeptTouched below.
  const [originatorDept, setOriginatorDept] = useState(lockedDepts?.[0] || 'Quality');
  // Whether a plant-wide user has deliberately picked a different
  // Originating Department. Until they do, it auto-tracks Responsible
  // Department (see the sync effect below) so switching Responsible
  // Department doesn't leave a stale Originating Department behind and
  // create an accidental, unintended handshake.
  const [originatorDeptTouched, setOriginatorDeptTouched] = useState(false);
  const [owner, setOwner] = useState(getDefaultAssignee(lockedDepts?.[0] || 'Quality'));
  const [problemPhoto, setProblemPhoto] = useState<string>('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Department-scoped users always raise tasks as one of their own
  // departments, but may target any department's responsible team (and, like
  // everyone else, may also broadcast plant-wide).
  useEffect(() => {
    if (lockedDepts) {
      setOriginatorDept(lockedDepts[0]);
    }
  }, [lockedDepts]);

  // Plant-wide roles (PlantHead/MD/Admin) don't have an inherent "home"
  // department, so until they deliberately pick a different Originating
  // Department (see the select below), it tracks whatever Responsible
  // Department is set to — otherwise switching Responsible Department would
  // leave a stale Originating Department behind and create an accidental,
  // unintended handshake.
  useEffect(() => {
    if (!isDeptScoped && !originatorDeptTouched) {
      setOriginatorDept(dept);
    }
  }, [dept, isDeptScoped, originatorDeptTouched]);

  // The assignee pool is scoped to whichever department is responsible for
  // executing the task; each department has a default placeholder assignee
  // so an owner is always pre-selected even before a specific person is known.
  useEffect(() => {
    setOwner(getDefaultAssignee(dept));
  }, [dept]);

  const departments = TASK_DEPARTMENTS;
  const assigneeOptions = combineAssigneesForDept(dept, supervisors);

  // Helper to calculate Next Saturday
  const handleSetNextSaturday = () => {
    const d = new Date();
    const day = d.getDay(); // 0 is Sunday, 6 is Saturday
    const daysUntilSaturday = (6 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilSaturday);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setTargetDeadline(`${yyyy}-${mm}-${dd}`);
  };

  // Uploads to Drive immediately on selection, not at form-submit time, so
  // the task-create call only ever carries the short returned link — never
  // the raw base64 image data. Compressed first so a multi-MB camera photo
  // doesn't sit occupying an Apps Script execution slot for long.
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const base64 = await compressImage(file);
      const url = await uploadPhotoToGoogleSheet(base64, file.name);
      if (url) {
        setProblemPhoto(url);
      }
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim() || isSubmitting || isUploadingPhoto) return;

    let normalizedRecurrence: Recurrence = 'One-Time';
    const recurrenceLower = recurrenceOption.toLowerCase();
    if (recurrenceLower.includes('daily')) normalizedRecurrence = 'Daily';
    else if (recurrenceLower.includes('monthly')) normalizedRecurrence = 'Monthly';
    else if (recurrenceLower.includes('quarterly')) normalizedRecurrence = 'Quarterly';
    else if (recurrenceLower.includes('weekly') || recurrenceLower.includes('pm')) normalizedRecurrence = 'Weekly';

    const effectiveBroadcast = isBroadcast;
    const effectiveDept = dept;

    setIsSubmitting(true);
    const success = await onAdd({
      priority,
      recurrence: normalizedRecurrence,
      dept: effectiveBroadcast ? 'All Departments' : effectiveDept,
      desc,
      owner: effectiveBroadcast ? 'All Department Leads' : (owner || getDefaultAssignee(dept)),
      deadline: targetDeadline || '2026-09-18',
      evidence: 'Photo Proof',
      status: 'Pending',
      actionNotes: machineEqNo ? `M/C: ${machineEqNo}` : '',
      attachedPhoto: problemPhoto || undefined,
      timestamp: new Date().toISOString(),
      originatorDept: effectiveBroadcast ? (lockedDepts?.[0] || 'Plant Head') : originatorDept,
      // New tasks are never Kaizen/DSI at creation — that's only offered
      // once a task is Completed with before/after photos + notes (see the
      // gating in ActionDetailModal). "Origin/Trigger" above is purely
      // descriptive context, unrelated to the DSI flag.
      isKaizen: false,
      isBroadcast,
      isMOM: originTrigger === MOM_TRIGGER,
      machineNote: machineEqNo || undefined
    });
    setIsSubmitting(false);

    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div 
        className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header as per screenshot */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 leading-tight">
                Create Action Item
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Log abnormality or directive for execution
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs text-slate-700">
          
          {/* Action Item Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-900">
                  Action Item Description *
                </label>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                  <span className="w-1.5 h-3 bg-blue-600 rounded-xs"></span>
                  Enter description
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {desc.length} / 12 chars
              </span>
            </div>
            <textarea
              required
              rows={3}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Describe what needs to be done, machine / station location, and root abnormality..."
              className="w-full p-3.5 bg-white border-2 border-blue-500 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-2xs"
            />
          </div>

          {/* Origin / Trigger & Originator / Raised By */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Origin / Trigger
              </label>
              <select
                value={originTrigger}
                onChange={(e) => setOriginTrigger(e.target.value)}
                className="w-full py-2.5 px-3 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:border-blue-500 outline-none shadow-2xs"
              >
                <option value="💡 General Kaizen (Continuous Improvement)">💡 General Kaizen (Continuous Improvement)</option>
                <option value="🚨 Safety Directive / Hazard Containment">🚨 Safety Directive / Hazard Containment</option>
                <option value="🔍 Internal / Customer Audit Finding">🔍 Internal / Customer Audit Finding</option>
                <option value="⚡ Line Breakdown / Equipment Abnormality">⚡ Line Breakdown / Equipment Abnormality</option>
                <option value={MOM_TRIGGER}>{MOM_TRIGGER}</option>
                <option value="🤝 CFT Handshake Resolution">🤝 CFT Handshake Resolution</option>
                <option value="📊 DWM Daily Work Management">📊 DWM Daily Work Management</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Originating Department
              </label>
              {isSingleDept ? (
                <div className="w-full py-2.5 px-3 bg-amber-50 border border-amber-300 rounded-xl text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  <span>{lockedDepts![0]} (You)</span>
                </div>
              ) : isMultiDept ? (
                <select
                  value={originatorDept}
                  onChange={(e) => setOriginatorDept(e.target.value)}
                  className="w-full py-2.5 px-3 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:border-blue-500 outline-none shadow-2xs"
                >
                  {lockedDepts!.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              ) : (
                <select
                  value={originatorDept}
                  onChange={(e) => {
                    setOriginatorDept(e.target.value);
                    setOriginatorDeptTouched(true);
                  }}
                  title="Defaults to Responsible Department (no handshake). Pick a different department to raise a genuine CFT handshake — e.g. Plant Head raising an issue against Quality — which routes completion through this department for verification."
                  className="w-full py-2.5 px-3 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:border-blue-500 outline-none shadow-2xs"
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}{d === dept ? ' (Same as Responsible — no handshake)' : ''}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Broadcast Card — available to every role, including dept-scoped
              users, so a DeptHead can also push a plant-wide notice. */}
          <div className="border border-slate-200 bg-white rounded-xl p-3 flex items-center justify-between shadow-2xs">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isBroadcast}
                onChange={(e) => setIsBroadcast(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer border-slate-300"
              />
              <span className="font-bold text-xs text-slate-800">
                Broadcast across ALL {TASK_DEPARTMENTS.length} Departments
              </span>
            </label>
            <span className="text-xs font-semibold text-slate-500">
              Plant-Wide
            </span>
          </div>

          {/* Target Department & Assignee (shown when not broadcast) */}
          {!isBroadcast && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Responsible Department *
                </label>
                <select
                  value={dept}
                  onChange={(e) => setDept(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:border-blue-500 outline-none"
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                {dept !== originatorDept && (
                  <p className="mt-1 text-[11px] font-semibold text-blue-700">
                    🤝 CFT Handshake: raised by {originatorDept} to {dept}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Assignee / Task Owner *
                </label>
                <select
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:border-blue-500 outline-none"
                >
                  {assigneeOptions.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Priority Level, Recurrence, Machine / Eq # (3 columns as per screenshot) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Priority Level
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full py-2.5 px-3 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:border-blue-500 outline-none shadow-2xs"
              >
                <option value="B">🟡 Priority B (Standard Routine)</option>
                <option value="A">🔴 Priority A (Critical Abnormality)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Recurrence
              </label>
              <select
                value={recurrenceOption}
                onChange={(e) => setRecurrenceOption(e.target.value)}
                className="w-full py-2.5 px-3 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:border-blue-500 outline-none shadow-2xs"
              >
                <option value="One-Time Action">✓ One-Time Action</option>
                <option value="Daily Routine (Shift Checklist)">Daily Routine (Shift Checklist)</option>
                <option value="Weekly Standard Work (Lubrication)">Weekly Standard Work (Lubrication)</option>
                <option value="Monthly PM (Calibration / Tooling)">Monthly PM (Calibration / Tooling)</option>
                <option value="Quarterly PM / Audit">Quarterly PM / Audit</option>
                <option value="Yearly PM / Overhaul">Yearly PM / Overhaul</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Machine / Eq #
              </label>
              <input
                type="text"
                value={machineEqNo}
                onChange={(e) => setMachineEqNo(e.target.value)}
                placeholder="e.g. PDC-02"
                className="w-full py-2.5 px-3 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:border-blue-500 outline-none shadow-2xs"
              />
            </div>
          </div>

          {/* Target Deadline with Next Saturday Quick Action */}
          <div className="border border-slate-200 bg-white rounded-xl p-3.5 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Target Deadline *</span>
              </label>
              <button
                type="button"
                onClick={handleSetNextSaturday}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors"
              >
                Next Saturday
              </button>
            </div>
            <input
              type="date"
              required
              value={targetDeadline}
              onChange={(e) => setTargetDeadline(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:bg-white focus:border-blue-500 outline-none"
            />
          </div>

          {/* Problem Photo (Before Condition - Optional) as per screenshot */}
          <div className="border border-slate-200 bg-white rounded-xl p-3.5 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Camera className="w-4 h-4 text-blue-600" />
              <span>Problem Photo (Before Condition - Optional)</span>
            </div>

            <div className="flex items-center gap-2.5">
              <label className={`cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-xs flex items-center gap-2 shadow-xs transition-colors ${isUploadingPhoto ? 'opacity-60 pointer-events-none' : ''}`}>
                <Camera className="w-4 h-4" />
                <span>Camera</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={isUploadingPhoto}
                  onChange={handlePhotoUpload}
                />
              </label>

              <label className={`cursor-pointer bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2 rounded-lg font-semibold text-xs flex items-center gap-2 shadow-2xs transition-colors ${isUploadingPhoto ? 'opacity-60 pointer-events-none' : ''}`}>
                <Upload className="w-4 h-4 text-slate-500" />
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isUploadingPhoto}
                  onChange={handlePhotoUpload}
                />
              </label>

              {problemPhoto && !isUploadingPhoto && (
                <button
                  type="button"
                  onClick={() => setProblemPhoto('')}
                  className="text-xs text-red-600 hover:underline font-medium ml-auto"
                >
                  Remove Photo
                </button>
              )}
            </div>

            {isUploadingPhoto && (
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Uploading photo to Drive…</span>
              </div>
            )}

            {problemPhoto && !isUploadingPhoto && (
              <a
                href={problemPhoto}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Photo attached — View on Drive</span>
              </a>
            )}
          </div>

          {/* Modal Footer as per screenshot */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-60"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>
                {isSubmitting
                  ? 'Creating...'
                  : isBroadcast ? 'Broadcast to All Depts' : 'Create Action Item'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
