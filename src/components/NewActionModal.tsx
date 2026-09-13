import React, { useState, useEffect } from 'react';
import { ActionItem, Priority, Recurrence } from '../types';
import { SAMARTH_PLANT_ASSIGNEES } from '../data/sentinelDataLoader';
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
  Lock
} from 'lucide-react';

interface NewActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (newItem: Omit<ActionItem, 'id'>) => Promise<boolean>;
  lockedDept?: string | null;
}

export const NewActionModal: React.FC<NewActionModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  lockedDept = null
}) => {
  if (!isOpen) return null;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [desc, setDesc] = useState('');
  const [originTrigger, setOriginTrigger] = useState('💡 General Kaizen (Continuous Improvement)');
  const [originator, setOriginator] = useState('👔 Plant Head (Awari B.)');
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [priority, setPriority] = useState<Priority>('B');
  const [recurrenceOption, setRecurrenceOption] = useState<string>('One-Time Action');
  const [machineEqNo, setMachineEqNo] = useState('PDC-02');
  const [targetDeadline, setTargetDeadline] = useState('2026-09-18');
  const [dept, setDept] = useState(lockedDept || 'Quality');
  const [owner, setOwner] = useState(SAMARTH_PLANT_ASSIGNEES[0] || 'Awari B');
  const [problemPhoto, setProblemPhoto] = useState<string>('');

  // Department-scoped users (DeptHead) can only create tasks for their own department.
  useEffect(() => {
    if (lockedDept) {
      setDept(lockedDept);
      setIsBroadcast(false);
    }
  }, [lockedDept]);

  const departments = [
    'Quality',
    'Store',
    'PDC',
    'Die Maint',
    'SPM',
    'Fettling',
    'Machine shop-01',
    'Machine shop-02',
    'PPC',
    'MC Maint',
    'NPD',
    'Tool Room',
    'HR',
    'Account',
    'Purchase',
    'Plant Head'
  ];

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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setProblemPhoto(uploadEvent.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim() || isSubmitting) return;

    let normalizedRecurrence: Recurrence = 'One-Time';
    if (recurrenceOption.toLowerCase().includes('daily')) normalizedRecurrence = 'Daily';
    else if (recurrenceOption.toLowerCase().includes('weekly') || recurrenceOption.toLowerCase().includes('pm')) normalizedRecurrence = 'Weekly';

    const isKaizen = originTrigger.includes('Kaizen');

    const effectiveBroadcast = isBroadcast && !lockedDept;
    const effectiveDept = lockedDept || dept;

    setIsSubmitting(true);
    const success = await onAdd({
      priority,
      recurrence: normalizedRecurrence,
      dept: effectiveBroadcast ? 'All Departments' : effectiveDept,
      desc: isKaizen && !desc.includes('[DSI Kaizen]') ? `⭐ [DSI Kaizen] ${desc}` : desc,
      owner: effectiveBroadcast ? 'All Department Leads' : (owner || 'Awari B'),
      deadline: targetDeadline || '2026-09-18',
      evidence: 'Photo Proof',
      status: 'Pending',
      actionNotes: machineEqNo ? `M/C: ${machineEqNo}` : '',
      attachedPhoto: problemPhoto || undefined,
      timestamp: new Date().toISOString(),
      originatorDept: originator.replace('👔', '').trim(),
      isKaizen,
      isBroadcast,
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
                <option value="📋 Saturday MOM Operational Action">📋 Saturday MOM Operational Action</option>
                <option value="🤝 CFT Handshake Resolution">🤝 CFT Handshake Resolution</option>
                <option value="📊 DWM Daily Work Management">📊 DWM Daily Work Management</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Originator / Raised By
              </label>
              <select
                value={originator}
                onChange={(e) => setOriginator(e.target.value)}
                className="w-full py-2.5 px-3 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:border-blue-500 outline-none shadow-2xs"
              >
                <option value="👔 Plant Head (Awari B.)">👔 Plant Head (Awari B.)</option>
                <option value="👔 Quality Lead (Shailesh T)">👔 Quality Lead (Shailesh T)</option>
                <option value="👔 PDC Lead (Shrirang C.)">👔 PDC Lead (Shrirang C.)</option>
                <option value="👔 PPC Lead (Ratan S)">👔 PPC Lead (Ratan S)</option>
                <option value="👔 Machine Shop-01 Lead (Ibrahim S)">👔 Machine Shop-01 Lead (Ibrahim S)</option>
                <option value="👔 Machine Shop-02 Lead (Sunil G)">👔 Machine Shop-02 Lead (Sunil G)</option>
                <option value="👔 Maintenance Lead (Mohite R)">👔 Maintenance Lead (Mohite R)</option>
                <option value="👔 Tool Room Lead (Ravindra N)">👔 Tool Room Lead (Ravindra N)</option>
                <option value="👔 Store Lead (Dipak G)">👔 Store Lead (Dipak G)</option>
                <option value="👔 Purchase Lead (Pankaj B)">👔 Purchase Lead (Pankaj B)</option>
                <option value="👔 HR / Admin Lead (Poonam S)">👔 HR / Admin Lead (Poonam S)</option>
                <option value="👔 Account Lead (Sushant D)">👔 Account Lead (Sushant D)</option>
                <option value="👔 SPM / Fettling Lead (Shrirang C.)">👔 SPM / Fettling Lead (Shrirang C.)</option>
                <option value="👔 NPD Lead (Ravindra N)">👔 NPD Lead (Ravindra N)</option>
              </select>
            </div>
          </div>

          {/* Broadcast Card (plant-wide roles only — department-locked users create within their own dept) */}
          {!lockedDept && (
            <div className="border border-slate-200 bg-white rounded-xl p-3 flex items-center justify-between shadow-2xs">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBroadcast}
                  onChange={(e) => setIsBroadcast(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer border-slate-300"
                />
                <span className="font-bold text-xs text-slate-800">
                  Broadcast across ALL 10 Departments
                </span>
              </label>
              <span className="text-xs font-semibold text-slate-500">
                Plant-Wide
              </span>
            </div>
          )}

          {/* Target Department & Assignee (shown when not broadcast) */}
          {!isBroadcast && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Responsible Department *
                </label>
                {lockedDept ? (
                  <div className="w-full py-2 px-3 bg-amber-50 border border-amber-300 rounded-lg text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                    <span>{lockedDept} (Locked)</span>
                  </div>
                ) : (
                  <select
                    value={dept}
                    onChange={(e) => setDept(e.target.value)}
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:border-blue-500 outline-none"
                  >
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
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
                  {SAMARTH_PLANT_ASSIGNEES.map((o) => (
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
              <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-xs flex items-center gap-2 shadow-xs transition-colors">
                <Camera className="w-4 h-4" />
                <span>Camera</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </label>

              <label className="cursor-pointer bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2 rounded-lg font-semibold text-xs flex items-center gap-2 shadow-2xs transition-colors">
                <Upload className="w-4 h-4 text-slate-500" />
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </label>

              {problemPhoto && (
                <button
                  type="button"
                  onClick={() => setProblemPhoto('')}
                  className="text-xs text-red-600 hover:underline font-medium ml-auto"
                >
                  Remove Photo
                </button>
              )}
            </div>

            {problemPhoto && (
              <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200">
                <img 
                  src={problemPhoto} 
                  alt="Problem Preview" 
                  className="w-full h-full object-cover" 
                />
              </div>
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
