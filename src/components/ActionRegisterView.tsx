import React, { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { 
  ActionItem, 
  FilterState, 
  ActionStatus 
} from '../types';
import { isRaisedToOtherDept, getTodayStr, isoToLocalDateStr } from '../data/sentinelDataLoader';
import { TASK_DEPARTMENTS, combineAllAssignees } from '../data/orgStructure';
import { Supervisor } from '../utils/dataService';
import {
  Search,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
  ArrowUpDown,
  Plus,
  RefreshCw,
  CheckCircle2,
  Check,
  ChevronDown,
  Lock,
  SlidersHorizontal
} from 'lucide-react';

// Whole days from `fromStr` to `toStr` (both 'YYYY-MM-DD'); negative when `toStr` is earlier.
function daysBetween(fromStr: string, toStr: string): number {
  const [fy, fm, fd] = fromStr.split('-').map(Number);
  const [ty, tm, td] = toStr.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 'YYYY-MM-DD' -> '30 Sep' (falls back to the raw text if unparseable).
function shortDate(dateStr: string): string {
  const [y, m, d] = (dateStr || '').split('-').map(Number);
  if (!y || !m || !d) return dateStr || '—';
  return `${d} ${MONTHS[m - 1]}`;
}

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

// Task types (Customer Complaint, Customer MOM, Broadcast, Recurring, Kaizen)
// have their own main tabs, so these pills are status/urgency filters that
// work the same inside every tab.
type QuickFilter = 'all' | 'priority_a' | 'due_overdue' | 'verification' | 'pending' | 'closed';

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
  const [activeQuickFilter, setActiveQuickFilter] = useState<QuickFilter>('all');
  // Department-scoped users: narrow their list to the tasks shared with one
  // other department (raised to it, or received from it).
  const [relatedDept, setRelatedDept] = useState('');
  // Two separate department choices:
  //  • the header picker (next to Refresh) sets filters.dept — the department
  //    being reviewed, shared by every screen;
  //  • inside the register, "With <dept>" narrows to tasks between that
  //    department and one other, and never changes the header.
  // With no header department, the register's own department box is a local
  // filter that also leaves the header alone.
  const [localDept, setLocalDept] = useState('');
  const scopeDept = filters.dept;
  const ownDept = scopeDept || localDept || (lockedDepts?.length === 1 ? lockedDepts[0] : '');
  // A "With" choice equal to the department now being reviewed would hide everything.
  useEffect(() => {
    if (relatedDept && relatedDept === ownDept) setRelatedDept('');
  }, [ownDept, relatedDept]);
  // Phone only: department / assignee / status filters fold behind a button.
  const [showFilters, setShowFilters] = useState(false);

  // Frozen panes: the table scrolls inside a box that fills the rest of the
  // screen, so its heading row and the ID / PRI / DEPT columns stay in view.
  const tableBoxRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [tableMaxH, setTableMaxH] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const fit = () => {
      const el = tableBoxRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const footer = footerRef.current?.offsetHeight ?? 52; // pagination bar; wraps to two lines on phones
      setTableMaxH(Math.max(200, window.innerHeight - top - footer - 12));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
    // The "With" box appearing adds a filter row on phones, moving the table down.
  }, [showFilters, !!(ownDept || lockedDepts)]);

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
      if (relatedDept && item.dept !== relatedDept && item.originatorDept !== relatedDept) return false;

      // Quick filter
      if (activeQuickFilter === 'priority_a' && item.priority !== 'A') return false;
      if (activeQuickFilter === 'due_overdue') {
        const isDueOrOverdue = (item.deadline <= TODAY_STR) && item.status !== 'Completed';
        if (!isDueOrOverdue) return false;
      }
      if (activeQuickFilter === 'verification' && item.status !== 'Under Verification') return false;
      if (activeQuickFilter === 'pending' && item.status !== 'Pending') return false;
      if (activeQuickFilter === 'closed' && item.status !== 'Completed') return false;

      // Search
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const matchesDesc = item.desc.toLowerCase().includes(query);
        const matchesOwner = item.owner.toLowerCase().includes(query);
        const matchesDept = item.dept.toLowerCase().includes(query);
        const matchesNotes = (item.actionNotes?.toLowerCase().includes(query)) || (item.machineNote?.toLowerCase().includes(query)) || false;
        const matchesId = item.id.toLowerCase().includes(query) || `#${item.id}`.toLowerCase().includes(query);
        if (!matchesDesc && !matchesOwner && !matchesDept && !matchesNotes && !matchesId) {
          return false;
        }
      }

      // Department (header choice, else the register's own box)
      const deptFilter = scopeDept || localDept;
      if (deptFilter) {
        // If this item is an inter-departmental task, match if selected dept is either target OR originator
        if (item.originatorDept && isRaisedToOtherDept(item.originatorDept, item.dept)) {
          if (item.dept !== deptFilter && item.originatorDept !== deptFilter) {
            return false;
          }
        } else if (item.dept !== deptFilter) {
          return false;
        }
      }

      // Owner dropdown
      if (filters.owner && item.owner !== filters.owner) {
        return false;
      }

      return true;
    });
  }, [actions, filters, activeQuickFilter, TODAY_STR, relatedDept, scopeDept, localDept]);

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
    <div className="space-y-2 sm:space-y-4">
      {/* Search & Filters Card matching image.png */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Row 1 (blue strip): Search Bar + Department Dropdown + Assignee Dropdown + Create Task */}
        <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-2 bg-[#E6F1FB] border-b border-[#B5D4F4] border-l-4 border-l-[#185FA5]">
          {/* Main Search Input */}
          <div className="relative flex-1 min-w-0 sm:min-w-[280px]">
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

          {/* Phone: one button opens department / assignee / status filters */}
          <button
            type="button"
            onClick={() => setShowFilters(v => !v)}
            className={`sm:hidden shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border ${
              showFilters || activeQuickFilter !== 'all' || localDept || relatedDept || filters.owner
                ? 'bg-[#0C447C] text-white border-[#0C447C]'
                : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>

          <div className={`${showFilters ? 'grid' : 'hidden'} w-full grid-cols-2 gap-2 sm:contents`}>
          {/* Department Select Dropdown / Locked State */}
          <div className="relative min-w-0 sm:min-w-[150px]">
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
            ) : scopeDept ? (
              <div
                className="w-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold py-2 px-3 rounded-xl truncate"
                title="Department chosen at the top, next to Refresh"
              >
                Dept: {scopeDept}
              </div>
            ) : (
              <>
                <select
                  value={localDept}
                  onChange={(e) => {
                    setLocalDept(e.target.value);
                    if (e.target.value === relatedDept) setRelatedDept('');
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

          {/* Related department: tasks between the chosen department and one other */}
          {(ownDept || lockedDepts) && (
            <div className="relative min-w-0 sm:min-w-[170px]">
              <select
                value={relatedDept}
                onChange={(e) => {
                  setRelatedDept(e.target.value);
                  setCurrentPage(1);
                }}
                title="Show only tasks shared with this department (raised to it or by it)"
                className={`w-full appearance-none border hover:border-slate-300 text-xs font-medium py-2 pl-3 pr-8 rounded-xl outline-none focus:border-blue-500 transition-colors cursor-pointer shadow-2xs ${
                  relatedDept ? 'bg-purple-50 border-purple-300 text-purple-800' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <option value="">With any department</option>
                {TASK_DEPARTMENTS.filter(d => d !== ownDept && !(lockedDepts && !ownDept && lockedDepts.includes(d))).map(d => (
                  <option key={d} value={d}>With {d}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* Assignees Select Dropdown matching "All Assignees (29)" */}
          <div className={`relative min-w-0 sm:min-w-[160px] ${ownDept || lockedDepts ? 'col-span-2' : ''}`}>
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

          </div>

          {/* Create Task Button matching image.png */}
          <button
            onClick={onOpenNewModal}
            className="hidden sm:flex bg-[#1d64ec] hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs px-4 py-2 rounded-xl items-center gap-1.5 shadow-sm transition-all whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Create Task</span>
          </button>
        </div>

        {/* Row 2 (violet strip): Filter Pills */}
        <div className={`${showFilters ? 'flex' : 'hidden'} sm:flex items-center gap-2 overflow-x-auto scrollbar-none px-3 sm:px-4 py-1.5 bg-[#EEEDFE] border-l-4 border-l-[#7F77DD]`}>

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

          {/* Pending */}
          <button
            onClick={() => {
              setActiveQuickFilter(activeQuickFilter === 'pending' ? 'all' : 'pending');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all ${
              activeQuickFilter === 'pending'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Clock className="w-3 h-3 text-amber-500" />
            <span>Pending</span>
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

          <span
            className="ml-auto pl-3 text-[11px] font-semibold text-[#04342C] whitespace-nowrap"
            title="Due tasks blink • Click a row to attach Before/After photos or convert to Kaizen"
          >
            Showing {filteredActions.length} of {actions.length}
          </span>
        </div>
      </div>

      {/* Main Table Card matching image.png */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div ref={tableBoxRef} className="overflow-auto" style={{ maxHeight: tableMaxH }}>
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-[#0C447C] text-[11px] font-bold uppercase tracking-wider text-[#E6F1FB] select-none">
                {/* ID Column */}
                <th
                  onClick={() => handleSort('id')}
                  className="sticky top-0 left-0 z-30 bg-[#0C447C] py-2.5 w-[68px] min-w-[68px] max-w-[68px] px-2 sm:w-24 sm:min-w-24 sm:max-w-24 sm:px-3 cursor-pointer hover:bg-[#185FA5] transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>ID</span>
                    <ArrowUpDown className="w-3 h-3 text-blue-200" />
                  </div>
                </th>

                {/* Priority Column */}
                <th className="sticky top-0 sm:left-24 z-20 sm:z-30 bg-[#0C447C] py-2.5 w-9 min-w-9 max-w-9 px-1 sm:w-12 sm:min-w-12 sm:max-w-12 sm:px-2 text-center">
                  <span>PRI</span>
                </th>

                {/* Department Column */}
                <th 
                  onClick={() => handleSort('dept')}
                  className="sticky top-0 sm:left-36 z-20 sm:z-30 bg-[#0C447C] sm:shadow-[2px_0_0_#185FA5] py-2.5 w-24 min-w-24 max-w-24 px-2 sm:w-32 sm:min-w-32 sm:max-w-32 sm:px-3 cursor-pointer hover:bg-[#185FA5] transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>DEPT</span>
                    <ArrowUpDown className="w-3 h-3 text-blue-200" />
                  </div>
                </th>

                {/* Description Column */}
                <th className="sticky top-0 z-20 bg-[#0C447C] py-2.5 px-3 sm:px-4 min-w-[220px] sm:min-w-[340px]">
                  <span>5W1H DESCRIPTION & ABNORMALITY</span>
                </th>

                {/* Assignee Column */}
                <th 
                  onClick={() => handleSort('owner')}
                  className="sticky top-0 z-20 bg-[#0C447C] py-2.5 px-3.5 w-36 cursor-pointer hover:bg-[#185FA5] transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>ASSIGNEE</span>
                    <ArrowUpDown className="w-3 h-3 text-blue-200" />
                  </div>
                </th>

                {/* Create Date Column */}
                <th
                  onClick={() => handleSort('timestamp')}
                  className="sticky top-0 z-20 bg-[#0C447C] py-2.5 px-3.5 w-32 cursor-pointer hover:bg-[#185FA5] transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>CREATE DATE</span>
                    <ArrowUpDown className="w-3 h-3 text-blue-200" />
                  </div>
                </th>

                {/* Due Date Column */}
                <th
                  onClick={() => handleSort('deadline')}
                  className="sticky top-0 z-20 bg-[#0C447C] py-2.5 px-3.5 w-36 cursor-pointer hover:bg-[#185FA5] transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>DUE DATE</span>
                    <ArrowUpDown className="w-3 h-3 text-blue-200" />
                  </div>
                </th>

                {/* Status Column */}
                <th className="sticky top-0 z-20 bg-[#0C447C] py-2.5 px-3 w-28 text-center">
                  <span>STATUS</span>
                </th>

                {/* Before / After Photos Column */}
                <th className="sticky top-0 z-20 bg-[#0C447C] py-2.5 px-3 w-32 text-center">
                  <span title="Before / After photos">B / A PHOTOS</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {paginatedActions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-sm">
                    No matching action items found.
                  </td>
                </tr>
              ) : (
                paginatedActions.map((item, rowIdx) => {
                  const isDone = item.status === 'Completed';
                  const daysLeft = item.deadline ? daysBetween(TODAY_STR, item.deadline) : null;
                  const isOverdue = !isDone && daysLeft !== null && daysLeft < 0;
                  const isDueToday = !isDone && daysLeft === 0;
                  const isDueSoon = !isDone && daysLeft !== null && daysLeft > 0 && daysLeft <= 3;
                  // Left edge colour: red overdue, amber due within 3 days, green completed, grey otherwise.
                  const edgeClass = isDone
                    ? 'shadow-[inset_3px_0_0_#639922]'
                    : isOverdue
                    ? 'shadow-[inset_3px_0_0_#E24B4A]'
                    : isDueToday || isDueSoon
                    ? 'shadow-[inset_3px_0_0_#EF9F27]'
                    : 'shadow-[inset_3px_0_0_#B4B2A9]';

                  // Frozen cells need a solid background so scrolled cells don't show through.
                  const rowBg = rowIdx % 2 === 1 ? 'bg-slate-50' : 'bg-white';
                  const frozen = `z-10 ${rowBg} group-hover:bg-[#F2F7FD]`;
                  return (
                    <tr 
                      key={item.id}
                      onClick={() => onOpenDetail(item)}
                      className={`${rowBg} hover:bg-[#F2F7FD] [&>td]:border-b [&>td]:border-slate-100 cursor-pointer transition-colors group`}
                    >
                      {/* ID */}
                      <td className={`${frozen} sticky left-0 ${edgeClass} py-2.5 w-[68px] min-w-[68px] max-w-[68px] px-2 sm:w-24 sm:min-w-24 sm:max-w-24 sm:px-3 font-mono text-xs font-bold text-blue-700 whitespace-nowrap`}>
                        {item.id}
                      </td>

                      {/* PRI */}
                      <td className={`${frozen} sm:sticky sm:left-24 py-2.5 w-9 min-w-9 max-w-9 px-1 sm:w-12 sm:min-w-12 sm:max-w-12 sm:px-2 text-center`}>
                        <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          item.priority === 'A'
                            ? 'bg-red-700 text-white border border-red-700'
                            : 'bg-white text-blue-700 border border-blue-400'
                        }`}>
                          {item.priority}
                        </span>
                      </td>

                      {/* DEPT */}
                      <td className={`${frozen} sm:sticky sm:left-36 sm:shadow-[2px_0_0_#E2E8F0] py-2.5 w-24 min-w-24 max-w-24 px-2 sm:w-32 sm:min-w-32 sm:max-w-32 sm:px-3 text-xs font-semibold text-slate-700`}>
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
                      <td className="py-2.5 px-3 sm:px-4 text-xs">
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
                      <td className="py-2.5 px-2.5 sm:px-3.5 text-xs font-medium text-slate-700 whitespace-nowrap">
                        {item.owner}
                      </td>

                      {/* CREATE DATE */}
                      <td className="py-2.5 px-2.5 sm:px-3.5 whitespace-nowrap font-mono text-xs text-slate-600">
                        {shortDate(isoToLocalDateStr(item.timestamp))}
                      </td>

                      {/* DUE DATE */}
                      <td className="py-2.5 px-2.5 sm:px-3.5 whitespace-nowrap">
                        {isOverdue ? (
                          <div className="text-xs font-bold text-red-700 leading-tight">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
                              {shortDate(item.deadline)}
                            </div>
                            <div className="text-[10px] font-semibold animate-pulse">{-daysLeft!} {daysLeft === -1 ? 'day' : 'days'} late</div>
                          </div>
                        ) : isDueToday ? (
                          <div className="text-xs font-bold text-amber-700 leading-tight">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              {shortDate(item.deadline)}
                            </div>
                            <div className="text-[10px] font-semibold">Due today</div>
                          </div>
                        ) : isDueSoon ? (
                          <div className="text-xs font-bold text-amber-700 leading-tight">
                            <div>{shortDate(item.deadline)}</div>
                            <div className="text-[10px] font-semibold">in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600">
                            {shortDate(item.deadline)}
                          </span>
                        )}
                      </td>

                      {/* STATUS */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded-full ${
                          item.status === 'Completed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : item.status === 'In process'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : item.status === 'Under Verification'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : item.status === 'Hold'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-300'
                        }`}>
                          {item.status}
                        </span>
                      </td>

                      {/* BEFORE / AFTER PHOTOS */}
                      <td 
                        className="py-2.5 px-3 text-center"
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
                            {item.attachedPhoto ? <Check className="w-3.5 h-3.5" /> : 'B'}
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
                            {item.afterPhoto ? <Check className="w-3.5 h-3.5" /> : 'A'}
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
        <div ref={footerRef} className="px-3 sm:px-6 py-2 bg-slate-50/80 border-t border-slate-200 flex flex-nowrap items-center justify-between gap-2 sm:gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2 min-w-0">
            <span className="hidden sm:inline">Rows per page:</span>
            <select
              aria-label="Rows per page"
              title="Rows per page"
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
              <option value={actions.length}>All</option>
            </select>
            <span className="hidden sm:inline text-slate-400">|</span>
            <span className="whitespace-nowrap truncate min-w-0">
              <span className="hidden sm:inline">Showing </span>{Math.min(filteredActions.length, (currentPage - 1) * pageSize + 1)}–
              {Math.min(filteredActions.length, currentPage * pageSize)} of {filteredActions.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-semibold text-slate-700 px-1 whitespace-nowrap">
              <span className="sm:hidden">{currentPage}/{totalPages}</span>
              <span className="hidden sm:inline">Page {currentPage} of {totalPages}</span>
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
