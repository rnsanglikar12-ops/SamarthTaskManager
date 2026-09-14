import React, { useState, useMemo } from 'react';
import { 
  ActionItem, 
  FilterState, 
  ActionStatus 
} from '../types';
import { isRaisedToOtherDept, getTodayStr } from '../data/sentinelDataLoader';
import { TASK_DEPARTMENTS, combineAllAssignees } from '../data/orgStructure';
import { Supervisor } from '../utils/googleSheetsService';
import { 
  Search, 
  Sparkles, 
  AlertTriangle, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Eye, 
  ArrowUpDown,
  AlignJustify,
  LayoutGrid,
  Plus,
  RefreshCw,
  Radio,
  CheckCircle2,
  Check,
  ChevronDown,
  Camera,
  Image as ImageIcon,
  Flame,
  Lock
} from 'lucide-react';

interface ActionRegisterViewProps {
  actions: ActionItem[];
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  onOpenDetail: (action: ActionItem) => void;
  onUpdateStatus: (id: string, newStatus: ActionStatus) => void;
  onOpenNewModal: () => void;
  onDelete?: (id: string) => void;
  lockedDepts?: string[] | null;
  supervisors?: Supervisor[];
}

type QuickFilter = 'all' | 'priority_a' | 'due_overdue' | 'kaizen' | 'broadcast' | 'recurring' | 'verification' | 'closed';

