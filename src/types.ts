export type Priority = 'A' | 'B';
export type Recurrence = 'One-Time' | 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly';
export type ActionStatus = 'Pending' | 'In process' | 'Completed' | 'Under Verification' | 'Hold';

export interface ActionItem {
  // Legacy tasks have plain numeric-looking IDs (e.g. "1052"); new tasks are
  // assigned a department-prefixed ID server-side (e.g. "PDC-47").
  id: string;
  priority: Priority;
  recurrence: Recurrence;
  dept: string;
  desc: string;
  owner: string;
  deadline: string;
  evidence: string;
  status: ActionStatus;
  actionNotes: string;
  attachedPhoto?: string;
  timestamp: string;
  // ISO time of the last update, only set while status is Completed — the
  // closest thing to a close date (no dedicated column exists).
  closedAt?: string;
  originatorDept: string;
  afterPhoto?: string;
  isKaizen?: boolean;
  kaizenBenefit?: string;
  isBroadcast?: boolean;
  category?: string;
  isMOM?: boolean;
  isCFT?: boolean;
  machineNote?: string;
}

export interface DepartmentStructure {
  srNo: number;
  deptName: string;
  deptHead: string;
  supervisors: string[];
}

export interface FilterState {
  search: string;
  dept: string;
  priority: string;
  status: string;
  owner: string;
  recurrence: string;
  originator: string;
  onlyKaizen: boolean;
  onlyOverdue: boolean;
  onlyBroadcast: boolean;
}

export interface OperationalStats {
  totalActions: number;
  completed: number;
  inProcess: number;
  pending: number;
  underVerification: number;
  onHold: number;
  criticalPriorityA: number;
  standardPriorityB: number;
  overdueCount: number;
  complianceRate: number;
  kaizenCount: number;
}

export type SentinelStats = OperationalStats;
