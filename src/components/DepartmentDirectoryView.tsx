import React, { useState, useMemo } from 'react';
import { SAMARTH_ORG_STRUCTURE, MENTOR_NAME } from '../data/orgStructure';
import { getTodayStr, isoToLocalDateStr } from '../data/sentinelDataLoader';
import { ActionItem } from '../types';
import {
  Building2,
  Users,
  Search,
  BarChart3,
  Layers,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Award,
  ChevronDown,
  Lock
} from 'lucide-react';

interface DepartmentDirectoryViewProps {
  actions: ActionItem[];
  onSelectDepartment: (deptName: string) => void;
  lockedDepts?: string[] | null;
  supervisors?: { name: string; dept: string }[];
}

type ViewTab = 'graphical' | 'split' | 'roster';

export const DepartmentDirectoryView: React.FC<DepartmentDirectoryViewProps> = ({
  actions,
  onSelectDepartment,
  lockedDepts = null,
  supervisors = []
}) => {
  const [activeViewTab, setActiveViewTab] = useState<ViewTab>('graphical');
  const [searchQuery, setSearchQuery] = useState('');
  // One person can head several departments — a single dept stays a hard,
  // non-interactive lock; more than one becomes a dropdown constrained to
  // just their own departments.
  const isSingleDept = (lockedDepts?.length ?? 0) === 1;
  const [selectedVelocityDept, setSelectedVelocityDept] = useState(
    isSingleDept ? lockedDepts![0] : 'All Departments (Plant-wide)'
  );

  const todayStr = getTodayStr();

  // Department statistics
  const deptStats = useMemo(() => {
    const stats: Record<string, { total: number; completed: number; pending: number; inProcess: number; overdue: number; priorityA: number }> = {};

    actions.forEach(a => {
      const d = a.dept || 'General';
      if (!stats[d]) {
        stats[d] = { total: 0, completed: 0, pending: 0, inProcess: 0, overdue: 0, priorityA: 0 };
      }
      stats[d].total += 1;
      if (a.status === 'Completed') {
        stats[d].completed += 1;
      } else if (a.status === 'In process' || a.status === 'Under Verification') {
        stats[d].inProcess += 1;
      } else {
        stats[d].pending += 1;
      }

      if (a.priority === 'A') {
        stats[d].priorityA += 1;
      }

      if (a.status !== 'Completed' && a.deadline < todayStr) {
        stats[d].overdue += 1;
      }
    });

    return stats;
  }, [actions, todayStr]);

  // Operational departments (excluding MD since MD doesn't attract tasks)
  const departmentsList = useMemo(() => {
    // Static org structure plus supervisors added at runtime through
    // Manage Supervisors, so the roster never lags behind the Assignee list.
    return SAMARTH_ORG_STRUCTURE.filter(d => d.deptName !== 'MD').map(d => ({
      ...d,
      supervisors: Array.from(new Set([
        ...d.supervisors,
        ...supervisors.filter(s => s.dept === d.deptName).map(s => s.name)
      ]))
    }));
  }, [supervisors]);

  // Filtered departments based on search
  const filteredDepartments = useMemo(() => {
    if (!searchQuery.trim()) return departmentsList;
    const q = searchQuery.toLowerCase();
    return departmentsList.filter(d => 
      d.deptName.toLowerCase().includes(q) ||
      d.deptHead.toLowerCase().includes(q) ||
      d.supervisors.some(s => s.toLowerCase().includes(q))
    );
  }, [departmentsList, searchQuery]);

  // Filter actions for Velocity section
  const velocityActions = useMemo(() => {
    if (selectedVelocityDept === 'All Departments (Plant-wide)') {
      return actions;
    }
    return actions.filter(a => (a.dept || 'General').toLowerCase() === selectedVelocityDept.toLowerCase());
  }, [actions, selectedVelocityDept]);

  // Real trailing-4-week velocity: four consecutive 7-day windows ending today.
  // "Generated" = tasks created in the window (createdAt timestamp); "Closed" =
  // Completed tasks whose last update fell in the window (closedAt — there is
  // no dedicated completion column, so last-update-while-Completed is the
  // closest available signal).
  const weeklyVelocity = useMemo(() => {
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dayStr = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const weeks = [3, 2, 1, 0].map(back => {
      const end = new Date(today);
      end.setDate(end.getDate() - back * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      return {
        week: `${back === 0 ? 'This Wk' : `W-${back}`} (${fmt(start)} - ${fmt(end)})`,
        start: dayStr(start),
        end: dayStr(end),
        generated: 0,
        closed: 0
      };
    });
    const bucket = (dateStr: string) => weeks.find(w => dateStr >= w.start && dateStr <= w.end);
    velocityActions.forEach(a => {
      const created = bucket(isoToLocalDateStr(a.timestamp));
      if (created) created.generated += 1;
      if (a.status === 'Completed') {
        const closed = bucket(isoToLocalDateStr(a.closedAt));
        if (closed) closed.closed += 1;
      }
    });
    return weeks;
  }, [velocityActions, todayStr]);

  const totalVelocityTasks = weeklyVelocity.reduce((n, w) => n + w.generated, 0);
  const closedVelocityTasks = weeklyVelocity.reduce((n, w) => n + w.closed, 0);
  const closureVelocityPercent = totalVelocityTasks > 0
    ? ((closedVelocityTasks / totalVelocityTasks) * 100).toFixed(1)
    : '0.0';
  const netVelocityBalance = closedVelocityTasks - totalVelocityTasks;

  // Leadership compliance ranking benchmarked against 80% target
  const complianceRanking = useMemo(() => {
    return departmentsList.map(dept => {
      const stats = deptStats[dept.deptName] || { total: 0, completed: 0, overdue: 0 };
      const rate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
      return {
        ...dept,
        stats,
        rate
      };
    }).sort((a, b) => b.rate - a.rate);
  }, [departmentsList, deptStats]);

  const maxWeeklyVal = Math.max(...weeklyVelocity.flatMap(w => [w.generated, w.closed]), 1);

  return (
    <div className="space-y-5">
      {/* Header Banner matching Screenshot 3 */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-2xs">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900 leading-snug">
                Department Leadership Scorecards & Graphical Roster
              </h2>
              <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
                {departmentsList.length} Departments Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Visual compliance analytics, workload breakdown charts, and supervisor accountability metrics
            </p>
          </div>
        </div>

        {/* Search, View Switches, and Links Modal Button */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Locked Notice Indicator */}
          {lockedDepts && (
            <div className="px-3 py-1.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 font-bold flex items-center gap-1.5 shadow-2xs">
              <Lock className="w-3.5 h-3.5 text-amber-700" />
              <span>Assigned Dept{lockedDepts.length > 1 ? 's' : ''}: {lockedDepts.join(', ')} (Locked)</span>
            </div>
          )}

          {/* Search bar */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leader or department..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-blue-500 transition-colors"
            />
          </div>

          {/* View Mode Toggle matching Screenshot 3 */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveViewTab('graphical')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeViewTab === 'graphical'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Graphical Analysis
            </button>
            <button
              onClick={() => setActiveViewTab('split')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeViewTab === 'split'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Split View
            </button>
            <button
              onClick={() => setActiveViewTab('roster')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeViewTab === 'roster'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Card Roster
            </button>
          </div>

        </div>
      </div>

      {/* SECTION 1: Plant-wide Velocity Chart (matching Screenshot 3) */}
      {(activeViewTab === 'graphical' || activeViewTab === 'split') && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-5">
          {/* Header Row with Department Dropdown */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span>Plant-wide Velocity: New Tasks Generated vs Closed (Last 4 Weeks)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Incoming abnormalities compared with shopfloor verified closures
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Department:</span>
              {isSingleDept ? (
                <div className="py-1 px-3 bg-amber-50 border border-amber-300 rounded-lg text-xs font-bold text-amber-950 flex items-center gap-1 shadow-2xs">
                  <Lock className="w-3 h-3 text-amber-700" />
                  <span>{lockedDepts![0]} (Locked)</span>
                </div>
              ) : (
                <select
                  value={selectedVelocityDept}
                  onChange={(e) => setSelectedVelocityDept(e.target.value)}
                  className="py-1.5 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 shadow-2xs"
                >
                  <option value="All Departments (Plant-wide)">
                    {lockedDepts ? 'All My Departments' : 'All Departments (Plant-wide)'}
                  </option>
                  {(lockedDepts ? departmentsList.filter(d => lockedDepts.includes(d.deptName)) : departmentsList).map(d => (
                    <option key={d.deptName} value={d.deptName}>{d.deptName}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* 4 Metric Cards in a row matching Screenshot 3 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {/* NEW TASKS GENERATED */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                NEW TASKS GENERATED
              </div>
              <div className="text-2xl font-bold text-blue-600 mt-1">
                {totalVelocityTasks}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Last 4 weeks
              </div>
            </div>

            {/* TASKS CLOSED */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                TASKS CLOSED
              </div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {closedVelocityTasks}
              </div>
              <div className="text-[11px] text-emerald-600 mt-0.5 font-medium">
                Verified on shopfloor
              </div>
            </div>

            {/* CLOSURE VELOCITY */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                CLOSURE VELOCITY
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {closureVelocityPercent}%
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Closed / Generated ratio
              </div>
            </div>

            {/* NET VELOCITY BALANCE */}
            <div className="bg-amber-50/20 border border-amber-300 rounded-xl p-3.5 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                NET VELOCITY BALANCE
              </div>
              <div className="text-2xl font-bold text-amber-600 mt-1">
                {netVelocityBalance}
              </div>
              <div className="text-[11px] text-amber-700 mt-0.5 font-medium">
                {netVelocityBalance < 0 ? 'Backlog increasing' : netVelocityBalance > 0 ? 'Backlog shrinking' : 'Backlog steady'}
              </div>
            </div>
          </div>

          {/* Velocity Grouped Bar Chart matching Screenshot 3 */}
          <div className="pt-2">
            <div className="h-60 flex items-end justify-between gap-4 sm:gap-8 px-4 sm:px-8 border-b border-slate-200 pb-2">
              {weeklyVelocity.map((w, idx) => {
                const closedHeight = w.closed > 0 ? Math.max(Math.round((w.closed / maxWeeklyVal) * 190), 12) : 2;
                const genHeight = w.generated > 0 ? Math.max(Math.round((w.generated / maxWeeklyVal) * 190), 16) : 2;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <div className="w-full flex items-end justify-center gap-2 max-w-[120px]">
                      {/* Closed Bar (Green) */}
                      <div className="w-full flex flex-col items-center">
                        <span className="text-[10px] font-bold text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity mb-1 font-mono">
                          {w.closed}
                        </span>
                        <div 
                          style={{ height: `${closedHeight}px` }} 
                          className="w-full max-w-[40px] bg-emerald-500 hover:bg-emerald-600 rounded-t-lg transition-all shadow-xs"
                          title={`Closed: ${w.closed}`}
                        />
                      </div>

                      {/* Generated Bar (Blue) */}
                      <div className="w-full flex flex-col items-center">
                        <span className="text-[10px] font-bold text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity mb-1 font-mono">
                          {w.generated}
                        </span>
                        <div 
                          style={{ height: `${genHeight}px` }} 
                          className="w-full max-w-[40px] bg-blue-500 hover:bg-blue-600 rounded-t-lg transition-all shadow-xs"
                          title={`Generated: ${w.generated}`}
                        />
                      </div>
                    </div>
                    {/* X-axis Label */}
                    <span className="text-[11px] font-semibold text-slate-600 text-center whitespace-nowrap">
                      {w.week}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Legend matching Screenshot 3 */}
            <div className="flex items-center justify-center gap-6 pt-3 text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-emerald-500"></span>
                <span>Tasks Closed</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-blue-500"></span>
                <span>New Tasks Generated</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: Two Columns Grid (Compliance Ranking vs Workload Breakdown) */}
      {(activeViewTab === 'graphical' || activeViewTab === 'split') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left Column: Department Leadership Compliance Ranking (%) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-600" />
                  <span>Department Leadership Compliance Ranking (%)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Leader task completion rate benchmarked against 80% target
                </p>
              </div>
              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                Target: 80%
              </span>
            </div>

            <div className="space-y-3 pt-2 max-h-[480px] overflow-y-auto pr-1">
              {complianceRanking.map((dept, idx) => {
                const meetsTarget = dept.rate >= 80;
                const isLocked = !!lockedDepts && !lockedDepts.includes(dept.deptName);
                return (
                  <div
                    key={dept.deptName}
                    onClick={isLocked ? undefined : () => onSelectDepartment(dept.deptName)}
                    title={isLocked ? `Access restricted. You are locked to: ${lockedDepts!.join(', ')}.` : undefined}
                    className={`p-3 bg-slate-50 border border-slate-200/80 rounded-xl transition-all space-y-2 group ${
                      isLocked ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-50/50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-mono font-bold flex items-center justify-center">
                          #{idx + 1}
                        </span>
                        <div>
                          <span className={`font-bold text-xs text-slate-900 transition-colors ${isLocked ? '' : 'group-hover:text-blue-600'}`}>
                            {dept.deptName}
                          </span>
                          <span className="text-[11px] text-slate-500 ml-2">
                            (HOD: {dept.deptHead})
                          </span>
                          {isLocked && <Lock className="w-3 h-3 text-slate-400 inline-block ml-1.5 align-text-top" />}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold font-mono ${
                          meetsTarget ? 'text-emerald-700' : 'text-slate-700'
                        }`}>
                          {dept.rate}%
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ({dept.stats.completed}/{dept.stats.total})
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      {/* 80% target marker */}
                      <div className="absolute left-[80%] top-0 bottom-0 w-0.5 bg-slate-400 z-10"></div>
                      <div 
                        style={{ width: `${Math.min(dept.rate, 100)}%` }}
                        className={`h-full rounded-full transition-all ${
                          meetsTarget ? 'bg-emerald-500' : dept.rate > 50 ? 'bg-blue-500' : 'bg-amber-500'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Department Roster Workload Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Department Roster Workload Breakdown</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Distribution of Closed, Under Verification, Active, and Overdue tasks
                </p>
              </div>
              <span className="bg-slate-100 text-slate-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-slate-200">
                {actions.length} Total Tasks
              </span>
            </div>

            <div className="space-y-3 pt-2 max-h-[480px] overflow-y-auto pr-1">
              {filteredDepartments.map((dept) => {
                const stats = deptStats[dept.deptName] || { total: 0, completed: 0, inProcess: 0, pending: 0, overdue: 0 };
                const isLocked = !!lockedDepts && !lockedDepts.includes(dept.deptName);
                return (
                  <div
                    key={dept.deptName}
                    onClick={isLocked ? undefined : () => onSelectDepartment(dept.deptName)}
                    title={isLocked ? `Access restricted. You are locked to: ${lockedDepts!.join(', ')}.` : undefined}
                    className={`p-3.5 bg-white border border-slate-200 rounded-xl transition-all shadow-2xs space-y-2 group ${
                      isLocked ? 'opacity-60 cursor-not-allowed' : 'hover:border-blue-300 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className={`font-bold text-xs text-slate-900 transition-colors flex items-center gap-1.5 ${isLocked ? '' : 'group-hover:text-blue-600'}`}>
                          {dept.deptName}
                          {isLocked && <Lock className="w-3 h-3 text-slate-400" />}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Lead: <strong className="text-slate-700">{dept.deptHead}</strong>
                          {dept.supervisors.length > 0 && ` • ${dept.supervisors.length} Supervisors`}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-900 font-mono">
                          {stats.total} Tasks
                        </span>
                      </div>
                    </div>

                    {/* Breakdown Badges */}
                    <div className="flex items-center gap-2 text-[11px] flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                        {stats.completed} Closed
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium border border-blue-200">
                        {stats.inProcess} Active
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-medium border border-amber-200">
                        {stats.pending} Pending
                      </span>
                      {stats.overdue > 0 && (
                        <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-bold border border-red-200">
                          {stats.overdue} Overdue
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: Card Roster Mode (when Card Roster or Split is toggled) */}
      {(activeViewTab === 'roster' || activeViewTab === 'split') && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Complete {departmentsList.length}-Department Organizational Cards & Supervisory Roster
            </h3>
            <span className="text-xs text-slate-500">
              Mentor: <strong>{MENTOR_NAME}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDepartments.map((dept) => {
              const stats = deptStats[dept.deptName] || { total: 0, completed: 0, priorityA: 0, overdue: 0 };
              const compPercent = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

              return (
                <div 
                  key={dept.deptName}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-mono font-bold text-slate-400">
                          DEPT #{dept.srNo}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                          {dept.deptName}
                        </h4>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {compPercent}% Done
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                      <div className="text-[11px] text-slate-500 font-medium">Department Head:</div>
                      <div className="font-bold text-slate-800 text-xs mt-0.5">
                        {dept.deptHead}
                      </div>
                    </div>

                    {dept.supervisors.length > 0 && (
                      <div className="text-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Supervisory Staff:
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {dept.supervisors.map((s, idx) => (
                            <span 
                              key={idx}
                              className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-xs">
                    <div className="text-slate-500 text-[11px]">
                      <strong>{stats.total}</strong> Tasks • <strong>{stats.completed}</strong> Closed
                    </div>
                    {lockedDepts && !lockedDepts.includes(dept.deptName) ? (
                      <span
                        className="text-slate-400 font-medium flex items-center gap-1 text-[11px] cursor-not-allowed select-none"
                        title={`Access restricted. You are locked to: ${lockedDepts.join(', ')}.`}
                      >
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span>Locked</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => onSelectDepartment(dept.deptName)}
                        className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 text-xs"
                      >
                        <span>{lockedDepts?.includes(dept.deptName) ? `View ${dept.deptName} Tasks` : 'View Tasks'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
