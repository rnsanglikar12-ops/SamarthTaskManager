import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell
} from 'recharts';
import { ActionItem } from '../types';
import { 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  ShieldAlert, 
  Factory, 
  Users
} from 'lucide-react';

interface AnalyticsViewProps {
  actions: ActionItem[];
  onSelectDept: (dept: string) => void;
  onSelectPriority: (priority: string) => void;
  lockedDept?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  'Completed': '#22c55e',
  'In process': '#f59e0b',
  'Pending': '#64748b',
  'Under Verification': '#38bdf8',
  'Hold': '#ef4444'
};

const PRIORITY_COLORS: Record<string, string> = {
  'A': '#ef4444',
  'B': '#38bdf8'
};

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ 
  actions, 
  onSelectDept, 
  onSelectPriority,
  lockedDept = null
}) => {
  // 1. Department Breakdown (Total vs Completed vs Pending)
  const deptData = useMemo(() => {
    const map: Record<string, { dept: string; total: number; completed: number; pending: number; priorityA: number }> = {};

    actions.forEach(item => {
      const dept = item.dept || 'General';
      if (!map[dept]) {
        map[dept] = { dept, total: 0, completed: 0, pending: 0, priorityA: 0 };
      }
      map[dept].total += 1;
      if (item.status === 'Completed') {
        map[dept].completed += 1;
      } else {
        map[dept].pending += 1;
      }
      if (item.priority === 'A') {
        map[dept].priorityA += 1;
      }
    });

    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10); // Top 10 departments
  }, [actions]);

  // 2. Status Distribution Data
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    actions.forEach(item => {
      counts[item.status] = (counts[item.status] || 0) + 1;
    });

    return Object.entries(counts).map(([name, value]) => ({
      name,
      value
    }));
  }, [actions]);

  // 3. Priority Distribution Data
  const priorityData = useMemo(() => {
    const counts: Record<string, number> = { 'A': 0, 'B': 0 };
    actions.forEach(item => {
      counts[item.priority] = (counts[item.priority] || 0) + 1;
    });

    return [
      { name: 'Priority A (Critical)', key: 'A', value: counts['A'] || 0 },
      { name: 'Priority B (Standard)', key: 'B', value: counts['B'] || 0 }
    ];
  }, [actions]);

  // 4. Top Assignees / Owners Workload
  const ownerData = useMemo(() => {
    const map: Record<string, { owner: string; total: number; completed: number; pending: number }> = {};
    actions.forEach(item => {
      const owner = item.owner || 'Unassigned';
      if (!map[owner]) {
        map[owner] = { owner, total: 0, completed: 0, pending: 0 };
      }
      map[owner].total += 1;
      if (item.status === 'Completed') {
        map[owner].completed += 1;
      } else {
        map[owner].pending += 1;
      }
    });

    return Object.values(map)
      .filter(o => o.owner !== 'Unassigned')
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [actions]);

  const totalActions = actions.length;
  const completedActions = actions.filter(a => a.status === 'Completed').length;
  const priorityACount = actions.filter(a => a.priority === 'A').length;
  const overallRate = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Executive Highlights Ribbon */}
      <div className="bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] rounded-2xl p-6 text-[#f8fafc] border border-[#334155] shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Factory className="w-5 h-5 text-[#38bdf8]" />
              <h2 className="text-xl font-bold font-heading text-[#f8fafc]">
                Operational Control Center
              </h2>
            </div>
            <p className="text-xs text-[#94a3b8] mt-1 max-w-2xl">
              Real-time synchronization across 17 plant departments at Samarth Industries. Monitoring CAPA compliance, IATF 16949 requirements, and Daily Work Management execution.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-[#0f172a] px-4 py-2.5 rounded-xl border border-[#334155]">
            <div className="text-right">
              <span className="text-[10px] text-[#94a3b8] uppercase font-semibold block">Plant Health Index</span>
              <span className="text-2xl font-extrabold font-heading text-[#22c55e]">{overallRate}%</span>
            </div>
            <div className="w-12 h-12 rounded-full border-4 border-[#334155] flex items-center justify-center relative">
              <span className="text-xs font-bold text-[#f8fafc] font-mono">{overallRate}%</span>
            </div>
          </div>
        </div>

        {/* Quick stat cards inside ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-t border-[#334155] pt-4">
          <div>
            <span className="text-[#94a3b8] block">Total Action Items</span>
            <span className="text-lg font-bold text-[#f8fafc] font-mono">{totalActions}</span>
          </div>
          <div>
            <span className="text-[#94a3b8] block">Priority A (High Severity)</span>
            <span className="text-lg font-bold text-[#ef4444] font-mono">{priorityACount} ({Math.round((priorityACount / (totalActions || 1)) * 100)}%)</span>
          </div>
          <div>
            <span className="text-[#94a3b8] block">Active Plant HODs</span>
            <span className="text-lg font-bold text-[#38bdf8] font-mono">17 Departments</span>
          </div>
          <div>
            <span className="text-[#94a3b8] block">Standard Recurrence</span>
            <span className="text-lg font-bold text-[#22c55e] font-mono">Daily / Shift Reviews</span>
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Distribution (2 cols) */}
        <div className="lg:col-span-2 bg-[#1e293b] p-5 rounded-xl border border-[#334155] shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading font-bold text-base text-[#f8fafc] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#38bdf8]" />
                Department-wise Action Volume & Resolution
              </h3>
              <p className="text-xs text-[#94a3b8]">Top departments by action items loaded</p>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={deptData}
                margin={{ top: 10, right: 10, left: -15, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis 
                  dataKey="dept" 
                  angle={-30} 
                  textAnchor="end" 
                  interval={0} 
                  tick={{ fontSize: 11, fill: '#94a3b8' }} 
                />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#f8fafc', fontSize: '12px', border: '1px solid #334155' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar 
                  dataKey="completed" 
                  name="Resolved" 
                  fill="#22c55e" 
                  radius={[4, 4, 0, 0]} 
                  cursor={lockedDept ? "default" : "pointer"}
                  onClick={(entry: any) => {
                    if (lockedDept) return;
                    if (entry && entry.dept) onSelectDept(entry.dept);
                  }}
                />
                <Bar 
                  dataKey="pending" 
                  name="Pending / In-Process" 
                  fill="#64748b" 
                  radius={[4, 4, 0, 0]} 
                  cursor={lockedDept ? "default" : "pointer"}
                  onClick={(entry: any) => {
                    if (lockedDept) return;
                    if (entry && entry.dept) onSelectDept(entry.dept);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Priority Split */}
        <div className="bg-[#1e293b] p-5 rounded-xl border border-[#334155] shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="font-heading font-bold text-base text-[#f8fafc] flex items-center gap-2 mb-1">
              <ShieldAlert className="w-4 h-4 text-[#ef4444]" />
              Priority Classification
            </h3>
            <p className="text-xs text-[#94a3b8] mb-4">Critical Priority A vs Standard Priority B</p>

            <div className="h-52 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    cursor="pointer"
                    onClick={(entry: any) => entry && entry.key && onSelectPriority(entry.key)}
                  >
                    {priorityData.map((entry) => (
                      <Cell 
                        key={`cell-${entry.key}`} 
                        fill={PRIORITY_COLORS[entry.key] || '#38bdf8'} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#f8fafc', fontSize: '12px', border: '1px solid #334155' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-2 border-t border-[#334155] pt-3 text-xs">
            <div 
              onClick={() => onSelectPriority('A')}
              className="flex items-center justify-between p-2 rounded-lg bg-[#ef4444]/10 hover:bg-[#ef4444]/20 border border-[#ef4444]/20 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#ef4444]" />
                <span className="font-semibold text-rose-300">Priority A (Critical)</span>
              </div>
              <span className="font-bold font-mono text-[#ef4444]">
                {priorityData[0]?.value} ({Math.round(((priorityData[0]?.value || 0) / (totalActions || 1)) * 100)}%)
              </span>
            </div>

            <div 
              onClick={() => onSelectPriority('B')}
              className="flex items-center justify-between p-2 rounded-lg bg-[#38bdf8]/10 hover:bg-[#38bdf8]/20 border border-[#38bdf8]/20 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#38bdf8]" />
                <span className="font-semibold text-sky-300">Priority B (Standard)</span>
              </div>
              <span className="font-bold font-mono text-[#38bdf8]">
                {priorityData[1]?.value} ({Math.round(((priorityData[1]?.value || 0) / (totalActions || 1)) * 100)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Second Row: Assignee Workload & Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assignee Accountability Chart */}
        <div className="lg:col-span-2 bg-[#1e293b] p-5 rounded-xl border border-[#334155] shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading font-bold text-base text-[#f8fafc] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#38bdf8]" />
                Key Stakeholders & Assignee Workload
              </h3>
              <p className="text-xs text-[#94a3b8]">Distribution of actions assigned across plant leads</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ownerData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis 
                  dataKey="owner" 
                  type="category" 
                  tick={{ fontSize: 11, fill: '#94a3b8' }} 
                  width={90}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#f8fafc', fontSize: '12px', border: '1px solid #334155' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="completed" name="Completed" stackId="a" fill="#22c55e" />
                <Bar dataKey="pending" name="Open / Pending" stackId="a" fill="#38bdf8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="bg-[#1e293b] p-5 rounded-xl border border-[#334155] shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="font-heading font-bold text-base text-[#f8fafc] flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
              Resolution Status Breakdown
            </h3>
            <p className="text-xs text-[#94a3b8] mb-2">Overall lifecycle of tracked items</p>

            <div className="h-44 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={65}
                    dataKey="value"
                  >
                    {statusData.map((entry) => (
                      <Cell 
                        key={`cell-${entry.name}`} 
                        fill={STATUS_COLORS[entry.name] || '#94a3b8'} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#f8fafc', fontSize: '12px', border: '1px solid #334155' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-1.5 border-t border-[#334155] pt-3 text-xs">
            {statusData.map(s => (
              <div key={s.name} className="flex items-center justify-between text-[#94a3b8]">
                <div className="flex items-center gap-1.5">
                  <span 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ backgroundColor: STATUS_COLORS[s.name] || '#94a3b8' }} 
                  />
                  <span>{s.name}</span>
                </div>
                <span className="font-mono font-semibold text-[#f8fafc]">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
