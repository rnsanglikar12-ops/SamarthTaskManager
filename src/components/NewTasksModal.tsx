import React from 'react';
import { ActionItem } from '../types';
import { Bell, X, ChevronRight } from 'lucide-react';

interface NewTasksModalProps {
  tasks: ActionItem[];
  displayName: string;
  onOpenTask: (task: ActionItem) => void;
  onViewAll: () => void;
  onClose: () => void;
}

const MAX_LISTED = 8;

const PRIORITY_STYLE: Record<string, string> = {
  A: 'bg-red-100 text-red-700 border-red-200',
  B: 'bg-amber-100 text-amber-800 border-amber-200',
  C: 'bg-slate-100 text-slate-600 border-slate-200'
};

export const NewTasksModal: React.FC<NewTasksModalProps> = ({
  tasks,
  displayName,
  onOpenTask,
  onViewAll,
  onClose
}) => {
  const listed = tasks.slice(0, MAX_LISTED);
  const hidden = tasks.length - listed.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 leading-tight">
                {tasks.length} new {tasks.length === 1 ? 'task' : 'tasks'} for you
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Welcome back, {displayName}. These arrived since you last opened Samarth.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {listed.map(task => (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => onOpenTask(task)}
                className="w-full text-left px-5 py-3 hover:bg-slate-50 flex items-start gap-3"
              >
                <span
                  className={`mt-0.5 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.C}`}
                >
                  {task.priority}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold text-slate-900 line-clamp-2">{task.desc}</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    {task.id} · {task.dept} · {task.owner} · Due {task.deadline}
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />
              </button>
            </li>
          ))}
          {hidden > 0 && (
            <li className="px-5 py-3 text-[11px] text-slate-500">+ {hidden} more in the Master Matrix</li>
          )}
        </ul>

        <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={onViewAll}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#1d64ec] hover:bg-blue-700 rounded-xl"
          >
            View in Master Matrix
          </button>
        </div>
      </div>
    </div>
  );
};
