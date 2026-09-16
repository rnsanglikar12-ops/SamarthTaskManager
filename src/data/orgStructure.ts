import { DepartmentStructure } from '../types';

export const SAMARTH_ORG_STRUCTURE: DepartmentStructure[] = [
  {
    srNo: 1,
    deptName: 'MD',
    deptHead: 'Sangram J.',
    supervisors: []
  },
  {
    srNo: 2,
    deptName: 'Plant Head',
    deptHead: 'Awari B.',
    supervisors: []
  },
  {
    srNo: 3,
    deptName: 'PDC',
    deptHead: 'Shrirang C.',
    supervisors: ['Khandu K', 'Jayprakash P', 'Kisan G', 'Rakshe R', 'Jagtap N', 'Harish P']
  },
  {
    srNo: 4,
    deptName: 'Die Maint',
    deptHead: 'Shrirang C.',
    supervisors: ['Subrata G']
  },
  {
    srNo: 5,
    deptName: 'SPM',
    deptHead: 'Shrirang C.',
    supervisors: []
  },
  {
    srNo: 6,
    deptName: 'Fettling',
    deptHead: 'Shrirang C.',
    supervisors: ['Santosh P']
  },
  {
    srNo: 7,
    deptName: 'Machine shop-01',
    deptHead: 'Ibrahim S',
    supervisors: []
  },
  {
    srNo: 8,
    deptName: 'Machine shop-02',
    deptHead: 'Sunil G',
    supervisors: []
  },
  {
    srNo: 9,
    deptName: 'PPC',
    deptHead: 'Shaikh R',
    supervisors: ['Ashok K', 'Vaibhav W.']
  },
  {
    srNo: 10,
    deptName: 'Store',
    deptHead: 'Dipak G',
    supervisors: []
  },
  {
    srNo: 11,
    deptName: 'MC Maint',
    deptHead: 'Mohite R',
    supervisors: []
  },
  {
    srNo: 12,
    deptName: 'Quality',
    deptHead: 'Shailesh T',
    supervisors: []
  },
  {
    srNo: 13,
    deptName: 'NPD',
    deptHead: 'Nawale R',
    supervisors: []
  },
  {
    srNo: 14,
    deptName: 'Tool Room',
    deptHead: 'Nawale R',
    supervisors: ['Yogesh J']
  },
  {
    srNo: 15,
    deptName: 'HR',
    deptHead: 'Poonam S',
    supervisors: []
  },
  {
    srNo: 16,
    deptName: 'Account',
    deptHead: 'Shinde S',
    supervisors: []
  },
  {
    srNo: 17,
    deptName: 'Purchase',
    deptHead: 'Pankaj B',
    supervisors: []
  }
];

export const MENTOR_NAME = 'Mr. Sanglikar (Mentor)';

// Departments that can be a task's "Responsible Department" (MD is plant-wide
// oversight and does not execute tasks itself).
export const TASK_DEPARTMENTS = SAMARTH_ORG_STRUCTURE
  .filter((d) => d.deptName !== 'MD')
  .map((d) => d.deptName);

// Every department gets a placeholder assignee so a task can always be
// created for a department even when the specific responsible person isn't
// known yet (e.g. a DeptHead raising a CFT handshake task to another dept).
export function getDefaultAssignee(deptName: string): string {
  return `${deptName} Default`;
}

// Assignees scoped to a single department: the default placeholder first
// (so it's the natural pre-selected choice), then the dept head and
// supervisors. Falls back to just the placeholder for unknown departments.
export function getAssigneesForDept(deptName: string): string[] {
  const entry = SAMARTH_ORG_STRUCTURE.find((d) => d.deptName === deptName);
  const names = entry ? [entry.deptHead, ...entry.supervisors] : [];
  return [getDefaultAssignee(deptName), ...Array.from(new Set(names.filter(Boolean)))];
}

// Full plant-wide assignee list (every department's default placeholder +
// dept head + supervisors), deduped — used for the global "Assignee" filter.
export const ALL_ASSIGNEES: string[] = Array.from(
  new Set(TASK_DEPARTMENTS.flatMap((dept) => getAssigneesForDept(dept)))
);

// Unions the static org-structure assignees for a department with
// dynamically-added supervisors (see SupervisorManagementModal) for that
// same department, deduped. Dynamic supervisors are fetched at runtime, so
// callers pass in whatever they currently have loaded.
export function combineAssigneesForDept(deptName: string, dynamicSupervisors: { name: string; dept: string }[]): string[] {
  const dynamicNames = dynamicSupervisors.filter((s) => s.dept === deptName).map((s) => s.name);
  return Array.from(new Set([...getAssigneesForDept(deptName), ...dynamicNames]));
}

// Plant-wide equivalent of combineAssigneesForDept, for the global Assignee filter.
export function combineAllAssignees(dynamicSupervisors: { name: string; dept: string }[]): string[] {
  return Array.from(new Set([...ALL_ASSIGNEES, ...dynamicSupervisors.map((s) => s.name)]));
}
