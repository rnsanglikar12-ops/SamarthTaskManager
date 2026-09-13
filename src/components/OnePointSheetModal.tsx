import React from 'react';
import { ActionItem } from '../types';
import { X, Printer, Sparkles, CheckCircle2, ShieldCheck } from 'lucide-react';

interface OnePointSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: ActionItem | null;
}

export const OnePointSheetModal: React.FC<OnePointSheetModalProps> = ({
  isOpen,
  onClose,
  action
}) => {
  if (!isOpen || !action) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div 
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[95vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Toolbar (hidden when printing) */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                1-Point Kaizen & DSI Standardization Sheet
              </h3>
              <p className="text-xs text-slate-500">
                Shopfloor Standard Operating Record • Samarth Industries
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print Sheet</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Sheet Document */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 font-sans bg-white print:p-0">
          <div className="border-2 border-slate-800 p-6 space-y-6">
            
            {/* Header with Samarth Logo & Title */}
            <div className="border-b-2 border-slate-800 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img 
                  src="/samarth_logo.png" 
                  alt="Samarth Industries" 
                  className="h-10 w-auto object-contain" 
                />
                <div>
                  <h1 className="text-base font-extrabold tracking-tight text-slate-900 uppercase">
                    SAMARTH INDUSTRIES
                  </h1>
                  <p className="text-[10px] text-slate-500">
                    Chakan Industrial Area, Phase II, Pune • Operations & Quality Hub
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="border-2 border-emerald-600 text-emerald-700 text-xs font-black px-3 py-1 uppercase tracking-wider rounded">
                  1-POINT KAIZEN SHEET
                </span>
                <p className="text-[10px] font-mono text-slate-500 mt-1 font-bold">
                  REF NO: SI-KZ-{String(action.id).padStart(4, '0')}
                </p>
              </div>
            </div>

            {/* Metadata Table */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border border-slate-300 rounded overflow-hidden">
              <div className="p-2 bg-slate-50 font-bold border-r border-slate-300">Department</div>
              <div className="p-2 border-r border-slate-300 font-semibold">{action.dept}</div>
              <div className="p-2 bg-slate-50 font-bold border-r border-slate-300">Target Date</div>
              <div className="p-2 font-mono font-semibold">{action.deadline}</div>

              <div className="p-2 bg-slate-50 font-bold border-r border-slate-300 border-t">Kaizen Owner</div>
              <div className="p-2 border-r border-slate-300 border-t font-semibold">{action.owner}</div>
              <div className="p-2 bg-slate-50 font-bold border-r border-slate-300 border-t">Verification Status</div>
              <div className="p-2 border-t font-bold text-emerald-700">{action.status}</div>
            </div>

            {/* 5W1H Abnormality Description */}
            <div className="space-y-1.5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                <span>1. Problem / Shopfloor Abnormality (5W1H)</span>
                {action.machineNote && (
                  <span className="text-[11px] font-mono text-slate-500 font-normal">
                    {action.machineNote}
                  </span>
                )}
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium leading-relaxed">
                {action.desc.replace(/⭐\s*\[DSI Kaizen\]/i, '').trim()}
              </div>
            </div>

            {/* Before vs After Photo Proof */}
            <div className="grid grid-cols-2 gap-4">
              {/* Before Condition */}
              <div className="border border-slate-300 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <span className="text-xs font-bold text-red-600 uppercase tracking-wide">
                    BEFORE CONDITION (Defect / Waste)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Initial State</span>
                </div>
                <div className="w-full h-44 bg-slate-100 rounded border border-dashed border-slate-300 flex items-center justify-center overflow-hidden">
                  {action.attachedPhoto ? (
                    <img 
                      src={action.attachedPhoto} 
                      alt="Before" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="text-center p-3 text-slate-400">
                      <span className="text-xs font-semibold block">Original Shopfloor Photo</span>
                      <span className="text-[10px]">Photo recorded on shopfloor</span>
                    </div>
                  )}
                </div>
              </div>

              {/* After Condition */}
              <div className="border border-emerald-300 bg-emerald-50/10 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-1">
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                    AFTER CONDITION (Countermeasure)
                  </span>
                  <span className="text-[10px] font-mono text-emerald-600 font-bold">Standardized</span>
                </div>
                <div className="w-full h-44 bg-emerald-50/40 rounded border border-dashed border-emerald-300 flex items-center justify-center overflow-hidden">
                  {action.afterPhoto ? (
                    <img 
                      src={action.afterPhoto} 
                      alt="After" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="text-center p-3 text-emerald-600">
                      <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-600" />
                      <span className="text-xs font-bold block">Poka-Yoke / Fix Implemented</span>
                      <span className="text-[10px] text-emerald-700">Verified by Shift Supervisor</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Kaizen Benefit & Standardization Work Instruction */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg space-y-1">
                <span className="font-bold text-amber-900 block uppercase tracking-wide">
                  Tangible Benefits (QCDSM)
                </span>
                <p className="text-slate-700 leading-relaxed">
                  {action.kaizenBenefit || 'Defect containment, safety improvement, ergonomic ease, cycle time adherence.'}
                </p>
              </div>

              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg space-y-1">
                <span className="font-bold text-blue-900 block uppercase tracking-wide">
                  Standard Work Instruction
                </span>
                <p className="text-slate-700 leading-relaxed">
                  Procedure documented in SOP / visual control card. Added to daily 5S & autonomous maintenance checklist.
                </p>
              </div>
            </div>

            {/* Signatures & Executive Authorization */}
            <div className="pt-4 border-t-2 border-slate-800 grid grid-cols-3 gap-4 text-center text-xs">
              <div>
                <div className="h-10 border-b border-slate-400 flex items-end justify-center pb-1 font-semibold text-slate-800">
                  {action.owner}
                </div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mt-1">
                  Kaizen Originator
                </span>
              </div>

              <div>
                <div className="h-10 border-b border-slate-400 flex items-end justify-center pb-1 font-semibold text-slate-800">
                  Awari B.
                </div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mt-1">
                  Plant Head (Verified)
                </span>
              </div>

              <div>
                <div className="h-10 border-b border-slate-400 flex items-end justify-center pb-1 font-semibold text-slate-800">
                  Mr. Sanglikar
                </div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mt-1">
                  Mentor & Continuous Excellence
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 print:hidden">
          <span>Samarth Industries Quality System Standard • ISO 9001 / IATF 16949</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
