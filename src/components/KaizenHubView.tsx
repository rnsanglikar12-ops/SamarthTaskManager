import React, { useState, useMemo, useEffect } from 'react';
import { ActionItem } from '../types';
import {
  Sparkles,
  Plus,
  Search,
  ArrowUpDown,
  Camera,
  CheckCircle2,
  Printer,
  Filter,
  Image as ImageIcon,
  ShieldAlert,
  Clock,
  Layers,
  Check,
  Lock
} from 'lucide-react';
import { OnePointSheetModal } from './OnePointSheetModal';
import { SAMARTH_ORG_STRUCTURE } from '../data/orgStructure';
import { isRaisedToOtherDept, isKaizenAction } from '../data/sentinelDataLoader';

interface KaizenHubViewProps {
  actions: ActionItem[];
  onOpenDetail: (action: ActionItem) => void;
  onOpenNewModal: () => void;
  lockedDepts?: string[] | null;
}

type KaizenCategoryFilter = 
  | 'all' 
  | 'dsi' 
  | 'pokayoke' 
  | '5s' 
  | 'standard' 
  | 'quality' 
  | 'productivity';

export const KaizenHubView: React.FC<KaizenHubViewProps> = ({
  actions,
  onOpenDetail,
  onOpenNewModal,
  lockedDepts = null
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  // One person can head several departments — a single dept stays a hard,
  // non-interactive lock; more than one becomes a dropdown constrained to
  // just their own departments. `actions` is already pre-scoped upstream
  // (isDeptInScope), so '' naturally shows the union of all their depts.
  const isSingleDept = (lockedDepts?.length ?? 0) === 1;
  const [selectedDept, setSelectedDept] = useState(isSingleDept ? lockedDepts![0] : '');

  // Keep in sync if the signed-in user's locked department(s) ever change
  // (e.g. a different user logs in on the same session).
  useEffect(() => {
    setSelectedDept(isSingleDept ? lockedDepts![0] : '');
  }, [lockedDepts]);
  const [selectedChampion, setSelectedChampion] = useState('');
  const [activeCategory, setActiveCategory] = useState<KaizenCategoryFilter>('all');
  const [sheetModalAction, setSheetModalAction] = useState<ActionItem | null>(null);
  const [sortField, setSortField] = useState<'id' | 'dept' | 'deadline'>('id');
  const [sortAsc, setSortAsc] = useState(false);

  // Extract Kaizen & DSI initiatives from actions
  const kaizenActions = useMemo(() => actions.filter(isKaizenAction), [actions]);

  // Champions list (the 17 HODs)
  const champions = useMemo(() => {
    const hods = SAMARTH_ORG_STRUCTURE.map(d => d.deptHead);
    return Array.from(new Set(hods)).filter(Boolean).sort();
  }, []);

  // Department list
  const departments = useMemo(() => {
    return Array.from(new Set(kaizenActions.map(k => k.dept))).filter(Boolean).sort();
  }, [kaizenActions]);

  // Filtered initiatives
  const filteredKaizens = useMemo(() => {
    return kaizenActions.filter(item => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSearch = 
          item.desc.toLowerCase().includes(q) ||
          item.owner.toLowerCase().includes(q) ||
          item.dept.toLowerCase().includes(q) ||
          (item.actionNotes && item.actionNotes.toLowerCase().includes(q)) ||
          (item.machineNote && item.machineNote.toLowerCase().includes(q)) ||
          String(item.id).includes(q);
        if (!matchesSearch) return false;
      }

      // Department (handshake-aware: match target dept OR originator dept, same as Master Matrix)
      if (selectedDept) {
        const matchesHandshake = item.originatorDept && isRaisedToOtherDept(item.originatorDept, item.dept)
          ? (item.dept === selectedDept || item.originatorDept === selectedDept)
          : item.dept === selectedDept;
        if (!matchesHandshake) return false;
      }

      // Champion / Owner
      if (selectedChampion && !item.owner.toLowerCase().includes(selectedChampion.toLowerCase())) return false;

      // Category Pill
      if (activeCategory === 'dsi') {
        const isDsi = item.desc.toLowerCase().includes('dsi') || (item.id % 2 === 0);
        if (!isDsi) return false;
      } else if (activeCategory === 'pokayoke') {
        const isPoka = item.desc.toLowerCase().includes('pokayoke') || item.desc.toLowerCase().includes('error');
        if (!isPoka) return false;
      } else if (activeCategory === '5s') {
        const is5S = item.desc.toLowerCase().includes('5s') || item.desc.toLowerCase().includes('cleaning') || item.desc.toLowerCase().includes('line');
        if (!is5S) return false;
      } else if (activeCategory === 'standard') {
        const isStd = !item.desc.toLowerCase().includes('dsi') && item.isKaizen;
        if (!isStd) return false;
      } else if (activeCategory === 'quality') {
        const isQ = item.dept.toLowerCase().includes('quality') || item.desc.toLowerCase().includes('defect') || item.desc.toLowerCase().includes('quality');
        if (!isQ) return false;
      } else if (activeCategory === 'productivity') {
        const isP = item.desc.toLowerCase().includes('time') || item.desc.toLowerCase().includes('speed') || item.desc.toLowerCase().includes('material');
        if (!isP) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortField === 'id') {
        const cmp = a.id.localeCompare(b.id, undefined, { numeric: true });
        return sortAsc ? cmp : -cmp;
      } else if (sortField === 'dept') {
        return sortAsc ? a.dept.localeCompare(b.dept) : b.dept.localeCompare(a.dept);
      } else {
        return sortAsc ? a.deadline.localeCompare(b.deadline) : b.deadline.localeCompare(a.deadline);
      }
    });
  }, [kaizenActions, searchQuery, selectedDept, selectedChampion, activeCategory, sortField, sortAsc]);

  const totalCount = kaizenActions.length;
  const completedCount = kaizenActions.filter(k => k.status === 'Completed').length;

  const toggleSort = (field: 'id' | 'dept' | 'deadline') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner Matching Screenshot 2 */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-2xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900 leading-snug">
                DSI (Daily Small Improvements) & Kaizen Excellence Hub
              </h2>
              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                {completedCount} Implemented
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Compiled identically to Master Matrix • Dual Before/After verification, Poka-Yoke containment, and 1-Point Kaizen Sheets
            </p>
          </div>
        </div>

        <button
          onClick={onOpenNewModal}
          className="bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Register DSI / Kaizen</span>
        </button>
      </div>

      {/* Filter Toolbar Matching Screenshot 2 */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Kaizen title, 5W1H abnormality, owner, machine #..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Department Filter */}
          {isSingleDept ? (
            <div className="py-2 px-3 bg-amber-50 border border-amber-300 rounded-lg text-xs font-bold text-amber-950 flex items-center gap-1 shadow-2xs">
              <Lock className="w-3.5 h-3.5 text-amber-700" />
              <span>{lockedDepts![0]} (Locked)</span>
            </div>
          ) : (
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:border-emerald-500 shadow-2xs"
            >
              <option value="">{lockedDepts ? 'All My Departments' : 'All Departments'}</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}

          {/* Champions Dropdown (17 Champions) */}
          <select
            value={selectedChampion}
            onChange={(e) => setSelectedChampion(e.target.value)}
            className="py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:border-emerald-500 shadow-2xs"
          >
            <option value="">All Champions (17)</option>
            {champions.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Filter Pills Row Matching Screenshot 2 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs select-none">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              activeCategory === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All DSI & Kaizens ({totalCount})
          </button>

          <button
            onClick={() => setActiveCategory('dsi')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              activeCategory === 'dsi'
                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            ✨ DSI (Small Improvements)
          </button>

          <button
            onClick={() => setActiveCategory('pokayoke')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              activeCategory === 'pokayoke'
                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            🛡️ Poka-Yoke (Error Proof)
          </button>

          <button
            onClick={() => setActiveCategory('5s')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              activeCategory === '5s'
                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            🧹 5S Standards
          </button>

          <button
            onClick={() => setActiveCategory('standard')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              activeCategory === 'standard'
                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            💡 Standard Kaizen
          </button>

          <button
            onClick={() => setActiveCategory('quality')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              activeCategory === 'quality'
                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            🎯 Quality (Zero Defect)
          </button>

          <button
            onClick={() => setActiveCategory('productivity')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              activeCategory === 'productivity'
                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            ⚡ Productivity / Time
          </button>
        </div>
      </div>

      {/* Subheader info text */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
        <span>
          Showing {filteredKaizens.length} of {totalCount} DSI / Kaizen initiatives
        </span>
        <span className="hidden sm:inline">
          Dual Before / After thumbnails visible • Click row to update resolution evidence or print 1-point sheet
        </span>
      </div>

      {/* STRICTLY TABLE VIEW MATCHING SCREENSHOT 2 */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/90 text-slate-600 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider">
                <th 
                  className="py-3 px-3 cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
                  onClick={() => toggleSort('id')}
                >
                  <div className="flex items-center gap-1">
                    <span>ID</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-2.5 whitespace-nowrap">TYPE ⇅</th>
                <th className="py-3 px-2 text-center whitespace-nowrap">PRI</th>
                <th 
                  className="py-3 px-3 cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
                  onClick={() => toggleSort('dept')}
                >
                  <div className="flex items-center gap-1">
                    <span>DEPT</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 min-w-[280px]">5W1H ABNORMALITY & KAIZEN TRANSFORMATION</th>
                <th className="py-3 px-3 whitespace-nowrap">LEAD / OWNER</th>
                <th 
                  className="py-3 px-3 cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
                  onClick={() => toggleSort('deadline')}
                >
                  <div className="flex items-center gap-1">
                    <span>TARGET DATE</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3 text-center whitespace-nowrap">STATUS</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">BEFORE / AFTER PHOTOS</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">1-POINT SHEET</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredKaizens.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 text-xs">
                    No DSI Kaizen initiatives match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredKaizens.map((item) => {
                  const isCompleted = item.status === 'Completed';
                  const isDue = item.deadline === '2026-09-09' || item.deadline < '2026-09-11';
                  const cleanDesc = item.desc.replace(/⭐\s*\[DSI Kaizen\]/i, '').trim();

                  return (
                    <tr
                      key={item.id}
                      onClick={() => onOpenDetail(item)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      {/* ID */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 text-xs">
                        #{item.id}
                      </td>

                      {/* TYPE */}
                      <td className="py-3 px-2.5">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          DSI
                        </span>
                      </td>

                      {/* PRI */}
                      <td className="py-3 px-2 text-center">
                        <span className={`inline-block w-5 h-5 leading-5 rounded text-[10px] font-extrabold text-white text-center ${
                          item.priority === 'A' ? 'bg-red-500' : 'bg-blue-500'
                        }`}>
                          {item.priority}
                        </span>
                      </td>

                      {/* DEPT */}
                      <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                        {item.dept}
                      </td>

                      {/* 5W1H ABNORMALITY & KAIZEN TRANSFORMATION */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 leading-snug">
                          {cleanDesc}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                            🎯 Quality
                          </span>
                          {item.machineNote && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-600 bg-slate-100 border border-slate-200">
                              M/C: {item.machineNote}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* LEAD / OWNER */}
                      <td className="py-3 px-3 font-medium text-slate-800 whitespace-nowrap">
                        {item.owner}
                      </td>

                      {/* TARGET DATE */}
                      <td className="py-3 px-3 font-mono text-xs whitespace-nowrap">
                        {isDue && !isCompleted ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                            {item.deadline} DUE
                          </span>
                        ) : (
                          <span className="text-slate-600">{item.deadline}</span>
                        )}
                      </td>

                      {/* STATUS */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {isCompleted ? (
                          <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Completed
                          </span>
                        ) : item.status === 'In process' ? (
                          <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            In process
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* BEFORE / AFTER PHOTOS */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Before Box */}
                          <div 
                            onClick={() => onOpenDetail(item)}
                            className="w-8 h-8 rounded border border-slate-300 bg-slate-100 hover:border-slate-400 flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden"
                            title="Before Photo Evidence"
                          >
                            {item.attachedPhoto ? (
                              <img src={item.attachedPhoto} alt="Before" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[9px] font-mono font-bold text-slate-500">BFR</span>
                            )}
                          </div>

                          {/* After Box */}
                          <div 
                            onClick={() => onOpenDetail(item)}
                            className={`w-8 h-8 rounded border flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden ${
                              isCompleted 
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700' 
                                : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300'
                            }`}
                            title="After Countermeasure Photo Proof"
                          >
                            {item.afterPhoto ? (
                              <img src={item.afterPhoto} alt="After" className="w-full h-full object-cover" />
                            ) : isCompleted ? (
                              <span className="text-[9px] font-mono font-bold text-emerald-700">AFT</span>
                            ) : (
                              <span className="text-[9px] font-mono text-slate-400">AFT</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 1-POINT SHEET BUTTON */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSheetModalAction(item)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-300 transition-colors flex items-center justify-center gap-1 mx-auto shadow-2xs"
                          title="Generate and Print 1-Point Kaizen Sheet"
                        >
                          <Printer className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Sheet</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1-Point Kaizen Standardization Sheet Modal */}
      <OnePointSheetModal
        isOpen={Boolean(sheetModalAction)}
        onClose={() => setSheetModalAction(null)}
        action={sheetModalAction}
      />
    </div>
  );
};
