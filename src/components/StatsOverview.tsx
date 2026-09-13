import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Activity, 
  Sparkles, 
  Flame, 
  ArrowUpRight
} from 'lucide-react';
import { SentinelStats } from '../types';

interface StatsOverviewProps {
  stats: SentinelStats;
  onFilterClick?: (filterType: string, value: any) => void;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats, onFilterClick }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-6">
      {/* Total Actions Card */}
      <div 
        id="stat-card-total"
        onClick={() => onFilterClick && onFilterClick('clear', null)}
        className="bg-[#1e293b] rounded-xl p-4 border border-[#334155] shadow-md hover:border-[#38bdf8] hover:shadow-sky-500/10 transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between text-[#94a3b8] mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">Total Items</span>
          <Activity className="w-4 h-4 text-[#38bdf8] group-hover:scale-110 transition-transform" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl sm:text-3xl font-extrabold font-heading text-[#38bdf8]">{stats.totalActions}</span>
          <span className="text-[11px] font-medium text-[#94a3b8] font-mono">100%</span>
        </div>
        <div className="mt-2 text-[11px] text-[#94a3b8] flex items-center justify-between">
          <span>Action Register</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-[#38bdf8] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Completed & Resolution */}
      <div 
        id="stat-card-completed"
        onClick={() => onFilterClick && onFilterClick('status', 'Completed')}
        className="bg-[#1e293b] rounded-xl p-4 border border-[#334155] shadow-md hover:border-[#22c55e] hover:shadow-emerald-500/10 transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between text-[#22c55e] mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">Resolved</span>
          <CheckCircle2 className="w-4 h-4 text-[#22c55e] group-hover:scale-110 transition-transform" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl sm:text-3xl font-extrabold font-heading text-[#22c55e]">{stats.completed}</span>
          <span className="text-[11px] font-bold text-[#22c55e] font-mono">{stats.complianceRate}%</span>
        </div>
        <div className="w-full bg-[#0f172a] h-1.5 rounded-full mt-2.5 overflow-hidden border border-[#334155]/60">
          <div 
            className="bg-[#22c55e] h-full rounded-full transition-all duration-500 shadow-sm shadow-emerald-400/30" 
            style={{ width: `${stats.complianceRate}%` }}
          />
        </div>
      </div>

      {/* Priority A Critical */}
      <div 
        id="stat-card-priority-a"
        onClick={() => onFilterClick && onFilterClick('priority', 'A')}
        className="bg-[#1e293b] rounded-xl p-4 border border-[#334155] shadow-md hover:border-[#ef4444] hover:shadow-rose-500/10 transition-all cursor-pointer group relative overflow-hidden"
      >
        <div className="flex items-center justify-between text-[#ef4444] mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">Priority A</span>
          <Flame className="w-4 h-4 text-[#ef4444] group-hover:scale-110 transition-transform" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl sm:text-3xl font-extrabold font-heading text-[#ef4444]">{stats.criticalPriorityA}</span>
          <span className="text-[11px] font-bold text-[#ef4444] font-mono">Critical</span>
        </div>
        <div className="mt-2 text-[11px] text-[#94a3b8] flex items-center justify-between">
          <span className="text-rose-300 font-medium">High Urgency CAPA</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-[#ef4444] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* In Process / In Verification */}
      <div 
        id="stat-card-in-process"
        onClick={() => onFilterClick && onFilterClick('status', 'In process')}
        className="bg-[#1e293b] rounded-xl p-4 border border-[#334155] shadow-md hover:border-[#f59e0b] hover:shadow-amber-500/10 transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between text-[#f59e0b] mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">In Progress</span>
          <Clock className="w-4 h-4 text-[#f59e0b] group-hover:scale-110 transition-transform" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl sm:text-3xl font-extrabold font-heading text-[#f59e0b]">{stats.inProcess + stats.underVerification}</span>
          <span className="text-[11px] font-medium text-[#94a3b8] font-mono">Active</span>
        </div>
        <div className="mt-2 text-[11px] text-[#94a3b8] flex items-center justify-between">
          <span>{stats.underVerification} Under Review</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-[#f59e0b] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Pending / Backlog */}
      <div 
        id="stat-card-pending"
        onClick={() => onFilterClick && onFilterClick('status', 'Pending')}
        className="bg-[#1e293b] rounded-xl p-4 border border-[#334155] shadow-md hover:border-slate-500 hover:shadow-slate-500/10 transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between text-[#94a3b8] mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">Pending</span>
          <AlertTriangle className="w-4 h-4 text-slate-400 group-hover:scale-110 transition-transform" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl sm:text-3xl font-extrabold font-heading text-slate-200">{stats.pending}</span>
          <span className="text-[11px] font-medium text-[#94a3b8] font-mono">Open</span>
        </div>
        <div className="mt-2 text-[11px] text-[#94a3b8] flex items-center justify-between">
          <span>Awaiting Action</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* DSI Kaizens */}
      <div 
        id="stat-card-kaizen"
        onClick={() => onFilterClick && onFilterClick('kaizen', true)}
        className="bg-[#1e293b] rounded-xl p-4 border border-[#334155] shadow-md hover:border-[#f59e0b] hover:shadow-amber-500/10 transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between text-[#f59e0b] mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">DSI Kaizens</span>
          <Sparkles className="w-4 h-4 text-[#f59e0b] group-hover:scale-110 transition-transform" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl sm:text-3xl font-extrabold font-heading text-[#f59e0b]">{stats.kaizenCount}</span>
          <span className="text-[11px] font-bold text-[#f59e0b] font-mono">Verified</span>
        </div>
        <div className="mt-2 text-[11px] text-[#94a3b8] flex items-center justify-between">
          <span className="text-amber-300 font-medium">Kaizen Benefits</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-[#f59e0b] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </div>
  );
};
