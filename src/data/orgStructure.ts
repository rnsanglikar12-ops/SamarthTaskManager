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
    supervisors: ['Kamble K.', 'Pande J.', 'Jagtap', 'Harish P', 'Kisan G']
  },
  {
    srNo: 4,
    deptName: 'Die Maint',
    deptHead: 'Shrirang C.',
    supervisors: ['Subrata G', 'Rakshe R.']
  },
  {
    srNo: 5,
    deptName: 'SPM',
    deptHead: 'Shrirang C.',
    supervisors: ['Madan G', 'Rakesh']
  },
  {
    srNo: 6,
    deptName: 'Fettling',
    deptHead: 'Shrirang C.',
    supervisors: ['Santosh P', 'Dey S', 'Ram Y']
  },
  {
    srNo: 7,
    deptName: 'Machine shop-01',
    deptHead: 'Ibrahim S',
    supervisors: ['Hanumant H', 'Situn', 'Dilip R']
  },
  {
    srNo: 8,
    deptName: 'Machine shop-02',
    deptHead: 'Sunil G',
    supervisors: ['Kiran', 'Dilip P', 'Shivashankar']
  },
  {
    srNo: 9,
    deptName: 'PPC',
    deptHead: 'Ratan S',
    supervisors: ['Vaibhav W.', 'Ashok K', 'Purushottam P', 'Masud K']
  },
  {
    srNo: 10,
    deptName: 'Store',
    deptHead: 'Dipak G',
    supervisors: ['Alok']
  },
  {
    srNo: 11,
    deptName: 'MC Maint',
    deptHead: 'Mohite R',
    supervisors: ['Rupesh D']
  },
  {
    srNo: 12,
    deptName: 'Quality',
    deptHead: 'Shailesh T',
    supervisors: ['Vyanket', 'Dipak D']
  },
  {
    srNo: 13,
    deptName: 'NPD',
    deptHead: 'Ravindra N',
    supervisors: ['Nayan P']
  },
  {
    srNo: 14,
    deptName: 'Tool Room',
    deptHead: 'Ravindra N',
    supervisors: ['Yogesh J', 'Pratyay']
  },
  {
    srNo: 15,
    deptName: 'HR',
    deptHead: 'Poonam S',
    supervisors: ['Trivenee']
  },
  {
    srNo: 16,
    deptName: 'Account',
    deptHead: 'Sushant D',
    supervisors: ['Siddharth']
  },
  {
    srNo: 17,
    deptName: 'Purchase',
    deptHead: 'Pankaj B',
    supervisors: ['Govind']
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
