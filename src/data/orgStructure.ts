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
