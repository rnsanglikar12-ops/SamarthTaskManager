import React, { useState } from 'react';
import { ActionItem, ActionStatus, Priority } from '../types';
import { 
  X, 
  CheckCircle2, 
  Sparkles, 
  Camera, 
  Save, 
  Trash2, 
  AlertTriangle,
  Image as ImageIcon,
  Send,
  RotateCcw,
  ShieldCheck,
  Check,
  AlertCircle
} from 'lucide-react';
import { AuthUser, can } from '../utils/auth';
import { isRaisedToOtherDept } from '../data/sentinelDataLoader';

interface ActionDetailModalProps {
  action: ActionItem | null;
  onClose: () => void;
  onSave: (updated: ActionItem) => void;
  onDelete?: (id: string) => void;
  currentDept?: string;
  session: AuthUser | null;
}

export const ActionDetailModal: React.FC<ActionDetailModalProps> = ({
  action,
  onClose,
  onSave,
  onDelete,
  currentDept = '',
  session
}) => {
  if (!action) return null;

  const [status, setStatus] = useState<ActionStatus>(action.status);
  const [actionNotes, setActionNotes] = useState<string>(action.actionNotes || '');
  const [evidence, setEvidence] = useState<string>(action.evidence || 'Photo Proof');
  const [priority, setPriority] = useState<Priority>(action.priority);
  const [attachedPhoto, setAttachedPhoto] = useState<string>(action.attachedPhoto || '');
  const [afterPhoto, setAfterPhoto] = useState<string>(action.afterPhoto || '');
  const [isKaizen, setIsKaizen] = useState<boolean>(action.isKaizen || false);
  const [kaizenBenefit, setKaizenBenefit] = useState<string>(action.kaizenBenefit || '');

  // Target Deadline revision state (Authority strictly with Plant Head / Secret Master)
  const [deadline, setDeadline] = useState<string>(action.deadline || '');
  const [isEditingDeadline, setIsEditingDeadline] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Originator Verification state
  const [showReworkInput, setShowReworkInput] = useState(false);
  const [reworkReason, setReworkReason] = useState('');
  const [handshakeNotice, setHandshakeNotice] = useState<string | null>(null);

  // Role permissions
  const hasReviseAuthority = can(session, 'reviseDeadline');
  const hasDeleteAuthority = can(session, 'deleteTask');
  const canEditTask = can(session, 'editOwnDept', action);
  const isExecutive = !!session && !session.department; // plant-wide role: PlantHead / MD / Admin

  // Handshake detection
  const originatorDept = action.originatorDept || 'Store';
  const isHandshake = (action.originatorDept && isRaisedToOtherDept(action.originatorDept, action.dept)) || !!action.isCFT;
  
  // Is the current viewer the originator (or executive with oversight)?
  const isOriginator = isExecutive || (!!currentDept && currentDept.toLowerCase() === originatorDept.toLowerCase());
  const isTargetDept = !isExecutive && !!currentDept && currentDept.toLowerCase() === action.dept.toLowerCase();

  const handleConfirmPermanentDelete = () => {
    if (onDelete) {
      onDelete(action.id);
    }
    onClose();
  };

  const handleSave = () => {
    onSave({
      ...action,
      status,
      actionNotes,
      evidence,
      priority,
      deadline,
      attachedPhoto: attachedPhoto || undefined,
      afterPhoto: afterPhoto || undefined,
      isKaizen,
      kaizenBenefit: isKaizen ? kaizenBenefit : undefined
    });
    onClose();
  };

  // Standard task completion (for non-handshake tasks, or originator sign-off)
  const handleMarkResolved = () => {
    const todayStr = new Date().toLocaleDateString('en-GB');
    const stamp = isHandshake
      ? `[Verified & Completed by Originator (${originatorDept}) on ${todayStr}]`
      : `[Resolved on ${todayStr}]`;

    onSave({
      ...action,
      status: 'Completed',
      actionNotes: actionNotes ? `${actionNotes} | ${stamp}` : stamp,
      evidence,
      priority,
      deadline,
      attachedPhoto: attachedPhoto || undefined,
      afterPhoto: afterPhoto || undefined,
      isKaizen,
      kaizenBenefit: isKaizen ? kaizenBenefit : undefined
    });
    onClose();
  };

  // Handshake: Target Department submits work for Originator Verification
  const handleSubmitForVerification = () => {
    const todayStr = new Date().toLocaleDateString('en-GB');
    const stamp = `[Work submitted for Originator Verification by ${action.dept} on ${todayStr}]`;
    
    onSave({
      ...action,
      status: 'Under Verification',
      actionNotes: actionNotes ? `${actionNotes} | ${stamp}` : stamp,
      evidence,
      priority,
      deadline,
      attachedPhoto: attachedPhoto || undefined,
      afterPhoto: afterPhoto || undefined,
      isKaizen,
      kaizenBenefit: isKaizen ? kaizenBenefit : undefined
    });
    onClose();
  };

  // Handshake: Originator rejects and requests rework
  const handleRequestRework = () => {
    if (!reworkReason.trim()) {
      setHandshakeNotice('Please provide specific feedback/reason for rework.');
      return;
    }

    const todayStr = new Date().toLocaleDateString('en-GB');
    const stamp = `[Rework requested by Originator (${originatorDept}) on ${todayStr}: ${reworkReason.trim()}]`;

    onSave({
      ...action,
      status: 'In process',
      actionNotes: actionNotes ? `${actionNotes} | ${stamp}` : stamp,
      evidence,
      priority,
      deadline,
      attachedPhoto: attachedPhoto || undefined,
      afterPhoto: afterPhoto || undefined,
      isKaizen,
      kaizenBenefit: isKaizen ? kaizenBenefit : undefined
    });
    onClose();
  };

  const handleStatusChange = (newStatus: ActionStatus) => {
    // If it's a handshake task and current user is NOT originator, prevent setting to 'Completed'
    if (isHandshake && newStatus === 'Completed' && !isOriginator) {
      setHandshakeNotice(`Handshake Task: Only the Originator (${originatorDept}) or Plant Head can mark this task Completed.`);
      return;
    }
    setHandshakeNotice(null);
    setStatus(newStatus);
  };

  const handlePhotoUpload = (type: 'before' | 'after', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const result = uploadEvent.target?.result as string;
        if (type === 'before') {
          setAttachedPhoto(result);
        } else {
          setAfterPhoto(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 font-mono font-bold text-xs flex items-center justify-center shadow-2xs">
              #{action.id}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900">
                  Shopfloor Task Verification
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  priority === 'A' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  Priority {priority}
                </span>
                {action.recurrence !== 'One-Time' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
                    {action.recurrence} PM
                  </span>
                )}
                {isHandshake && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                    <span>🤝 Handshake: {originatorDept} → {action.dept}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Samarth Industries Operational Execution Matrix
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs text-slate-700">

          {/* Handshake Notice Banner */}
          {handshakeNotice && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-800 flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{handshakeNotice}</span>
            </div>
          )}

          {/* Handshake Task Originator Verification Card (Requirement 4) */}
          {isHandshake && (
            <div className={`p-4 rounded-xl border space-y-3 transition-all ${
              status === 'Under Verification'
                ? 'bg-purple-50/90 border-purple-200 text-purple-950 shadow-2xs'
                : status === 'Completed'
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                : 'bg-blue-50/70 border-blue-200 text-blue-950'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">🤝</span>
                  <div>
                    <h4 className="font-bold text-xs">
                      Inter-Departmental Handshake Task
                    </h4>
                    <p className="text-[11px] opacity-80 mt-0.5">
                      Originator: <strong className="font-semibold">{originatorDept}</strong> | Executing Dept: <strong className="font-semibold">{action.dept}</strong>
                    </p>
                  </div>
                </div>

                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                  status === 'Completed'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : status === 'Under Verification'
                    ? 'bg-purple-200/80 text-purple-900 border border-purple-300 animate-pulse'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}>
                  {status === 'Under Verification' ? 'Awaiting Originator Verification' : status}
                </span>
              </div>

              {/* Status explanation */}
              {status === 'Completed' ? (
                <div className="p-2.5 bg-white/80 rounded-lg border border-emerald-200 text-[11px] text-emerald-800 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Verified and approved as complete by Originator ({originatorDept}).</span>
                </div>
              ) : status === 'Under Verification' ? (
                <div className="space-y-2 text-xs">
                  <p className="text-[11px] text-purple-900 font-medium">
                    {action.dept} has submitted countermeasures and photographic evidence for sign-off.
                  </p>

                  {/* If user is the Originator or Executive, show Verification Sign-off Actions */}
                  {isOriginator ? (
                    <div className="p-3 bg-white rounded-xl border border-purple-200 space-y-2.5 shadow-2xs">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                        <ShieldCheck className="w-4 h-4 text-purple-600" />
                        <span>Originator Verification Actions ({originatorDept})</span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Inspect the Before and After photo proofs below. Only you ({originatorDept}) or the Plant Head can approve completion.
                      </p>

                      {!showReworkInput ? (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleMarkResolved}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-2xs transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve & Mark Completed</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowReworkInput(true)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 rounded-lg font-semibold text-xs transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                            <span>Request Rework</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2 pt-1 bg-amber-50/50 p-2.5 rounded-lg border border-amber-200">
                          <label className="block text-[11px] font-bold text-amber-900">
                            Reason for Rework / Required Correction:
                          </label>
                          <input
                            type="text"
                            value={reworkReason}
                            onChange={(e) => setReworkReason(e.target.value)}
                            placeholder="Describe what is incomplete or defective..."
                            className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded text-xs outline-none font-sans"
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleRequestRework}
                              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold"
                            >
                              Send Back for Rework
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowReworkInput(false);
                                setReworkReason('');
                              }}
                              className="px-2.5 py-1 bg-white border border-slate-300 text-slate-600 rounded text-xs font-semibold"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 bg-white/80 rounded-lg border border-purple-200 text-[11px] text-purple-900">
                      <span>Submitted to <strong>{originatorDept}</strong> for verification. Once the originator approves, this task will be marked Completed.</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[11px] opacity-85">
                  Assigned to <strong>{action.dept}</strong> for execution. Once countermeasures are implemented with Before/After photos, submit for verification to <strong>{originatorDept}</strong>.
                </div>
              )}
            </div>
          )}

          {/* In-Modal Permanent Delete Confirmation (Reliable, iframe-safe) */}
          {showDeleteConfirm && (
            <div className="p-4 bg-red-50 border-2 border-red-300 rounded-xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-2 text-red-900 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                <span>Confirm Permanent Deletion of Task #{action.id}</span>
              </div>
              <div className="text-xs text-red-800 space-y-1.5">
                <p>
                  Authorized executive action. This will permanently remove Task #{action.id} from the master operational register.
                </p>
                <div className="p-2.5 bg-white/80 rounded-lg border border-red-200 font-medium text-slate-800">
                  <span className="text-slate-500 font-semibold block text-[10px] uppercase">Task Description:</span>
                  {action.desc.replace(/⭐\s*\[DSI Kaizen\]/i, '').trim()}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleConfirmPermanentDelete}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Yes, Permanently Delete Task</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold shadow-2xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Abnormality / Task Description */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              5W1H Abnormality / Directive
            </label>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 font-medium text-slate-900 text-sm leading-relaxed">
              {action.desc.replace(/⭐\s*\[DSI Kaizen\]/i, '').trim()}
            </div>
          </div>

          {/* Key Attributes Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
            <div>
              <span className="text-slate-400 block text-[11px] font-medium">Responsible Dept</span>
              <strong className="text-slate-800 text-xs block mt-0.5">{action.dept}</strong>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] font-medium">Originator Dept</span>
              <strong className="text-slate-800 text-xs block mt-0.5">{originatorDept}</strong>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] font-medium">Assignee / Owner</span>
              <strong className="text-slate-800 text-xs block mt-0.5">{action.owner}</strong>
            </div>

            {/* Target Deadline with Revision Control (Requirement 1 & 6) */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 block text-[11px] font-medium">Target Deadline</span>
                {hasReviseAuthority && (
                  <button
                    type="button"
                    onClick={() => setIsEditingDeadline(!isEditingDeadline)}
                    className="text-[10px] text-blue-600 hover:underline font-bold"
                  >
                    {isEditingDeadline ? 'Done' : 'Revise'}
                  </button>
                )}
              </div>

              {isEditingDeadline && hasReviseAuthority ? (
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="mt-1 w-full py-1 px-2 bg-white border border-blue-500 rounded text-xs font-mono outline-none"
                />
              ) : (
                <strong className="text-slate-800 text-xs block mt-0.5 font-mono font-bold">
                  {deadline || 'Ongoing'}
                </strong>
              )}
            </div>
          </div>

          {/* Before & After Photo Proof Section */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Before / After Photo Proof
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Before Photo Box */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 flex flex-col items-center justify-center min-h-[140px] text-center relative overflow-hidden">
                {attachedPhoto ? (
                  <div className="relative w-full h-full min-h-[120px] flex flex-col items-center justify-center">
                    <img src={attachedPhoto} alt="Before" className="max-h-28 rounded-lg object-contain" />
                    <button 
                      type="button"
                      onClick={() => setAttachedPhoto('')}
                      className="absolute top-1 right-1 p-1 bg-white/90 text-red-600 hover:text-red-700 rounded-lg shadow-sm border border-slate-200"
                      title="Remove Before photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Before Condition Proof</span>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full py-4 text-slate-500 hover:text-blue-600 transition-colors">
                    <Camera className="w-6 h-6 mb-1.5 text-slate-400" />
                    <span className="text-xs font-semibold">[ B ] Attach Before Photo</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Click to upload JPG / PNG</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => handlePhotoUpload('before', e)} 
                    />
                  </label>
                )}
              </div>

              {/* After Photo Box */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 flex flex-col items-center justify-center min-h-[140px] text-center relative overflow-hidden">
                {afterPhoto ? (
                  <div className="relative w-full h-full min-h-[120px] flex flex-col items-center justify-center">
                    <img src={afterPhoto} alt="After" className="max-h-28 rounded-lg object-contain" />
                    <button 
                      type="button"
                      onClick={() => setAfterPhoto('')}
                      className="absolute top-1 right-1 p-1 bg-white/90 text-red-600 hover:text-red-700 rounded-lg shadow-sm border border-slate-200"
                      title="Remove After photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">After Resolution Proof</span>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full py-4 text-slate-500 hover:text-blue-600 transition-colors">
                    <ImageIcon className="w-6 h-6 mb-1.5 text-slate-400" />
                    <span className="text-xs font-semibold">[ A ] Attach After Photo</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Click to upload JPG / PNG</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => handlePhotoUpload('after', e)} 
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Editable Status & Priority Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Update Status
              </label>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value as ActionStatus)}
                disabled={!canEditTask}
                className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 focus:border-blue-500 outline-none shadow-2xs disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="Pending">Pending / Open</option>
                <option value="In process">In process / Action Ongoing</option>
                <option value="Under Verification">Under Verification (Originator / QA)</option>
                {/* Only Originator or Executive or non-handshake can select Completed directly */}
                {(!isHandshake || isOriginator) && (
                  <option value="Completed">Resolved / Completed</option>
                )}
                <option value="Hold">Hold / Blocked</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                disabled={!canEditTask}
                className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 focus:border-blue-500 outline-none shadow-2xs disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="A">Priority A (High Severity / Critical)</option>
                <option value="B">Priority B (Standard / Routine)</option>
              </select>
            </div>
          </div>

          {/* Action Notes / Countermeasures */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Action Notes, Countermeasures & Root Cause
            </label>
            <textarea
              rows={3}
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              placeholder="Record immediate containment, machine adjustment, root cause or supplier verification..."
              disabled={!canEditTask}
              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 outline-none shadow-2xs disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>

          {/* Convert to Kaizen Toggle */}
          <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isKaizen}
                onChange={(e) => setIsKaizen(e.target.checked)}
                disabled={!canEditTask}
                className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 disabled:opacity-50"
              />
              <span className="font-bold text-emerald-800 text-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Classify as DSI / Kaizen Continuous Improvement</span>
              </span>
            </label>

            {isKaizen && (
              <input
                type="text"
                value={kaizenBenefit}
                onChange={(e) => setKaizenBenefit(e.target.value)}
                placeholder="Document tangible benefit: Cost reduction, safety enhancement, cycle time saving..."
                className="w-full py-2 px-3 bg-white border border-emerald-300 rounded-lg text-xs text-slate-800 focus:outline-none"
              />
            )}
          </div>
        </div>

        {/* Modal Footer with Strict Role Gating (Requirement 1 & 4) */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Handshake Completion vs Submission Button */}
            {canEditTask && (isHandshake ? (
              isOriginator ? (
                /* Originator or Plant Head: Can complete the handshake task */
                status !== 'Completed' && (
                  <button
                    type="button"
                    onClick={handleMarkResolved}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>Originator Approve & Complete</span>
                  </button>
                )
              ) : (
                /* Target Dept (e.g. PDC): CANNOT mark completed; must submit for originator verification */
                status !== 'Completed' && (
                  status === 'Under Verification' ? (
                    <button
                      type="button"
                      disabled
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-100 text-purple-700 rounded-xl text-xs font-bold cursor-not-allowed opacity-80"
                    >
                      <span>Awaiting Verification by {originatorDept}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmitForVerification}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                      title={`Submit work to ${originatorDept} for verification`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit to {originatorDept} for Verification</span>
                    </button>
                  )
                )
              )
            ) : (
              /* Standard Internal Task: Any department member can mark completed */
              status !== 'Completed' && (
                <button
                  type="button"
                  onClick={handleMarkResolved}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>Mark Completed</span>
                </button>
              )
            ))}

            {/* Delete button: Strictly visible ONLY if user has executive delete authority! (Requirement 1) */}
            {hasDeleteAuthority && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/80 rounded-xl border border-red-200 transition-colors text-xs font-bold shadow-2xs"
                title="Permanently Delete Task (Authorized Executive Access)"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Task</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors shadow-2xs"
            >
              Cancel
            </button>
            {canEditTask && (
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1d64ec] hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <Save className="w-4 h-4 stroke-[2.5]" />
                <span>Save Updates</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