export const ActionRegisterView: React.FC<ActionRegisterViewProps> = ({
  actions,
  filters,
  setFilters,
  onOpenDetail,
  onUpdateStatus,
  onOpenNewModal,
  onDelete,
  lockedDepts = null,
  supervisors = []
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [sortField, setSortField] = useState<keyof ActionItem>('id');
  const [sortAsc, setSortAsc] = useState<boolean>(false); // Default descending by ID matching #652 first
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [activeQuickFilter, setActiveQuickFilter] = useState<QuickFilter>('all');

  // Today's operational date
  const TODAY_STR = getTodayStr();

  // One person can head several departments — a single dept stays a hard,
  // non-interactive lock; more than one becomes a dropdown constrained to
  // just their own departments.
  const isSingleDept = (lockedDepts?.length ?? 0) === 1;
  const isMultiDept = (lockedDepts?.length ?? 0) > 1;

  // Department list — the full canonical set, so the filter is populated
  // even before any tasks exist yet. Dept-scoped users only ever see their
  // own department(s) here, never the full plant list.
  const departments = lockedDepts ?? TASK_DEPARTMENTS;

  // Assignees list — every department's default placeholder + dept head +
  // static org-structure supervisors + dynamically-added supervisors
  const assigneesList = useMemo(() => combineAllAssignees(supervisors), [supervisors]);

  // Filter actions
  const filteredActions = useMemo(() => {
    return actions.filter(item => {
      // Quick filter
      if (activeQuickFilter === 'priority_a' && item.priority !== 'A') return false;
      if (activeQuickFilter === 'due_overdue') {
        const isDueOrOverdue = (item.deadline <= TODAY_STR) && item.status !== 'Completed';
        if (!isDueOrOverdue) return false;
      }
      if (activeQuickFilter === 'kaizen' && !item.isKaizen) return false;
      if (activeQuickFilter === 'broadcast' && !item.isBroadcast) return false;
      if (activeQuickFilter === 'recurring' && item.recurrence === 'One-Time') return false;
      if (activeQuickFilter === 'verification' && item.status !== 'Under Verification') return false;
      if (activeQuickFilter === 'closed' && item.status !== 'Completed') return false;

      // Search
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const matchesDesc = item.desc.toLowerCase().includes(query);
        const matchesOwner = item.owner.toLowerCase().includes(query);
        const matchesDept = item.dept.toLowerCase().includes(query);
        const matchesNotes = (item.actionNotes?.toLowerCase().includes(query)) || (item.machineNote?.toLowerCase().includes(query)) || false;
        const matchesId = item.id.toString() === query || `#${item.id}` === query;
        if (!matchesDesc && !matchesOwner && !matchesDept && !matchesNotes && !matchesId) {
          return false;
        }
      }

      // Department dropdown
      if (filters.dept) {
        // If this item is an inter-departmental task, match if selected dept is either target OR originator
        if (item.originatorDept && isRaisedToOtherDept(item.originatorDept, item.dept)) {
          if (item.dept !== filters.dept && item.originatorDept !== filters.dept) {
            return false;
          }
        } else if (item.dept !== filters.dept) {
          return false;
        }
      }

      // Owner dropdown
      if (filters.owner && item.owner !== filters.owner) {
        return false;
      }

      return true;
    });
  }, [actions, filters, activeQuickFilter, TODAY_STR]);

  // Sort actions
  const sortedActions = useMemo(() => {
    return [...filteredActions].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal === undefined) return 1;
      if (bVal === undefined) return -1;

      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredActions, sortField, sortAsc]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedActions.length / pageSize));
  const paginatedActions = useMemo(() => {
    if (pageSize >= sortedActions.length) return sortedActions;
    const start = (currentPage - 1) * pageSize;
    return sortedActions.slice(start, start + pageSize);
  }, [sortedActions, currentPage, pageSize]);

  const handleSort = (field: keyof ActionItem) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'id' ? false : true); // Default ID descending
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filters Card matching image.png */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3.5">
        {/* Row 1: Search Bar + Department Dropdown + Assignee Dropdown + View Switch + Create Task */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Main Search Input */}
          <div className="relative flex-1 min-w-[280px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search 5W1H description, machine #, owner, dept, ID..."
              value={filters.search}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, search: e.target.value }));
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl outline-none transition-all placeholder:text-slate-400 text-slate-800"
            />
            {filters.search && (
              <button
                onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Department Select Dropdown / Locked State */}
          <div className="relative min-w-[150px]">
            {isSingleDept ? (
              <div
                className="w-full bg-amber-50 border border-amber-300 text-amber-950 text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-between shadow-2xs cursor-not-allowed select-none"
                title={`Department locked to ${lockedDepts![0]}. Department switching is restricted on HOD links.`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span className="truncate">{lockedDepts![0]} (Locked)</span>
                </div>
              </div>
            ) : (
              <>
                <select
                  value={filters.dept}
                  onChange={(e) => {
                    setFilters(prev => ({ ...prev, dept: e.target.value }));
                    setCurrentPage(1);
                  }}
                  className="w-full appearance-none bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-medium py-2 pl-3 pr-8 rounded-xl outline-none focus:border-blue-500 transition-colors cursor-pointer shadow-2xs"
                >
                  <option value="">{isMultiDept ? 'All My Departments' : 'All Departments'}</option>
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </>
            )}
          </div>

          {/* Assignees Select Dropdown matching "All Assignees (29)" */}
          <div className="relative min-w-[160px]">
            <select
              value={filters.owner}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, owner: e.target.value }));
                setCurrentPage(1);
              }}
              className="w-full appearance-none bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-medium py-2 pl-3 pr-8 rounded-xl outline-none focus:border-blue-500 transition-colors cursor-pointer shadow-2xs"
            >
              <option value="">All Assignees ({assigneesList.length})</option>
              {assigneesList.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* View Mode: Strict Table View */}
          <div className="flex items-center bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200/70 text-xs font-semibold text-slate-700 gap-1.5 shadow-2xs">
            <AlignJustify className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[11px]">Table View</span>
          </div>

          {/* Create Task Button matching image.png */}
          <button
            onClick={onOpenNewModal}
            className="bg-[#1d64ec] hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Create Task</span>
          </button>
        </div>

        {/* Row 2: Filter Pills matching image.png */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pt-1">
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap mr-1">
            Filters:
          </span>

          {/* All Tasks (652) */}
          <button
            onClick={() => {
              setActiveQuickFilter('all');
              setCurrentPage(1);
            }}
            className={`px-3.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeQuickFilter === 'all'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {isSingleDept ? `${lockedDepts![0]} Tasks` : isMultiDept ? 'My Depts Tasks' : 'All Tasks'} ({actions.length})
          </button>

          {/* Priority A */}
          <button
            onClick={() => {
              setActiveQuickFilter(activeQuickFilter === 'priority_a' ? 'all' : 'priority_a');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all ${
              activeQuickFilter === 'priority_a'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="text-red-500">🎴</span>
            <span>Priority A</span>
          </button>

          {/* Due / Overdue */}
          <button
            onClick={() => {
              setActiveQuickFilter(activeQuickFilter === 'due_overdue' ? 'all' : 'due_overdue');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all ${
              activeQuickFilter === 'due_overdue'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span>Due / Overdue</span>
          </button>

          {/* DSI / Kaizen */}
          <button
            onClick={() => {
              setActiveQuickFilter(activeQuickFilter === 'kaizen' ? 'all' : 'kaizen');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all ${
              activeQuickFilter === 'kaizen'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="w-3 h-3 text-emerald-500" />
            <span>DSI / Kaizen</span>
          </button>

          {/* Broadcasts */}
          <button
            onClick={() => {
              setActiveQuickFilter(activeQuickFilter === 'broadcast' ? 'all' : 'broadcast');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all ${
              activeQuickFilter === 'broadcast'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Radio className="w-3 h-3 text-blue-500" />
            <span>Broadcasts</span>
          </button>

          {/* Recurring PM (2) */}
          <button
            onClick={() => {
              setActiveQuickFilter(activeQuickFilter === 'recurring' ? 'all' : 'recurring');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all ${
              activeQuickFilter === 'recurring'
                ? 'bg-amber-500 text-white shadow-2xs'
                : 'bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <RefreshCw className="w-3 h-3 text-amber-600" />
            <span>Recurring PM (2)</span>
          </button>

          {/* Verification */}
          <button
            onClick={() => {
              setActiveQuickFilter(activeQuickFilter === 'verification' ? 'all' : 'verification');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all ${
              activeQuickFilter === 'verification'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Eye className="w-3 h-3 text-purple-500" />
            <span>Verification</span>
          </button>

          {/* Closed */}
          <button
            onClick={() => {
              setActiveQuickFilter(activeQuickFilter === 'closed' ? 'all' : 'closed');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all ${
              activeQuickFilter === 'closed'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Closed</span>
          </button>
        </div>
      </div>

      {/* Subheader Status Bar matching image.png */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">
            Showing {filteredActions.length} of {actions.length} tasks
          </span>
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Register ID Range: #1 – #{actions.length}</span>
          </span>
        </div>

        <div className="text-[11px] text-slate-500 italic">
          Due tasks show mild continuous blink • Click row to attach Before/After photos or convert to Kaizen
        </div>
      </div>

      {/* Main Table Card matching image.png */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 select-none">
                {/* ID Column */}
                <th 
                  onClick={() => handleSort('id')}
                  className="py-3 px-3.5 w-16 cursor-pointer hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>ID</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* Priority Column */}
                <th className="py-3 px-2.5 w-12 text-center">
                  <span>PRI</span>
                </th>

                {/* Department Column */}
                <th 
                  onClick={() => handleSort('dept')}
                  className="py-3 px-3.5 w-32 cursor-pointer hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>DEPT</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* Description Column */}
                <th className="py-3 px-4 min-w-[340px]">
                  <span>5W1H DESCRIPTION & ABNORMALITY</span>
                </th>

                {/* Assignee Column */}
                <th 
                  onClick={() => handleSort('owner')}
                  className="py-3 px-3.5 w-36 cursor-pointer hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>ASSIGNEE</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* Due Date Column */}
                <th 
                  onClick={() => handleSort('deadline')}
                  className="py-3 px-3.5 w-36 cursor-pointer hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>DUE DATE</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* Status Column */}
                <th className="py-3 px-3 w-28 text-center">
                  <span>STATUS</span>
                </th>

                {/* Before / After Photos Column */}
                <th className="py-3 px-3 w-32 text-center">
                  <span>BEFORE / AFTER PHOTOS</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedActions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                    No matching action items found.
                  </td>
                </tr>
              ) : (
                paginatedActions.map((item) => {
                  const isDueToday = item.deadline === TODAY_STR && item.status !== 'Completed';
                  const isOverdue = item.deadline < TODAY_STR && item.status !== 'Completed';

                  return (
                    <tr 
                      key={item.id}
                      onClick={() => onOpenDetail(item)}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                    >
                      {/* ID */}
                      <td className="py-3.5 px-3.5 font-mono text-xs font-bold text-slate-800">
                        #{item.id}
                      </td>

                      {/* PRI */}
                      <td className="py-3.5 px-2.5 text-center">
                        <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          item.priority === 'A'
                            ? 'bg-red-50 text-red-600 border border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {item.priority}
                        </span>
                      </td>

                      {/* DEPT */}
                      <td className="py-3.5 px-3.5 text-xs font-semibold text-slate-700">
                        <div className="font-semibold text-slate-800">{item.dept}</div>
                        {item.originatorDept && isRaisedToOtherDept(item.originatorDept, item.dept) && (
                          <div 
                            className="text-[10px] text-purple-700 font-medium flex items-center gap-1 mt-0.5" 
                            title={`Inter-Departmental Task: Raised by ${item.originatorDept} to ${item.dept}`}
                          >
                            <span className="text-slate-400 font-normal">from</span>
                            <span className="bg-purple-50 border border-purple-200 px-1 py-0.2 rounded font-bold text-purple-800">
                              {item.originatorDept}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 5W1H DESCRIPTION & ABNORMALITY */}
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-medium text-slate-900 leading-relaxed group-hover:text-blue-950">
                          {item.desc}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          {item.recurrence !== 'One-Time' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                              <RefreshCw className="w-2.5 h-2.5" />
                              <span>{item.recurrence}</span>
                            </span>
                          )}
                          {item.machineNote && (
                            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                              <span className="font-semibold text-slate-400">M/C:</span>
                              <span>{item.machineNote}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* ASSIGNEE */}
                      <td className="py-3.5 px-3.5 text-xs font-medium text-slate-700 whitespace-nowrap">
                        {item.owner}
                      </td>

                      {/* DUE DATE */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        {isDueToday ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                            <span>{item.deadline} DUE</span>
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            <span>{item.deadline}</span>
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-slate-600">
                            {item.deadline}
                          </span>
                        )}
                      </td>

                      {/* STATUS */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded-full ${
                          item.status === 'Completed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : item.status === 'In process'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : item.status === 'Under Verification'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {item.status}
                        </span>
                      </td>

                      {/* BEFORE / AFTER PHOTOS */}
                      <td 
                        className="py-3.5 px-3 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDetail(item);
                        }}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          {/* [ B ] Before Box */}
                          <div 
                            className={`w-7 h-7 rounded-lg border flex items-center justify-center text-xs font-bold transition-all ${
                              item.attachedPhoto
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-2xs'
                                : 'border-dashed border-slate-300 hover:border-blue-400 bg-slate-50/80 hover:bg-blue-50/50 text-slate-400 hover:text-blue-600'
                            }`}
                            title={item.attachedPhoto ? 'Before photo attached' : 'Attach Before photo'}
                          >
                            B
                          </div>

                          {/* [ A ] After Box */}
                          <div 
                            className={`w-7 h-7 rounded-lg border flex items-center justify-center text-xs font-bold transition-all ${
                              item.afterPhoto
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-2xs'
                                : 'border-dashed border-slate-300 hover:border-blue-400 bg-slate-50/80 hover:bg-blue-50/50 text-slate-400 hover:text-blue-600'
                            }`}
                            title={item.afterPhoto ? 'After photo attached' : 'Attach After photo'}
                          >
                            A
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-50/80 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={actions.length}>All ({actions.length})</option>
            </select>
            <span className="text-slate-400">|</span>
            <span>
              Showing {Math.min(filteredActions.length, (currentPage - 1) * pageSize + 1)}–
              {Math.min(filteredActions.length, currentPage * pageSize)} of {filteredActions.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-semibold text-slate-700 px-1">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
